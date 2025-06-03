
'use server';

/**
 * @fileOverview This flow extracts key information from scanned invoices and receipts using AI.
 *
 * - extractInvoiceData - A function that handles the invoice data extraction process.
 * - ExtractInvoiceDataInput - The input type for the extractInvoiceData function.
 * - ExtractInvoiceDataOutput - The return type for the extractInvoiceData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractInvoiceDataInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      'A photo of the invoice or receipt, as a data URI that must include a MIME type and use Base64 encoding. Expected format: \'data:<mimetype>;base64,<encoded_data>\'.'  
    ),
});
export type ExtractInvoiceDataInput = z.infer<typeof ExtractInvoiceDataInputSchema>;

const InvoiceItemSchema = z.object({
  description: z.string().optional().describe('Description of the item or service. May be empty if not found.'),
  quantity: z.number().optional().describe('Quantity of the item. Default to 1 if not specified or found.'),
  unitPrice: z.number().optional().describe('Price per unit of the item. May be empty if not found. If quantity is 1, this might be same as totalPrice.'),
  totalPrice: z.number().optional().describe('Total price for this line item. May be empty if not found. For receipts, this is often the listed price for the item, potentially including tax.'),
});
export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;

const ExtractInvoiceDataOutputSchema = z.object({
  date: z.string().optional().describe('The date on the invoice or receipt (YYYY-MM-DD format). If not found or format is different (e.g., DD.MM.YYYY), try to convert. Example: "23.02.2024" should be "2024-02-23". "3 Temmuz 2030" should be "2030-07-03".'),
  amount: z.number().optional().describe('The grand total amount on the invoice or receipt. Look for labels like "TOPLAM", "GENEL TOPLAM", "ÖDENECEK TUTAR", "FATURA TOPLAMI". This is often at the bottom. If not found, leave empty.'),
  vendor: z.string().optional().describe('The name of the vendor (company issuing the invoice, e.g., "KAYALI ŞİRKETLER GRUBU", "BİM BİRLEŞİK MAĞAZALAR A.Ş.", "Firma Adı", "Şirket Adı"). If not found, leave empty.'),
  invoiceNumber: z.string().optional().describe('The invoice number. Look for "Fatura No", "FATURA NO". Sometimes there might be other numbers like "NO:", "Fiş No:", or "ETTN"; prioritize "FATURA NO". If not found, leave empty.'),
  taxAmount: z.number().optional().describe('The total tax amount. Look for labels like "TOPKDV", "KDV TOPLAMI", "Toplam Vergi". If an explicit total tax amount is listed, use that. If only a percentage and subtotal are given, calculate it. If not found or not applicable, leave empty.'),
  items: z.array(InvoiceItemSchema).optional().describe('Line items from the invoice or receipt. Each item should include description, quantity, unitPrice, and totalPrice if available. For retail receipts: quantity is often 1 if not specified. Values like "%20" next to an item are likely VAT percentages or discount codes, not quantities. The price listed for an item on a receipt is often the total price for that line item, potentially including tax (extract as totalPrice). If not found or not applicable, leave empty array.'),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInvoiceDataPrompt',
  input: {schema: ExtractInvoiceDataInputSchema},
  output: {schema: ExtractInvoiceDataOutputSchema},
  prompt: `You are an expert accounting assistant specializing in extracting information from Turkish invoices, receipts, and "Bilgi Fişi" (information slips) like the ones from BİM.
  Your task is to meticulously extract key information from the provided scanned image. Prioritize accuracy. If a field is ambiguous or not present, it's better to omit it or leave it empty/null than to guess incorrectly.

  Please extract the following information:
  - Vendor (Satıcı Adı/Firma Adı): Identify the company or entity that issued the document (e.g., "KAYALI ŞİRKETLER GRUBU", "BİM BİRLEŞİK MAĞAZALAR A.Ş."). This is often found at the top.
  - Date (Tarih/Düzenlenme Tarihi): The date the document was issued. Convert common Turkish formats like DD.MM.YYYY or "Gün Ay Yıl" (e.g., "3 Temmuz 2030") to YYYY-MM-DD format. For example, "23.02.2024" should become "2024-02-23". If not found, omit.
  - Amount (Toplam Tutar/Genel Toplam): The grand total amount due. Look for labels like "TOPLAM", "GENEL TOPLAM", "ÖDENECEK TUTAR", "FATURA TOPLAMI". It's often at the bottom or near payment details. Extract the numeric value. If not found, omit.
  - Invoice Number (Fatura No): The unique identification number. Look for "Fatura No" or "FATURA NO" explicitly. If there are multiple numbers like a simple "NO:", "Fiş No:", or "ETTN", prioritize the one labeled "FATURA NO". If not found, omit.
  - Tax Amount (Toplam Vergi Tutarı/KDV Tutarı): The total amount of tax. Look for labels like "TOPKDV", "KDV TOPLAMI", "Toplam Vergi". 
    If only a percentage and a subtotal are provided, calculate the tax amount.
    If there's a discrepancy between a listed tax amount and a calculated one, prefer the explicitly listed tax amount. If no tax information is found, omit.
  - Items (Kalemler/Ürünler): A list of line items. For each item, extract:
    - description (AÇIKLAMA): The description of the product or service.
    - quantity (MİKTAR): The quantity of the item. For retail receipts or single-item entries, if quantity is not explicitly stated, assume 1. A percentage like "%20" next to an item is likely a VAT rate or discount, NOT quantity.
    - unitPrice (BİRİM FİYATI): The price per unit. If quantity is 1, this may be the same as totalPrice. If not clearly identifiable, it can be omitted.
    - totalPrice (TOPLAM TUTAR): The total price for that line item. For retail receipts, the listed price for an item is often this total price (potentially KDV dahil/including VAT).
    If line items are not clearly identifiable or not applicable, return an empty array for items.

  Here is the scanned image:
  {{media url=photoDataUri}}

  Return the extracted information in JSON format according to the defined output schema. Ensure all monetary values are numbers, not strings with currency symbols (e.g., "4,499.00 TL" should be 4499.00).
  For core fields like Date, Amount (grand total), and Vendor: if they are absolutely unidentifiable from the image, you can omit them, but try your best to find them.
  `,
});

const extractInvoiceDataFlow = ai.defineFlow(
  {
    name: 'extractInvoiceDataFlow',
    inputSchema: ExtractInvoiceDataInputSchema,
    outputSchema: ExtractInvoiceDataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    
    // Ensure default values for items if undefined, and ensure items are valid
    // Also, if quantity is missing for an item, default it to 1
    const items = output?.items?.map(item => ({
        description: item.description || undefined, 
        quantity: item.quantity === null || item.quantity === undefined ? 1 : Number(item.quantity), // Default to 1 if not present
        unitPrice: item.unitPrice === null || item.unitPrice === undefined ? undefined : Number(item.unitPrice),
        totalPrice: item.totalPrice === null || item.totalPrice === undefined ? undefined : Number(item.totalPrice),
    })).filter(item => item.description || item.totalPrice) || [];

    return {
        date: output?.date || undefined,
        amount: output?.amount === null || output?.amount === undefined ? undefined : Number(output.amount),
        vendor: output?.vendor || undefined,
        invoiceNumber: output?.invoiceNumber || undefined,
        taxAmount: output?.taxAmount === null || output?.taxAmount === undefined ? undefined : Number(output.taxAmount),
        items: items,
    } as ExtractInvoiceDataOutput;
  }
);

    