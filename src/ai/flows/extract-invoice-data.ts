
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
  unitPrice: z.number().optional().describe('Price per unit of the item. May be empty if not found.'),
  totalPrice: z.number().optional().describe('Total price for this line item. May be empty if not found.'),
});
export type InvoiceItem = z.infer<typeof InvoiceItemSchema>;

const ExtractInvoiceDataOutputSchema = z.object({
  date: z.string().optional().describe('The date on the invoice or receipt (YYYY-MM-DD format). If not found or format is different, leave empty or try to convert. Example: "3 Temmuz 2030" should be "2030-07-03".'),
  amount: z.number().optional().describe('The grand total amount (TOPLAM FİYAT) on the invoice or receipt. If not found, leave empty.'),
  vendor: z.string().optional().describe('The name of the vendor (company issuing the invoice, e.g., "KAYALI ŞİRKETLER GRUBU"). If not found, leave empty.'),
  invoiceNumber: z.string().optional().describe('The invoice number (Fatura No). If not found, leave empty.'),
  taxAmount: z.number().optional().describe('The total tax amount (e.g., KDV, VERGİLER). If an explicit total tax amount is listed, use that. If only a percentage and subtotal are given (e.g., VERGİLER: %15, ARA TOPLAM: 5200), calculate it. If not found or not applicable, leave empty.'),
  items: z.array(InvoiceItemSchema).optional().describe('Line items from the invoice. Each item should include description, quantity, unitPrice, and totalPrice if available. If not found or not applicable, leave empty array.'),
  // customerName: z.string().optional().describe('The name of the customer or client (ALICI BİLGİLERİ or similar). If not found, leave empty.'), // Optional: Add if needed
  // subTotal: z.number().optional().describe('The subtotal amount (ARA TOPLAM) before taxes. If not found, leave empty.'), // Optional: Add if needed
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInvoiceDataPrompt',
  input: {schema: ExtractInvoiceDataInputSchema},
  output: {schema: ExtractInvoiceDataOutputSchema},
  prompt: `You are an expert accounting assistant specializing in extracting information from Turkish invoices and receipts.
  Your task is to meticulously extract key information from the provided scanned image. Prioritize accuracy. If a field is ambiguous or not present, it's better to omit it or leave it empty/null than to guess incorrectly.

  Please extract the following information:
  - Vendor (Satıcı Adı): Identify the company or entity that issued the invoice. This is often found at the top, like "KAYALI ŞİRKETLER GRUBU" in the example. Do not confuse with "ALICI BİLGİLERİ".
  - Date (Düzenlenme Tarihi): The date the invoice was issued. Convert to YYYY-MM-DD format. For example, "3 Temmuz 2030" should become "2030-07-03". If not found, omit.
  - Amount (Toplam Fiyat/Tutar): The grand total amount due, usually labeled as "TOPLAM FİYAT" or similar. Extract the numeric value. If not found, omit.
  - Invoice Number (Fatura No): The unique identification number for the invoice. If not found, omit.
  - Tax Amount (Toplam Vergi Tutarı/KDV Tutarı): The total amount of tax. Look for labels like "VERGİLER TOPLAMI", "KDV TOPLAMI".
    If only a percentage and a subtotal (ARA TOPLAM) are provided (e.g., "VERGİLER : %15", "ARA TOPLAM : 5200,00 TL"), calculate the tax amount (e.g., 5200 * 0.15 = 780).
    If there's a discrepancy between a listed tax amount and a calculated one, prefer the explicitly listed tax amount. If no tax information is found, omit.
  - Items (Fatura Kalemleri): A list of line items. For each item, extract:
    - description (AÇIKLAMA): The description of the product or service.
    - quantity (MİKTAR): The quantity of the item. Assume 1 if not specified.
    - unitPrice (BİRİM FİYATI): The price per unit.
    - totalPrice (TOPLAM): The total price for that line item (quantity * unitPrice).
    The "KDV" column in the example (with "1") seems to be an indicator, not a standard VAT rate for the line item; do not misinterpret it as quantity or price. Focus on the "AÇIKLAMA", "MİKTAR", "BİRİM FİYATI", and "TOPLAM" columns for items.
    If line items are not clearly identifiable or not applicable, return an empty array for items.

  Here is the scanned image:
  {{media url=photoDataUri}}

  Return the extracted information in JSON format according to the defined output schema. Ensure all monetary values are numbers, not strings with currency symbols (e.g., "100,00 TL" should be 100.00).
  If a core field like date, total amount, or vendor name is absolutely unidentifiable from the image, you can omit it from the output.
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
    const items = output?.items?.map(item => ({
        description: item.description || undefined, // Explicitly set to undefined if null/empty
        quantity: item.quantity === null || item.quantity === undefined ? undefined : Number(item.quantity),
        unitPrice: item.unitPrice === null || item.unitPrice === undefined ? undefined : Number(item.unitPrice),
        totalPrice: item.totalPrice === null || item.totalPrice === undefined ? undefined : Number(item.totalPrice),
    })).filter(item => item.description || item.totalPrice) || []; // Filter out items that are completely empty

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

    