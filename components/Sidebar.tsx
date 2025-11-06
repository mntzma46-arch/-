import React, { useState } from 'react';
import type { User, Chat } from '../types';
import { BotIcon, ChatIcon, LogoutIcon, MoonIcon, PlusIcon, SunIcon, UserIcon, InfoIcon, CloseIcon, PhoneIcon, VideoIcon } from './Icons';

interface SidebarProps {
  user: User;
  chats: Chat[];
  activeChatId: string | null;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onStartVoiceChat: () => void;
  onStartVideoChat: () => void;
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  user,
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onLogout,
  theme,
  onToggleTheme,
  onStartVoiceChat,
  onStartVideoChat,
  isOpen,
  onClose,
}) => {
  const [isDeveloperInfoOpen, setDeveloperInfoOpen] = useState(false);
  
  return (
    <>
      <div className={`fixed top-0 right-0 h-full w-72 bg-gray-50 dark:bg-gray-800/80 backdrop-blur-md border-l border-gray-200 dark:border-gray-700/50 transition-transform duration-300 ease-in-out z-40 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
              <BotIcon className="w-8 h-8 text-primary-500" />
              <span className="text-xl font-bold">شات بنِت</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
             <CloseIcon />
          </button>
        </div>
        
        <div className="p-2 space-y-2">
           <button onClick={onStartVideoChat} className="w-full flex items-center gap-3 p-3 rounded-lg text-right text-sm font-medium transition-colors bg-purple-500 text-white hover:bg-purple-600">
              <VideoIcon />
              محادثة فيديو (جديد)
          </button>
           <button onClick={onStartVoiceChat} className="w-full flex items-center gap-3 p-3 rounded-lg text-right text-sm font-medium transition-colors bg-green-500 text-white hover:bg-green-600">
              <PhoneIcon />
              محادثة صوتية
          </button>
           <button onClick={onNewChat} className="w-full flex items-center gap-3 p-3 rounded-lg text-right text-sm font-medium transition-colors bg-primary-500 text-white hover:bg-primary-600">
              <PlusIcon />
              محادثة جديدة
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {chats.map(chat => (
            <a
              key={chat.id}
              href="#"
              onClick={(e) => {
                  e.preventDefault();
                  onSelectChat(chat.id);
              }}
              className={`flex items-center gap-3 p-3 rounded-lg text-right text-sm transition-colors ${
                activeChatId === chat.id
                  ? 'bg-primary-500/20 text-primary-600 dark:text-primary-400'
                  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                  : `hover:bg-gray-200 dark:hover:bg-gray-700`
              }`}
            >
              <ChatIcon />
              <span className="truncate flex-1">{chat.title}</span>
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700/50 space-y-2">
          <div className="flex items-center justify-between">
              <span className="text-sm font-medium">المظهر</span>
              <button onClick={onToggleTheme} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700">
                  {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
          </div>
          <div className="flex items-center gap-3 p-2 rounded-lg">
            <UserIcon className="w-8 h-8"/>
            <div className="flex-1 truncate">
              <p className="text-sm font-semibold">{user.email}</p>
              {user.isDeveloper && <p className="text-xs text-primary-500">مطور</p>}
            </div>
            <div className="flex gap-1">
                <button onClick={() => setDeveloperInfoOpen(true)} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
                    <InfoIcon />
                </button>
                <button onClick={onLogout} className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400">
                    <LogoutIcon />
                </button>
            </div>
          </div>
        </div>
      </div>
      {isDeveloperInfoOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setDeveloperInfoOpen(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm relative" onClick={e => e.stopPropagation()}>
                <button onClick={() => setDeveloperInfoOpen(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                    <CloseIcon />
                </button>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">معلومات المطور</h3>
                <div className="space-y-2 text-sm">
                    <p><span className="font-semibold">الاسم:</span> منة الله محمد مصطفى</p>
                    <p><span className="font-semibold">البريد الإلكتروني:</span> <a href="mailto:mntzma46@gmail.com" className="text-primary-500 hover:underline">mntzma46@gmail.com</a></p>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;