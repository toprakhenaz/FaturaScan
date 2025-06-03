'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'; // Timestamp'ı firebase/firestore'dan import et
import type { UserProfile } from '@/lib/types';

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      toast({ title: 'Signup Failed', description: "Passwords do not match.", variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      let profileCreationSuccessful = false;
      if (user && db) {
        const userProfileData: UserProfile = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: 'user', // Yeni kullanıcılar için varsayılan rol
          createdAt: serverTimestamp() as Timestamp,
        };
        try {
          await setDoc(doc(db, 'users', user.uid), userProfileData);
          console.log(`[SignupForm] User profile created in Firestore for UID: ${user.uid}`);
          profileCreationSuccessful = true;
        } catch (firestoreError: any) {
          console.error("[SignupForm] Error creating user profile in Firestore:", firestoreError);
          toast({
            title: 'Signup Warning',
            description: 'Account created, but saving user profile failed. Some features might not work correctly. Please contact support.',
            variant: 'destructive',
            duration: 7000,
          });
          // Profil oluşturma başarısız olsa bile devam et, kullanıcı en azından Auth'a kaydedildi.
        }
      }
      
      if (profileCreationSuccessful) {
        toast({ title: 'Signup Successful', description: 'Your account has been created and profile saved.' });
      } else if (user) {
         // Profil kaydedilemediyse ama auth başarılıysa, bu zaten yukarıdaki toast ile belirtildi.
         // İsteğe bağlı olarak burada farklı bir mesaj gösterilebilir.
         toast({ title: 'Signup Successful (Auth Only)', description: 'Your account is created. Profile issues encountered.' });
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message);
      // Firebase Auth hatalarını daha kullanıcı dostu hale getirebiliriz
      let friendlyMessage = err.message;
      if (err.code === 'auth/email-already-in-use') {
        friendlyMessage = 'This email address is already in use. Please try a different email or login.';
      } else if (err.code === 'auth/weak-password') {
        friendlyMessage = 'The password is too weak. Please use a stronger password (at least 6 characters).';
      }
      toast({ title: 'Signup Failed', description: friendlyMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Create Account</CardTitle>
        <CardDescription>Join FaturaScan today.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
             <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="••••••••"
              />
               <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </Button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Sign Up
          </Button>
        </form>
      </CardContent>
      <CardFooter className="text-sm">
        <p>Already have an account? <Link href="/login" className="text-primary hover:underline">Login</Link></p>
      </CardFooter>
    </Card>
  );
}
