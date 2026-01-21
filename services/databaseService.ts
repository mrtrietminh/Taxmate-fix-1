
import { UserAccount, AppDatabase, Transaction, ChatMessage, P2PMessage } from '../types';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, query, where, updateDoc } from 'firebase/firestore';

// --- CẤU HÌNH GOOGLE CLOUD / FIREBASE ---
// Bước 1: Truy cập console.firebase.google.com -> Tạo Project -> Tạo Firestore Database
// Bước 2: Copy config vào bên dưới.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE", // Thay bằng API Key của bạn
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

// Tự động kiểm tra xem đã cấu hình chưa. Nếu chưa thì dùng LocalStorage.
const IS_CLOUD_ENABLED = firebaseConfig.apiKey !== "YOUR_API_KEY_HERE";

let dbFirestore: any;
if (IS_CLOUD_ENABLED) {
    try {
        const app = initializeApp(firebaseConfig);
        dbFirestore = getFirestore(app);
        console.log("✅ Đã kết nối tới Google Cloud Firestore");
    } catch (e) {
        console.error("❌ Lỗi kết nối Firebase:", e);
    }
} else {
    console.warn("⚠️ Chưa cấu hình Firebase. Ứng dụng đang chạy chế độ Local Storage (Offline).");
}

// Key cho LocalStorage (Fallback)
const LOCAL_DB_KEY = 'taxmate_gcp_firestore_v1';
const SESSION_KEY = 'taxmate_active_session';

const simulateDelay = (ms: number = 400) => new Promise(resolve => setTimeout(resolve, ms));

export const databaseService = {
    /**
     * Lấy dữ liệu 1 user (Hỗ trợ cả Cloud & Local)
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
            // Local Storage
            const db = JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '{}');
            return db[phoneNumber] || null;
        }
    },

    /**
     * Lưu/Cập nhật User (Hỗ trợ cả Cloud & Local)
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
        // Tạo tài khoản kế toán mặc định nếu chưa có (chỉ cho demo/first run)
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
        // Debounce nhẹ để tránh spam Firestore
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
     * Đã cập nhật để hoạt động với Firestore
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
     * HỖ TRỢ BACKUP (Giữ nguyên logic cũ hoặc cảnh báo)
     * Với Cloud, backup ít cần thiết hơn, nhưng vẫn giữ để export JSON
     */
    exportBackup: async (): Promise<string> => {
        let dbData: AppDatabase = {};
        if (IS_CLOUD_ENABLED && dbFirestore) {
             // Trên cloud thì chỉ backup được user hiện tại đang login để tránh leak data
             // Hoặc cần logic admin. Tạm thời fallback lấy từ localStorage nếu có, hoặc trả về rỗng.
             // Để đơn giản cho demo: Cảnh báo.
             return "CLOUD_MODE_ACTIVE";
        } else {
            dbData = JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '{}');
        }
        const json = JSON.stringify(dbData);
        return btoa(unescape(encodeURIComponent(json)));
    },

    importBackup: (backupString: string): boolean => {
        if (IS_CLOUD_ENABLED) {
            alert("Đang ở chế độ Cloud. Vui lòng import dữ liệu thông qua Firebase Console.");
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
    
    // --- HELPER CHO LOCAL DB (LEGACY SUPPORT) ---
    // Hàm này giữ lại để tránh break code cũ, nhưng khuyến khích dùng getUser/updateUser
    getDB: (): AppDatabase => {
         return JSON.parse(localStorage.getItem(LOCAL_DB_KEY) || '{}');
    }
};
