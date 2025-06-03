
'use client';

import type { User } from 'firebase/auth';
import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, appInitializationError as firebaseAppInitError } from '@/lib/firebase';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { doc, getDoc, Timestamp } from 'firebase/firestore';
import type { UserProfile, UserRole } from '@/lib/types';
import { ensureUserProfile } from '@/lib/userUtils'; // Import the new utility

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
      setAuthLoading(false); // Auth state determined

      if (user) {
        setRoleLoading(true); // Start loading role/profile
        await ensureUserProfile(user); // Ensure profile exists or is created

        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const profileData = userDocSnap.data() as UserProfile;
            setUserProfile(profileData);
            setUserRole(profileData.role);
            console.log(`[AuthContext] User profile loaded for UID ${user.uid}, Role: ${profileData.role}`);
          } else {
            // This case should be less frequent now due to ensureUserProfile,
            // but kept as a fallback or if ensureUserProfile itself fails.
            console.warn(`[AuthContext] User profile for UID ${user.uid} still not found after ensureUserProfile. Defaulting role to 'user'. This might indicate an issue with profile creation.`);
            const defaultProfile: UserProfile = {
              uid: user.uid,
              email: user.email,
              role: 'user',
              createdAt: Timestamp.now(),
              displayName: user.displayName || null,
            };
            setUserProfile(defaultProfile);
            setUserRole('user');
          }
        } catch (error) {
          console.error("[AuthContext] Error fetching user profile:", error);
          setUserProfile(null);
          setUserRole(null);
        } finally {
          setRoleLoading(false); // Role/profile loading finished
        }
      } else {
        setUserProfile(null);
        setUserRole(null);
        setRoleLoading(false); // No user, so role loading is "finished"
      }
    });

    return () => {
      unsubscribe();
    };
  }, []); // Removed db from dependencies as it's stable

  const overallLoading = authLoading || roleLoading;

  return (
    <AuthContext.Provider value={{ currentUser, userProfile, userRole, authLoading, roleLoading, initializationError: firebaseAppInitError }}>
      {overallLoading && !firebaseAppInitError && (
        <div className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-background">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      )}
      {firebaseAppInitError && !currentUser && (
        <div className="fixed inset-0 z-50 flex h-screen w-screen items-center justify-center bg-background p-4">
          <div className="max-w-md rounded-lg border border-destructive bg-card p-6 text-center shadow-lg">
            <h1 className="mb-4 text-xl font-bold text-destructive">Application Error</h1>
            <p className="text-card-foreground">Firebase could not be initialized:</p>
            <p className="mt-2 text-sm text-destructive-foreground bg-destructive/20 p-2 rounded-md">{firebaseAppInitError}</p>
            <p className="mt-4 text-xs text-muted-foreground">Please check the browser console for more details and ensure your Firebase environment variables are correctly set in <code>.env.local</code> and the server has been restarted.</p>
          </div>
        </div>
      )}
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
