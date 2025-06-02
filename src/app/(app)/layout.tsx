
'use client'; 

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AppHeader from '@/components/layout/AppHeader';
import AppSidebar from '@/components/layout/AppSidebar';
// Loader2 is no longer directly used here for a full-page loader

export default function AppLayout({ children }: { children: ReactNode }) {
  const { currentUser, authLoading, roleLoading } = useAuth();
  const router = useRouter();

  const isLoading = authLoading || roleLoading;

  useEffect(() => {
    // Redirect to login if loading is complete and there's no user
    if (!isLoading && !currentUser) {
      router.replace('/login');
    }
  }, [currentUser, isLoading, router]);

  // AppLayout will now always render its main structure.
  // AuthProvider (which wraps AppLayout) is responsible for showing a global loading overlay
  // when `isLoading` (authLoading || roleLoading) is true.
  // If loading is complete and currentUser is null, the useEffect above will trigger a redirect.
  // This approach ensures a consistent DOM structure between server and client initial render,
  // preventing the hydration error caused by AppLayout conditionally rendering a different root element.

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <div className="container flex-1 items-start md:grid md:grid-cols-[240px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-10">
        <AppSidebar />
        <main className="relative py-6 lg:py-8 md:col-start-2">
          {/* 
            Children are rendered here.
            If isLoading is true, AuthProvider's overlay will cover this.
            If isLoading is false and !currentUser, a redirect is imminent via useEffect.
            If isLoading is false and currentUser exists, content is shown.
          */}
          {children}
        </main>
      </div>
    </div>
  );
}
