
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function UserManagementPage() {
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
            <h1 className="font-headline text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">View and manage all users in the system.</p>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="font-headline">User List</CardTitle>
          <CardDescription>
            This section will display a list of users. Functionality to edit roles or manage users will be added in future steps.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-12">
          <p className="text-muted-foreground text-lg">User management features are coming soon!</p>
          {/* Placeholder for user table or list */}
        </CardContent>
      </Card>
    </div>
  );
}
