
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, Settings, Construction } from 'lucide-react';

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/dashboard/admin">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Admin Panel</span>
          </Link>
        </Button>
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">Application Settings</h1>
          <p className="text-muted-foreground">Manage global configuration for FaturaScan.</p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline flex items-center">
            <Settings className="mr-2 h-5 w-5" /> General Settings
          </CardTitle>
          <CardDescription>
            Configure application-wide parameters and defaults.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
            <Construction className="mx-auto h-16 w-16 text-muted-foreground/50" />
            <p className="mt-4 text-lg text-muted-foreground">
                Settings Management Coming Soon
            </p>
            <p className="text-sm text-muted-foreground">
                This section will allow administrators to configure various aspects of the application.
            </p>
        </CardContent>
      </Card>
    </div>
  );
}

