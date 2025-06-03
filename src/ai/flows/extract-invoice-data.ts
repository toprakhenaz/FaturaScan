
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
  description: z.string().describe('Description of the item or service.'),
  quantity: z.number().optional().describe('Quantity of the item. Default to 1 if not specified.'),
  unitPrice: z.number().optional().describe('Price per unit of the item. Default to item total if not specified.'),
  totalPrice: z.number().describe('Total price for this line item.'),
});

const ExtractInvoiceDataOutputSchema = z.object({
  date: z.string().optional().describe('The date on the invoice or receipt (YYYY-MM-DD). If not found, leave empty.'),
  amount: z.number().optional().describe('The total amount on the invoice or receipt. If not found, leave empty.'),
  vendor: z.string().optional().describe('The name of the vendor. If not found, leave empty.'),
  invoiceNumber: z.string().optional().describe('The invoice number. If not found, leave empty.'),
  taxAmount: z.number().optional().describe('The total tax amount. If not found, leave empty.'),
  items: z.array(InvoiceItemSchema).optional().describe('Line items from the invoice. If not found or not applicable, leave empty array.'),
});
export type ExtractInvoiceDataOutput = z.infer<typeof ExtractInvoiceDataOutputSchema>;

export async function extractInvoiceData(input: ExtractInvoiceDataInput): Promise<ExtractInvoiceDataOutput> {
  return extractInvoiceDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractInvoiceDataPrompt',
  input: {schema: ExtractInvoiceDataInputSchema},
  output: {schema: ExtractInvoiceDataOutputSchema},
  prompt: `You are an expert accounting assistant. Your task is to extract key information from a scanned image of an invoice or receipt.

  Please extract the following information:
  - Date: The date on the invoice or receipt. Format as YYYY-MM-DD. If a date is not clearly identifiable, you may omit this field or return null/undefined.
  - Amount: The grand total amount on the invoice or receipt (numeric). If a total amount is not clearly identifiable, you may omit this field or return null/undefined.
  - Vendor: The name of the vendor or company that issued the invoice/receipt. If a vendor name is not clearly identifiable, you may omit this field or return null/undefined.
  - Invoice Number: The unique identification number for the invoice. If an invoice number is not clearly identifiable, you may omit this field.
  - Tax Amount: The total amount of tax listed on the invoice (e.g., VAT, GST). If not clearly identifiable, you may omit this field.
  - Items: A list of line items from the invoice. Each item should include:
    - description: A string describing the item or service.
    - quantity: A number representing the quantity. If not specified, assume 1.
    - unitPrice: A number representing the price per unit. If not specified, you can infer it from totalPrice and quantity, or use totalPrice if quantity is 1.
    - totalPrice: A number representing the total price for that line item.
    If line items are not clearly identifiable or not applicable (e.g., for a simple receipt), you may omit the items array or return an empty array.

  Prioritize accuracy. If a field is ambiguous or not present, it's better to omit it than to guess incorrectly.

  Here is the scanned image of the invoice or receipt:

  {{media url=photoDataUri}}

  Return the extracted information in JSON format according to the defined output schema.
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
    // Ensure default values for items if undefined
    return {
        ...output,
        items: output?.items || [], 
    } as ExtractInvoiceDataOutput;
  }
);

