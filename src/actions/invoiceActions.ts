
'use server';

import type { User } from 'firebase/auth';
import { z } from 'zod';
import { getAuth as getFirebaseAuth } from 'firebase/auth';
import { app as firebaseAppInstance, db } from '@/lib/firebase'; 
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { extractInvoiceData, ExtractInvoiceDataInput, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import { validateExtractedData, ValidateExtractedDataInput, ValidateExtractedDataOutput } from '@/ai/flows/validate-extracted-data';
import type { Invoice, InvoiceItem } from '@/lib/types';

const globalAuth = firebaseAppInstance ? getFirebaseAuth(firebaseAppInstance) : null;


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
        // Even if some new fields are missing, proceed with validation for core fields.
        // The form will handle missing optional fields.
        let errorMsg = "AI could not extract all required core fields (Date, Amount, Vendor). ";
        if (extractedData && (!extractedData.date || extractedData.amount == null || !extractedData.vendor)) {
             errorMsg += `Missing: ${!extractedData.date ? 'Date, ' : ''}${extractedData.amount == null ? 'Amount, ' : ''}${!extractedData.vendor ? 'Vendor' : ''}`.slice(0, -2);
        } else {
            errorMsg += "Please check the image or try again.";
        }
        // We still return extractedData so user can see what was extracted
        return { extractedData, validationResult: null, error: errorMsg };
    }
    
    const validationInput: ValidateExtractedDataInput = {
      date: extractedData.date, // These are asserted as non-null by the check above
      amount: extractedData.amount,
      vendor: extractedData.vendor,
    };
    const validationResult = await validateExtractedData(validationInput);
    
    return { extractedData, validationResult };

  } catch (error: any) {
    console.error("[processInvoiceUpload] Error processing invoice:", error);
    return { extractedData: null, validationResult: null, error: error.message || "An unexpected error occurred during AI processing." };
  }
}

const invoiceItemSchemaForSave = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  totalPrice: z.number(),
});

const saveInvoiceSchema = z.object({
  date: z.string(),
  amount: z.number(),
  vendor: z.string().min(1, "Vendor name is required"),
  invoiceNumber: z.string().nullish(),
  taxAmount: z.number().nullish(),
  items: z.array(invoiceItemSchemaForSave).nullish(),
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
  userId: string
): Promise<{ success: boolean; invoiceId?: string; error?: string }> {
  
  console.log("[saveInvoice Action] Initiated for userId:", userId, "with data:", invoiceData);

  if (!userId) {
    console.error("[saveInvoice Action] Critical: userId parameter is missing or empty.");
    return { success: false, error: "User ID is missing. Cannot save invoice. (SA-NoUIDParam)" };
  }

  if (!db) {
    const dbInitErrorMsg = "[saveInvoice Action] Firebase db object (from @/lib/firebase) is not available. Critical initialization issue.";
    console.error(dbInitErrorMsg);
    return { success: false, error: "Firebase database service is not configured. Please contact support. (SA-DBObj)" };
  }
  
  const validation = saveInvoiceSchema.safeParse(invoiceData);
  if(!validation.success) {
    console.warn("[saveInvoice Action] Invoice data validation failed:", validation.error.format());
    return { success: false, error: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') };
  }

  try {
    console.log(`[saveInvoice Action] Attempting to save validated invoice for user: ${userId}`);
    const docRef = await addDoc(collection(db, 'invoices'), {
      ...invoiceData,
      userId: userId, 
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

