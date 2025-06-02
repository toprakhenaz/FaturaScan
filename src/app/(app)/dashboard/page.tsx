'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Invoice } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PlusCircle, TrendingUp, TrendingDown, Loader2, AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser) {
      const fetchInvoices = async () => {
        setLoading(true);
        setError(null);
        try {
          const invoicesCol = collection(db, 'invoices');
          const q = query(invoicesCol, where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'));
          const querySnapshot = await getDocs(q);
          const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
          setInvoices(fetchedInvoices);
        } catch (err: any) {
          console.error("Error fetching invoices:", err);
          setError('Failed to load invoices. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      fetchInvoices();
    }
  }, [currentUser]);

  const formatDate = (dateStrOrTimestamp: string | Timestamp) => {
    try {
      if (dateStrOrTimestamp instanceof Timestamp) {
        return format(dateStrOrTimestamp.toDate(), 'PP'); // e.g., Sep 21, 2023
      }
      // Try to parse if it's a string like YYYY-MM-DD
      const date = new Date(dateStrOrTimestamp);
      if (isNaN(date.getTime())) { // Check if date is valid
         // Try parsing with slashes if it's like DD/MM/YYYY
        const parts = dateStrOrTimestamp.split('/');
        if (parts.length === 3) {
          const parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
          if (!isNaN(parsedDate.getTime())) return format(parsedDate, 'PP');
        }
        return 'Invalid Date';
      }
      return format(date, 'PP');
    } catch (e) {
      return 'Invalid Date';
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
  };

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your scanned invoices and receipts.</p>
        </div>
        <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Link href="/dashboard/scan">
            <PlusCircle className="mr-2 h-5 w-5" />
            Scan New Document
          </Link>
        </Button>
      </div>

      {invoices.length === 0 ? (
        <Card className="text-center py-12">
           <CardHeader>
            <FileText className="mx-auto h-16 w-16 text-muted-foreground" />
            <CardTitle className="mt-4 font-headline text-2xl">No Documents Yet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-6">Start by scanning your first invoice or receipt.</p>
            <Button asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link href="/dashboard/scan">
                <PlusCircle className="mr-2 h-5 w-5" />
                Scan Your First Document
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">Your Documents</CardTitle>
            <CardDescription>List of all your scanned invoices and receipts.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.vendor}</TableCell>
                    <TableCell>{formatDate(invoice.date)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(invoice.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={invoice.category === 'gelir' ? 'default' : 'secondary'} className={invoice.category === 'gelir' ? 'bg-green-500/20 text-green-700 border-green-500/30' : 'bg-red-500/20 text-red-700 border-red-500/30'}>
                        {invoice.category === 'gelir' ? <TrendingUp className="mr-1 h-4 w-4" /> : <TrendingDown className="mr-1 h-4 w-4" />}
                        {invoice.category.charAt(0).toUpperCase() + invoice.category.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {invoice.isSuspicious ? (
                        <Badge variant="destructive" className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
                          <AlertTriangle className="mr-1 h-4 w-4" />
                          Suspicious
                        </Badge>
                      ) : (
                         <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                          Validated
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
