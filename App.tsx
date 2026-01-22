
import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import AccountantMatch from './components/AccountantMatch';
import AccountantView from './components/AccountantView';
import Onboarding from './components/Onboarding';
import Login from './components/Login';
import { Transaction, BusinessProfile, ChatMessage, UserAccount } from './types';
import { databaseService } from './services/databaseService';
import { PieChart, Users, Bell, LogOut, MessageCircle, Cloud, CloudOff, Loader2 } from 'lucide-react';

type View = 'CHAT' | 'DASHBOARD' | 'CONNECT';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [currentView, setCurrentView] = useState<View>('CHAT');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Khôi phục session từ Cloud
  useEffect(() => {
    const initApp = async () => {
      try {
        const user = await databaseService.getCurrentSession();
        if (user) {
          setCurrentUser(user);
          setIsAuthenticated(true);
        }
      } catch (e) {
        console.error("Session restore failed", e);
      } finally {
        setIsLoading(false);
      }
    };
    initApp();
  }, []);

  // Poll tin nhắn để cập nhật badge thông báo (Cập nhật sang Async)
  useEffect(() => {
    if (!isAuthenticated || currentUser?.role === 'ACCOUNTANT') return;
    
    const interval = setInterval(async () => {
        const updatedUser = await databaseService.getUser(currentUser?.phoneNumber || '');
        if (updatedUser) {
            // Chỉ cập nhật nếu số lượng tin nhắn thay đổi để tránh re-render quá nhiều
            if (updatedUser.p2pChat.length !== currentUser?.p2pChat.length) {
                setCurrentUser(updatedUser);
            }
        }
    }, 3000);
    return () => clearInterval(interval);
  }, [isAuthenticated, currentUser?.phoneNumber, currentUser?.p2pChat.length]);


  // Hàm đồng bộ dữ liệu lên GCP trung tâm
  const syncWithCloud = async (updatedUser: UserAccount) => {
      setIsSyncing(true);
      try {
        await databaseService.syncUserData(updatedUser);
      } catch (e) {
        console.error("Cloud sync failed", e);
      } finally {
        setTimeout(() => setIsSyncing(false), 800);
      }
  };

  const handleLoginSuccess = (user: UserAccount) => {
      setCurrentUser(user);
      setIsAuthenticated(true);
  };

  const handleLogout = () => {
      databaseService.clearSession();
      setCurrentUser(null);
      setIsAuthenticated(false);
      setCurrentView('CHAT');
      console.log("User logged out successfully.");
  };

  // FIX: Sử dụng Functional Update để đảm bảo luôn lấy state mới nhất
  const handleNewTransaction = (transaction: Transaction) => {
    setCurrentUser(prevUser => {
        if (!prevUser) return null;
        
        const updatedUser = {
            ...prevUser,
            transactions: [...prevUser.transactions, transaction]
        };
        
        // Gọi sync ngay trong callback để đảm bảo data đồng nhất
        syncWithCloud(updatedUser);
        return updatedUser;
    });
  };

  // FIX: Sử dụng Functional Update
  const handleRemoveTransaction = (id: string) => {
      setCurrentUser(prevUser => {
          if (!prevUser) return null;
          
          const updatedUser = {
              ...prevUser,
              transactions: prevUser.transactions.filter(t => t.id !== id)
          };
          
          syncWithCloud(updatedUser);
          return updatedUser;
      });
  };

  // FIX: Sử dụng Functional Update
  const handleSetMessages = (newMessages: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setCurrentUser(prevUser => {
          if (!prevUser) return null;

          const updatedHistory = typeof newMessages === 'function' 
            ? newMessages(prevUser.chatHistory) 
            : newMessages;

          const updatedUser = {
              ...prevUser,
              chatHistory: updatedHistory
          };
          
          syncWithCloud(updatedUser);
          return updatedUser;
      });
  };

  const handleCompleteOnboarding = (profile: BusinessProfile) => {
      setCurrentUser(prevUser => {
          if (!prevUser) return null;
          const updatedUser = {
              ...prevUser,
              profile: profile
          };
          syncWithCloud(updatedUser);
          return updatedUser;
      });
  };

  // Hàm cập nhật hồ sơ (được gọi từ Dashboard)
  const handleUpdateProfile = (updatedProfile: BusinessProfile) => {
      setCurrentUser(prevUser => {
          if (!prevUser) return null;
          const updatedUser = {
              ...prevUser,
              profile: updatedProfile
          };
          syncWithCloud(updatedUser);
          return updatedUser;
      });
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-white">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
        <p className="text-slate-500 font-medium">Đang kết nối Google Cloud...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
      return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  if (currentUser?.role === 'ACCOUNTANT') {
      return (
          <div className="h-full w-full max-w-md mx-auto bg-slate-50 shadow-2xl overflow-hidden relative border-x border-slate-200">
              <AccountantView onLogout={handleLogout} />
          </div>
      );
  }

  if (!currentUser?.profile) {
      return (
          <div className="h-full w-full max-w-md mx-auto bg-white shadow-2xl relative border-x border-slate-200">
              <Onboarding onComplete={handleCompleteOnboarding} />
          </div>
      );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'CHAT':
        return (
          <ChatInterface 
            onNewTransaction={handleNewTransaction} 
            onRemoveTransaction={handleRemoveTransaction} 
            businessProfile={currentUser.profile!}
            messages={currentUser.chatHistory}
            setMessages={handleSetMessages}
          />
        );
      case 'DASHBOARD':
        return (
            <Dashboard 
                transactions={currentUser.transactions} 
                businessProfile={currentUser.profile!} 
                onUpdateProfile={handleUpdateProfile} 
            />
        );
      case 'CONNECT':
        return <AccountantMatch transactions={currentUser.transactions} currentUserPhone={currentUser.phoneNumber} />;
      default:
        return null;
    }
  };

  // Logic tính số tin nhắn chưa đọc (đơn giản hóa bằng cách đếm tổng tin nhắn nếu chưa thanh toán)
  const hasUnreadMessages = currentUser.p2pChat.length > 0;

  return (
    <div className="flex flex-col h-full w-full max-w-md mx-auto bg-slate-50 shadow-2xl overflow-hidden border-x border-slate-200">
      <header className="shrink-0 bg-white/90 backdrop-blur-xl border-b border-slate-200/50 pt-safe z-50">
        <div className="h-[60px] px-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-blue-200 shadow-md flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {currentUser.profile?.name.charAt(0) || 'T'}
                </div>
                <div className="flex flex-col justify-center min-w-0 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                        <h1 className="font-bold text-slate-900 text-[15px] leading-tight truncate">TaxMate</h1>
                        {isSyncing ? (
                          <Cloud size={14} className="text-blue-500 animate-bounce shrink-0" />
                        ) : (
                          <Cloud size={14} className="text-green-500 shrink-0" />
                        )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium leading-tight truncate uppercase tracking-wide">
                      {isSyncing ? 'Đang đồng bộ...' : (currentUser.profile?.name || 'Cloud Active')}
                    </p>
                </div>
            </div>
            <div className="flex gap-1 shrink-0">
                <button type="button" className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 transition-all active:scale-95">
                    <Bell size={20} />
                </button>
                <button 
                    type="button" 
                    onClick={handleLogout} 
                    className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 cursor-pointer"
                    title="Đăng xuất"
                >
                    <LogOut size={20} />
                </button>
            </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {renderContent()}
      </main>

      <nav className="shrink-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/50 pb-safe px-6 pt-1 flex justify-between items-center z-30">
        <button onClick={() => setCurrentView('CHAT')} className="group flex flex-col items-center gap-1 p-2 w-16 transition-all">
            <MessageCircle size={24} className={currentView === 'CHAT' ? "text-blue-600 fill-blue-600" : "text-slate-400"} />
            <span className={`text-[10px] font-semibold ${currentView === 'CHAT' ? 'text-blue-600' : 'text-slate-400'}`}>Trợ lý</span>
        </button>
        <button onClick={() => setCurrentView('DASHBOARD')} className="group flex flex-col items-center gap-1 p-2 w-16 transition-all">
            <PieChart size={24} className={currentView === 'DASHBOARD' ? "text-blue-600 fill-blue-600" : "text-slate-400"} />
            <span className={`text-[10px] font-semibold ${currentView === 'DASHBOARD' ? 'text-blue-600' : 'text-slate-400'}`}>Sổ sách</span>
        </button>
        <button onClick={() => setCurrentView('CONNECT')} className="group flex flex-col items-center gap-1 p-2 w-16 transition-all relative">
            <div className="relative">
                <Users size={24} className={currentView === 'CONNECT' ? "text-blue-600 fill-blue-600" : "text-slate-400"} />
                {hasUnreadMessages && currentView !== 'CONNECT' && (
                    <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full"></span>
                )}
            </div>
            <span className={`text-[10px] font-semibold ${currentView === 'CONNECT' ? 'text-blue-600' : 'text-slate-400'}`}>Kế toán</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
