import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { LiveServerMessage } from '@google/genai';
import { connectLiveSession, createPcmBlob, decode, decodeAudioData, LiveSession } from '../services/geminiService';
import { BotIcon, ChevronLeftIcon, MenuIcon, PhoneIcon, StopIcon, ThumbsDownIcon, ThumbsUpIcon, UserIcon, SettingsIcon, CloseIcon } from './Icons';
import type { Persona } from '../types';
import { PERSONAS } from '../constants';

interface VideoChatViewProps {
  onExit: () => void;
  onMenuClick: () => void;
  persona: Persona;
}

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

type TranscriptItem = {
  id: string;
  author: 'user' | 'model';
  text: string;
  timestamp: string;
  feedback?: 'liked' | 'disliked';
};

type AudioSettings = {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
};


// VAD constants for detecting user speech
const VAD_ENERGY_THRESHOLD = 0.005;
const VAD_SILENCE_TIMEOUT = 500; // Reduced for faster response times

const AudioSettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    settings: AudioSettings;
    onSettingsChange: (newSettings: AudioSettings) => void;
}> = ({ isOpen, onClose, settings, onSettingsChange }) => {
    if (!isOpen) return null;

    const handleToggle = (key: keyof AudioSettings) => {
        onSettingsChange({ ...settings, [key]: !settings[key] });
    };
    
    const ToggleSwitch: React.FC<{ label: string; enabled: boolean; onChange: () => void; description: string; }> = ({ label, enabled, onChange, description }) => (
        <div>
            <div className="flex items-center justify-between">
                <span className="text-gray-200 font-medium">{label}</span>
                <button
                    onClick={onChange}
                    className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                        enabled ? 'bg-primary-500' : 'bg-gray-600'
                    }`}
                >
                    <span
                        className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                            enabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">{description}</p>
        </div>
    );

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm relative border border-gray-700" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white">إعدادات الصوت</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <CloseIcon />
                    </button>
                </div>
                <div className="space-y-4">
                    <ToggleSwitch 
                        label="إلغاء الضوضاء"
                        enabled={settings.noiseSuppression}
                        onChange={() => handleToggle('noiseSuppression')}
                        description="يقلل من ضوضاء الخلفية مثل المراوح أو النقرات."
                    />
                    <ToggleSwitch 
                        label="إلغاء الصدى"
                        enabled={settings.echoCancellation}
                        onChange={() => handleToggle('echoCancellation')}
                        description="يمنع صوت السماعات من أن يتم التقاطه بواسطة الميكروفون."
                    />
                    <ToggleSwitch 
                        label="ضبط الحساسية التلقائي"
                        enabled={settings.autoGainControl}
                        onChange={() => handleToggle('autoGainControl')}
                        description="يقوم تلقائياً بضبط مستوى صوت الميكروفون الخاص بك."
                    />
                </div>
            </div>
        </div>
    );
};


const RobotAvatar: React.FC<{ isBotSpeaking: boolean; isUserSpeaking: boolean }> = ({ isBotSpeaking, isUserSpeaking }) => (
    <div className="relative w-64 h-64 mx-auto">
        <div 
            className={`absolute -inset-4 bg-blue-500/50 rounded-full transition-all duration-500 ease-out ${isUserSpeaking ? 'opacity-100 scale-110 blur-xl' : 'opacity-0 scale-100 blur-lg'}`}
            style={{ animation: isUserSpeaking ? 'pulse 2s infinite' : 'none' }}
        />
        <svg viewBox="0 0 100 100" className="relative z-10 drop-shadow-lg">
            <defs>
                <radialGradient id="grad-body" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#d1d5db" />
                    <stop offset="100%" stopColor="#6b7280" />
                </radialGradient>
                <radialGradient id="grad-head" cx="50%" cy="40%" r="50%">
                    <stop offset="0%" stopColor="#f3f4f6" />
                    <stop offset="100%" stopColor="#9ca3af" />
                </radialGradient>
                 <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                    <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                </filter>
            </defs>
            {/* Body */}
            <path d="M 30 95 C 30 70, 70 70, 70 95 L 65 95 C 65 75, 35 75, 35 95 Z" fill="url(#grad-body)" />
            {/* Neck */}
            <rect x="46" y="60" width="8" height="5" fill="#6b7280" />
            {/* Head */}
            <circle cx="50" cy="40" r="25" fill="url(#grad-head)" stroke="#4b5563" strokeWidth="1" />
            {/* Eyes */}
            <g>
                <circle cx="38" cy="38" r="4" fill="#111827" />
                <circle cx="62" cy="38" r="4" fill="#111827" />
                <circle cx="38" cy="38" r="6" fill="#22d3ee" filter="url(#glow)" className="opacity-80 animate-pulse" />
                <circle cx="62" cy="38" r="6" fill="#22d3ee" filter="url(#glow)" className="opacity-80 animate-pulse" style={{ animationDelay: '0.5s' }}/>
                <circle cx="39" cy="37" r="1.5" fill="white" className="opacity-80" />
                <circle cx="63" cy="37" r="1.5" fill="white" className="opacity-80" />
            </g>
            {/* Mouth */}
            <path
                d={isBotSpeaking ? "M 42 52 Q 50 59 58 52" : "M 42 52 L 58 52"}
                stroke="#374151"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                style={{ transition: 'd 0.15s ease-in-out' }}
            />
        </svg>
    </div>
);


const VideoChatView: React.FC<VideoChatViewProps> = ({ onExit, onMenuClick, persona }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isBotSpeaking, setIsBotSpeaking] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>(() => {
    try {
        const saved = localStorage.getItem('audioSettings');
        return saved ? JSON.parse(saved) : { noiseSuppression: true, echoCancellation: true, autoGainControl: true };
    } catch {
        return { noiseSuppression: true, echoCancellation: true, autoGainControl: true };
    }
  });
  
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botSpeakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, currentInput, currentOutput]);

  useEffect(() => {
    localStorage.setItem('audioSettings', JSON.stringify(audioSettings));
  }, [audioSettings]);
  
  const handleSetFeedback = (id: string, feedback: 'liked' | 'disliked') => {
    setTranscript(prev => prev.map(item => 
      item.id === id ? { ...item, feedback: item.feedback === feedback ? undefined : feedback } : item
    ));
  };

  const cleanup = useCallback(async () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (botSpeakingTimeoutRef.current) clearTimeout(botSpeakingTimeoutRef.current);
    
    scriptProcessorRef.current?.disconnect();
    scriptProcessorRef.current = null;

    mediaStreamRef.current?.getTracks().forEach(track => track.stop());
    mediaStreamRef.current = null;

    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    
    const closePromises: Promise<any>[] = [];

    if (sessionPromiseRef.current) {
        const sessionClosePromise = sessionPromiseRef.current
            .then(session => session.close())
            .catch(e => console.error("Error closing session:", e));
        closePromises.push(sessionClosePromise);
        sessionPromiseRef.current = null;
    }

    if (inputAudioContextRef.current?.state !== 'closed') {
        closePromises.push(inputAudioContextRef.current.close());
    }
    inputAudioContextRef.current = null;

    if (outputAudioContextRef.current?.state !== 'closed') {
        closePromises.push(outputAudioContextRef.current.close());
    }
    outputAudioContextRef.current = null;
    
    await Promise.all(closePromises).catch(e => console.error("Error during resource cleanup:", e));
  }, []);

  const handleDisconnect = useCallback(async () => {
    setStatus('idle');
    await cleanup();
    setCurrentInput('');
    setCurrentOutput('');
    setIsUserSpeaking(false);
    setIsBotSpeaking(false);
  }, [cleanup]);

  useEffect(() => {
    // Component unmount cleanup
    return () => { cleanup(); };
  }, [cleanup]);

  const handleConnect = async () => {
    if (status === 'connected' || status === 'connecting') return;
    setStatus('connecting');
    setTranscript([]);
    setCurrentInput('');
    setCurrentOutput('');
    setIsUserSpeaking(false);
    setIsBotSpeaking(false);

    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: audioSettings });
      
      inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;

      const personaConfig = PERSONAS[persona];

      sessionPromiseRef.current = connectLiveSession({
        onopen: () => {
          setStatus('connected');
          if (!mediaStreamRef.current || !inputAudioContextRef.current) return;
          const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
          scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(1024, 1, 1);
          
          scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
            const rms = Math.sqrt(inputData.reduce((acc, val) => acc + val * val, 0) / inputData.length);

            if (rms > VAD_ENERGY_THRESHOLD) {
                setIsUserSpeaking(true);
                if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
                silenceTimerRef.current = setTimeout(() => setIsUserSpeaking(false), VAD_SILENCE_TIMEOUT);
            }

            const pcmBlob = createPcmBlob(inputData);
            sessionPromiseRef.current?.then((session) => session.sendRealtimeInput({ media: pcmBlob }));
          };
          source.connect(scriptProcessorRef.current);
          scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
            let localCurrentInput = currentInput;
            let localCurrentOutput = currentOutput;

            if (message.serverContent?.outputTranscription) {
                setCurrentOutput(prev => prev + message.serverContent.outputTranscription.text);
                localCurrentOutput += message.serverContent.outputTranscription.text;
            }
            if (message.serverContent?.inputTranscription) {
                setCurrentInput(prev => prev + message.serverContent.inputTranscription.text);
                localCurrentInput += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.turnComplete) {
                setTranscript(prev => {
                    const newTranscript = [...prev];
                    const timestamp = new Date().toISOString();
                    if (localCurrentInput.trim()) newTranscript.push({ id: uuidv4(), author: 'user', text: localCurrentInput, timestamp });
                    if (localCurrentOutput.trim()) newTranscript.push({ id: uuidv4(), author: 'model', text: localCurrentOutput, timestamp });
                    return newTranscript;
                });
                setCurrentInput('');
                setCurrentOutput('');
            }
            
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
            if (base64Audio && outputAudioContextRef.current) {
                if (botSpeakingTimeoutRef.current) clearTimeout(botSpeakingTimeoutRef.current);
                setIsBotSpeaking(true);

                const outputCtx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                source.addEventListener('ended', () => {
                    sourcesRef.current.delete(source);
                    if (botSpeakingTimeoutRef.current) clearTimeout(botSpeakingTimeoutRef.current);
                    botSpeakingTimeoutRef.current = setTimeout(() => {
                        if (sourcesRef.current.size === 0) setIsBotSpeaking(false);
                    }, 150);
                });
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
            }

             if (message.serverContent?.interrupted) {
                sourcesRef.current.forEach(source => source.stop());
                sourcesRef.current.clear();
                nextStartTimeRef.current = 0;
                setIsBotSpeaking(false);
            }
        },
        onerror: (e) => {
          console.error('Session error:', e);
          setStatus('error');
          cleanup();
        },
        onclose: () => {
          setStatus(prev => (prev === 'connected' || prev === 'connecting' ? 'idle' : prev));
        },
      }, personaConfig.instruction, personaConfig.voice);
    } catch (err) {
      console.error('Failed to start voice session:', err);
      setStatus('error');
      alert('لم نتمكن من الوصول إلى الميكروفون. يرجى التحقق من الأذونات والإعدادات.');
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle': return 'اضغط لبدء محادثة فيديو';
      case 'connecting': return 'جاري الاتصال...';
      case 'connected': return isUserSpeaking ? '...أنت تتحدث' : 'أنا أستمع...';
      case 'error': return 'حدث خطأ. يرجى المحاولة مرة أخرى.';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white relative overflow-hidden">
      <AudioSettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={audioSettings}
        onSettingsChange={setAudioSettings}
      />
      <header className="flex items-center p-4 bg-gray-900/50 backdrop-blur-sm justify-between z-20">
        <div className="flex items-center">
            <button onClick={onExit} className="p-2 rounded-full hover:bg-gray-700">
                <ChevronLeftIcon className="transform -rotate-180" />
            </button>
            <h1 className="text-xl font-bold mr-4">محادثة فيديو ({PERSONAS[persona].name})</h1>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setIsSettingsOpen(true)} className="p-2 rounded-full hover:bg-gray-700">
                <SettingsIcon />
            </button>
            <button onClick={onMenuClick} className="p-2 rounded-full hover:bg-gray-700">
                <MenuIcon />
            </button>
        </div>
      </header>
      
      <main className="flex-1 flex flex-col justify-center items-center relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
             <RobotAvatar isBotSpeaking={isBotSpeaking} isUserSpeaking={isUserSpeaking} />
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 right-0 p-6 h-2/3 overflow-y-auto space-y-4 z-10" ref={transcriptEndRef}>
              {transcript.map((item) => <TranscriptMessage key={item.id} item={item} onSetFeedback={handleSetFeedback} />)}
              {currentInput && <div className="flex items-start gap-3 flex-row-reverse"><div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-600 ${isUserSpeaking ? 'animate-pulse' : ''}`}><UserIcon className="w-5 h-5"/></div><div className="p-3 rounded-lg max-w-lg bg-primary-600 text-lg">{currentInput}</div></div>}
              {currentOutput && <div className="flex items-start gap-3"><div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-500 animate-pulse"><BotIcon className="w-5 h-5"/></div><div className="p-3 rounded-lg max-w-lg bg-gray-700 text-lg">{currentOutput}</div></div>}
          </div>
      </main>

      <footer className="p-6 text-center bg-gray-900 border-t border-gray-700/50 z-20">
        <p className="text-gray-400 mb-4 h-6">{getStatusText()}</p>
        
        {status !== 'connected' && status !== 'connecting' ? (
             <button onClick={handleConnect} className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg transform hover:scale-105 transition-transform active:scale-95">
                <PhoneIcon className="w-10 h-10"/>
             </button>
        ) : (
             <button onClick={handleDisconnect} className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto shadow-lg transform hover:scale-105 transition-transform active:scale-95">
                <StopIcon className="w-10 h-10"/>
             </button>
        )}
      </footer>
    </div>
  );
};

const TranscriptMessage: React.FC<{
    item: TranscriptItem;
    onSetFeedback: (id: string, feedback: 'liked' | 'disliked') => void;
}> = ({ item, onSetFeedback }) => {
    const isUser = item.author === 'user';
    const formattedTime = new Date(item.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    return (
        <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''} group`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-gray-600' : 'bg-purple-500'}`}>
              {isUser ? <UserIcon className="w-5 h-5"/> : <BotIcon className="w-5 h-5"/>}
            </div>
            <div className="flex-1">
                <div className={`p-3 rounded-lg max-w-lg text-lg inline-block ${isUser ? 'bg-primary-600' : 'bg-gray-700'}`}>
                  {item.text}
                </div>
                <div className={`flex items-center gap-4 mt-2 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-xs text-gray-500">{formattedTime}</span>
                    {!isUser && (
                        <div className="flex items-center gap-1">
                            <button onClick={() => onSetFeedback(item.id, 'liked')} className={`p-1.5 rounded-full hover:bg-gray-600 ${item.feedback === 'liked' ? 'text-primary-400' : 'text-gray-400'}`}>
                                <ThumbsUpIcon className="w-4 h-4"/>
                            </button>
                            <button onClick={() => onSetFeedback(item.id, 'disliked')} className={`p-1.5 rounded-full hover:bg-gray-600 ${item.feedback === 'disliked' ? 'text-red-500' : 'text-gray-400'}`}>
                                <ThumbsDownIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VideoChatView;