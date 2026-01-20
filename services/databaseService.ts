
import { UserAccount, AppDatabase, Transaction, ChatMessage, P2PMessage } from '../types';

// Key cho "Cloud Storage" giả lập qua LocalStorage để đảm bảo persistence
const CLOUD_DB_KEY = 'taxmate_gcp_firestore_v1';
const SESSION_KEY = 'taxmate_active_session';

const simulateCloudDelay = (ms: number = 600) => new Promise(resolve => setTimeout(resolve, ms));

export const databaseService = {
    /**
     * TRUY XUẤT DỮ LIỆU (Đồng bộ)
     * Dùng cho các component cần dữ liệu ngay lập tức hoặc trong các vòng lặp polling
     */
    getDB: (): AppDatabase => {
        const data = localStorage.getItem(CLOUD_DB_KEY);
        return data ? JSON.parse(data) : {};
    },

    /**
     * LƯU DỮ LIỆU (Đồng bộ)
     */
    saveDB: (db: AppDatabase) => {
        localStorage.setItem(CLOUD_DB_KEY, JSON.stringify(db));
    },

    /**
     * CẬP NHẬT NGƯỜI DÙNG (Đồng bộ)
     * Dùng bởi AccountantView và AccountantMatch để cập nhật chat P2P
     */
    updateUser: (user: UserAccount) => {
        const db = databaseService.getDB();
        db[user.phoneNumber] = user;
        databaseService.saveDB(db);
    },

    /**
     * ĐĂNG KÝ (Bất đồng bộ - Mô phỏng GCP)
     */
    register: async (phone: string, password: string): Promise<UserAccount> => {
        await simulateCloudDelay(1000);
        const db = databaseService.getDB();
        
        if (db[phone]) throw new Error("Số điện thoại này đã tồn tại trên hệ thống.");
        
        const newUser: UserAccount = {
            phoneNumber: phone,
            password: password,
            role: phone === '0999999999' ? 'ACCOUNTANT' : 'CLIENT',
            profile: null,
            transactions: [],
            chatHistory: [],
            p2pChat: [],
            createdAt: Date.now(),
            isPaid: false // Mặc định chưa thanh toán
        };
        
        db[phone] = newUser;
        databaseService.saveDB(db);
        localStorage.setItem(SESSION_KEY, phone);
        return newUser;
    },

    /**
     * ĐĂNG NHẬP (Bất đồng bộ - Mô phỏng GCP)
     */
    login: async (phone: string, password?: string): Promise<UserAccount> => {
        await simulateCloudDelay(800);
        const db = databaseService.getDB();
        
        // Khởi tạo tài khoản kế toán mặc định nếu chưa có
        if (phone === '0999999999' && !db[phone]) {
            db[phone] = {
                phoneNumber: phone,
                password: 'admin',
                role: 'ACCOUNTANT',
                profile: null,
                transactions: [],
                chatHistory: [],
                p2pChat: [],
                createdAt: Date.now(),
                isPaid: true
            };
            databaseService.saveDB(db);
        }

        const user = db[phone];
        if (!user) throw new Error("Tài khoản không tồn tại.");
        if (password && user.password && user.password !== password) throw new Error("Mật khẩu không chính xác.");
        
        localStorage.setItem(SESSION_KEY, phone);
        return user;
    },

    /**
     * ĐỒNG BỘ DỮ LIỆU (Bất đồng bộ - Mô phỏng GCP Sync)
     */
    syncUserData: async (user: UserAccount): Promise<void> => {
        await simulateCloudDelay(400); 
        const db = databaseService.getDB();
        db[user.phoneNumber] = user;
        databaseService.saveDB(db);
        console.log(`[GCP Sync] Cloud synchronization for ${user.phoneNumber} completed.`);
    },

    /**
     * KHÔI PHỤC PHIÊN ĐĂNG NHẬP
     */
    getCurrentSession: async (): Promise<UserAccount | null> => {
        const phone = localStorage.getItem(SESSION_KEY);
        if (!phone) return null;
        
        // Mô phỏng kiểm tra token trên server
        await simulateCloudDelay(300);
        const db = databaseService.getDB();
        return db[phone] || null;
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
    getAllClients: (): UserAccount[] => {
        const db = databaseService.getDB();
        return Object.values(db).filter(u => u.role === 'CLIENT');
    }
};
