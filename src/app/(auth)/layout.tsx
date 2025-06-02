import type { ReactNode } from 'react';
import Image from 'next/image';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="mb-8 flex items-center space-x-2">
        <Image src="https://placehold.co/50x50.png?text=FS" alt="FaturaScan Logo" data-ai-hint="logo monogram" width={50} height={50} className="rounded-lg" />
        <h1 className="font-headline text-4xl font-bold text-primary">FaturaScan</h1>
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
