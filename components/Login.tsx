import React, { useState } from 'react';
import type { User } from '../types';

interface LoginProps {
  onLogin: (email: string) => User;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }
    setError('');
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      try {
        onLogin(email);
      } catch (err) {
        setError('فشل تسجيل الدخول. يرجى التحقق من بياناتك.');
      } finally {
        setIsSubmitting(false);
      }
    }, 1000);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gradient-to-br from-gray-900 to-black">
      <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl transform transition-all">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white">مرحباً بك في شات بنِت</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">سجل الدخول للمتابعة</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="relative">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="peer relative block w-full px-3 py-3 text-gray-900 bg-gray-50 dark:bg-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-transparent"
              placeholder="البريد الإلكتروني"
            />
             <label
              htmlFor="email"
              className="absolute right-3 -top-2.5 text-gray-600 dark:text-gray-400 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-3.5 peer-focus:-top-2.5 peer-focus:text-primary-500 peer-focus:text-sm bg-white dark:bg-gray-800 px-1"
            >
              البريد الإلكتروني
            </label>
          </div>
           <div className="relative">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="peer relative block w-full px-3 py-3 text-gray-900 bg-gray-50 dark:bg-gray-700 dark:text-white border border-gray-300 dark:border-gray-600 rounded-md appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 placeholder-transparent"
              placeholder="كلمة المرور"
            />
             <label
              htmlFor="password"
              className="absolute right-3 -top-2.5 text-gray-600 dark:text-gray-400 text-sm transition-all peer-placeholder-shown:text-base peer-placeholder-shown:text-gray-400 peer-placeholder-shown:top-3.5 peer-focus:-top-2.5 peer-focus:text-primary-500 peer-focus:text-sm bg-white dark:bg-gray-800 px-1"
            >
              كلمة المرور
            </label>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative flex justify-center w-full px-4 py-3 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:bg-primary-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </button>
          </div>
           <div className="text-sm text-center">
            <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
              هل نسيت كلمة المرور؟
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;