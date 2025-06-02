import type { Metadata } from 'next';
import { PT_Sans } from 'next/font/google'; // Correctly import PT Sans
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';

// Configure PT Sans font
const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'], // Specify weights you need
  variable: '--font-pt-sans', // Optional: if you want to use it as a CSS variable
});

export const metadata: Metadata = {
  title: 'FaturaScan - Invoice & Receipt Management',
  description: 'Scan, extract, and manage your invoices and receipts effortlessly with FaturaScan.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={ptSans.className}>
      <head>
        {/* Google Fonts link is managed by next/font, no need for manual <link> for PT Sans */}
      </head>
      <body className="font-body antialiased">
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
