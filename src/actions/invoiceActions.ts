
'use server';

import { z } from 'zod';
import { auth, db, app as firebaseApp } from '@/lib/firebase'; // Import app for logging
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
    console.error("[saveInvoice Action] Firebase auth object is not initialized from firebase.ts. This is unexpected.");
    return { success: false, error: "Firebase auth service is not configured. Please contact support." };
  }
  if (!firebaseApp) { // firebaseApp is imported from @/lib/firebase
    console.error("[saveInvoice Action] Firebase app object is not initialized from firebase.ts. This is unexpected.");
     return { success: false, error: "Firebase app service is not configured. Please contact support." };
  }

  console.log(`[saveInvoice Action] Using Firebase app: ${firebaseApp.name}`);

  try {
    console.log("[saveInvoice Action] Waiting for auth.authStateReady()...");
    await auth.authStateReady();
    console.log("[saveInvoice Action] auth.authStateReady() resolved successfully.");
  } catch (e: any) { 
    console.error("[saveInvoice Action] Error during auth.authStateReady():", e.message, e.stack);
  }
  
  const currentUser: User | null = auth.currentUser;
  
  if (currentUser) {
    console.log(`[saveInvoice Action] auth.currentUser successfully retrieved: UID ${currentUser.uid}, Email: ${currentUser.email}`);
  } else {
    console.error("[saveInvoice Action] auth.currentUser is null AFTER authStateReady() resolved. This indicates the server-side SDK instance is not picking up the authenticated session.");
    // Attempt to get more diagnostic info from the auth object if currentUser is null
    if (auth) {
        try {
            // This part is speculative if currentUser is already null, but for diagnostics:
            const freshCurrentUser = auth.currentUser; 
            if (freshCurrentUser) {
                 const idTokenResult = await freshCurrentUser.getIdTokenResult(true); // Force refresh
                 console.log('[saveInvoice Action] Attempted getIdTokenResult on potentially fresh currentUser:', idTokenResult ? 'has result' : 'no result for fresh user');
            } else {
                 console.log('[saveInvoice Action] auth.currentUser is still null, cannot call getIdTokenResult.');
            }
        } catch (tokenError: any) {
            console.error('[saveInvoice Action] Error trying to getIdTokenResult (or accessing currentUser for it):', tokenError.message);
        }
    }
    return { success: false, error: "User not authenticated. Please ensure you are logged in and try again. (Server Context Check)" };
  }

  const validation = saveInvoiceSchema.safeParse(invoiceData);
  if(!validation.success) {
    console.warn("[saveInvoice Action] Invoice data validation failed:", validation.error.errors);
    return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
  }

  try {
    const docRef = await addDoc(collection(db, 'invoices'), {
      ...invoiceData,
      userId: currentUser.uid, 
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log("[saveInvoice Action] Invoice saved successfully with ID:", docRef.id);
    return { success: true, invoiceId: docRef.id };
  } catch (error: any) {
    console.error("[saveInvoice Action] Error saving invoice to Firestore:", error);
    return { success: false, error: error.message || "Failed to save invoice to database." };
  }
}

