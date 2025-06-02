
'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { userRole, roleLoading, currentUser, authLoading } = useAuth();
  const router = useRouter();

  const isLoading = authLoading || roleLoading;

  useEffect(() => {
    if (!isLoading && currentUser && userRole !== 'admin') {
      router.replace('/dashboard'); // Redirect non-admins
    }
    if (!isLoading && !currentUser) {
      router.replace('/login'); // Redirect unauthenticated users
    }
  }, [userRole, isLoading, currentUser, router]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (userRole !== 'admin') {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center">
            <AlertTriangle className="mr-2 h-5 w-5" /> Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>You do not have permission to view this page.</p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
       {/* Can add admin-specific sub-navigation here if needed */}
      {children}
    </div>
  );
}
