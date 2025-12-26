import React, { useState } from 'react';
import type { User, Chat } from '../types';
import { BotIcon, ChatIcon, LogoutIcon, MoonIcon, PlusIcon, SunIcon, UserIcon, InfoIcon, CloseIcon, PhoneIcon, VideoIcon, SearchIcon, EditIcon, TrashIcon } from './Icons';

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
  onDeleteChat: (id: string) => void;
  onRenameChat: (id: string, newTitle: string) => void;
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
  onDeleteChat,
  onRenameChat
}) => {
  const [isDeveloperInfoOpen, setDeveloperInfoOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [chatToDelete, setChatToDelete] = useState<Chat | null>(null);
  const [chatToRename, setChatToRename] = useState<Chat | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const filteredChats = chats.filter(chat => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    const titleMatch = chat.title.toLowerCase().includes(term);
    const messageMatch = chat.messages.some(message =>
        message.parts.some(part =>
            'text' in part && part.text.toLowerCase().includes(term)
        )
    );
    return titleMatch || messageMatch;
  });
  
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

        <div className="p-2">
            <div className="relative">
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <SearchIcon className="w-4 h-4 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="ابحث..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 pr-10 text-sm text-gray-900 bg-gray-200 border border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        className="absolute inset-y-0 left-0 flex items-center pl-3"
                        aria-label="Clear search"
                    >
                        <CloseIcon className="w-4 h-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" />
                    </button>
                )}
            </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredChats.map(chat => (
            <div key={chat.id} className="group relative">
                <a
                  href="#"
                  onClick={(e) => {
                      e.preventDefault();
                      onSelectChat(chat.id);
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg text-right text-sm transition-colors w-full ${
                    activeChatId === chat.id
                      ? 'bg-primary-500/20 text-primary-600 dark:text-primary-400'
                      : `hover:bg-gray-200 dark:hover:bg-gray-700`
                  }`}
                >
                  <ChatIcon />
                  <span className="truncate flex-1">{chat.title}</span>
                </a>
                <div className="absolute top-1/2 left-2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => { setChatToRename(chat); setNewTitle(chat.title); }}
                        className="px-2 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                        title="إعادة تسمية"
                    >
                        إعادة تسمية
                    </button>
                    <button
                        onClick={() => setChatToDelete(chat)}
                        className="px-2 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 text-red-600 dark:text-red-400 rounded-md hover:bg-red-500 hover:text-white dark:hover:bg-red-500"
                        title="حذف"
                    >
                        حذف
                    </button>
                </div>
            </div>
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
      {chatToRename && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setChatToRename(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4">إعادة تسمية المحادثة</h3>
                <form onSubmit={(e) => {
                    e.preventDefault();
                    if (newTitle.trim()) {
                        onRenameChat(chatToRename.id, newTitle.trim());
                    }
                    setChatToRename(null);
                }}>
                    <input
                        type="text"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        className="w-full p-2 text-sm text-gray-900 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white dark:border-gray-600"
                        autoFocus
                    />
                    <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={() => setChatToRename(null)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600">
                            إلغاء
                        </button>
                        <button type="submit" className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700">
                            حفظ
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
      {chatToDelete && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => setChatToDelete(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">هل أنت متأكد؟</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">سيتم حذف المحادثة "{chatToDelete.title}" نهائياً.</p>
                <div className="flex justify-center gap-2">
                    <button onClick={() => setChatToDelete(null)} className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 w-24">
                        إلغاء
                    </button>
                    <button
                        onClick={() => {
                            onDeleteChat(chatToDelete.id);
                            setChatToDelete(null);
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 w-24"
                    >
                        حذف
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;