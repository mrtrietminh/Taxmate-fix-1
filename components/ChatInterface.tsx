
import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Loader2, CheckCircle, XCircle, AlertTriangle, ArrowRight, Sparkles, FileText } from 'lucide-react';
import { ChatMessage, Transaction, TransactionType, RiskLevel, BusinessProfile, FirestoreTransaction } from '../types';
import { sendMessageToGemini } from '../services/geminiService';
import { generateId, formatVND, formatDate } from '../utils';
import { databaseService } from '../services/databaseService';

interface ChatInterfaceProps {
  onNewTransaction: (t: Transaction) => void;
  onRemoveTransaction: (id: string) => void;
  businessProfile: BusinessProfile;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  currentUserUid: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onNewTransaction,
  onRemoveTransaction,
  businessProfile,
  messages,
  setMessages,
  currentUserUid
}) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'model',
          text: `Xin chào ${businessProfile.name}! \n\nTaxMate đã sẵn sàng hỗ trợ sổ sách cho hộ kinh doanh của bạn. Hôm nay cửa hàng có phát sinh hóa đơn hay chi phí nào cần ghi nhận không?`,
          timestamp: Date.now(),
        }
      ]);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isProcessing]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputText]);

  const handleSendMessage = async () => {
    if (isProcessing) return;
    const trimmedInput = inputText.trim();
    const files = fileInputRef.current?.files;
    const hasImage = files && files.length > 0;

    if (!trimmedInput && !hasImage) return;

    const userText = trimmedInput;
    setIsProcessing(true);
    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    let base64Image: string | undefined = undefined;
    if (hasImage && files) {
      base64Image = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(files[0]);
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
    }

    const userMsgId = generateId();
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: 'user',
      text: userText || (base64Image ? 'Gửi hình ảnh chứng từ...' : ''),
      timestamp: Date.now(),
      imageUrl: base64Image
    }]);

    const result = await sendMessageToGemini(
        userText || "Phân tích hình ảnh này", 
        base64Image,
        businessProfile
    );

    let pendingTransaction: Transaction | undefined = undefined;
    
    if (result.transaction) {
      const transactionId = generateId();
      const isRisky = result.transaction.riskLevel === RiskLevel.HIGH || result.transaction.riskLevel === RiskLevel.WARNING;
      
      let transDate = new Date().toISOString();
      if (result.transaction.date) {
          // Xử lý ngày tháng an toàn hơn
          const dateStr = result.transaction.date;
          // Kiểm tra định dạng YYYY-MM-DD
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
               const aiDate = new Date(dateStr);
               aiDate.setHours(12, 0, 0, 0); // Đặt giữa trưa để tránh lệch múi giờ
               transDate = aiDate.toISOString();
          } else {
              // Fallback nếu AI trả về format lạ
              try {
                  const aiDate = new Date(dateStr);
                  if (!isNaN(aiDate.getTime())) {
                      transDate = aiDate.toISOString();
                  }
              } catch (e) {
                  console.warn("Date parse error", e);
              }
          }
      }

      // Chuẩn hóa Transaction Type
      const rawType = result.transaction.type.toUpperCase();
      const finalType = (rawType === 'INCOME' || rawType === 'THU') ? TransactionType.INCOME : TransactionType.EXPENSE;

      pendingTransaction = {
        id: transactionId,
        date: transDate,
        amount: result.transaction.amount,
        description: result.transaction.description,
        type: finalType,
        category: result.transaction.category,
        riskLevel: result.transaction.riskLevel as RiskLevel,
        riskNote: result.transaction.riskNote,
        source: base64Image ? 'IMAGE' : 'CHAT',
        isVerified: !isRisky
      };
    }

    // AN TOÀN: Nếu có transaction, ép buộc nội dung text phải là câu hỏi xác nhận
    // Tránh trường hợp AI nói "Đã xong" làm user hiểu lầm
    let replyText = result.reply;
    if (pendingTransaction) {
        if (replyText.toLowerCase().includes("đã lưu") || replyText.toLowerCase().includes("đã ghi")) {
            replyText = "Tôi đã trích xuất được thông tin sau. Vui lòng kiểm tra và bấm Xác nhận bên dưới:";
        } else if (!replyText.includes("xác nhận") && !replyText.includes("kiểm tra")) {
            replyText += "\n\nVui lòng xác nhận thông tin phiếu:";
        }
    }

    setMessages(prev => [...prev, {
      id: generateId(),
      role: 'model',
      text: replyText,
      timestamp: Date.now(),
      pendingData: pendingTransaction, 
      actionRequired: !!pendingTransaction
    }]);

    setIsProcessing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleAction = async (msgId: string, action: 'CONFIRM' | 'REJECT') => {
    if (action === 'CONFIRM') {
      const msg = messages.find(m => m.id === msgId);
      if (msg?.pendingData) {
        // Save to Firestore transactions collection
        const firestoreTransaction: Omit<FirestoreTransaction, 'id'> = {
          businessUserId: currentUserUid,
          date: new Date(msg.pendingData.date).getTime(),
          amount: msg.pendingData.amount,
          type: msg.pendingData.type === TransactionType.INCOME ? 'INCOME' : 'EXPENSE',
          note: msg.pendingData.description,
          createdAt: Date.now(),
          source: 'AI'
        };

        try {
          await databaseService.saveTransaction(firestoreTransaction);
          console.log('✅ Transaction saved to Firestore');
        } catch (e) {
          console.error('Error saving transaction to Firestore:', e);
        }

        // Also update local state for backward compatibility
        onNewTransaction(msg.pendingData);
      }
    }

    setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m;

        if (action === 'CONFIRM') {
            return {
                ...m,
                actionRequired: false,
                relatedTransactionId: m.pendingData?.id,
                text: m.text
            };
        } else {
            return {
                ...m,
                actionRequired: false,
                pendingData: undefined,
                text: "Đã hủy bỏ thao tác này."
            };
        }
    }));
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-hide pb-32 select-text">
        <div className="text-center text-[11px] font-medium text-slate-400 my-4 uppercase tracking-wide">
            Hôm nay, {new Date().toLocaleDateString('vi-VN')}
        </div>
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex w-full group ${msg.role === 'user' ? 'justify-end' : 'justify-start items-end'}`}
          >
            {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 border border-white shadow-sm flex items-center justify-center mr-2 shrink-0 mb-4">
                    <Sparkles size={16} className="text-blue-600" />
                </div>
            )}
            
            <div
              className={`max-w-[85%] md:max-w-[75%] px-4 py-3 text-[15px] shadow-sm leading-relaxed relative ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-[20px] rounded-br-sm'
                  : 'bg-white text-slate-800 border border-slate-100 rounded-[20px] rounded-bl-sm'
              }`}
            >
              {msg.imageUrl && (
                <div className="mb-3 rounded-xl overflow-hidden border border-white/20 shadow-sm">
                    <img src={msg.imageUrl} alt="User upload" className="max-h-60 w-full object-cover" />
                </div>
              )}
              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
              
              {/* Trạng thái: Đã lưu thành công */}
              {msg.relatedTransactionId && !msg.actionRequired && msg.role === 'model' && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle size={14} className="fill-green-100" />
                        <span className="text-xs font-bold">Đã ghi sổ thành công</span>
                    </div>
                </div>
              )}

              {/* Trạng thái: Chờ xác nhận (Preview Card Style) */}
              {msg.actionRequired && msg.pendingData && (
                  <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden relative animate-in fade-in zoom-in-95 duration-200">
                      {/* Ticket Decoration */}
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-indigo-400"></div>
                      
                      <div className="p-3">
                        <div className="flex items-start justify-between mb-3">
                            <div className="flex gap-2">
                                <div className={`p-1.5 rounded-lg h-fit ${msg.pendingData.type === TransactionType.INCOME ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    <FileText size={16} />
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 text-sm line-clamp-2">{msg.pendingData.description}</p>
                                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                                        <span>{msg.pendingData.category}</span>
                                        <span>•</span>
                                        <span>{formatDate(msg.pendingData.date).split(',')[0]}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-baseline justify-between py-2 border-t border-dashed border-slate-300">
                            <span className="text-xs text-slate-500 font-medium">Số tiền</span>
                            <span className={`text-lg font-bold ${msg.pendingData.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-900'}`}>
                                {formatVND(msg.pendingData.amount)}
                            </span>
                        </div>

                        {msg.pendingData.riskLevel !== RiskLevel.SAFE && (
                            <div className="flex gap-2 items-start bg-amber-50 p-2 rounded-lg mb-2">
                                <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-[11px] text-amber-700 leading-tight">
                                    <strong>Lưu ý:</strong> {msg.pendingData.riskNote || "Khoản mục cần xem xét kỹ."}
                                </p>
                            </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 divide-x divide-slate-200 border-t border-slate-200 bg-slate-100">
                          <button 
                            onClick={() => handleAction(msg.id, 'REJECT')}
                            className="py-3 text-slate-600 text-xs font-bold hover:bg-slate-200 active:bg-slate-300 transition-colors"
                          >
                              Hủy bỏ
                          </button>
                          <button 
                            onClick={() => handleAction(msg.id, 'CONFIRM')}
                            className="py-3 text-blue-600 text-xs font-bold hover:bg-blue-50 active:bg-blue-100 transition-colors"
                          >
                              Xác nhận
                          </button>
                      </div>
                  </div>
              )}
            </div>
          </div>
        ))}
        
        {isProcessing && (
          <div className="flex justify-start w-full animate-pulse items-end">
             <div className="w-8 h-8 rounded-full bg-slate-200 mr-2 shrink-0 mb-1"></div>
            <div className="bg-white border border-slate-100 rounded-[20px] rounded-bl-sm px-4 py-3 flex items-center gap-2 shadow-sm">
              <Loader2 className="animate-spin text-blue-600" size={16} />
              <span className="text-slate-500 text-sm font-medium">TaxMate đang viết...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200/50 px-3 py-3 pb-safe z-10">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleSendMessage}
          />
          <button
            onClick={handleImageClick}
            className="w-10 h-10 flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 active:scale-95 rounded-full transition-all shrink-0 mb-0.5"
          >
            <ImageIcon size={20} />
          </button>
          
          <div className="flex-1 bg-slate-100/80 rounded-[24px] flex items-center px-4 py-2 transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-200 border border-transparent shadow-inner">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập thu chi hoặc gửi ảnh..."
              className="flex-1 bg-transparent border-none outline-none text-slate-900 resize-none max-h-32 min-h-[24px] py-1 text-base placeholder:text-slate-400"
              rows={1}
            />
          </div>

          <button
            onClick={handleSendMessage}
            disabled={(!inputText.trim() && !fileInputRef.current?.files?.length) || isProcessing}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all shadow-sm shrink-0 mb-0.5 ${
                (!inputText.trim() && !fileInputRef.current?.files?.length) || isProcessing
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white active:scale-90 shadow-blue-200'
            }`}
          >
            <Send size={18} className={(!inputText.trim() && !fileInputRef.current?.files?.length) ? "ml-0" : "ml-0.5"} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
