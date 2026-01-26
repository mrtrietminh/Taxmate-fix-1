
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum RiskLevel {
  SAFE = 'SAFE',
  WARNING = 'WARNING',
  HIGH = 'HIGH',
}

export interface BusinessProfile {
  name: string;
  taxId: string;
  address: string;
  industry: string;
  industryCode?: string;
  ownerName: string;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: TransactionType;
  category: string;
  riskLevel: RiskLevel;
  riskNote?: string;
  source?: 'CHAT' | 'IMAGE' | 'MANUAL';
  isVerified?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
  imageUrl?: string;
  pendingData?: Transaction;
  actionRequired?: boolean;
  relatedTransactionId?: string;
}

export interface P2PMessage {
    id: string;
    senderId: string;
    text: string;
    timestamp: number;
    read: boolean;
}

export enum BookingStep {
    IDLE = 'IDLE',
    PAYMENT = 'PAYMENT',
    MATCHING_CHECKLIST = 'MATCHING_CHECKLIST',
    CONNECTED = 'CONNECTED'
}

export interface AccountantProfile {
    id: string;
    name: string;
    rating: number;
    reviews: number;
    pricePerFiling: number;
    avatar: string;
    tags: string[];
    isOnline: boolean;
    licenseNumber: string;
}

export interface UserAccount {
    uid: string; // Firebase Auth UID - primary identifier
    phoneNumber: string;
    password?: string;
    role: 'CLIENT' | 'ACCOUNTANT';
    profile: BusinessProfile | null;
    transactions: Transaction[];
    chatHistory: ChatMessage[];
    p2pChat: P2PMessage[];
    createdAt: number;
    isPaid?: boolean; // Trạng thái đã thanh toán dịch vụ kế toán hay chưa
}

export type AppDatabase = Record<string, UserAccount>;

// ==================== NEW TYPES FOR CORE FEATURES ====================

// Client Assignment (Part 1)
export interface ClientAssignment {
    id?: string;
    accountantId: string;
    businessUserId: string;
    createdAt: number;
}

// Human-to-Human Message (Part 3)
export interface HumanMessage {
    id?: string;
    roomId: string;
    senderId: string;
    senderRole: 'BUSINESS' | 'ACCOUNTANT';
    text: string;
    createdAt: number;
}

// Firestore Transaction (Part 4)
export interface FirestoreTransaction {
    id?: string;
    businessUserId: string;
    date: number;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    note: string;
    createdAt: number;
    source: 'AI' | 'MANUAL';
}
