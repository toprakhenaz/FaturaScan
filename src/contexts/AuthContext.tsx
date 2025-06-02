
'use client';

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, appInitializationError as firebaseAppInitError } from '@/lib/firebase';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { UserProfile, UserRole } from '@/lib/types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  userRole: UserRole | null;
  authLoading: boolean; // Firebase auth state loading
  roleLoading: boolean; // Firestore user profile/role loading
  initializationError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (firebaseAppInitError) {
      console.error("[AuthContext] Firebase app initialization failed previously. Auth listener will not be set up. Error:", firebaseAppInitError);
      setAuthLoading(false);
      setRoleLoading(false);
      return;
    }

    if (!auth || !db) {
      console.error("[AuthContext] Firebase auth or db object is not available. Cannot set up auth listener or fetch profile.");
      setAuthLoading(false);
      setRoleLoading(false);
      return;
    }

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      setAuthLoading(false);

      if (user) {
        setRoleLoading(true);
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const profileData = userDocSnap.data() as UserProfile;
            setUserProfile(profileData);
            setUserRole(profileData.role);
          } else {
            // This case should ideally not happen if signup creates a profile.
            // Fallback to 'user' role or handle as an anomaly.
            console.warn(`[AuthContext] User profile for UID ${user.uid} not found in Firestore. Defaulting role to 'user'.`);
            const defaultProfile: UserProfile = {
              uid: user.uid,
              email: user.email,
              role: 'user',
              createdAt: Timestamp.now() // Or consider not setting it if not found
            };
            setUserProfile(defaultProfile);
            setUserRole('user');
          }
        } catch (error) {
          console.error("[AuthContext] Error fetching user profile:", error);
          setUserProfile(null); // Ensure profile is null on error
          setUserRole(null); // Ensure role is null on error
        } finally {
          setRoleLoading(false);
        }
      } else {
        setUserProfile(null);
        setUserRole(null);
        setRoleLoading(false); // No user, so role loading is complete (no role).
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const overallLoading = authLoading || roleLoading;

  if (overallLoading && !firebaseAppInitError) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }
  
  if (firebaseAppInitError && !currentUser) {
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
    <AuthContext.Provider value={{ currentUser, userProfile, userRole, authLoading, roleLoading, initializationError: firebaseAppInitError }}>
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
