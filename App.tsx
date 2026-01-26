
import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import AccountantMatch from './components/AccountantMatch';
import AccountantView from './components/AccountantView';
import Onboarding from './components/Onboarding';
import Login from './components/Login';
import ServiceQuote from './components/ServiceQuote';
import { Transaction, BusinessProfile, ChatMessage, UserAccount } from './types';
import { databaseService } from './services/databaseService';
import { PieChart, Users, Bell, LogOut, MessageCircle, Cloud, Loader2 } from 'lucide-react';

type View = 'CHAT' | 'DASHBOARD' | 'CONNECT';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [currentView, setCurrentView] = useState<View>('CHAT');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // State cho việc xem báo giá khi chưa đăng nhập
  const [showGuestQuote, setShowGuestQuote] = useState(() => {
      if (typeof window !== 'undefined') {
          const path = window.location.pathname;
          const params = new URLSearchParams(window.location.search);
          return path === '/bao-gia' || params.get('view') === 'quote';
      }
      return false;
  });

  // Listen to Firebase Auth state changes - Cloud-first approach
  useEffect(() => {
    const unsubscribe = databaseService.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch user data from Firestore using UID
          const userData = await databaseService.getUser(firebaseUser.uid);
          if (userData) {
            // Fetch business profile from separate collection
            const profile = await databaseService.getBusinessProfile(firebaseUser.uid);
            if (profile) {
              userData.profile = profile;
            }
            setCurrentUser(userData);
            setIsAuthenticated(true);
          } else {
            // User exists in Auth but not in Firestore - rare case
            console.warn('User authenticated but no Firestore document found');
            setIsAuthenticated(false);
            setCurrentUser(null);
          }
        } catch (e) {
          console.error("Error loading user data from Firestore:", e);
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } else {
        // Not authenticated
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Poll tin nhắn để cập nhật badge thông báo
  useEffect(() => {
    if (!isAuthenticated || !currentUser || currentUser.role === 'ACCOUNTANT') return;

    const interval = setInterval(async () => {
        const updatedUser = await databaseService.getUser(currentUser.uid);
        if (updatedUser) {
            if (updatedUser.p2pChat.length !== currentUser.p2pChat.length) {
                // Preserve the profile since it's in a separate collection
                updatedUser.profile = currentUser.profile;
                setCurrentUser(updatedUser);
            }
        }
    }, 3000);
    return () => clearInterval(interval);
  }, [isAuthenticated, currentUser?.uid, currentUser?.p2pChat.length, currentUser?.profile]);


  // Hàm đồng bộ dữ liệu lên Firestore
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

  const handleLoginSuccess = async (user: UserAccount) => {
      setCurrentUser(user);
      setIsAuthenticated(true);
  };

  const handleLogout = async () => {
      try {
        await databaseService.signOut();
      } catch (e) {
        console.error("Logout error:", e);
      }
      setCurrentUser(null);
      setIsAuthenticated(false);
      setCurrentView('CHAT');
  };

  const handleNewTransaction = (transaction: Transaction) => {
    setCurrentUser(prevUser => {
        if (!prevUser) return null;

        const updatedUser = {
            ...prevUser,
            transactions: [...prevUser.transactions, transaction]
        };

        syncWithCloud(updatedUser);
        return updatedUser;
    });
  };

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

  const handleCompleteOnboarding = async (profile: BusinessProfile) => {
      if (!currentUser) return;

      // Save ONLY to businessProfiles/{uid} collection
      await databaseService.saveBusinessProfile(currentUser.uid, profile);

      // Update local state
      setCurrentUser(prevUser => {
          if (!prevUser) return null;
          return {
              ...prevUser,
              profile: profile
          };
      });
  };

  const handleUpdateProfile = async (updatedProfile: BusinessProfile) => {
      if (!currentUser) return;

      // Update ONLY businessProfiles/{uid} collection
      await databaseService.saveBusinessProfile(currentUser.uid, updatedProfile);

      setCurrentUser(prevUser => {
          if (!prevUser) return null;
          return {
              ...prevUser,
              profile: updatedProfile
          };
      });
  };

  const handleCloseGuestQuote = () => {
      setShowGuestQuote(false);
      if (window.location.pathname === '/bao-gia') {
           window.history.pushState({}, '', '/');
      } else {
           const url = new URL(window.location.href);
           url.searchParams.delete('view');
           window.history.replaceState({}, '', url);
      }
  };

  const handleOpenGuestQuote = () => {
      setShowGuestQuote(true);
      window.history.pushState({}, '', '/bao-gia');
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-white">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
        <p className="text-slate-500 font-medium">Đang kết nối Google Cloud...</p>
      </div>
    );
  }

  // --- XỬ LÝ KHI CHƯA ĐĂNG NHẬP ---
  if (!isAuthenticated) {
      return (
        <>
            <Login onLoginSuccess={handleLoginSuccess} />

            {/* Nút xem báo giá nhanh cho khách */}
            <button
                onClick={handleOpenGuestQuote}
                className="fixed bottom-6 right-6 w-14 h-14 bg-white text-blue-600 rounded-full shadow-2xl border-2 border-blue-50 flex items-center justify-center z-40 active:scale-90 transition-transform hover:bg-blue-50"
                title="Xem báo giá dịch vụ"
            >
                <span className="text-2xl font-black font-serif">$</span>
            </button>

            {/* Modal Báo giá */}
            {showGuestQuote && <ServiceQuote onClose={handleCloseGuestQuote} />}
        </>
      );
  }

  if (currentUser?.role === 'ACCOUNTANT') {
      return (
          <div className="h-full w-full max-w-md mx-auto bg-slate-50 shadow-2xl overflow-hidden relative border-x border-slate-200">
              <AccountantView onLogout={handleLogout} accountantUid={currentUser.uid} />
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
            currentUserUid={currentUser.uid}
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
        return <AccountantMatch transactions={currentUser.transactions} currentUserUid={currentUser.uid} currentUserPhone={currentUser.phoneNumber} />;
      default:
        return null;
    }
  };

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
