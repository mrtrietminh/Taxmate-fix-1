
import React, { useState, useEffect, useRef } from 'react';
import { TransactionType, BusinessProfile, FirestoreTransaction, HumanMessage } from '../types';
import { formatVND, formatDate } from '../utils';
import { databaseService } from '../services/databaseService';
import { Send, FileText, TrendingUp, LogOut, Search, ChevronRight, ChevronLeft, MessageSquare, Store, Calculator, Bot, PenLine } from 'lucide-react';

interface AccountantViewProps {
    onLogout: () => void;
    accountantUid: string;
}

interface ClientData {
    uid: string;
    phoneNumber: string;
    profile: BusinessProfile | null;
    transactions: FirestoreTransaction[];
}

const AccountantView: React.FC<AccountantViewProps> = ({ onLogout, accountantUid }) => {
    const [clients, setClients] = useState<ClientData[]>([]);
    const [selectedClientUid, setSelectedClientUid] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'CHAT' | 'BOOKS'>('CHAT');
    const [chatInput, setChatInput] = useState('');
    const [messages, setMessages] = useState<HumanMessage[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch assigned clients from Firestore
    useEffect(() => {
        const fetchClients = async () => {
            try {
                const assignedClients = await databaseService.getAssignedClients(accountantUid);
                const clientDataList: ClientData[] = assignedClients.map(c => ({
                    uid: c.user.uid,
                    phoneNumber: c.user.phoneNumber,
                    profile: c.profile,
                    transactions: c.transactions
                }));
                setClients(prevClients => {
                    if (JSON.stringify(clientDataList) !== JSON.stringify(prevClients)) {
                        return clientDataList;
                    }
                    return prevClients;
                });
            } catch (e) {
                console.error("Error fetching clients:", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchClients();

        // Poll for updates every 5 seconds
        const interval = setInterval(fetchClients, 5000);
        return () => clearInterval(interval);
    }, [accountantUid]);

    // Fetch messages when a client is selected
    useEffect(() => {
        if (!selectedClientUid) return;

        const fetchMessages = async () => {
            const roomId = databaseService.generateRoomId(selectedClientUid, accountantUid);
            const roomMessages = await databaseService.getRoomMessages(roomId);
            setMessages(prev => {
                if (JSON.stringify(roomMessages) !== JSON.stringify(prev)) {
                    return roomMessages;
                }
                return prev;
            });
        };
        fetchMessages();

        // Poll for new messages every 3 seconds
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [selectedClientUid, accountantUid]);

    const selectedClient = clients.find(c => c.uid === selectedClientUid);

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !selectedClientUid) return;

        const roomId = databaseService.generateRoomId(selectedClientUid, accountantUid);
        await databaseService.sendHumanMessage(roomId, accountantUid, 'ACCOUNTANT', chatInput.trim());

        // Optimistic update
        const newMessage: HumanMessage = {
            roomId,
            senderId: accountantUid,
            senderRole: 'ACCOUNTANT',
            text: chatInput.trim(),
            createdAt: Date.now()
        };
        setMessages(prev => [...prev, newMessage]);
        setChatInput('');
    };

    // Auto-scroll when new messages arrive
    useEffect(() => {
        if (activeTab === 'CHAT') {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages.length, activeTab]);

    const filteredClients = clients.filter(c =>
        (c.profile?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phoneNumber.includes(searchTerm)
    );

    // Screen 1: Client List
    if (!selectedClientUid) {
        return (
            <div className="h-full bg-slate-50 flex flex-col">
                <div className="bg-indigo-900 text-white pt-safe pb-6 px-4 shadow-lg shrink-0">
                    <div className="flex justify-between items-center h-[60px] mb-4">
                        <h1 className="font-bold text-lg">Khách hàng được phân công</h1>
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
                    {isLoading ? (
                        <div className="text-center py-20 text-slate-400 text-sm">Đang tải...</div>
                    ) : filteredClients.length === 0 ? (
                        <div className="text-center py-20 opacity-30 italic text-sm">Chưa có khách hàng được phân công.</div>
                    ) : (
                        filteredClients.map(client => (
                            <button
                                key={client.uid}
                                onClick={() => setSelectedClientUid(client.uid)}
                                className="w-full bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between active:scale-95 transition-all text-left group"
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors relative shrink-0">
                                        {client.profile?.name?.charAt(0) || '?'}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-900 line-clamp-1 break-words">{client.profile?.name || 'Chưa thiết lập'}</p>
                                        <div className="flex gap-3 text-[11px] text-slate-500 mt-0.5">
                                            <span className="flex items-center gap-1 font-mono truncate">{client.phoneNumber}</span>
                                            <span className="text-indigo-600 font-bold">{client.transactions.length} giao dịch</span>
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight size={18} className="text-slate-300 shrink-0" />
                            </button>
                        ))
                    )}
                </div>
            </div>
        );
    }

    // Screen 2: Client Detail (Chat & Books)
    const transactions = selectedClient?.transactions || [];
    const income = transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);

    return (
        <div className="h-full bg-slate-50 flex flex-col">
            <div className="bg-indigo-900 text-white pt-safe px-4 shadow-lg shrink-0">
                <div className="flex items-center justify-between h-[60px] mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        <button
                            type="button"
                            onClick={() => setSelectedClientUid(null)}
                            className="p-2 -ml-2 hover:bg-white/10 rounded-full active:scale-90 shrink-0"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-full bg-white text-indigo-900 font-bold flex items-center justify-center shrink-0">
                                {selectedClient?.profile?.name?.charAt(0) || '?'}
                            </div>
                            <div className="overflow-hidden min-w-0">
                                <p className="font-bold text-sm leading-tight truncate">{selectedClient?.profile?.name || 'Chưa thiết lập'}</p>
                                <p className="text-[10px] text-indigo-200 uppercase mt-0.5 font-mono truncate">{selectedClient?.phoneNumber}</p>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onLogout}
                        className="p-2 hover:bg-white/10 rounded-full active:scale-95 text-indigo-300 hover:text-white shrink-0"
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
                        {messages.length === 0 ? (
                            <div className="text-center py-20 opacity-30 italic text-sm">Chưa có hội thoại nào với khách hàng này.</div>
                        ) : (
                            messages.map((msg, i) => (
                                <div key={msg.id || i} className={`flex ${msg.senderRole === 'ACCOUNTANT' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-[14px] shadow-sm ${
                                        msg.senderRole === 'ACCOUNTANT'
                                            ? 'bg-indigo-600 text-white rounded-br-none'
                                            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                                    }`}>
                                        {msg.text}
                                        <p className={`text-[9px] mt-1 text-right ${msg.senderRole === 'ACCOUNTANT' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                ) : (
                    <div className="p-4 space-y-6">
                        {/* Business Info */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
                                <Store size={16} className="text-indigo-600" /> Thông tin HKD
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-slate-500">MST</span>
                                    <span className="font-mono font-medium">{selectedClient?.profile?.taxId || '--'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Ngành nghề</span>
                                    <span className="font-medium text-right max-w-[60%] line-clamp-1">{selectedClient?.profile?.industry || '--'}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-500">Chủ HKD</span>
                                    <span className="font-medium">{selectedClient?.profile?.ownerName || '--'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Financial Summary */}
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

                        {/* Transaction List */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <FileText size={16} className="text-indigo-600" /> Nhật ký giao dịch
                            </h3>
                            {transactions.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 text-sm">Khách hàng chưa ghi nhận giao dịch nào.</div>
                            ) : (
                                transactions.map(t => (
                                    <div key={t.id} className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-start shadow-sm">
                                        <div className="flex-1 min-w-0 mr-2">
                                            <p className="text-sm font-bold text-slate-800 line-clamp-2 break-words mb-1">{t.note}</p>
                                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                                <span className={`px-1.5 py-0.5 rounded flex items-center gap-1 ${t.source === 'AI' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                                                    {t.source === 'AI' ? <Bot size={10} /> : <PenLine size={10} />}
                                                    {t.source === 'AI' ? 'AI' : 'Thủ công'}
                                                </span>
                                                <span>•</span>
                                                <span className="whitespace-nowrap">{new Date(t.date).toLocaleDateString('vi-VN')}</span>
                                            </div>
                                        </div>
                                        <div className="text-right whitespace-nowrap">
                                            <p className={`text-sm font-black ${t.type === 'INCOME' ? 'text-green-600' : 'text-slate-900'}`}>
                                                {t.type === 'INCOME' ? '+' : '-'}{formatVND(t.amount)}
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
