
import React, { useState, useEffect, useRef } from 'react';
import { Transaction, P2PMessage, TransactionType, RiskLevel, UserAccount } from '../types';
import { formatVND, formatDate } from '../utils';
import { databaseService } from '../services/databaseService';
import { Send, FileText, Phone, TrendingUp, LogOut, Search, ChevronRight, ChevronLeft, MessageSquare, CreditCard, Store, AlertTriangle, Calculator } from 'lucide-react';

interface AccountantViewProps {
    onLogout: () => void;
}

const AccountantView: React.FC<AccountantViewProps> = ({ onLogout }) => {
    const [clients, setClients] = useState<UserAccount[]>([]);
    const [selectedClientPhone, setSelectedClientPhone] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'CHAT' | 'BOOKS'>('CHAT');
    const [chatInput, setChatInput] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setClients(databaseService.getAllClients());
        const interval = setInterval(() => {
            setClients(databaseService.getAllClients());
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const selectedClient = clients.find(c => c.phoneNumber === selectedClientPhone);

    const handleSendMessage = () => {
        if (!chatInput.trim() || !selectedClientPhone) return;

        // Lấy dữ liệu tươi từ DB để tránh race condition (ghi đè state cũ)
        const db = databaseService.getDB();
        const client = db[selectedClientPhone];
        
        if (!client) return;

        const newMessage: P2PMessage = {
            id: Date.now().toString(),
            senderId: 'ACCOUNTANT',
            text: chatInput.trim(),
            timestamp: Date.now(),
            read: false
        };

        const updatedClient = {
            ...client,
            p2pChat: [...client.p2pChat, newMessage]
        };

        // Lưu vào DB
        databaseService.updateUser(updatedClient);
        
        // Cập nhật UI ngay lập tức (Optimistic update)
        setClients(prev => prev.map(c => c.phoneNumber === selectedClientPhone ? updatedClient : c));
        setChatInput('');
    };
    
    // Auto-scroll khi có tin nhắn mới
    useEffect(() => {
        if (activeTab === 'CHAT' && selectedClient?.p2pChat) {
             messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [selectedClient?.p2pChat, activeTab]);

    const filteredClients = clients.filter(c => 
        (c.profile?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phoneNumber.includes(searchTerm)
    );

    // Màn hình 1: Danh sách khách hàng
    if (!selectedClientPhone) {
        return (
            <div className="h-full bg-slate-50 flex flex-col">
                <div className="bg-indigo-900 text-white pt-safe pb-6 px-4 shadow-lg shrink-0">
                    <div className="flex justify-between items-center h-[60px] mb-4">
                        <h1 className="font-bold text-lg">Quản lý Khách hàng</h1>
                        <button 
                            type="button" 
                            onClick={onLogout} 
                            className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full active:scale-95 transition-all cursor-pointer"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300" size={18} />
                        <input 
                            type="text"
                            placeholder="Tìm tên hoặc SĐT khách hàng..."
                            className="w-full bg-indigo-800 border-none rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredClients.length === 0 ? (
                        <div className="text-center py-20 opacity-30 italic text-sm">Chưa có khách hàng nào.</div>
                    ) : (
                        filteredClients.map(client => (
                            <button 
                                key={client.phoneNumber}
                                onClick={() => setSelectedClientPhone(client.phoneNumber)}
                                className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-95 transition-all text-left group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors relative">
                                        {client.profile?.name.charAt(0) || '?'}
                                        {client.isPaid && <div className="absolute top-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>}
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-900 line-clamp-1">{client.profile?.name || 'Chưa thiết lập'}</p>
                                        <div className="flex gap-3 text-[11px] text-slate-500 mt-0.5">
                                            <span className="flex items-center gap-1 font-mono">{client.phoneNumber}</span>
                                            {client.isPaid ? 
                                                <span className="text-green-600 font-bold flex items-center gap-1">Đã thanh toán</span> : 
                                                <span className="text-slate-400 flex items-center gap-1">Chưa thanh toán</span>
                                            }
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-slate-300" />
                            </button>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // Màn hình 2: Chi tiết khách hàng (Chat & Books)
    // Tính toán số liệu cơ bản
    const transactions = selectedClient?.transactions || [];
    const income = transactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    
    // Tính thuế tạm tính (Logic đơn giản để accountant tham khảo)
    const THRESHOLD = 500000000;
    const isExempt = income <= THRESHOLD;
    // Tỷ lệ giả định (1.5% cho bán lẻ) - Trong thực tế nên lấy từ industry code chính xác
    const taxRate = 0.015; 
    const estimatedTax = isExempt ? 0 : income * taxRate;

    return (
        <div className="h-full bg-slate-50 flex flex-col">
            <div className="bg-indigo-900 text-white pt-safe px-4 shadow-lg shrink-0">
                <div className="flex items-center justify-between h-[60px] mb-2">
                    <div className="flex items-center gap-2">
                        <button 
                            type="button" 
                            onClick={() => setSelectedClientPhone(null)} 
                            className="p-2 -ml-2 hover:bg-white/10 rounded-full active:scale-90"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-white text-indigo-900 font-bold flex items-center justify-center shrink-0">
                                {selectedClient?.profile?.name.charAt(0)}
                            </div>
                            <div className="overflow-hidden">
                                <p className="font-bold text-sm leading-tight truncate">{selectedClient?.profile?.name}</p>
                                <p className="text-[10px] text-indigo-200 uppercase mt-0.5 font-mono">{selectedClient?.phoneNumber}</p>
                            </div>
                        </div>
                    </div>
                    {/* Thêm Logout vào đây cho tiện */}
                    <button 
                        type="button" 
                        onClick={onLogout} 
                        className="p-2 hover:bg-white/10 rounded-full active:scale-95 text-indigo-300 hover:text-white"
                    >
                        <LogOut size={20} />
                    </button>
                </div>
                
                <div className="flex bg-indigo-800/50 p-1 rounded-xl mb-4">
                    <button 
                        onClick={() => setActiveTab('CHAT')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'CHAT' ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-300'}`}
                    >
                        <MessageSquare size={14} /> Tư vấn
                    </button>
                    <button 
                        onClick={() => setActiveTab('BOOKS')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'BOOKS' ? 'bg-white text-indigo-900 shadow-sm' : 'text-indigo-300'}`}
                    >
                        <TrendingUp size={14} /> Sổ sách
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50">
                {activeTab === 'CHAT' ? (
                    <div className="p-4 space-y-4 pb-20">
                        {selectedClient?.p2pChat.length === 0 ? (
                            <div className="text-center py-20 opacity-30 italic text-sm">Chưa có hội thoại nào.</div>
                        ) : (
                            selectedClient?.p2pChat.map((msg, i) => (
                                <div key={i} className={`flex ${msg.senderId === 'ACCOUNTANT' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[14px] shadow-sm ${
                                        msg.senderId === 'ACCOUNTANT' 
                                        ? 'bg-indigo-600 text-white rounded-br-none' 
                                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                                    }`}>
                                        {msg.text}
                                        <p className={`text-[9px] mt-1 text-right ${msg.senderId === 'ACCOUNTANT' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                ) : (
                    <div className="p-4 space-y-6">
                        {/* Thông tin định danh */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                                <Store size={16} className="text-indigo-600" /> Thông tin HKD
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">MST</span>
                                    <span className="font-mono font-medium">{selectedClient?.profile?.taxId}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Ngành nghề</span>
                                    <span className="font-medium text-right max-w-[60%] line-clamp-1">{selectedClient?.profile?.industry}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Mã ngành</span>
                                    <span className="font-medium">{selectedClient?.profile?.industryCode || '--'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Tổng quan Tài chính */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tổng thu</p>
                                <p className="text-lg font-black text-green-600">{formatVND(income)}</p>
                            </div>
                            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Tổng chi</p>
                                <p className="text-lg font-black text-slate-900">{formatVND(expense)}</p>
                            </div>
                        </div>

                         {/* Thuế tạm tính (View cho Kế toán) */}
                         <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white p-4 rounded-2xl shadow-md">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <Calculator size={16} className="text-yellow-400" />
                                    <span className="text-xs font-bold uppercase text-slate-300">Thuế phải nộp (Tạm tính)</span>
                                </div>
                                {isExempt && <span className="bg-green-500/20 text-green-300 text-[10px] px-2 py-0.5 rounded font-bold">Miễn thuế</span>}
                            </div>
                            <p className="text-2xl font-bold mb-1">{formatVND(estimatedTax)}</p>
                            <p className="text-[10px] text-slate-400">
                                {isExempt 
                                    ? `Doanh thu ${formatVND(income)} <= 500tr (Miễn nộp)`
                                    : `Doanh thu > 500tr. Tính 1.5% trên tổng doanh thu.`
                                }
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <FileText size={16} className="text-indigo-600" /> Nhật ký giao dịch
                            </h3>
                            {transactions.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-sm">Khách hàng chưa ghi nhận giao dịch nào.</div>
                            ) : (
                                transactions.slice().reverse().map(t => (
                                    <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-start shadow-sm">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 line-clamp-2 mb-1">{t.description}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                <span className="bg-slate-100 px-1.5 py-0.5 rounded">{t.category}</span>
                                                <span>•</span>
                                                <span>{formatDate(t.date).split(' ')[0]}</span>
                                            </div>
                                            {t.riskLevel !== RiskLevel.SAFE && (
                                                <div className="flex items-center gap-1 mt-1.5 text-amber-600">
                                                    <AlertTriangle size={10} />
                                                    <span className="text-[10px] font-medium">Cần lưu ý</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right whitespace-nowrap ml-2">
                                            <p className={`text-sm font-black ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-900'}`}>
                                                {t.type === TransactionType.INCOME ? '+' : '-'}{formatVND(t.amount)}
                                            </p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {activeTab === 'CHAT' && (
                <div className="bg-white border-t border-slate-200 p-3 pb-safe shrink-0 flex gap-2">
                     <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Nhập nội dung tư vấn..."
                        className="flex-1 bg-slate-100 rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        onKeyDown={(e) => {
                            // FIX: Kiểm tra isComposing để tránh gửi tin nhắn khi đang gõ tiếng Việt (Telex/VNI)
                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                      />
                      <button 
                        type="button"
                        onClick={handleSendMessage} 
                        disabled={!chatInput.trim()}
                        className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 disabled:opacity-50"
                      >
                          <Send size={20} />
                      </button>
                </div>
            )}
        </div>
    );
};

export default AccountantView;
