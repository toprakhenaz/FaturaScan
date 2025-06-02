
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
  
  console.log("[saveInvoice Action] Called.");

  if (!auth) {
    console.error("[saveInvoice Action] Firebase auth object (from @/lib/firebase) is not available. This is a critical initialization issue.");
    return { success: false, error: "Firebase auth service is not configured. Please contact support. (Auth Object Check)" };
  }
  if (!firebaseAppInstance) {
    console.error("[saveInvoice Action] Firebase app instance (from @/lib/firebase) is not available. This could indicate an initialization problem.");
    // Not returning immediately, as auth might still function if initialized, but it's a warning sign.
  } else {
    console.log(`[saveInvoice Action] Using Firebase app instance from @/lib/firebase: ${firebaseAppInstance.name}`);
  }

  try {
    console.log("[saveInvoice Action] Attempting to wait for auth.authStateReady()...");
    await auth.authStateReady();
    console.log("[saveInvoice Action] auth.authStateReady() promise resolved.");
  } catch (e: any) { 
    console.error("[saveInvoice Action] Error during auth.authStateReady() call:", e.message, e.stack);
    // Potentially return error here if authStateReady itself fails critically
    // return { success: false, error: "Authentication state could not be determined." };
  }
  
  // Crucial check:
  const currentUser: User | null = auth.currentUser;
  
  if (currentUser) {
    console.log(`[saveInvoice Action] auth.currentUser successfully retrieved: UID ${currentUser.uid}, Email: ${currentUser.email}`);
  } else {
    console.error("[saveInvoice Action] auth.currentUser is NULL after authStateReady() resolved. This usually means the server action's auth context isn't picking up the client session. Check for browser extensions (ad blockers, privacy tools) that might block Firebase communication (ERR_BLOCKED_BY_CLIENT), or other session-related issues.");
    return { success: false, error: "User not authenticated. Please ensure you are logged in and try again. (Server Context Check Failed)" };
  }

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
