
import React, { useState } from 'react';
import { Phone, ArrowRight, Lock, Loader2, Briefcase, ChevronLeft, UserPlus } from 'lucide-react';
import { databaseService } from '../services/databaseService';
import { UserAccount } from '../types';

interface LoginProps {
  onLoginSuccess: (user: UserAccount) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (phoneNumber.length < 10) {
        setError('Số điện thoại không hợp lệ.');
        return;
    }
    if (password.length < 4) {
        setError('Mật khẩu phải ít nhất 4 ký tự.');
        return;
    }

    setIsLoading(true);
    try {
        if (isRegister) {
            const user = await databaseService.register(phoneNumber, password);
            onLoginSuccess(user);
        } else {
            const user = await databaseService.login(phoneNumber, password);
            onLoginSuccess(user);
        }
    } catch (err: any) {
        setError(err.message || 'Có lỗi xảy ra.');
    } finally {
        setIsLoading(false);
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
                <p className="text-blue-100 text-sm">Cloud-Based Tax Assistant</p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-100">
                <form onSubmit={handleAuth} className="space-y-5">
                    <h2 className="text-xl font-bold text-slate-800">
                        {isRegister ? 'Tạo tài khoản mới' : 'Chào mừng trở lại'}
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
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Mật khẩu</label>
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 transition-all">
                            <Lock size={20} className="text-slate-400 mr-3" />
                            <input 
                                type="password" 
                                placeholder="••••••"
                                className="flex-1 bg-transparent outline-none font-medium text-slate-900 placeholder:text-slate-400"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-xs bg-red-50 p-3 rounded-xl border border-red-100 font-medium">{error}</p>}

                    <button 
                        type="submit"
                        disabled={isLoading}
                        className={`w-full text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg ${phoneNumber === '0999999999' ? 'bg-indigo-900' : 'bg-blue-600'}`}
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <>{isRegister ? 'Đăng ký' : 'Đăng nhập'} <ArrowRight size={18} /></>}
                    </button>

                    <button 
                        type="button"
                        onClick={() => setIsRegister(!isRegister)}
                        className="w-full text-center text-sm font-bold text-blue-600 hover:underline pt-2 flex items-center justify-center gap-1"
                    >
                        {isRegister ? <><ChevronLeft size={16}/> Đã có tài khoản? Đăng nhập</> : <><UserPlus size={16}/> Người dùng mới? Đăng ký ngay</>}
                    </button>
                </form>
            </div>
            <p className="mt-8 text-center text-[10px] text-slate-400 uppercase tracking-widest">
                Protected by Google Cloud Security
            </p>
        </div>
    </div>
  );
};

export default Login;
