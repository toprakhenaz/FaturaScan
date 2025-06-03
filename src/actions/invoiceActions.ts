
'use server';

import { z } from 'zod';
import { db } from '@/lib/firebase'; // Removed auth, app as they are not directly used here for auth check
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { extractInvoiceData, ExtractInvoiceDataInput, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import { validateExtractedData, ValidateExtractedDataInput, ValidateExtractedDataOutput } from '@/ai/flows/validate-extracted-data';
import type { Invoice } from '@/lib/types';
// User type from firebase/auth is not needed if we pass userId

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


export async function saveInvoice(
  invoiceData: Omit<Invoice, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  userId: string // Added userId as a parameter
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  
  console.log("[saveInvoice Action] Initiated for userId:", userId);

  if (!userId) {
    console.error("[saveInvoice Action] userId parameter is missing or empty.");
    return { success: false, error: "User ID is missing. Cannot save invoice." };
  }

  if (!db) {
    const dbInitErrorMsg = "[saveInvoice Action] Firebase db object (from @/lib/firebase) is not available. Critical initialization issue.";
    console.error(dbInitErrorMsg);
    return { success: false, error: "Firebase database service is not configured. Please contact support. (SA-DBObj)" };
  }
  
  const validation = saveInvoiceSchema.safeParse(invoiceData);
  if(!validation.success) {
    console.warn("[saveInvoice Action] Invoice data validation failed:", validation.error.errors);
    return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
  }

  try {
    console.log(`[saveInvoice Action] Attempting to save invoice for user: ${userId}`);
    const docRef = await addDoc(collection(db, 'invoices'), {
      ...invoiceData,
      userId: userId, // Use the passed userId
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
