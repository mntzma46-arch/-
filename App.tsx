import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

import type { User, Chat, Message, Persona } from './types';
import { DEVELOPER_EMAIL, USERS_DB } from './constants';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import ChatView from './components/ChatView';
import VoiceChatView from './components/VoiceChatView';
import VideoChatView from './components/VideoChatView';

// A simple polyfill for uuid if it's not available
const simpleUuid = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
const generateId = typeof uuidv4 === 'function' ? uuidv4 : simpleUuid;


const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'chat' | 'voice' | 'video'>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        const user: User = JSON.parse(storedUser);
        setCurrentUser(user);
        const userChats = localStorage.getItem(`chats_${user.email}`);
        if (userChats) {
          const parsedChats: Chat[] = JSON.parse(userChats);
          // Simple migration for old chats without a persona or messages without IDs
          const migratedChats = parsedChats.map(c => ({
            ...c,
            persona: c.persona || 'normal',
            messages: c.messages.map(m => ({
              ...m,
              id: m.id || generateId(),
              timestamp: m.timestamp || new Date().toISOString()
            }))
          }));
          setChats(migratedChats);
          if (migratedChats.length > 0) {
            setActiveChatId(migratedChats[0].id);
          }
        } else {
          // FIX: Corrected call to handleNewChat with two arguments.
          handleNewChat('normal', user.email);
        }
      }
    } catch (error) {
      console.error("Failed to parse user data from localStorage", error);
      localStorage.removeItem('currentUser');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const handleLogin = (email: string): User => {
    const user = USERS_DB.find(u => u.email === email) || { email, isDeveloper: email === DEVELOPER_EMAIL };
    localStorage.setItem('currentUser', JSON.stringify(user));
    setCurrentUser(user);
    const userChats = localStorage.getItem(`chats_${user.email}`);
    if (userChats) {
        const parsedChats: Chat[] = JSON.parse(userChats);
        const migratedChats = parsedChats.map(c => ({
          ...c,
          persona: c.persona || 'normal',
          messages: c.messages.map(m => ({ ...m, id: m.id || generateId(), timestamp: m.timestamp || new Date().toISOString() }))
        }));
        setChats(migratedChats);
        setActiveChatId(migratedChats.length > 0 ? migratedChats[0].id : null);
    } else {
        setChats([]);
        setActiveChatId(null);
        // FIX: Corrected call to handleNewChat with two arguments.
        handleNewChat('normal', user.email);
    }
    return user;
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    setChats([]);
    setActiveChatId(null);
  }, []);

  const handleNewChat = useCallback((persona?: Persona, userEmail?: string) => {
    const email = userEmail || currentUser?.email;
    if (!email) return;

    const newChat: Chat = {
      id: generateId(),
      title: 'محادثة جديدة',
      messages: [],
      createdAt: new Date().toISOString(),
      persona: persona || 'normal',
    };
    const updatedChats = [newChat, ...chats];
    setChats(updatedChats);
    setActiveChatId(newChat.id);
    localStorage.setItem(`chats_${email}`, JSON.stringify(updatedChats));
    setViewMode('chat');
    setIsSidebarOpen(false);
  }, [chats, currentUser]);

  const handleSelectChat = useCallback((chatId: string) => {
    setActiveChatId(chatId);
    setViewMode('chat');
    setIsSidebarOpen(false);
  }, []);

  const handleUpdateChat = useCallback((updates: Partial<Omit<Chat, 'id' | 'createdAt'>>) => {
    if (!currentUser || !activeChatId) return;

    const updatedChats = chats.map(chat => {
      if (chat.id === activeChatId) {
        const newChat = { ...chat, ...updates };
        // Auto-update title from first user message
        if (updates.messages && chat.title === 'محادثة جديدة' && updates.messages.length > 0 && updates.messages[0].role === 'user') {
          const firstUserPart = updates.messages[0].parts.find(p => 'text' in p);
          if (firstUserPart && 'text' in firstUserPart) {
            newChat.title = firstUserPart.text.substring(0, 30) + (firstUserPart.text.length > 30 ? '...' : '');
          }
        }
        return newChat;
      }
      return chat;
    });

    setChats(updatedChats);
    localStorage.setItem(`chats_${currentUser.email}`, JSON.stringify(updatedChats));
  }, [activeChatId, chats, currentUser]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };

  const activeChat = chats.find(chat => chat.id === activeChatId);

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }
  
  return (
    <div className="flex h-screen w-screen bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-sans overflow-hidden">
        <Sidebar 
            user={currentUser}
            chats={chats}
            activeChatId={activeChatId}
            onNewChat={() => handleNewChat()}
            onSelectChat={handleSelectChat}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
            onStartVoiceChat={() => {
              setViewMode('voice');
              setIsSidebarOpen(false);
            }}
            onStartVideoChat={() => {
              setViewMode('video');
              setIsSidebarOpen(false);
            }}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
        />
        {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/60 z-30" />}

        <main className="flex-1 flex flex-col h-full">
          {viewMode === 'voice' ? (
            <VoiceChatView 
              onExit={() => setViewMode('chat')} 
              onMenuClick={() => setIsSidebarOpen(true)}
              persona={activeChat?.persona || 'normal'}
            />
          ) : viewMode === 'video' ? (
            <VideoChatView
              onExit={() => setViewMode('chat')}
              onMenuClick={() => setIsSidebarOpen(true)}
              persona={activeChat?.persona || 'normal'}
            />
          ) : activeChat ? (
            <ChatView 
                key={activeChatId}
                chat={activeChat}
                onChatUpdate={handleUpdateChat}
                onNewChat={(persona) => handleNewChat(persona)}
                onMenuClick={() => setIsSidebarOpen(true)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
                <button onClick={() => setIsSidebarOpen(true)} className="absolute top-5 right-5 p-2 rounded-md bg-white/10 hover:bg-white/20">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                </button>
                <div className="p-8">
                    <h1 className="text-4xl font-bold text-gray-700 dark:text-gray-300">مرحباً بك في شات بنِت</h1>
                    <p className="mt-4 text-lg text-gray-500 dark:text-gray-400">ابدأ محادثة جديدة للبدء.</p>
                    <button onClick={() => handleNewChat()} className="mt-6 px-6 py-3 bg-primary-600 text-white rounded-lg shadow-md hover:bg-primary-700 transition-colors">
                        بدء محادثة جديدة
                    </button>
                </div>
            </div>
          )}
        </main>
    </div>
  );
};

export default App;