
import { UserAccount, AppDatabase, Transaction, ChatMessage, P2PMessage, BusinessProfile, FirestoreTransaction, HumanMessage, ClientAssignment } from '../types';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, initializeFirestore, addDoc, orderBy, Timestamp, deleteDoc } from 'firebase/firestore';
import {
    getAuth,
    onAuthStateChanged,
    signInWithPhoneNumber,
    RecaptchaVerifier,
    ConfirmationResult,
    User,
    signOut
} from 'firebase/auth';

// --- CẤU HÌNH GOOGLE CLOUD / FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyDo60X6HM70j80ReZKa4h5XTSHh77w_jy8",
  authDomain: "taxmate-8a9d3.firebaseapp.com",
  projectId: "taxmate-8a9d3",
  storageBucket: "taxmate-8a9d3.firebasestorage.app",
  messagingSenderId: "726344611291",
  appId: "1:726344611291:web:c48ca59d82766204cfe3fe",
  measurementId: "G-0FN9V9QK72"
};

// Initialize Firebase App (Singleton)
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with long polling for better network compatibility
let dbFirestore: ReturnType<typeof getFirestore>;
try {
    dbFirestore = initializeFirestore(app, {
        experimentalForceLongPolling: true,
    });
    console.log("✅ [Cloud] Đã kết nối tới Google Cloud Firestore (Long Polling)");
} catch (e: any) {
    if (e.code === 'failed-precondition') {
        dbFirestore = getFirestore(app);
        console.log("⚠️ Firestore đã khởi tạo trước đó, sử dụng instance hiện tại.");
    } else {
        console.warn("Firestore init warning:", e);
        dbFirestore = getFirestore(app);
    }
}

// Initialize Firebase Auth
const auth = getAuth(app);

// Store confirmation result for OTP verification
let confirmationResult: ConfirmationResult | null = null;

export const databaseService = {
    // ==================== FIREBASE AUTH ====================

    /**
     * Get current Firebase Auth user
     */
    getCurrentAuthUser: (): User | null => {
        return auth.currentUser;
    },

    /**
     * Listen to auth state changes
     */
    onAuthStateChanged: (callback: (user: User | null) => void) => {
        return onAuthStateChanged(auth, callback);
    },

    /**
     * Initialize reCAPTCHA verifier for phone auth
     */
    initRecaptcha: (containerId: string): RecaptchaVerifier => {
        const verifier = new RecaptchaVerifier(auth, containerId, {
            size: 'invisible',
            callback: () => {
                console.log('reCAPTCHA verified');
            }
        });
        return verifier;
    },

    /**
     * Send OTP to phone number
     */
    sendOTP: async (phoneNumber: string, recaptchaVerifier: RecaptchaVerifier): Promise<void> => {
        // Format phone number to E.164 (Vietnam: +84)
        let formattedPhone = phoneNumber;
        if (phoneNumber.startsWith('0')) {
            formattedPhone = '+84' + phoneNumber.substring(1);
        } else if (!phoneNumber.startsWith('+')) {
            formattedPhone = '+84' + phoneNumber;
        }

        confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
        console.log('✅ OTP sent to', formattedPhone);
    },

    /**
     * Verify OTP and sign in
     */
    verifyOTP: async (otp: string): Promise<User> => {
        if (!confirmationResult) {
            throw new Error('Vui lòng gửi mã OTP trước.');
        }
        const result = await confirmationResult.confirm(otp);
        console.log('✅ Phone auth successful, UID:', result.user.uid);
        return result.user;
    },

    /**
     * Sign out
     */
    signOut: async (): Promise<void> => {
        await signOut(auth);
        console.log('✅ User signed out');
    },

    // ==================== USER DATA (Firestore) ====================

    /**
     * Get user data from Firestore by UID
     */
    getUser: async (uid: string): Promise<UserAccount | null> => {
        try {
            const docRef = doc(dbFirestore, "users", uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return docSnap.data() as UserAccount;
            }
            return null;
        } catch (e) {
            console.error("Cloud Error (getUser):", e);
            return null;
        }
    },

    /**
     * Create or update user in Firestore
     */
    updateUser: async (user: UserAccount): Promise<void> => {
        try {
            await setDoc(doc(dbFirestore, "users", user.uid), user);
            console.log(`✅ [Cloud] User ${user.uid} updated`);
        } catch (e) {
            console.error("Cloud Error (updateUser):", e);
            throw e;
        }
    },

    /**
     * Create new user after phone auth
     */
    createUserAfterAuth: async (firebaseUser: User, phoneNumber: string): Promise<UserAccount> => {
        // Check if user already exists
        const existingUser = await databaseService.getUser(firebaseUser.uid);
        if (existingUser) {
            return existingUser;
        }

        // Create new user document
        const newUser: UserAccount = {
            uid: firebaseUser.uid,
            phoneNumber: phoneNumber,
            role: phoneNumber === '0999999999' ? 'ACCOUNTANT' : 'CLIENT',
            profile: null,
            transactions: [],
            chatHistory: [],
            p2pChat: [],
            createdAt: Date.now(),
            isPaid: phoneNumber === '0999999999' ? true : false
        };

        await databaseService.updateUser(newUser);
        return newUser;
    },

    /**
     * Sync user data to Firestore (same as updateUser, kept for compatibility)
     */
    syncUserData: async (user: UserAccount): Promise<void> => {
        await databaseService.updateUser(user);
    },

    // ==================== BUSINESS PROFILES COLLECTION ====================

    /**
     * Save Business Profile to businessProfiles/{uid}
     */
    saveBusinessProfile: async (uid: string, profile: BusinessProfile): Promise<void> => {
        try {
            await setDoc(doc(dbFirestore, "businessProfiles", uid), profile);
            console.log(`✅ [Cloud] Đã lưu BusinessProfile cho ${uid}`);
        } catch (e) {
            console.error("Cloud Error (saveBusinessProfile):", e);
            throw e;
        }
    },

    /**
     * Get Business Profile from businessProfiles/{uid}
     */
    getBusinessProfile: async (uid: string): Promise<BusinessProfile | null> => {
        try {
            const docRef = doc(dbFirestore, "businessProfiles", uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                console.log(`✅ [Cloud] Đã tải BusinessProfile cho ${uid}`);
                return docSnap.data() as BusinessProfile;
            }
            return null;
        } catch (e) {
            console.error("Cloud Error (getBusinessProfile):", e);
            return null;
        }
    },

    // ==================== ACCOUNTANT FUNCTIONS ====================

    /**
     * Get all clients (for Accountant view) - DEPRECATED, use getAssignedClients instead
     */
    getAllClients: async (): Promise<UserAccount[]> => {
        try {
            const q = query(collection(dbFirestore, "users"), where("role", "==", "CLIENT"));
            const querySnapshot = await getDocs(q);
            const clients: UserAccount[] = [];
            querySnapshot.forEach((doc) => {
                clients.push(doc.data() as UserAccount);
            });
            return clients;
        } catch (e) {
            console.error("Cloud Error (getAllClients):", e);
            return [];
        }
    },

    // ==================== PART 1: CLIENT ASSIGNMENTS ====================

    // Hardcoded test accountant UID - replace with actual accountant UID after first login
    TEST_ACCOUNTANT_UID: 'TEST_ACCOUNTANT_001',

    /**
     * Assign a business user to an accountant
     */
    assignClientToAccountant: async (businessUserId: string, accountantId?: string): Promise<void> => {
        try {
            const targetAccountantId = accountantId || databaseService.TEST_ACCOUNTANT_UID;

            // Check if assignment already exists
            const q = query(
                collection(dbFirestore, "clientAssignments"),
                where("businessUserId", "==", businessUserId),
                where("accountantId", "==", targetAccountantId)
            );
            const existing = await getDocs(q);
            if (!existing.empty) {
                console.log("✅ Assignment already exists");
                return;
            }

            const assignment: ClientAssignment = {
                accountantId: targetAccountantId,
                businessUserId: businessUserId,
                createdAt: Date.now()
            };
            await addDoc(collection(dbFirestore, "clientAssignments"), assignment);
            console.log(`✅ [Cloud] Assigned client ${businessUserId} to accountant ${targetAccountantId}`);
        } catch (e) {
            console.error("Cloud Error (assignClientToAccountant):", e);
            throw e;
        }
    },

    /**
     * Get all clients assigned to an accountant
     */
    getAssignedClients: async (accountantId: string): Promise<{user: UserAccount, profile: BusinessProfile | null, transactions: FirestoreTransaction[]}[]> => {
        try {
            const q = query(
                collection(dbFirestore, "clientAssignments"),
                where("accountantId", "==", accountantId)
            );
            const assignmentsSnapshot = await getDocs(q);

            const clients: {user: UserAccount, profile: BusinessProfile | null, transactions: FirestoreTransaction[]}[] = [];

            for (const assignmentDoc of assignmentsSnapshot.docs) {
                const assignment = assignmentDoc.data() as ClientAssignment;
                const user = await databaseService.getUser(assignment.businessUserId);
                if (user) {
                    const profile = await databaseService.getBusinessProfile(assignment.businessUserId);
                    const transactions = await databaseService.getClientTransactions(assignment.businessUserId);
                    clients.push({ user, profile, transactions });
                }
            }

            return clients;
        } catch (e) {
            console.error("Cloud Error (getAssignedClients):", e);
            return [];
        }
    },

    // ==================== PART 3: HUMAN-TO-HUMAN CHAT ====================

    /**
     * Generate room ID for chat between business and accountant
     */
    generateRoomId: (businessUserId: string, accountantId: string): string => {
        return `${businessUserId}_${accountantId}`;
    },

    /**
     * Send a human message
     */
    sendHumanMessage: async (roomId: string, senderId: string, senderRole: 'BUSINESS' | 'ACCOUNTANT', text: string): Promise<void> => {
        try {
            const message: HumanMessage = {
                roomId,
                senderId,
                senderRole,
                text,
                createdAt: Date.now()
            };
            await addDoc(collection(dbFirestore, "messages"), message);
            console.log(`✅ [Cloud] Message sent in room ${roomId}`);
        } catch (e) {
            console.error("Cloud Error (sendHumanMessage):", e);
            throw e;
        }
    },

    /**
     * Get messages for a room
     */
    getRoomMessages: async (roomId: string): Promise<HumanMessage[]> => {
        try {
            const q = query(
                collection(dbFirestore, "messages"),
                where("roomId", "==", roomId),
                orderBy("createdAt", "asc")
            );
            const snapshot = await getDocs(q);
            const messages: HumanMessage[] = [];
            snapshot.forEach((doc) => {
                messages.push({ id: doc.id, ...doc.data() } as HumanMessage);
            });
            return messages;
        } catch (e) {
            console.error("Cloud Error (getRoomMessages):", e);
            return [];
        }
    },

    // ==================== PART 4: TRANSACTIONS COLLECTION ====================

    /**
     * Save a transaction to the transactions collection
     */
    saveTransaction: async (transaction: Omit<FirestoreTransaction, 'id'>): Promise<string> => {
        try {
            const docRef = await addDoc(collection(dbFirestore, "transactions"), transaction);
            console.log(`✅ [Cloud] Transaction saved: ${docRef.id}`);
            return docRef.id;
        } catch (e) {
            console.error("Cloud Error (saveTransaction):", e);
            throw e;
        }
    },

    /**
     * Get all transactions for a business user
     */
    getClientTransactions: async (businessUserId: string): Promise<FirestoreTransaction[]> => {
        try {
            const q = query(
                collection(dbFirestore, "transactions"),
                where("businessUserId", "==", businessUserId),
                orderBy("createdAt", "desc")
            );
            const snapshot = await getDocs(q);
            const transactions: FirestoreTransaction[] = [];
            snapshot.forEach((doc) => {
                transactions.push({ id: doc.id, ...doc.data() } as FirestoreTransaction);
            });
            return transactions;
        } catch (e) {
            console.error("Cloud Error (getClientTransactions):", e);
            return [];
        }
    },

    // ==================== LEGACY COMPATIBILITY (for gradual migration) ====================
    // These functions are kept temporarily but will throw errors to force migration

    /**
     * @deprecated Use Firebase Auth instead
     */
    register: async (_phone: string, _password: string): Promise<UserAccount> => {
        throw new Error('Vui lòng sử dụng đăng nhập bằng số điện thoại với OTP.');
    },

    /**
     * @deprecated Use Firebase Auth instead
     */
    login: async (_phone: string, _password?: string): Promise<UserAccount> => {
        throw new Error('Vui lòng sử dụng đăng nhập bằng số điện thoại với OTP.');
    },

    /**
     * @deprecated No longer needed with Firebase Auth
     */
    resetPassword: async (_phone: string, _newPin: string): Promise<void> => {
        throw new Error('Với Firebase Auth, bạn có thể đăng nhập lại bằng OTP mới.');
    },

    /**
     * @deprecated Use onAuthStateChanged instead
     */
    getCurrentSession: async (): Promise<UserAccount | null> => {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) return null;
        return await databaseService.getUser(firebaseUser.uid);
    },

    /**
     * @deprecated Use signOut instead
     */
    clearSession: () => {
        databaseService.signOut();
    },

    /**
     * @deprecated No longer using localStorage
     */
    exportBackup: async (): Promise<string> => {
        throw new Error('Backup không còn cần thiết. Dữ liệu được lưu trên Google Cloud.');
    },

    /**
     * @deprecated No longer using localStorage
     */
    importBackup: (_backupString: string): boolean => {
        throw new Error('Import không còn hỗ trợ. Dữ liệu được lưu trên Google Cloud.');
    },

    /**
     * @deprecated No longer using localStorage
     */
    getDB: (): AppDatabase => {
        console.warn('getDB() is deprecated. Use Firestore queries instead.');
        return {};
    }
};
