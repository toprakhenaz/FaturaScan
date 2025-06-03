"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, Hash, FileText } from "lucide-react";
import Link from "next/link";

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoice() {
      setLoading(true);
      setError(null);
      try {
        const docRef = doc(db, "invoices", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setInvoice({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError("Invoice not found.");
        }
      } catch (err: any) {
        setError("Failed to load invoice details.");
      } finally {
        setLoading(false);
      }
    }
    fetchInvoice();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5" /> Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!invoice) return null;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Invoice Details
          </CardTitle>
          <CardDescription>All extracted and saved details for this document.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="font-semibold">Vendor</div>
              <div>{invoice.vendor}</div>
            </div>
            <div>
              <div className="font-semibold">Date</div>
              <div>{invoice.date}</div>
            </div>
            <div>
              <div className="font-semibold">Amount</div>
              <div>{invoice.amount}</div>
            </div>
            <div>
              <div className="font-semibold">Tax Amount</div>
              <div>{invoice.taxAmount ?? "N/A"}</div>
            </div>
            <div>
              <div className="font-semibold">Invoice Number</div>
              <div>{invoice.invoiceNumber ?? "N/A"}</div>
            </div>
            <div>
              <div className="font-semibold">Category</div>
              <Badge>{invoice.category}</Badge>
            </div>
            <div>
              <div className="font-semibold">Status</div>
              {invoice.isSuspicious ? (
                <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
                  <AlertTriangle className="mr-1 h-4 w-4" /> Suspicious
                </Badge>
              ) : (
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  <CheckCircle2 className="mr-1 h-4 w-4" /> Validated
                </Badge>
              )}
            </div>
          </div>
          <div>
            <div className="font-semibold mb-2">Extracted Items</div>
            {Array.isArray(invoice.items) && invoice.items.length > 0 ? (
              <div className="space-y-2">
                {invoice.items.map((item: any, idx: number) => (
                  <div key={idx} className="border rounded p-2 bg-muted/10">
                    <div className="font-medium">{item.description || "N/A"}</div>
                    <div className="text-xs text-muted-foreground flex gap-4">
                      <span>Qty: {item.quantity ?? "N/A"}</span>
                      <span>Unit Price: {item.unitPrice ?? "N/A"}</span>
                      <span>Total: {item.totalPrice ?? "N/A"}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">No items extracted.</div>
            )}
          </div>
          <div className="mt-4">
            <div className="font-semibold mb-1">Validation Summary</div>
            <div className="text-xs text-muted-foreground">{invoice.validationSummary}</div>
          </div>
        </CardContent>
        <CardFooter>
          <Link href="/dashboard">
            <Badge className="cursor-pointer">Back to Dashboard</Badge>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
} 