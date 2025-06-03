
'use server';

import { z } from 'zod';
import { auth, db, app as firebaseAppInstance } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { extractInvoiceData, ExtractInvoiceDataInput, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import { validateExtractedData, ValidateExtractedDataInput, ValidateExtractedDataOutput } from '@/ai/flows/validate-extracted-data';
import type { Invoice } from '@/lib/types';
import type { User } from 'firebase/auth';

const processInvoiceSchema = z.object({
  photoDataUri: z.string().startsWith('data:image/', { message: "Invalid image data URI" }),
});

export async function processInvoiceUpload(formData: FormData): Promise<{
  extractedData: ExtractInvoiceDataOutput | null;
  validationResult: ValidateExtractedDataOutput | null;
  error?: string;
}> {
  const photoDataUri = formData.get('photoDataUri') as string;

  const validation = processInvoiceSchema.safeParse({ photoDataUri });
  if (!validation.success) {
    return { extractedData: null, validationResult: null, error: validation.error.errors.map(e => e.message).join(', ') };
  }

  try {
    const extractionInput: ExtractInvoiceDataInput = { photoDataUri };
    const extractedData = await extractInvoiceData(extractionInput);

    if (!extractedData || !extractedData.date || extractedData.amount == null || !extractedData.vendor) {
        return { extractedData, validationResult: null, error: "AI could not extract all required fields. Please check the image or try again." };
    }
    
    const validationInput: ValidateExtractedDataInput = {
      date: extractedData.date,
      amount: extractedData.amount,
      vendor: extractedData.vendor,
    };
    const validationResult = await validateExtractedData(validationInput);
    
    return { extractedData, validationResult };

  } catch (error: any) {
    console.error("Error processing invoice:", error);
    return { extractedData: null, validationResult: null, error: error.message || "An unexpected error occurred during AI processing." };
  }
}


const saveInvoiceSchema = z.object({
  date: z.string(),
  amount: z.number(),
  vendor: z.string().min(1, "Vendor name is required"),
  category: z.enum(['gelir', 'gider']),
  validationSummary: z.string(),
  isDateValid: z.boolean(),
  isAmountValid: z.boolean(),
  isVendorValid: z.boolean(),
  isSuspicious: z.boolean(),
  suspiciousReasons: z.array(z.string()),
  imageFileName: z.string().optional(),
});


export async function saveInvoice(invoiceData: Omit<Invoice, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  
  console.log("[saveInvoice Action] Initiated.");

  if (!auth) {
    const authInitErrorMsg = "[saveInvoice Action] Firebase auth object (from @/lib/firebase) is not available. Critical initialization issue.";
    console.error(authInitErrorMsg);
    return { success: false, error: "Firebase auth service is not configured. Please contact support. (SA-AuthObj)" };
  }
  if (!firebaseAppInstance) {
    console.warn("[saveInvoice Action] Firebase app instance (from @/lib/firebase) is not available. Potential initialization problem.");
  } else {
    console.log(`[saveInvoice Action] Using Firebase app instance: ${firebaseAppInstance.name}, Auth instance app name: ${auth.app.name}`);
  }

  try {
    console.log("[saveInvoice Action] Waiting for auth.authStateReady()...");
    await auth.authStateReady();
    console.log("[saveInvoice Action] auth.authStateReady() resolved.");
  } catch (e: any) { 
    console.error("[saveInvoice Action] Error during auth.authStateReady():", e.message);
    // Not returning immediately, will check currentUser next.
  }
  
  const currentUser: User | null = auth.currentUser;
  
  if (!currentUser) {
    console.error("[saveInvoice Action] auth.currentUser is NULL. This means the server action could not identify an authenticated user session. This can be due to client-side request blocking (e.g., browser extensions), issues with session propagation to server actions, or the user not being logged in properly on the client.");
    return { success: false, error: "User not authenticated by server. Please ensure you are logged in and try again. If issues persist, try an incognito window or check browser extensions. (SA-NoUser)" };
  }
  
  console.log(`[saveInvoice Action] User identified: UID ${currentUser.uid}, Email: ${currentUser.email}`);

  const validation = saveInvoiceSchema.safeParse(invoiceData);
  if(!validation.success) {
    console.warn("[saveInvoice Action] Invoice data validation failed:", validation.error.errors);
    return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
  }

  try {
    console.log(`[saveInvoice Action] Attempting to save invoice for user: ${currentUser.uid}`);
    const docRef = await addDoc(collection(db, 'invoices'), {
      ...invoiceData,
      userId: currentUser.uid, 
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log("[saveInvoice Action] Invoice saved successfully with ID:", docRef.id);
    return { success: true, invoiceId: docRef.id };
  } catch (error: any) {
    console.error("[saveInvoice Action] Error saving invoice to Firestore:", error.message, error.stack);
    return { success: false, error: error.message || "Failed to save invoice to database." };
  }
}

