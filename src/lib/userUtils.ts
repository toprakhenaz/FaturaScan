
'use client';

import { doc, setDoc, getDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Assuming db is correctly exported from firebase.ts
import type { User } from "firebase/auth";
import type { UserProfile } from "./types";

/**
 * Ensures that a user profile document exists in Firestore for the given user.
 * If it doesn't exist, it creates one with a default role of 'user'.
 * @param user The Firebase authenticated user object.
 * @returns Promise<void>
 */
export async function ensureUserProfile(user: User): Promise<void> {
  if (!db) {
    console.error("[ensureUserProfile] Firestore instance (db) is not available. Cannot ensure user profile.");
    return;
  }
  if (!user || !user.uid) {
    console.error("[ensureUserProfile] Invalid user object provided.");
    return;
  }

  const userRef = doc(db, "users", user.uid);
  
  try {
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      console.log(`[ensureUserProfile] Profile for user ${user.uid} not found. Creating new profile.`);
      const newUserProfile: UserProfile = {
        uid: user.uid,
        email: user.email,
        role: "user", // Default role
        createdAt: Timestamp.now(),
        displayName: user.displayName || null,
      };
      await setDoc(userRef, newUserProfile);
      console.log(`[ensureUserProfile] Profile created for user ${user.uid}.`);
    } else {
      // console.log(`[ensureUserProfile] Profile already exists for user ${user.uid}.`);
    }
  } catch (error) {
    console.error(`[ensureUserProfile] Error ensuring user profile for ${user.uid}:`, error);
  }
}
