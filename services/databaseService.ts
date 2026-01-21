
import { UserAccount, AppDatabase, Transaction, ChatMessage, P2PMessage } from '../types';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';

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

// Kích hoạt chế độ Cloud
const IS_CLOUD_ENABLED = true;

let dbFirestore: any;

if (IS_CLOUD_ENABLED) {
    try {
        // Singleton pattern: Kiểm tra xem app đã khởi tạo chưa để tránh lỗi
        const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        dbFirestore = getFirestore(app);
        console.log("✅ [Cloud] Đã kết nối tới Firestore Project:", firebaseConfig.projectId);
    } catch (e) {
        console.error("❌ [Cloud] Lỗi kết nối Firebase:", e);
    }
}

// Key cho LocalStorage (Fallback hoặc Cache phiên làm việc)
const LOCAL_DB_KEY = 'taxmate_gcp_firestore_v1';
const SESSION_KEY = 'taxmate_active_session';

const simulateDelay = (ms: number = 400) => new Promise(resolve => setTimeout(resolve, ms));

export const databaseService = {
    /**
     * Lấy dữ liệu 1 user (Ưu tiên Cloud)
     */
    getUser: async (phoneNumber: string): Promise<UserAccount | null> => {
        if (IS_CLOUD_ENABLED && dbFirestore) {
            try {
                const docRef = doc(dbFirestore, "users", phoneNumber);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    return docSnap.data() as UserAccount;
                }
                return null;
            } catch (e) {
                console.error("Cloud Error (getUser):", e);
                return null;
            }
        } else {
            // Fallback Local Storage
            const db = JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '{}');
            return db[phoneNumber] || null;
        }
    },

    /**
     * Lưu/Cập nhật User (Ưu tiên Cloud)
     */
    updateUser: async (user: UserAccount) => {
        if (IS_CLOUD_ENABLED && dbFirestore) {
            try {
                // Trên Firestore, ta lưu từng user thành 1 document trong collection 'users'
                await setDoc(doc(dbFirestore, "users", user.phoneNumber), user);
            } catch (e) {
                console.error("Cloud Error (updateUser):", e);
            }
        } else {
            const db = JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '{}');
            db[user.phoneNumber] = user;
            localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
        }
    },

    /**
     * ĐĂNG KÝ
     */
    register: async (phone: string, password: string): Promise<UserAccount> => {
        const existingUser = await databaseService.getUser(phone);
        if (existingUser) throw new Error("Số điện thoại này đã tồn tại trên hệ thống.");
        
        const newUser: UserAccount = {
            phoneNumber: phone,
            password: password,
            role: phone === '0999999999' ? 'ACCOUNTANT' : 'CLIENT',
            profile: null,
            transactions: [],
            chatHistory: [],
            p2pChat: [],
            createdAt: Date.now(),
            isPaid: false
        };
        
        await databaseService.updateUser(newUser);
        localStorage.setItem(SESSION_KEY, phone);
        return newUser;
    },

    /**
     * ĐĂNG NHẬP
     */
    login: async (phone: string, password?: string): Promise<UserAccount> => {
        // Tạo tài khoản kế toán mặc định trên Cloud nếu chưa có (chỉ chạy lần đầu)
        if (phone === '0999999999') {
            const acc = await databaseService.getUser(phone);
            if (!acc) {
                const accountant: UserAccount = {
                    phoneNumber: phone,
                    password: '123456',
                    role: 'ACCOUNTANT',
                    profile: null,
                    transactions: [],
                    chatHistory: [],
                    p2pChat: [],
                    createdAt: Date.now(),
                    isPaid: true
                };
                await databaseService.updateUser(accountant);
            }
        }

        const user = await databaseService.getUser(phone);
        if (!user) throw new Error("Tài khoản không tồn tại.");
        if (password && user.password && user.password !== password) throw new Error("Mã PIN không chính xác.");
        
        localStorage.setItem(SESSION_KEY, phone);
        return user;
    },

    /**
     * ĐẶT LẠI MẬT KHẨU
     */
    resetPassword: async (phone: string, newPin: string): Promise<void> => {
        const user = await databaseService.getUser(phone);
        if (!user) throw new Error("Số điện thoại chưa được đăng ký.");
        
        user.password = newPin;
        await databaseService.updateUser(user);
    },

    /**
     * ĐỒNG BỘ DỮ LIỆU
     */
    syncUserData: async (user: UserAccount): Promise<void> => {
        await databaseService.updateUser(user);
        if (!IS_CLOUD_ENABLED) await simulateDelay(200);
    },

    /**
     * KHÔI PHỤC PHIÊN ĐĂNG NHẬP
     */
    getCurrentSession: async (): Promise<UserAccount | null> => {
        const phone = localStorage.getItem(SESSION_KEY);
        if (!phone) return null;
        return await databaseService.getUser(phone);
    },

    /**
     * ĐĂNG XUẤT
     */
    clearSession: () => {
        localStorage.removeItem(SESSION_KEY);
    },

    /**
     * LẤY DANH SÁCH KHÁCH HÀNG (Dành cho Kế toán)
     */
    getAllClients: async (): Promise<UserAccount[]> => {
        if (IS_CLOUD_ENABLED && dbFirestore) {
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
        } else {
            const db = JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '{}');
            return Object.values(db).filter((u: any) => u.role === 'CLIENT') as UserAccount[];
        }
    },

    /**
     * HỖ TRỢ BACKUP
     */
    exportBackup: async (): Promise<string> => {
        let dbData: AppDatabase = {};
        if (IS_CLOUD_ENABLED && dbFirestore) {
             return "CLOUD_MODE_ACTIVE";
        } else {
            dbData = JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '{}');
        }
        const json = JSON.stringify(dbData);
        return btoa(unescape(encodeURIComponent(json)));
    },

    importBackup: (backupString: string): boolean => {
        if (IS_CLOUD_ENABLED) {
            alert("Đang ở chế độ Cloud. Dữ liệu đã được đồng bộ trực tuyến.");
            return false;
        }
        try {
            const json = decodeURIComponent(escape(atob(backupString)));
            const db = JSON.parse(json);
            if (typeof db !== 'object') return false;
            localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db));
            return true;
        } catch (e) {
            console.error("Import failed", e);
            throw new Error("Mã sao lưu không hợp lệ.");
        }
    },
    
    getDB: (): AppDatabase => {
         return JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '{}');
    }
};
