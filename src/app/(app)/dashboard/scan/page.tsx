'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { processInvoiceUpload } from '@/actions/invoiceActions';
import InvoiceForm from '@/components/invoice/InvoiceForm';
import type { ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import type { ValidateExtractedDataOutput } from '@/ai/flows/validate-extracted-data';
import Image from 'next/image';
import { UploadCloud, Loader2, FileScan, AlertTriangle } from 'lucide-react';

export default function ScanPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractInvoiceDataOutput | null>(null);
  const [validationResult, setValidationResult] = useState<ValidateExtractedDataOutput | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) { // 5MB limit
        toast({ title: "File too large", description: "Please upload an image under 5MB.", variant: "destructive"});
        setFile(null);
        setPreviewUrl(null);
        return;
      }
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(selectedFile.type)) {
        toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, or WEBP image.", variant: "destructive"});
        setFile(null);
        setPreviewUrl(null);
        return;
      }
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setExtractedData(null); // Reset AI results if new file is chosen
      setValidationResult(null);
      setError(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast({ title: 'No file selected', description: 'Please select an image file to upload.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setError(null);
    setExtractedData(null);
    setValidationResult(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const photoDataUri = reader.result as string;
        const formData = new FormData();
        formData.append('photoDataUri', photoDataUri);

        const result = await processInvoiceUpload(formData);

        if (result.error) {
          setError(result.error);
          toast({ title: 'Processing Failed', description: result.error, variant: 'destructive' });
        } else if (result.extractedData && result.validationResult) {
          setExtractedData(result.extractedData);
          setValidationResult(result.validationResult);
          toast({ title: 'Processing Complete', description: 'Review the extracted data below.' });
        } else {
          setError("Unexpected error during AI processing. Extracted or validation data is missing.");
          toast({ title: 'Processing Failed', description: "Unexpected error, AI results incomplete.", variant: 'destructive' });
        }
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred.');
        toast({ title: 'Error', description: err.message || 'An unexpected error occurred.', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read the file.');
      toast({ title: 'File Read Error', description: 'Could not read the selected file.', variant: 'destructive' });
      setLoading(false);
    };
  };

  const handleSaveSuccess = () => {
    // Reset form for new scan
    setFile(null);
    setPreviewUrl(null);
    setExtractedData(null);
    setValidationResult(null);
    setError(null);
    const fileInput = document.getElementById('invoice-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = ''; // Clear file input
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">Scan Document</h1>
        <p className="text-muted-foreground">Upload an image of your invoice or receipt to extract its data.</p>
        <p className="text-xs text-muted-foreground mt-2">Supported document types: BİM market receipts, e-Archive invoices, regular invoices, information slips. Turkish number/date formats and TL/₺ are supported.</p>
      </div>

      {!extractedData && (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Upload Document Image</CardTitle>
            <CardDescription>Select a clear image of your invoice or receipt (JPG, PNG, WEBP, max 5MB).</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="invoice-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg hover:border-primary transition-colors">
                    {previewUrl ? (
                      <Image src={previewUrl} alt="Preview" width={200} height={200} className="max-h-56 w-auto object-contain rounded-md" data-ai-hint="invoice receipt" />
                    ) : (
                      <>
                        <UploadCloud className="h-12 w-12 text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5MB</p>
                      </>
                    )}
                  </div>
                </Label>
                <Input 
                  id="invoice-upload" 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp" 
                  onChange={handleFileChange} 
                  className="hidden"
                />
              </div>
              {error && (
                <p className="text-sm text-destructive flex items-center">
                  <AlertTriangle className="mr-2 h-4 w-4"/> {error}
                </p>
              )}
              <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={!file || loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileScan className="mr-2 h-4 w-4" />}
                {loading ? 'Processing... (This may take 10-30 seconds)' : 'Process Document'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {extractedData && validationResult && (
        <InvoiceForm 
          initialExtractedData={extractedData} 
          initialValidationResult={validationResult}
          imageFileName={file?.name}
          onSaveSuccess={handleSaveSuccess}
        />
      )}
       {extractedData && 
        <Button variant="outline" onClick={handleSaveSuccess} className="w-full mt-4">
          Scan Another Document
        </Button>
      }
    </div>
  );
}
