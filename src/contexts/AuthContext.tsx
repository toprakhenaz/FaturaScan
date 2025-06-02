'use client';

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, appInitializationError as firebaseAppInitError } from '@/lib/firebase';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  initializationError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (firebaseAppInitError) {
      console.error("[AuthContext] Firebase app initialization failed previously. Auth listener will not be set up. Error:", firebaseAppInitError);
      setLoading(false); // Stop loading, currentUser remains null
      return;
    }

    if (!auth) {
      console.error("[AuthContext] Firebase auth object is not available (it might be undefined after an initialization issue). Cannot set up auth listener.");
      setLoading(false);
      return;
    }

    // console.log('[AuthContext] Setting up Firebase auth state listener.');
    const unsubscribe = auth.onAuthStateChanged((user) => {
      // console.log('[AuthContext] Auth state changed. User:', user ? user.uid : null);
      setCurrentUser(user);
      setLoading(false);
    });

    return () => {
      // console.log('[AuthContext] Cleaning up Firebase auth state listener.');
      unsubscribe();
    };
  }, []);

  if (loading && !firebaseAppInitError) { // Only show global loader if no init error and still loading auth state
    return (
      <div className="flex h-screen w-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (firebaseAppInitError && !currentUser) { // If init error and still no user (stuck)
     return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
        <div className="max-w-md rounded-lg border border-destructive bg-card p-6 text-center shadow-lg">
          <h1 className="mb-4 text-xl font-bold text-destructive">Application Error</h1>
          <p className="text-card-foreground">Firebase could not be initialized:</p>
          <p className="mt-2 text-sm text-destructive-foreground bg-destructive/20 p-2 rounded-md">{firebaseAppInitError}</p>
          <p className="mt-4 text-xs text-muted-foreground">Please check the browser console for more details and ensure your Firebase environment variables are correctly set in <code>.env.local</code> and the server has been restarted.</p>
        </div>
      </div>
    );
  }


  return (
    <AuthContext.Provider value={{ currentUser, loading, initializationError: firebaseAppInitError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
