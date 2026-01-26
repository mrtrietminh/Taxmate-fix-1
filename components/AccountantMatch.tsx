
import React, { useState, useEffect, useRef } from 'react';
import { BookingStep, AccountantProfile, Transaction, P2PMessage } from '../types';
import { formatVND, formatDate } from '../utils';
import { databaseService } from '../services/databaseService';
import { Check, ShieldCheck, Send, Eye, EyeOff, Sparkles, QrCode, Copy, Loader2, ArrowLeft, CheckCircle2, MessageCircle, FileText } from 'lucide-react';
import ServiceQuote from './ServiceQuote';

const SERVICE_FEE = 199000;
const BANK_BIN = '970422'; // MB Bank
const BANK_ACCOUNT = '09102923'; // Số tài khoản nhận tiền (Ví dụ)
const BANK_NAME = 'MB BANK';
const ACCOUNT_NAME = 'TAXMATE COMPANY';

interface AccountantMatchProps {
    transactions: Transaction[];
    currentUserPhone: string;
}

const MOCK_ACCOUNTANT: AccountantProfile = {
    id: '1',
    name: 'Nguyễn Thu Hà',
    rating: 5.0,
    reviews: 312,
    pricePerFiling: 199000,
    avatar: 'https://ui-avatars.com/api/?name=Thu+Ha&background=0D8ABC&color=fff',
    tags: ['Chuyên gia Thuế Khoán', 'Ngành Bán lẻ'],
    isOnline: true,
    licenseNumber: 'CPA-2024-8837'
};

const AccountantMatch: React.FC<AccountantMatchProps> = ({ transactions, currentUserPhone }) => {
  const [step, setStep] = useState<BookingStep>(BookingStep.IDLE);
  const [isDataShared, setIsDataShared] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<P2PMessage[]>([]);
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);
  const [showQuote, setShowQuote] = useState(false); // State để hiển thị bảng giá
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll tin nhắn và trạng thái thanh toán (Async)
  useEffect(() => {
    let isMounted = true;
    const checkStatus = async () => {
        try {
            const user = await databaseService.getUser(currentUserPhone);
            if (user && isMounted) {
                // Tối ưu hóa: Chỉ cập nhật state khi dữ liệu thực sự thay đổi để tránh giật màn hình
                setMessages(prev => {
                    if (JSON.stringify(prev) !== JSON.stringify(user.p2pChat)) {
                        return user.p2pChat;
                    }
                    return prev;
                });

                // Nếu đã thanh toán và đang ở trạng thái IDLE hoặc PAYMENT thì chuyển sang CONNECTED
                // Chỉ chuyển khi không đang xử lý verify thủ công (để tránh xung đột animation)
                if (user.isPaid && (step === BookingStep.IDLE)) {
                    setStep(BookingStep.CONNECTED);
                }
            }
        } catch (e) {
            console.error("Polling error:", e);
        }
    };
    checkStatus(); 
    const interval = setInterval(checkStatus, 3000); // Tăng thời gian poll lên 3s để giảm tải
    return () => {
        isMounted = false;
        clearInterval(interval);
    };
  }, [currentUserPhone, step]);

  const handleSendMessage = async () => {
      if (!chatInput.trim()) return;
      
      const user = await databaseService.getUser(currentUserPhone);
      if (!user) return;

      const newMessage: P2PMessage = {
          id: Date.now().toString(),
          senderId: currentUserPhone,
          text: chatInput.trim(),
          timestamp: Date.now(),
          read: false
      };
      
      user.p2pChat = [...user.p2pChat, newMessage];
      await databaseService.updateUser(user);
      
      // Optimistic update
      setMessages(user.p2pChat); 
      setChatInput('');
  };

  const handleConfirmPayment = async () => {
      setIsVerifyingPayment(true);
      try {
        // Giả lập call API verify giao dịch ngân hàng (2s)
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const user = await databaseService.getUser(currentUserPhone);
        if (user) {
            // Cập nhật trạng thái thanh toán
            user.isPaid = true;
            await databaseService.updateUser(user);
            
            // Chuyển UI
            setStep(BookingStep.MATCHING_CHECKLIST); 
            
            // Giả lập delay tìm kiếm kế toán (2.5s)
            setTimeout(() => {
                setStep(BookingStep.CONNECTED);
            }, 2500);
        } else {
            alert("Không tìm thấy thông tin tài khoản. Vui lòng thử lại.");
        }
      } catch (e) {
          console.error("Payment error:", e);
          alert("Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.");
      } finally {
          setIsVerifyingPayment(false);
      }
  };

  useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, step]); // Chỉ scroll khi số lượng tin nhắn thay đổi hoặc đổi màn hình

  // Generate VietQR URL
  const getQrUrl = () => {
     return `https://img.vietqr.io/image/${BANK_BIN}-${BANK_ACCOUNT}-compact.png?amount=${SERVICE_FEE}&addInfo=${encodeURIComponent(currentUserPhone)}`;
  };

  // NẾU ĐANG XEM BÁO GIÁ THÌ HIỂN THỊ COMPONENT BÁO GIÁ
  if (showQuote) {
      return <ServiceQuote onClose={() => setShowQuote(false)} />;
  }

  // -- SCREEN 1: INTRO --
  if (step === BookingStep.IDLE) {
    return (
        <div className="h-full p-6 flex flex-col items-center justify-center text-center bg-slate-50 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-50 to-transparent"></div>
            
            <div className="relative z-10 w-full max-w-sm">
                {/* NOTIFICATION TEASER: Nếu kế toán đã nhắn tin */}
                {messages.length > 0 && (
                    <div className="mb-6 bg-white rounded-2xl p-4 shadow-lg border border-blue-100 flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                        <div className="relative shrink-0">
                            <img src={MOCK_ACCOUNTANT.avatar} className="w-12 h-12 rounded-full border-2 border-white shadow-sm" alt="Accountant" />
                            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-white">
                                {messages.length}
                            </div>
                        </div>
                        <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900 truncate">
                                {MOCK_ACCOUNTANT.name} <span className="text-slate-400 font-normal">đã nhắn:</span>
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                                <p className="text-xs text-blue-600 font-bold italic truncate">"Bấm để mở khóa nội dung..."</p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
                    <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Sparkles size={40} className="text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 mb-2">Chuyên gia Kế toán</h2>
                    <p className="text-slate-500 text-sm mb-6">Kết nối 1-1 với kế toán chuyên nghiệp để soát xét sổ sách và tối ưu thuế.</p>
                    
                    <div className="bg-slate-50 rounded-xl p-4 mb-8 text-left space-y-3">
                        <div className="flex items-center gap-3 text-sm text-slate-700">
                            <Check size={16} className="text-green-500 shrink-0" />
                            <span>Rà soát toàn bộ sổ sách 2024-2025</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-700">
                            <Check size={16} className="text-green-500 shrink-0" />
                            <span>Tư vấn tối ưu thuế khoán</span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-700">
                            <Check size={16} className="text-green-500 shrink-0" />
                            <span>Hỗ trợ giải trình với cơ quan thuế</span>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <button onClick={() => setStep(BookingStep.PAYMENT)} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-all">
                            {messages.length > 0 ? 'Mở khóa tin nhắn ngay' : 'Kết nối ngay'} • {formatVND(SERVICE_FEE)}
                        </button>
                        
                        <button 
                            onClick={() => setShowQuote(true)}
                            className="w-full py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 active:scale-95 transition-all flex items-center justify-center gap-2 text-sm"
                        >
                             <FileText size={16} /> Xem bảng giá chi tiết
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // -- SCREEN 2: PAYMENT (QR CODE) --
  if (step === BookingStep.PAYMENT) {
      return (
        <div className="h-full bg-slate-50 flex flex-col">
            <div className="bg-white px-4 py-3 border-b border-slate-100 flex items-center gap-2 sticky top-0 z-10">
                <button onClick={() => setStep(BookingStep.IDLE)} className="p-2 -ml-2 rounded-full hover:bg-slate-50"><ArrowLeft size={20}/></button>
                <h2 className="font-bold text-slate-800">Thanh toán dịch vụ</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 w-full max-w-sm text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-4">Quét mã để thanh toán</p>
                    
                    <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-inner mb-6 inline-block">
                        <img src={getQrUrl()} alt="VietQR" className="w-48 h-48 object-contain mix-blend-multiply" />
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-3 border-b border-dashed border-slate-200">
                            <span className="text-sm text-slate-500">Ngân hàng</span>
                            <span className="text-sm font-bold text-slate-900">{BANK_NAME}</span>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-dashed border-slate-200">
                            <span className="text-sm text-slate-500">Số tài khoản</span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 tracking-wider">{BANK_ACCOUNT}</span>
                                <button className="text-blue-600 p-1 hover:bg-blue-50 rounded"><Copy size={14}/></button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-dashed border-slate-200">
                            <span className="text-sm text-slate-500">Chủ tài khoản</span>
                            <span className="text-sm font-bold text-slate-900">{ACCOUNT_NAME}</span>
                        </div>
                        <div className="flex justify-between items-center py-3">
                            <span className="text-sm text-slate-500">Số tiền</span>
                            <span className="text-xl font-black text-blue-600">{formatVND(SERVICE_FEE)}</span>
                        </div>
                    </div>
                </div>

                <div className="mt-6 w-full max-w-sm">
                    <button 
                        onClick={handleConfirmPayment}
                        disabled={isVerifyingPayment}
                        className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-green-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isVerifyingPayment ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                        {isVerifyingPayment ? 'Đang xác minh...' : 'Tôi đã chuyển khoản'}
                    </button>
                    <p className="text-center text-xs text-slate-400 mt-4 px-4">
                        Hệ thống sẽ tự động kích hoạt kết nối ngay sau khi nhận được tiền.
                    </p>
                </div>
            </div>
        </div>
      );
  }

  // -- SCREEN 3: MATCHING SIMULATION --
  if (step === BookingStep.MATCHING_CHECKLIST) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-white p-8 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-25"></div>
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center relative z-10">
                    <Loader2 size={40} className="text-blue-600 animate-spin" />
                </div>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Đang tìm kế toán phù hợp...</h2>
            <p className="text-slate-500 text-sm">Chúng tôi đang phân tích ngành hàng và quy mô kinh doanh của bạn.</p>
        </div>
      );
  }

  // -- SCREEN 4: CONNECTED (CHAT) --
  if (step === BookingStep.CONNECTED) {
      return (
          <div className="h-full bg-slate-100 flex flex-col">
              <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-10">
                  <div className="flex items-center gap-3">
                      <div className="relative">
                        <img src={MOCK_ACCOUNTANT.avatar} className="w-10 h-10 rounded-full border-2 border-green-500" alt="Accountant" />
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>
                      <div>
                          <p className="text-sm font-bold text-slate-900">{MOCK_ACCOUNTANT.name}</p>
                          <p className="text-[10px] text-green-600 font-bold bg-green-50 px-1.5 py-0.5 rounded w-fit">Đã xác thực</p>
                      </div>
                  </div>
                  <button onClick={() => setIsDataShared(!isDataShared)} className={`p-2 rounded-xl transition-colors ${isDataShared ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                      {isDataShared ? <Eye size={20} /> : <EyeOff size={20} />}
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* System Message */}
                  <div className="flex justify-center my-4">
                      <div className="bg-blue-50 text-blue-800 text-[11px] px-3 py-1.5 rounded-full font-medium">
                          Đã kết nối với kế toán viên. Phí dịch vụ: {formatVND(SERVICE_FEE)} (Đã thanh toán)
                      </div>
                  </div>

                  {messages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.senderId === currentUserPhone ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-[14px] shadow-sm ${msg.senderId === currentUserPhone ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'}`}>
                              {msg.text}
                          </div>
                      </div>
                  ))}
                  <div ref={messagesEndRef} />
              </div>

              <div className="bg-white border-t border-slate-200 p-3 pb-safe flex gap-2">
                  <input 
                      type="text" 
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Trao đổi với kế toán..."
                      className="flex-1 bg-slate-50 rounded-full px-5 py-3 text-sm outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                      onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              handleSendMessage();
                          }
                      }}
                  />
                  <button onClick={handleSendMessage} disabled={!chatInput.trim()} className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg active:scale-95 disabled:opacity-50"><Send size={20} /></button>
              </div>
          </div>
      );
  }

  return null;
};

export default AccountantMatch;
