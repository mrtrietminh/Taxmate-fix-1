
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, RiskLevel, BusinessProfile } from '../types';
import { formatVND, formatDate } from '../utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { TrendingUp, TrendingDown, Filter, FileText, Calculator, ChevronLeft, Calendar, Info, Store, MapPin, CreditCard, User, AlertCircle, ChevronRight, Pencil, X, Save, Briefcase, Hash, Download, Upload, Copy, CheckCircle2 } from 'lucide-react';
import { databaseService } from '../services/databaseService';

interface DashboardProps {
  transactions: Transaction[];
  businessProfile: BusinessProfile;
  onUpdateProfile: (profile: BusinessProfile) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ transactions, businessProfile, onUpdateProfile }) => {
  const [viewDetail, setViewDetail] = useState<TransactionType | null>(null);
  const [showTaxInfo, setShowTaxInfo] = useState(false);
  
  // -- State cho tính năng Edit Profile & Backup --
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<BusinessProfile>(businessProfile);
  const [backupMode, setBackupMode] = useState(false); // Tab backup trong modal
  const [backupString, setBackupString] = useState('');
  const [importString, setImportString] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Sync edit form khi businessProfile thay đổi từ props
  useEffect(() => {
      setEditForm(businessProfile);
  }, [businessProfile]);

  // Load backup string when backup mode is active
  useEffect(() => {
      if (backupMode) {
          databaseService.exportBackup().then(setBackupString);
      }
  }, [backupMode]);

  const handleSaveProfile = (e: React.FormEvent) => {
      e.preventDefault();
      onUpdateProfile(editForm);
      setIsEditingProfile(false);
  };
  
  const handleCopyBackup = async () => {
      const code = await databaseService.exportBackup();
      navigator.clipboard.writeText(code);
      setBackupString(code); // Hiển thị để user thấy nếu cần
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleImportBackup = () => {
      if(!importString.trim()) return;
      try {
          databaseService.importBackup(importString);
          alert("Khôi phục dữ liệu thành công! Ứng dụng sẽ tải lại.");
          window.location.reload();
      } catch (e) {
          alert("Mã sao lưu không hợp lệ. Vui lòng kiểm tra lại.");
      }
  };

  // LOGIC: Chọn năm mặc định thông minh
  const [selectedYear, setSelectedYear] = useState(() => {
      const currentYear = new Date().getFullYear();
      if (transactions.length === 0) return currentYear;
      const years = transactions.map(t => new Date(t.date).getFullYear());
      const maxYear = Math.max(...years);
      // Nếu có dữ liệu năm tương lai (ví dụ 2026), hiển thị năm đó
      return maxYear > currentYear ? maxYear : currentYear;
  });

  // Tự động chuyển sang năm có dữ liệu mới nhất khi transactions thay đổi
  useEffect(() => {
      if (transactions.length > 0) {
          const years = transactions.map(t => new Date(t.date).getFullYear());
          const maxYear = Math.max(...years);
          // Nếu năm hiện tại đang xem không có dữ liệu, nhưng năm maxYear có, thì chuyển sang maxYear
          const hasDataForSelected = transactions.some(t => new Date(t.date).getFullYear() === selectedYear);
          if (!hasDataForSelected && maxYear !== selectedYear) {
              setSelectedYear(maxYear);
          }
      }
  }, [transactions]);

  // --- LOGIC: Lọc năm ---
  const availableYears = useMemo(() => {
    const years = new Set<number>(transactions.map((t) => new Date(t.date).getFullYear()));
    years.add(new Date().getFullYear());
    years.add(selectedYear);
    return Array.from(years).sort((a: number, b: number) => b - a);
  }, [transactions, selectedYear]);

  const yearTransactions = useMemo(() => {
    return transactions.filter(t => new Date(t.date).getFullYear() === selectedYear);
  }, [transactions, selectedYear]);

  const yearlyIncome = yearTransactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);

  const yearlyExpense = yearTransactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);

  // --- LOGIC TÍNH THUẾ (CẬP NHẬT THEO THÔNG TƯ 40/2021/TT-BTC) ---
  const THRESHOLD_EXEMPT = 500000000; // Ngưỡng 500 triệu (Theo yêu cầu user)
  // Thực tế luật là >100tr/năm đã phải nộp, nhưng app làm theo yêu cầu user là mốc 500tr.
  
  const taxProgress = Math.min(100, Math.max(0, (yearlyIncome / THRESHOLD_EXEMPT) * 100));

  // Hàm xác định tỷ lệ thuế chính xác hơn theo Phụ lục I
  const getIndustryTaxDetails = (industryStr: string) => {
    const lower = industryStr.toLowerCase();

    // 0. ĐẶC BIỆT: Cho thuê tài sản (Thuế cao nhất: 10%)
    if (lower.includes('cho thuê') || lower.includes('thuê nhà') || lower.includes('thuê phòng') || lower.includes('thuê tài sản')) {
         return { vat: 0.05, pit: 0.05, name: 'Cho thuê tài sản', code: 'Cho thuê' };
    }

    // 1. NHÓM 3: Sản xuất, Vận tải, Ăn uống, Sửa chữa (3% + 1.5% = 4.5%)
    // Cần check trước Nhóm 2 vì "Dịch vụ ăn uống" có từ "dịch vụ" nhưng thuộc nhóm 3
    const group3Keywords = [
        'sản xuất', 'gia công', 'chế biến', // Sản xuất
        'vận tải', 'chở hàng', 'chở khách', 'xe ôm', 'taxi', 'grab', // Vận tải
        'ăn uống', 'nhà hàng', 'quán ăn', 'cafe', 'cà phê', 'trà sữa', 'giải khát', // Ăn uống
        'sửa chữa', 'bảo dưỡng', 'rửa xe', // Sửa chữa
        'xây dựng', 'lắp đặt' // Nếu có bao thầu (mặc định nếu không rõ)
    ];
    if (group3Keywords.some(k => lower.includes(k))) {
         // Check ngoại lệ: Xây dựng KHÔNG bao thầu -> Nhóm 2
         if ((lower.includes('xây dựng') || lower.includes('lắp đặt')) && (lower.includes('không bao thầu') || lower.includes('nhân công'))) {
             // Pass xuống logic nhóm 2
         } else {
             return { vat: 0.03, pit: 0.015, name: 'Sản xuất, Vận tải, Ăn uống', code: 'Nhóm 3' };
         }
    }

    // 2. NHÓM 2: Dịch vụ, Lưu trú (5% + 2% = 7%)
    const group2Keywords = [
        'lưu trú', 'khách sạn', 'nhà nghỉ', 'homestay', // Lưu trú
        'tư vấn', 'thiết kế', 'giám sát', 'kế toán', 'môi giới', 'quảng cáo', // Dịch vụ giấy tờ/media
        'massage', 'karaoke', 'vũ trường', 'game', 'internet', 'bida', 'bi-a', // Giải trí
        'giặt là', 'cắt tóc', 'làm đầu', 'gội đầu', 'spa', 'thẩm mỹ', // Dịch vụ cá nhân
        'xây dựng', 'lắp đặt', 'nhân công' // Case không bao thầu
    ];
    if (group2Keywords.some(k => lower.includes(k))) {
         return { vat: 0.05, pit: 0.02, name: 'Dịch vụ, Xây dựng (nhân công)', code: 'Nhóm 2' };
    }

    // 3. NHÓM 4: Đại lý, Khác (2% + 1% = 3%)
    if (lower.includes('đại lý') || lower.includes('xổ số') || lower.includes('đa cấp')) {
         return { vat: 0.02, pit: 0.01, name: 'Hoạt động kinh doanh khác', code: 'Nhóm 4' };
    }

    // 4. NHÓM 1: Phân phối, Bán buôn/lẻ (Default) (1% + 0.5% = 1.5%)
    return { vat: 0.01, pit: 0.005, name: 'Phân phối, Bán buôn/lẻ', code: 'Nhóm 1' };
  };

  const calculateTaxYearly = () => {
      const settings = getIndustryTaxDetails(businessProfile.industry);
      const totalRate = settings.vat + settings.pit;
      const totalRatePercent = (totalRate * 100).toFixed(1); 
      
      // LOGIC MỚI:
      // <= 500tr: Miễn thuế.
      // > 500tr: Tính trên TOÀN BỘ DOANH THU (Doanh thu x Tỷ lệ).
      
      if (yearlyIncome <= THRESHOLD_EXEMPT) {
          return {
              amount: 0,
              title: `Miễn thuế ${selectedYear}`,
              desc: `${settings.name}`,
              detail: `Thuế suất: ${totalRatePercent}% (${(settings.vat*100)}% GTGT + ${(settings.pit*100)}% TNCN). Hiện tại MIỄN NỘP do doanh thu <= 500tr.`,
              isExempt: true,
              settings: settings
          };
      } else {
          // Tính thuế trên toàn bộ doanh thu
          const tax = yearlyIncome * totalRate;
          return {
              amount: tax,
              title: `Thuế khoán ${selectedYear}`,
              desc: `Thuế suất ${totalRatePercent}% (${settings.code})`,
              detail: `Doanh thu > 500tr: Tính ${totalRatePercent}% trên TỔNG DOANH THU (${formatVND(yearlyIncome)}).`,
              isExempt: false,
              settings: settings
          };
      }
  };

  const taxInfo = calculateTaxYearly();

  // --- LOGIC: Biểu đồ theo tháng ---
  const monthlyChartData = useMemo(() => {
      const data = Array.from({ length: 12 }, (_, i) => ({
          name: `T${i + 1}`,
          income: 0,
          expense: 0
      }));
      
      yearTransactions.forEach(t => {
          const month = new Date(t.date).getMonth();
          if (t.type === TransactionType.INCOME) data[month].income += t.amount;
          else data[month].expense += t.amount;
      });
      
      return data;
  }, [yearTransactions]);

  // --- LOGIC: Group Transactions ---
  const groupedTransactions = useMemo<Record<string, Transaction[]>>(() => {
    if (!viewDetail) return {};
    const filtered = yearTransactions
        .filter(t => t.type === viewDetail)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const groups: Record<string, Transaction[]> = {};
    filtered.forEach(t => {
        const date = new Date(t.date);
        const key = `Tháng ${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
    });
    return groups;
  }, [yearTransactions, viewDetail]);

  // --- VIEW: Detail View ---
  if (viewDetail) {
      return (
        <div className="h-full overflow-y-auto bg-slate-50 pb-safe flex flex-col">
            <div className="sticky top-0 bg-white/90 backdrop-blur-xl border-b border-slate-200 z-20 px-4 py-3 flex items-center gap-3 shadow-sm">
                <button 
                    onClick={() => setViewDetail(null)}
                    className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full active:scale-90 transition-all"
                >
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h2 className="font-bold text-lg text-slate-800">
                        {viewDetail === TransactionType.INCOME ? `Thu Nhập ${selectedYear}` : `Chi Phí ${selectedYear}`}
                    </h2>
                    <p className="text-xs text-slate-500">
                        Tổng cộng: <span className={`font-bold ${viewDetail === TransactionType.INCOME ? 'text-green-600' : 'text-red-600'}`}>
                            {formatVND(viewDetail === TransactionType.INCOME ? yearlyIncome : yearlyExpense)}
                        </span>
                    </p>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {Object.keys(groupedTransactions).length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <FileText size={48} className="mx-auto mb-3 opacity-20" />
                        <p>Chưa có dữ liệu năm {selectedYear}.</p>
                    </div>
                ) : (
                    Object.entries(groupedTransactions).map(([month, transList]: [string, Transaction[]]) => (
                        <div key={month}>
                            <div className="flex items-center gap-2 mb-3 sticky top-[60px] z-10 bg-slate-50/95 backdrop-blur py-2 w-fit px-3 rounded-full border border-slate-100 shadow-sm">
                                <Calendar size={14} className="text-blue-600" />
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{month}</span>
                            </div>
                            <div className="space-y-3">
                                {transList.map((t) => (
                                    <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
                                        <div className="flex items-start gap-3 flex-1 min-w-0">
                                            <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${t.type === TransactionType.INCOME ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                                <FileText size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-slate-900 line-clamp-2 break-words">{t.description}</p>
                                                <p className="text-xs text-slate-500 mt-1">{t.category} • {formatDate(t.date).split(' ')[0]}</p>
                                                {t.riskLevel !== RiskLevel.SAFE && (
                                                    <div className={`mt-2 inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium ${
                                                        t.riskLevel === RiskLevel.HIGH 
                                                        ? 'bg-red-50 border-red-100 text-red-600' 
                                                        : 'bg-amber-50 border-amber-100 text-amber-600'
                                                    }`}>
                                                        {t.riskLevel === RiskLevel.HIGH ? 'Rủi ro cao' : 'Cần lưu ý'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 pl-2">
                                            <p className={`text-sm font-bold ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-900'}`}>
                                                {formatVND(t.amount)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="my-6 border-b border-slate-100"></div>
                        </div>
                    ))
                )}
            </div>
        </div>
      );
  }

  // --- VIEW: Main Dashboard ---
  return (
    <div className="h-full overflow-y-auto bg-slate-50 pb-safe relative">
      <div className="p-4 space-y-6">
        
        {/* Business Profile & Year Selector */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-3 flex items-center justify-between backdrop-blur">
                <div className="flex items-center gap-2">
                    <Store size={16} className="text-blue-600" />
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Hộ kinh doanh</span>
                </div>
                
                {/* Year Selector */}
                <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm shrink-0">
                    <button 
                        onClick={() => {
                            const currentIndex = availableYears.indexOf(selectedYear);
                            if (currentIndex < availableYears.length - 1) setSelectedYear(availableYears[currentIndex + 1]);
                        }}
                        disabled={availableYears.indexOf(selectedYear) >= availableYears.length - 1}
                        className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-bold text-slate-800 px-2 min-w-[50px] text-center">{selectedYear}</span>
                    <button 
                        onClick={() => {
                            const currentIndex = availableYears.indexOf(selectedYear);
                            if (currentIndex > 0) setSelectedYear(availableYears[currentIndex - 1]);
                        }}
                        disabled={availableYears.indexOf(selectedYear) <= 0}
                        className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30"
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>

            <div className="p-4 relative">
                <button 
                    onClick={() => { setIsEditingProfile(true); setBackupMode(false); }}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600 rounded-full transition-colors active:scale-95"
                    title="Chỉnh sửa thông tin"
                >
                    <Pencil size={16} />
                </button>

                <div className="space-y-1 pr-8">
                    <h2 className="text-lg font-bold text-slate-900 leading-tight break-words">{businessProfile.name}</h2>
                    <div className="flex items-center gap-1.5 mt-1 text-slate-500 text-xs">
                        <CreditCard size={12} className="shrink-0" />
                        <span className="font-mono bg-slate-100 px-1 rounded text-slate-600 truncate">{businessProfile.taxId}</span>
                    </div>
                </div>
                
                <div className="space-y-2 pt-2 border-t border-slate-50 mt-3">
                     <div className="flex items-center gap-2 text-xs mt-2 flex-wrap">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-medium border border-blue-100 truncate max-w-full">
                            {businessProfile.industryCode ? `${businessProfile.industryCode} - ` : ''}{businessProfile.industry}
                        </span>
                        {/* Hiển thị nhóm ngành nghề */}
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md font-medium border border-purple-100 truncate max-w-full">
                            {taxInfo.settings?.code || 'Chưa phân loại'}
                        </span>
                     </div>
                </div>
            </div>
        </div>

        {/* Tax Info Card */}
        <div 
            className="bg-gradient-to-br from-indigo-700 to-purple-800 p-5 rounded-3xl shadow-lg shadow-indigo-200 text-white relative overflow-hidden transition-all active:scale-[0.99]"
            onClick={() => setShowTaxInfo(!showTaxInfo)}
        >
            <div className="relative z-10">
                <div className="flex justify-between items-start">
                    <span className="text-indigo-100 text-sm font-medium">{taxInfo.title}</span>
                    <div className="bg-white/10 p-1 rounded-full">
                        <Info size={14} className="text-indigo-100" />
                    </div>
                </div>
                
                <p className="text-3xl font-bold mt-2 tracking-tight break-words">{formatVND(taxInfo.amount)}</p>
                
                {showTaxInfo ? (
                    <div className="mt-4 bg-white/10 p-4 rounded-xl backdrop-blur-md text-xs space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-center border-b border-white/20 pb-2">
                                <span className="font-bold text-indigo-100">Ngưỡng tính thuế (500tr)</span>
                                <span className="text-indigo-200 font-mono">{taxProgress.toFixed(1)}%</span>
                            </div>
                            
                            <div className="space-y-1.5 pt-1">
                                <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                                            yearlyIncome > THRESHOLD_EXEMPT 
                                                ? 'bg-red-400' 
                                                : 'bg-gradient-to-r from-green-300 to-emerald-300'
                                        }`}
                                        style={{ width: `${taxProgress}%` }}
                                    ></div>
                                </div>
                                <p className="text-[10px] text-indigo-200 italic mt-1 leading-relaxed">
                                    {taxInfo.detail}
                                </p>
                            </div>
                    </div>
                ) : (
                        <div className="mt-4 flex gap-2 text-xs bg-white/10 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm items-center max-w-full">
                        {taxInfo.isExempt ? <AlertCircle size={14} className="text-green-300 shrink-0" /> : <Calculator size={14} className="text-indigo-200 shrink-0" />}
                        <span className="truncate">{taxInfo.desc}</span>
                    </div>
                )}
            </div>
            {/* Decoration */}
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-6 -mb-6 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl"></div>
        </div>

        {/* Income/Expense Cards */}
        <div className="grid grid-cols-2 gap-4">
            <button 
                onClick={() => setViewDetail(TransactionType.INCOME)}
                className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 active:scale-95 transition-transform hover:bg-slate-50 cursor-pointer text-left relative overflow-hidden group"
            >
                <div className="absolute top-0 right-0 w-16 h-16 bg-green-50 rounded-bl-3xl -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10 flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-green-100 rounded-xl">
                            <TrendingUp size={18} className="text-green-700" />
                        </div>
                        <span className="text-xs text-slate-500 font-bold">TỔNG THU</span>
                    </div>
                </div>
                <p className="relative z-10 text-base sm:text-lg font-bold text-slate-800 break-words line-clamp-1">{formatVND(yearlyIncome)}</p>
            </button>

            <button 
                onClick={() => setViewDetail(TransactionType.EXPENSE)}
                className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-between h-32 active:scale-95 transition-transform hover:bg-slate-50 cursor-pointer text-left relative overflow-hidden group"
            >
                 <div className="absolute top-0 right-0 w-16 h-16 bg-red-50 rounded-bl-3xl -mr-2 -mt-2 transition-transform group-hover:scale-110"></div>
                <div className="relative z-10 flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-red-100 rounded-xl">
                            <TrendingDown size={18} className="text-red-700" />
                        </div>
                        <span className="text-xs text-slate-500 font-bold">TỔNG CHI</span>
                    </div>
                </div>
                <p className="relative z-10 text-base sm:text-lg font-bold text-slate-800 break-words line-clamp-1">{formatVND(yearlyExpense)}</p>
            </button>
        </div>

        {/* Monthly Chart */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 mb-6">Biểu đồ dòng tiền {selectedYear}</h3>
            <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChartData} barGap={0} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10}} tickFormatter={(val) => `${val / 1000000}M`} />
                        <Tooltip 
                            cursor={{fill: '#f8fafc'}}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '8px 12px', fontSize: '12px' }}
                            formatter={(value: number, name: string) => [formatVND(value), name === 'income' ? 'Thu' : 'Chi']}
                        />
                        <Bar dataKey="income" name="income" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        <Bar dataKey="expense" name="expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>

        {/* Transaction List (Filtered by Year) */}
        <div>
            <div className="sticky top-0 bg-slate-50/90 backdrop-blur pt-2 pb-3 z-10 flex items-center justify-between">
                <h3 className="font-bold text-slate-800">Giao dịch {selectedYear}</h3>
                <button className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-full active:scale-95 transition-transform">
                    <Filter size={14} />
                    Lọc
                </button>
            </div>
            
            <div className="space-y-3 pb-20">
                {yearTransactions.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <p className="text-sm">Không có giao dịch nào trong năm {selectedYear}</p>
                    </div>
                ) : (
                    yearTransactions.slice().reverse().map((t) => (
                    <div key={t.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between active:bg-slate-50 transition-colors">
                        <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${t.type === TransactionType.INCOME ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            <FileText size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[15px] font-semibold text-slate-900 line-clamp-1 break-words">{t.description}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{t.category} • {formatDate(t.date).split(',')[0]}</p>
                            {t.riskLevel !== RiskLevel.SAFE && (
                                <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-medium ${
                                    t.riskLevel === RiskLevel.HIGH 
                                    ? 'bg-red-50 border-red-100 text-red-600' 
                                    : 'bg-amber-50 border-amber-100 text-amber-600'
                                }`}>
                                    {t.riskLevel === RiskLevel.HIGH ? 'Rủi ro cao' : 'Cần lưu ý'}
                                </div>
                            )}
                        </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                        <p className={`text-[15px] font-bold ${t.type === TransactionType.INCOME ? 'text-green-600' : 'text-slate-900'}`}>
                            {t.type === TransactionType.INCOME ? '+' : '-'}{formatVND(t.amount)}
                        </p>
                        </div>
                    </div>
                    ))
                )}
            </div>
        </div>
      </div>

      {/* EDIT PROFILE & BACKUP MODAL */}
      {isEditingProfile && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsEditingProfile(false)}></div>
            <div className="relative bg-white w-full max-w-md rounded-t-[32px] sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <h2 className="font-bold text-lg text-slate-800">Cài đặt tài khoản</h2>
                    <button onClick={() => setIsEditingProfile(false)} className="p-2 -mr-2 text-slate-400 hover:bg-slate-50 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex border-b border-slate-100">
                    <button 
                        onClick={() => setBackupMode(false)}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all ${!backupMode ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
                    >
                        Thông tin
                    </button>
                    <button 
                        onClick={() => setBackupMode(true)}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-all ${backupMode ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'}`}
                    >
                        Sao lưu & Đồng bộ
                    </button>
                </div>
                
                {backupMode ? (
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800 leading-relaxed">
                            <Info size={16} className="inline-block mr-1 -mt-0.5" />
                            Do ứng dụng chạy ở chế độ Demo, dữ liệu chỉ nằm trên thiết bị này. 
                            Để chuyển sang máy khác, hãy sử dụng tính năng bên dưới.
                        </div>

                        {/* Export Section */}
                        <div className="space-y-3">
                            <h3 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2">
                                <Download size={16} /> Sao lưu dữ liệu (Máy cũ)
                            </h3>
                            <p className="text-xs text-slate-500">Copy mã bên dưới và gửi sang máy mới.</p>
                            
                            <button 
                                onClick={handleCopyBackup}
                                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-4 rounded-xl border border-slate-200 font-mono text-xs break-all relative group active:scale-95 transition-all text-left px-4 flex justify-between items-center"
                            >
                                <span className="truncate pr-4 opacity-60">
                                    {backupString ? backupString.substring(0, 30) : 'Loading...'}...
                                </span>
                                {copySuccess ? <CheckCircle2 size={18} className="text-green-600" /> : <Copy size={18} />}
                            </button>
                            {copySuccess && <p className="text-xs text-green-600 font-bold text-center">Đã sao chép vào bộ nhớ đệm!</p>}
                        </div>

                        <div className="border-t border-dashed border-slate-200"></div>

                        {/* Import Section */}
                        <div className="space-y-3">
                            <h3 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2">
                                <Upload size={16} /> Khôi phục dữ liệu (Máy mới)
                            </h3>
                            <p className="text-xs text-slate-500">Dán mã sao lưu vào đây để nạp lại dữ liệu.</p>
                            
                            <textarea
                                value={importString}
                                onChange={(e) => setImportString(e.target.value)}
                                placeholder="Dán mã sao lưu vào đây..."
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-xs font-mono h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                            ></textarea>
                            
                            <button 
                                onClick={handleImportBackup}
                                disabled={!importString.trim()}
                                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
                            >
                                Khôi phục & Tải lại
                            </button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto p-6 space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Tên Hộ Kinh Doanh <span className="text-red-500">*</span></label>
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                <Store size={20} className="text-slate-400 mr-3" />
                                <input 
                                    required
                                    type="text"
                                    className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                                    value={editForm.name}
                                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Mã Số Thuế <span className="text-red-500">*</span></label>
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                <CreditCard size={20} className="text-slate-400 mr-3" />
                                <input 
                                    required
                                    type="text"
                                    className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                                    value={editForm.taxId}
                                    onChange={(e) => setEditForm({...editForm, taxId: e.target.value})}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Ngành nghề chính</label>
                            <div className="flex items-center bg-blue-50 border border-blue-200 rounded-xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                <Briefcase size={20} className="text-blue-500 mr-3" />
                                <input 
                                    type="text"
                                    className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                                    value={editForm.industry}
                                    onChange={(e) => setEditForm({...editForm, industry: e.target.value})}
                                />
                            </div>
                            <p className="text-[11px] text-blue-600 mt-1 ml-1 font-medium flex gap-1 items-center">
                                <Info size={12}/>
                                Thay đổi ngành nghề sẽ tính lại mức thuế.
                            </p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Mã ngành (VSIC)</label>
                            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                <Hash size={20} className="text-slate-400 mr-3" />
                                <input 
                                    type="text"
                                    className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400"
                                    value={editForm.industryCode || ''}
                                    onChange={(e) => setEditForm({...editForm, industryCode: e.target.value})}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Địa chỉ kinh doanh</label>
                            <div className="flex items-start bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                                <MapPin size={20} className="text-slate-400 mr-3 mt-0.5" />
                                <textarea 
                                    rows={2}
                                    className="flex-1 bg-transparent outline-none text-slate-900 font-medium placeholder:text-slate-400 resize-none"
                                    value={editForm.address}
                                    onChange={(e) => setEditForm({...editForm, address: e.target.value})}
                                />
                            </div>
                        </div>
                        
                        <div className="pt-2 pb-safe">
                            <button 
                                type="submit"
                                className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                            >
                                <Save size={18} /> Lưu thay đổi
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
