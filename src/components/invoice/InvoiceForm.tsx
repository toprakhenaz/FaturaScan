'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { saveInvoice } from '@/actions/invoiceActions';
import type { Invoice, InvoiceFormData } from '@/lib/types';
import type { ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import type { ValidateExtractedDataOutput } from '@/ai/flows/validate-extracted-data';
import { AlertTriangle, CheckCircle2, Loader2, Save } from 'lucide-react';

interface InvoiceFormProps {
  initialExtractedData: ExtractInvoiceDataOutput;
  initialValidationResult: ValidateExtractedDataOutput;
  imageFileName?: string;
  onSaveSuccess?: () => void;
}

export default function InvoiceForm({ initialExtractedData, initialValidationResult, imageFileName, onSaveSuccess }: InvoiceFormProps) {
  const [formData, setFormData] = useState<InvoiceFormData>({
    date: initialExtractedData.date || '',
    amount: initialExtractedData.amount || 0,
    vendor: initialExtractedData.vendor || '',
    category: '', // Default to empty, user must select
    validationSummary: initialValidationResult.summary || '',
    isDateValid: initialValidationResult.validationResult.isDateValid,
    isAmountValid: initialValidationResult.validationResult.isAmountValid,
    isVendorValid: initialValidationResult.validationResult.isVendorValid,
    isSuspicious: initialValidationResult.validationResult.suspicious,
    suspiciousReasons: initialValidationResult.validationResult.reasons || [],
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) : value,
    }));
  };

  const handleCategoryChange = (value: 'gelir' | 'gider') => {
    setFormData(prev => ({ ...prev, category: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.category) {
      toast({ title: 'Validation Error', description: 'Please select a category.', variant: 'destructive'});
      return;
    }
    setLoading(true);

    const invoiceToSave: Omit<Invoice, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
      date: formData.date,
      amount: formData.amount,
      vendor: formData.vendor,
      category: formData.category,
      validationSummary: formData.validationSummary,
      isDateValid: formData.isDateValid,
      isAmountValid: formData.isAmountValid,
      isVendorValid: formData.isVendorValid,
      isSuspicious: formData.isSuspicious,
      suspiciousReasons: formData.suspiciousReasons,
      imageFileName: imageFileName,
    };
    
    const result = await saveInvoice(invoiceToSave);
    setLoading(false);

    if (result.success) {
      toast({ title: 'Invoice Saved', description: 'Your document has been successfully saved.' });
      if (onSaveSuccess) {
        onSaveSuccess();
      } else {
        router.push('/dashboard');
      }
    } else {
      toast({ title: 'Save Failed', description: result.error || 'An unknown error occurred.', variant: 'destructive' });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Review & Save Document</CardTitle>
        <CardDescription>Verify the extracted information and categorize your document.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {formData.isSuspicious && (
            <Alert variant="destructive" className="bg-yellow-50 border-yellow-300 text-yellow-700">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <AlertTitle className="text-yellow-800">Potential Issues Found</AlertTitle>
              <AlertDescription className="text-yellow-700">
                {formData.validationSummary}
                {formData.suspiciousReasons.length > 0 && (
                  <ul className="list-disc pl-5 mt-1">
                    {formData.suspiciousReasons.map((reason, i) => <li key={i}>{reason}</li>)}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
          {!formData.isSuspicious && (
             <Alert variant="default" className="bg-green-50 border-green-300 text-green-700">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <AlertTitle className="text-green-800">Data Validated</AlertTitle>
              <AlertDescription className="text-green-700">
                {formData.validationSummary || "The extracted data seems valid."}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Input id="vendor" name="vendor" value={formData.vendor} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date (YYYY-MM-DD)</Label>
              <Input id="date" name="date" type="date" value={formData.date} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (TRY)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" value={formData.amount} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select name="category" onValueChange={handleCategoryChange} value={formData.category}>
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gelir">Gelir (Income)</SelectItem>
                  <SelectItem value="gider">Gider (Expense)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Document
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">Please review all fields carefully before saving.</p>
      </CardFooter>
    </Card>
  );
}
