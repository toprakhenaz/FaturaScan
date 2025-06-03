
import type { Timestamp } from 'firebase/firestore';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface Invoice {
  id?: string; // Firestore document ID
  userId: string;
  
  // Data from AI, potentially edited by user
  date: string; // YYYY-MM-DD
  amount: number;
  vendor: string;
  invoiceNumber?: string | null; // New field
  taxAmount?: number | null; // New field
  items?: InvoiceItem[] | null; // New field for line items
  
  category: 'gelir' | 'gider'; // Income or Expense
  
  // AI validation details
  validationSummary: string;
  isDateValid: boolean;
  isAmountValid: boolean;
  isVendorValid: boolean;
  isSuspicious: boolean;
  suspiciousReasons: string[];
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;

  imageFileName?: string; 
  // imageUrl?: string; // URL from Firebase Storage (optional feature)
}

export type InvoiceFormData = Omit<Invoice, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'imageFileName'> & {
  photoDataUri?: string; // Temporary for AI processing
};

export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  role: UserRole;
  createdAt: Timestamp;
}

