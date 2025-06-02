
'use server';

import { z } from 'zod';
import { auth, db } from '@/lib/firebase';
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
    console.error("[saveInvoice Action] Firebase auth object is not initialized. Check firebase.ts initialization.");
    return { success: false, error: "Firebase auth service is not available. Please try again later or contact support." };
  }

  try {
    // Wait for Firebase to load the authentication state.
    await auth.authStateReady();
    console.log("[saveInvoice Action] auth.authStateReady() resolved.");
  } catch (e) {
    console.error("[saveInvoice Action] Error during auth.authStateReady():", e);
    // Proceed, the currentUser check below will handle if auth state is still not available.
  }
  
  const currentUser: User | null = auth.currentUser;
  console.log("[saveInvoice Action] auth.currentUser after authStateReady:", currentUser ? currentUser.uid : 'null');

  if (!currentUser) {
    console.error("[saveInvoice Action] User not authenticated after waiting for auth state. currentUser is null.");
    return { success: false, error: "User not authenticated. Please ensure you are logged in and try again." };
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

