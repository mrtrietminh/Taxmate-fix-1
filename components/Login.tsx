
import React, { useState } from 'react';
import { Phone, ArrowRight, Lock, Loader2, Briefcase, ChevronLeft, UserPlus, HelpCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import { databaseService } from '../services/databaseService';
import { validatePhoneNumber, validatePin } from '../services/validation';
import { UserAccount } from '../types';

interface LoginProps {
  onLoginSuccess: (user: UserAccount) => void;
}

type AuthMode = 'LOGIN' | 'REGISTER' | 'FORGOT_PASSWORD';

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('LOGIN');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState(''); // Dùng cho Register hoặc Reset
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>, setter: React.Dispatch<React.SetStateAction<string>>) => {
      // Chỉ cho phép nhập số và tối đa 6 ký tự
      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
      setter(val);
  };

  const resetForm = () => {
      setError('');
      setSuccessMsg('');
      setPin('');
      setConfirmPin('');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    // Validate phone number
    const phoneValidation = validatePhoneNumber(phoneNumber);
    if (!phoneValidation.isValid) {
        setError(phoneValidation.error!);
        return;
    }

    // Validate PIN
    const pinValidation = validatePin(pin);
    if (!pinValidation.isValid) {
        setError(pinValidation.error!);
        return;
    }

    // Validate PIN confirmation for register/reset
    if ((mode === 'REGISTER' || mode === 'FORGOT_PASSWORD') && pin !== confirmPin) {
        setError('Mã PIN xác nhận không khớp.');
        return;
    }

    setIsLoading(true);
    try {
        if (mode === 'REGISTER') {
            const user = await databaseService.register(phoneNumber, pin);
            onLoginSuccess(user);
        } else if (mode === 'LOGIN') {
            const user = await databaseService.login(phoneNumber, pin);
            onLoginSuccess(user);
        } else if (mode === 'FORGOT_PASSWORD') {
            await databaseService.resetPassword(phoneNumber, pin);
            setSuccessMsg('Đặt lại mã PIN thành công. Vui lòng đăng nhập.');
            setTimeout(() => {
                setMode('LOGIN');
                resetForm();
            }, 1500);
        }
    } catch (err: any) {
        setError(err.message || 'Có lỗi xảy ra.');
    } finally {
        setIsLoading(false);
    }
  };

  const getTitle = () => {
      switch(mode) {
          case 'LOGIN': return 'Chào mừng trở lại';
          case 'REGISTER': return 'Tạo mã PIN mới';
          case 'FORGOT_PASSWORD': return 'Đặt lại mã PIN';
      }
  };

  const getButtonText = () => {
      switch(mode) {
          case 'LOGIN': return 'Đăng nhập';
          case 'REGISTER': return 'Tạo tài khoản';
          case 'FORGOT_PASSWORD': return 'Xác nhận đổi PIN';
      }
  };

  return (
    <div className="h-full bg-white flex flex-col relative overflow-hidden">
        <div className={`absolute top-0 left-0 w-full h-64 rounded-b-[40px] z-0 transition-colors duration-500 ${phoneNumber === '0999999999' ? 'bg-indigo-900' : 'bg-blue-600'}`}></div>
        
        <div className="z-10 flex-1 flex flex-col px-6 pt-12">
            <div className="text-white mb-8 text-center">
                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                     {phoneNumber === '0999999999' ? <Briefcase size={40} /> : <span className="text-4xl font-bold">T</span>}
                </div>
                <h1 className="text-2xl font-bold">TaxMate</h1>
                <p className="text-blue-100 text-sm">Trợ lý Kế toán Hộ kinh doanh</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-100">
                <form onSubmit={handleAuth} className="space-y-5">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center justify-between">
                        {getTitle()}
                        {mode !== 'LOGIN' && (
                             <button 
                                type="button" 
                                onClick={() => { setMode('LOGIN'); resetForm(); }}
                                className="text-slate-400 hover:text-slate-600"
                             >
                                 <ChevronLeft size={24} />
                             </button>
                        )}
                    </h2>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Số điện thoại</label>
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 transition-all">
                            <Phone size={20} className="text-slate-400 mr-3" />
                            <input 
                                type="tel" 
                                placeholder="09xx xxx xxx"
                                className="flex-1 bg-transparent outline-none font-medium text-slate-900 placeholder:text-slate-400"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">
                            {mode === 'FORGOT_PASSWORD' ? 'Mã PIN mới (6 số)' : 'Mã PIN bảo mật (6 số)'}
                        </label>
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 transition-all">
                            <Lock size={20} className="text-slate-400 mr-3" />
                            <input 
                                type="password" 
                                inputMode="numeric"
                                pattern="[0-9]*"
                                maxLength={6}
                                placeholder="• • • • • •"
                                className="flex-1 bg-transparent outline-none font-medium text-slate-900 placeholder:text-slate-400 tracking-widest text-lg"
                                value={pin}
                                onChange={(e) => handlePinChange(e, setPin)}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    {(mode === 'REGISTER' || mode === 'FORGOT_PASSWORD') && (
                        <div className="animate-in fade-in slide-in-from-top-2">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Xác nhận mã PIN</label>
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 transition-all">
                                <CheckCircle2 size={20} className="text-slate-400 mr-3" />
                                <input 
                                    type="password" 
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    placeholder="• • • • • •"
                                    className="flex-1 bg-transparent outline-none font-medium text-slate-900 placeholder:text-slate-400 tracking-widest text-lg"
                                    value={confirmPin}
                                    onChange={(e) => handlePinChange(e, setConfirmPin)}
                                    disabled={isLoading}
                                />
                            </div>
                        </div>
                    )}

                    {error && <p className="text-red-500 text-xs bg-red-50 p-3 rounded-xl border border-red-100 font-medium animate-pulse">{error}</p>}
                    {successMsg && <p className="text-green-600 text-xs bg-green-50 p-3 rounded-xl border border-green-100 font-medium">{successMsg}</p>}

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className={`w-full text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg ${phoneNumber === '0999999999' ? 'bg-indigo-900' : 'bg-blue-600'}`}
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <>{getButtonText()} <ArrowRight size={18} /></>}
                    </button>

                    {mode === 'LOGIN' && (
                        <div className="flex items-center justify-between pt-2">
                            <button 
                                type="button"
                                onClick={() => { setMode('FORGOT_PASSWORD'); resetForm(); }}
                                className="text-xs font-medium text-slate-400 hover:text-slate-600 flex items-center gap-1"
                            >
                                <HelpCircle size={14} /> Quên mã PIN?
                            </button>
                            <button 
                                type="button"
                                onClick={() => { setMode('REGISTER'); resetForm(); }}
                                className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-1"
                            >
                                <UserPlus size={16}/> Đăng ký mới
                            </button>
                        </div>
                    )}
                </form>
            </div>
            
            <p className="mt-8 text-center text-[10px] text-slate-400 uppercase tracking-widest">
                Secured by TaxMate Cloud
            </p>
        </div>
    </div>
  );
};

export default Login;
