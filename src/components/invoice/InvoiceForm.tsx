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
import type { Invoice, InvoiceFormData, InvoiceItem } from '@/lib/types';
import type { ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import type { ValidateExtractedDataOutput } from '@/ai/flows/validate-extracted-data';
import { AlertTriangle, CheckCircle2, Loader2, Save, ListChecks } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext'; 
import { Textarea } from '@/components/ui/textarea';

interface InvoiceFormProps {
  initialExtractedData: ExtractInvoiceDataOutput;
  initialValidationResult: ValidateExtractedDataOutput;
  imageFileName?: string;
  onSaveSuccess?: () => void;
}

export default function InvoiceForm({ initialExtractedData, initialValidationResult, imageFileName, onSaveSuccess }: InvoiceFormProps) {
  const { currentUser } = useAuth(); 
  const [formData, setFormData] = useState<InvoiceFormData>({
    date: initialExtractedData.date || '',
    amount: initialExtractedData.amount || 0,
    vendor: initialExtractedData.vendor || '',
    invoiceNumber: initialExtractedData.invoiceNumber || null,
    taxAmount: initialExtractedData.taxAmount || null,
    items: initialExtractedData.items || [],
    category: '', 
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    // Handle number inputs specifically
    if (type === 'number') {
      // Allow empty string for optional number fields, parse to number if not empty, else null
      setFormData(prev => ({
        ...prev,
        [name]: value === '' ? null : parseFloat(value),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleCategoryChange = (value: 'gelir' | 'gider') => {
    setFormData(prev => ({ ...prev, category: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      toast({ title: 'Authentication Error', description: 'You must be logged in to save an invoice.', variant: 'destructive'});
      return;
    }

    if (!formData.category) {
      toast({ title: 'Validation Error', description: 'Please select a category.', variant: 'destructive'});
      return;
    }
    setLoading(true);

    const invoiceToSave: Omit<Invoice, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = {
      date: formData.date,
      amount: formData.amount,
      vendor: formData.vendor,
      invoiceNumber: formData.invoiceNumber || null,
      taxAmount: formData.taxAmount || null,
      items: formData.items || [],
      category: formData.category,
      validationSummary: formData.validationSummary,
      isDateValid: formData.isDateValid,
      isAmountValid: formData.isAmountValid,
      isVendorValid: formData.isVendorValid,
      isSuspicious: formData.isSuspicious,
      suspiciousReasons: formData.suspiciousReasons,
      imageFileName: imageFileName,
    };
    
    const result = await saveInvoice(invoiceToSave, currentUser.uid); 
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
              <Label htmlFor="invoiceNumber">Invoice Number (Optional)</Label>
              <Input id="invoiceNumber" name="invoiceNumber" value={formData.invoiceNumber || ''} onChange={handleChange} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxAmount">Tax Amount (Optional)</Label>
              <Input id="taxAmount" name="taxAmount" type="number" step="0.01" value={formData.taxAmount ?? ''} onChange={handleChange} />
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
          
          {formData.items && formData.items.length > 0 && (
            <div className="space-y-2 col-span-full">
              <Label className="flex items-center"><ListChecks className="mr-2 h-5 w-5" /> Extracted Items</Label>
              <div className="p-3 border rounded-md bg-muted/10 space-y-3 max-h-60 overflow-y-auto">
                {formData.items.map((item, index) => (
                  <div key={index} className="text-sm p-3 border rounded-md bg-background shadow-sm">
                    <p className="font-medium text-primary">{item.description || "N/A"}</p>
                    <div className="grid grid-cols-3 gap-x-2 text-xs text-muted-foreground items-center">
                      <span>Qty: {item.quantity ?? 'N/A'}</span>
                      <span>
                        Unit Price: 
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-24 ml-1 inline-block"
                          value={item.unitPrice ?? ''}
                          onChange={e => {
                            const value = e.target.value === '' ? null : parseFloat(e.target.value);
                            setFormData(prev => ({
                              ...prev,
                              items: prev.items.map((it, i) => i === index ? { ...it, unitPrice: value } : it)
                            }));
                          }}
                          placeholder="N/A"
                        />
                      </span>
                      <span className="font-semibold text-foreground">Total: {item.totalPrice?.toFixed(2) ?? 'N/A'}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">You can edit the unit price for each item. Other fields are extracted automatically.</p>
            </div>
          )}


          <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90" disabled={loading || !currentUser}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Document
          </Button>
          {!currentUser && (
            <p className="text-sm text-destructive text-center">Please log in to save the document.</p>
          )}
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">Please review all fields carefully before saving.</p>
      </CardFooter>
    </Card>
  );
}
