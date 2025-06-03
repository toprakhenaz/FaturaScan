
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Users, Settings, FileText } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground">Manage users, settings, and other application aspects.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
              <Users className="mr-2 h-6 w-6" /> User Management
            </CardTitle>
            <CardDescription>View, edit, and manage user accounts and roles.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <Link href="/dashboard/admin/users">
                Manage Users
              </Link>
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
                <Settings className="mr-2 h-6 w-6" /> Application Settings
            </CardTitle>
            <CardDescription>Configure global settings for the application.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard/admin/settings">
                Configure Settings
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center">
                <FileText className="mr-2 h-6 w-6" /> Content Management (Coming Soon)
            </CardTitle>
            <CardDescription>Manage application-wide content or settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" disabled>
              Manage Content
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

