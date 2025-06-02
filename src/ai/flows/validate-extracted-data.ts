// This is an experimental implementation of this flow.
'use server';
/**
 * @fileOverview Validates extracted invoice/receipt data against common sense business rules and flags suspicious data.
 *
 * - validateExtractedData - A function that validates extracted data.
 * - ValidateExtractedDataInput - The input type for the validateExtractedData function.
 * - ValidateExtractedDataOutput - The return type for the validateExtractedData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ValidateExtractedDataInputSchema = z.object({
  date: z
    .string()
    .describe('The date of the invoice/receipt in ISO 8601 format (YYYY-MM-DD).'),
  amount: z.number().describe('The amount of the invoice/receipt.'),
  vendor: z.string().describe('The name of the vendor.'),
});
export type ValidateExtractedDataInput = z.infer<
  typeof ValidateExtractedDataInputSchema
>;

const ValidationResultSchema = z.object({
  isDateValid: z
    .boolean()
    .describe('Whether the date is valid (in the past and not too far in the past).'),
  isAmountValid: z
    .boolean()
    .describe('Whether the amount is valid (a reasonable value).'),
  isVendorValid: z
    .boolean()
    .describe('Whether the vendor name seems valid.'),
  suspicious: z
    .boolean()
    .describe('Whether the data is suspicious based on the validations.'),
  reasons: z.array(z.string()).describe('Reasons why the data might be suspicious.'),
});

const ValidateExtractedDataOutputSchema = z.object({
  validationResult: ValidationResultSchema.describe(
    'The result of validating the extracted data.'
  ),
  summary: z
    .string()
    .describe('A short summary of the validation results and any suspicious findings.'),
});

export type ValidateExtractedDataOutput = z.infer<
  typeof ValidateExtractedDataOutputSchema
>;

export async function validateExtractedData(
  input: ValidateExtractedDataInput
): Promise<ValidateExtractedDataOutput> {
  return validateExtractedDataFlow(input);
}

const validateExtractedDataPrompt = ai.definePrompt({
  name: 'validateExtractedDataPrompt',
  input: {schema: ValidateExtractedDataInputSchema},
  output: {schema: ValidateExtractedDataOutputSchema},
  prompt: `You are an expert validator for financial data extracted from invoices and receipts.

  You will receive the following extracted data:
  Date: {{{date}}}
  Amount: {{{amount}}}
  Vendor: {{{vendor}}}

  Your task is to validate this data against common sense business rules and flag any suspicious data.

  Specifically, consider the following:
  - The date should be in the past, but not too far in the past (e.g., not more than 2 years ago).
  - The amount should be a reasonable value for a typical business transaction. Very large or very small amounts could be suspicious.
  - The vendor name should seem like a valid business name (e.g., not gibberish).

  Based on your validation, determine whether the data is suspicious and provide a summary of your findings.

  Here is the schema you must follow:
  ${'```'}
  ${JSON.stringify(ValidateExtractedDataOutputSchema.shape, null, 2)}
  ${'```'}

  Return the output in JSON format, including a boolean "suspicious" field and an array of "reasons" if the data is suspicious.
  The validationResult field should contain detailed validation results.
  The summary field should provide a concise summary of the validation outcome.
  `,
});

const validateExtractedDataFlow = ai.defineFlow(
  {
    name: 'validateExtractedDataFlow',
    inputSchema: ValidateExtractedDataInputSchema,
    outputSchema: ValidateExtractedDataOutputSchema,
  },
  async input => {
    const currentDate = new Date();
    const inputDate = new Date(input.date);
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(currentDate.getFullYear() - 2);

    let isDateValid = inputDate <= currentDate && inputDate >= twoYearsAgo;
    let isAmountValid = input.amount > 0 && input.amount < 1000000; // Arbitrary upper bound
    let isVendorValid = input.vendor.length > 2; // Basic check

    const {output} = await validateExtractedDataPrompt(input);

    const suspicious = !isDateValid || !isAmountValid || !isVendorValid;

    const reasons: string[] = [];
    if (!isDateValid) {
      reasons.push('The date is invalid (either in the future or too far in the past).');
    }
    if (!isAmountValid) {
      reasons.push('The amount is invalid (either negative or unreasonably large).');
    }
    if (!isVendorValid) {
      reasons.push('The vendor name is invalid (too short).');
    }

    // Use the LLM's validation results if available, otherwise use rule-based.
    // This allows the LLM to potentially provide more nuanced validation or catch things the rules miss.
    const finalValidationResult = output?.validationResult ? {
        isDateValid: output.validationResult.isDateValid !== undefined ? output.validationResult.isDateValid : isDateValid,
        isAmountValid: output.validationResult.isAmountValid !== undefined ? output.validationResult.isAmountValid : isAmountValid,
        isVendorValid: output.validationResult.isVendorValid !== undefined ? output.validationResult.isVendorValid : isVendorValid,
        suspicious: output.validationResult.suspicious !== undefined ? output.validationResult.suspicious : suspicious,
        reasons: output.validationResult.reasons?.length ? output.validationResult.reasons : reasons,
    } : {
        isDateValid,
        isAmountValid,
        isVendorValid,
        suspicious,
        reasons,
    };
    
    const finalSummary = output?.summary || (finalValidationResult.suspicious
      ? `The extracted data is suspicious. Reasons: ${finalValidationResult.reasons.join(', ')}`
      : 'The extracted data appears to be valid.');

    return {
      validationResult: finalValidationResult,
      summary: finalSummary,
    };
  }
);

