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

const ExtractInvoiceDataOutputSchema = z.object({
  date: z.string().describe('The date on the invoice or receipt (YYYY-MM-DD).'),
  amount: z.number().describe('The total amount on the invoice or receipt.'),
  vendor: z.string().describe('The name of the vendor.'),
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
  - Date: The date on the invoice or receipt. Format as YYYY-MM-DD.
  - Amount: The total amount on the invoice or receipt. (number only)
  - Vendor: The name of the vendor.

  Here is the scanned image of the invoice or receipt:

  {{media url=photoDataUri}}

  Return the extracted information in JSON format.
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
    return output!;
  }
);
