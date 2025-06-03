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
  prompt: `You are an expert accounting assistant specializing in extracting information from Turkish invoices, receipts, e-Archive invoices (e-Arşiv Fatura), and "Bilgi Fişi" (information slips). Your task is to meticulously extract key information from the provided scanned image. The document could be:

A retail receipt (like BİM)
A formal e-Archive invoice (e-Arşiv Fatura)
A regular invoice or receipt
Prioritize accuracy. If a field is ambiguous or not present, it's better to omit it or leave it empty/null than to guess incorrectly.

Please extract the following information:

Vendor (Satıcı Adı/Firma Adı): Identify the company or entity that issued the document.
For receipts: Look at the top (e.g., "BİM BİRLEŞİK MAĞAZALAR A.Ş.")
For e-Archive invoices: Look for "Satıcı (Şube):" section or company name at the top (e.g., "ORKA AKADEMİ TİCARET A.Ş.")
Date (Tarih/Düzenlenme Tarihi/Fatura Tarihi): The date the document was issued.
For receipts: Look for date patterns like DD.MM.YYYY or DD/MM/YYYY near the top
For e-Archive invoices: Look for "Fatura Tarihi:" field
Convert to YYYY-MM-DD format (e.g., "01.10.2023" → "2023-10-01", "08/05/2024" → "2024-05-08")
Amount (Toplam Tutar/Genel Toplam/Ödenecek Tutar): The grand total amount due.
For receipts: Look for "TOPLAM" preceded by "*" at the bottom
For e-Archive invoices: Look for "ÖDENECEK TUTAR:" field (this is the final amount to be paid)
Extract the numeric value (handle both comma and dot as decimal separators)
Invoice Number (Fatura No/Fiş No): The unique identification number.
For receipts: Look for "NO:", "Fiş No:"
For e-Archive invoices: Look for "Fatura No:" or "Fatura Saati:" section
For BİM receipts, this might be the transaction number
Tax Amount (Toplam Vergi Tutarı/KDV Tutarı): The total amount of tax.
For receipts: Look for "TOPKDV" followed by a number
For e-Archive invoices: Look for "K.D.V. Tutarı:" or "Hesaplanan K.D.V." in the totals section
Sum all tax amounts if multiple rates are shown
Items (Kalemler/Ürünler): A list of line items. For each item, extract:
description (AÇIKLAMA/Mal/Hizmet): The description of the product or service
quantity (MİKTAR/Miktar): The quantity of the item
For receipts: %1.00 or %1 indicates quantity 1
For e-Archive invoices: Look in the "Miktar" column
Default to 1 if not specified
unitPrice (BİRİM FİYATI/Birim Fiyat): The price per unit
For e-Archive invoices: Look in the "Birim Fiyat" column
For receipts: May not be explicitly shown if quantity is 1
totalPrice (TOPLAM TUTAR/Tutar): The total price for that line item
For receipts: The price preceded by "*"
For e-Archive invoices: Look in the "Tutar" column (usually rightmost) If line items are not clearly identifiable, return an empty array for items.
Important notes:

For BİM receipts:
The vendor name is at the very top
Date is in DD.MM.YYYY format near the top
Items show %1.00 (quantity) followed by *price
TOPLAM is near the bottom with "*"
TOPKDV shows tax amount
For e-Archive invoices:
Look for structured tables with columns
"ÖDENECEK TUTAR" is the final amount
Tax information is in "K.D.V." sections
Date format might be DD/MM/YYYY or DD.MM.YYYY
Here is the scanned image: {{media url=photoDataUri}}

Return the extracted information in JSON format according to the defined output schema. IMPORTANT formatting rules:

Monetary values: Return as numbers without currency symbols
Handle comma as decimal separator: "10.000,00 TL" → 10000.00
Handle dot as thousands separator: "2.000,00" → 2000.00
Remove spaces and "TL": "12 000,00 TL" → 12000.00
Dates: Always convert to YYYY-MM-DD format
"08/05/2024" → "2024-05-08"
"01.10.2023" → "2023-10-01"
"3 Temmuz 2030" → "2030-07-03"
For core fields (Date, Amount, Vendor): Try your best to find them before giving up. These are usually clearly visible in both receipts and invoices. `,
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

    