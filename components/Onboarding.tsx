
import React, { useState, useRef } from 'react';
import { Camera, ArrowRight, Loader2, Store, CreditCard, MapPin, User, Briefcase, ChevronLeft, Hash } from 'lucide-react';
import { analyzeBusinessLicense } from '../services/geminiService';
import { BusinessProfile } from '../types';

interface OnboardingProps {
  onComplete: (profile: BusinessProfile) => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Intro, 2: Upload/Method, 3: Form
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State form data
  const [formData, setFormData] = useState<BusinessProfile>({
    name: '',
    taxId: '',
    address: '',
    industry: '',
    industryCode: '',
    ownerName: ''
  });

  // State for showing OCR fallback message
  const [showOcrFallbackMessage, setShowOcrFallbackMessage] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const extracted = await analyzeBusinessLicense(base64);

      setIsProcessing(false);
      if (extracted && extracted.name?.trim() && extracted.taxId?.trim()) {
        // OCR successful - prefill form and go to step 3
        setShowOcrFallbackMessage(false);
        setFormData(extracted);
        setStep(3);
      } else {
        // OCR failed or incomplete - GRACEFUL FALLBACK
        // Don't show scary error, just guide to manual entry with friendly message
        setShowOcrFallbackMessage(true);
        setStep(3); // Automatically go to manual entry form
      }
    };
    reader.readAsDataURL(file);
  };

  const handleManualEntry = () => {
      setStep(3);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      // Basic validation
      if (!formData.name.trim() || !formData.taxId.trim()) {
          alert("Vui lòng nhập Tên hộ kinh doanh và Mã số thuế.");
          return;
      }
      onComplete(formData);
  };

  // --- RENDER STEP 1: WELCOME ---
  if (step === 1) {
    return (
      <div className="h-full bg-white p-6 flex flex-col justify-center items-center text-center">
        <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-blue-200">
          <span className="text-4xl text-white font-bold">T</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Chào mừng bạn đến với TaxMate</h1>
        <p className="text-slate-500 mb-8 max-w-xs">Ứng dụng kế toán AI dành riêng cho Hộ kinh doanh thời đại số.</p>
        
        <button 
          onClick={() => setStep(2)}
          className="w-full max-w-xs bg-blue-600 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all active:scale-95"
        >
          Bắt đầu ngay <ArrowRight size={20} />
        </button>
      </div>
    );
  }

  // --- RENDER STEP 2: CHOOSE METHOD (UPLOAD) ---
  if (step === 2) {
    return (
        <div className="h-full bg-slate-50 p-6 flex flex-col pt-safe">
          <div className="mb-8 mt-4">
            <div className="flex gap-2 mb-4">
                <div className="h-1.5 flex-1 bg-blue-600 rounded-full"></div>
                <div className="h-1.5 flex-1 bg-slate-200 rounded-full"></div>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Thiết lập hồ sơ</h2>
            <p className="text-slate-500 text-sm">Vui lòng chụp ảnh <strong>Giấy chứng nhận đăng ký hộ kinh doanh</strong> để AI tự động nhập liệu.</p>
          </div>
    
          <div 
            onClick={() => !isProcessing && fileInputRef.current?.click()}
            className="flex-1 max-h-80 border-2 border-dashed border-blue-300 bg-blue-50 rounded-2xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-blue-100 transition-colors relative overflow-hidden active:scale-95"
          >
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileUpload}
            />
            
            {isProcessing ? (
               <div className="flex flex-col items-center animate-pulse">
                    <Loader2 size={48} className="text-blue-600 animate-spin mb-4" />
                    <p className="text-blue-700 font-medium">Đang quét thông tin...</p>
               </div>
            ) : (
                <>
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <Camera size={32} className="text-blue-600" />
                    </div>
                    <p className="text-blue-700 font-medium">Chạm để chụp ảnh</p>
                </>
            )}
          </div>
    
          <div className="mt-8">
            <button 
                onClick={handleManualEntry}
                disabled={isProcessing}
                className="w-full py-3.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl active:bg-slate-50 transition-colors"
            >
                Nhập tay thông tin
            </button>
          </div>
        </div>
      );
  }

  // --- RENDER STEP 3: FORM INPUT ---
  return (
    <div className="h-full bg-white flex flex-col pt-safe">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
            <button onClick={() => setStep(2)} className="p-2 -ml-2 text-slate-400 hover:bg-slate-50 rounded-full">
                <ChevronLeft />
            </button>
            <h2 className="font-bold text-lg text-slate-800">Thông tin Hộ kinh doanh</h2>
        </div>

        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Friendly OCR fallback message - shown when image couldn't be read */}
            {showOcrFallbackMessage && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-2">
                <p className="text-blue-800 text-sm">
                  📝 Để đảm bảo chính xác, vui lòng nhập thông tin hộ kinh doanh của bạn vào form bên dưới.
                </p>
              </div>
            )}
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Tên Hộ Kinh Doanh <span className="text-red-500">*</span></label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                    <Store size={20} className="text-slate-400 mr-3" />
                    <input 
                        required
                        type="text"
                        placeholder="Ví dụ: Tạp Hóa Cô Ba"
                        className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Mã Số Thuế / Số HKD <span className="text-red-500">*</span></label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                    <CreditCard size={20} className="text-slate-400 mr-3" />
                    <input 
                        required
                        type="text"
                        placeholder="031xxxxxxx-001"
                        className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                        value={formData.taxId}
                        onChange={(e) => setFormData({...formData, taxId: e.target.value})}
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Ngành nghề chính</label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                    <Briefcase size={20} className="text-slate-400 mr-3" />
                    <input 
                        type="text"
                        placeholder="Ví dụ: Bán lẻ hàng tạp hóa"
                        className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                        value={formData.industry}
                        onChange={(e) => setFormData({...formData, industry: e.target.value})}
                    />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 ml-1">Dùng để tính tỷ lệ thuế khoán phù hợp.</p>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Mã ngành chính</label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                    <Hash size={20} className="text-slate-400 mr-3" />
                    <input 
                        type="text"
                        placeholder="Ví dụ: 4711"
                        className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                        value={formData.industryCode || ''}
                        onChange={(e) => setFormData({...formData, industryCode: e.target.value})}
                    />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 ml-1">Mã ngành VSIC cấp 4 hoặc 5 (Nếu có).</p>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Chủ hộ kinh doanh</label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                    <User size={20} className="text-slate-400 mr-3" />
                    <input 
                        type="text"
                        placeholder="Họ và tên chủ hộ"
                        className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                        value={formData.ownerName}
                        onChange={(e) => setFormData({...formData, ownerName: e.target.value})}
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Địa chỉ kinh doanh</label>
                <div className="flex items-start bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                    <MapPin size={20} className="text-slate-400 mr-3 mt-0.5" />
                    <textarea 
                        rows={2}
                        placeholder="Số nhà, đường, phường/xã..."
                        className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400 resize-none"
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                    />
                </div>
            </div>

            <div className="pt-4 pb-10">
                <button 
                    type="submit"
                    className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
                >
                    Hoàn tất hồ sơ
                </button>
            </div>
        </form>
    </div>
  );
};

export default Onboarding;
