'use server';

import { z } from 'zod';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { extractInvoiceData, ExtractInvoiceDataInput, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import { validateExtractedData, ValidateExtractedDataInput, ValidateExtractedDataOutput } from '@/ai/flows/validate-extracted-data';
import type { Invoice, InvoiceFormData } from '@/lib/types';

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
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { success: false, error: "User not authenticated." };
  }

  const validation = saveInvoiceSchema.safeParse(invoiceData);
  if(!validation.success) {
    return { success: false, error: validation.error.errors.map(e => e.message).join(', ') };
  }

  try {
    const docRef = await addDoc(collection(db, 'invoices'), {
      ...invoiceData,
      userId: currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true, invoiceId: docRef.id };
  } catch (error: any) {
    console.error("Error saving invoice:", error);
    return { success: false, error: error.message || "Failed to save invoice." };
  }
}
