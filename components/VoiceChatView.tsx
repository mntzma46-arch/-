import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { LiveServerMessage } from '@google/genai';
import { connectLiveSession, createPcmBlob, decode, decodeAudioData, LiveSession } from '../services/geminiService';
import { BotIcon, ChevronLeftIcon, MicIcon, PhoneIcon, StopIcon, UserIcon, MenuIcon, WomanIcon, ThumbsUpIcon, ThumbsDownIcon } from './Icons';
import type { Persona } from '../types';
import { PERSONAS } from '../constants';

interface VoiceChatViewProps {
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

const VAD_ENERGY_THRESHOLD = 0.01;
const VAD_SILENCE_TIMEOUT = 800; // Increased for more natural pauses

const VoiceChatView: React.FC<VoiceChatViewProps> = ({ onExit, onMenuClick, persona }) => {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [currentInput, setCurrentInput] = useState('');
  const [currentOutput, setCurrentOutput] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, currentInput, currentOutput]);
  
  const handleSetFeedback = (id: string, feedback: 'liked' | 'disliked') => {
    setTranscript(prev => prev.map(item => 
      item.id === id ? { ...item, feedback: item.feedback === feedback ? undefined : feedback } : item
    ));
  };

  const cleanup = useCallback(async () => {
    if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
    }

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

    if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
        closePromises.push(inputAudioContextRef.current.close());
    }
    inputAudioContextRef.current = null;

    if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
        closePromises.push(outputAudioContextRef.current.close());
    }
    outputAudioContextRef.current = null;
    
    await Promise.all(closePromises).catch(e => console.error("Error during resource cleanup:", e));
  }, []);

  const handleDisconnect = useCallback(async () => {
    setStatus('idle'); // Give immediate UI feedback
    await cleanup();
    setCurrentInput('');
    setCurrentOutput('');
    setIsSpeaking(false);
  }, [cleanup]);

  useEffect(() => {
    // This is the component unmount cleanup.
    return () => {
        // We call the async cleanup but can't await it here.
        // This handles navigating away from the component.
        cleanup();
    };
  }, [cleanup]);

  const handleConnect = async () => {
    if (status === 'connected' || status === 'connecting') return;
    setStatus('connecting');
    setTranscript([]);
    setCurrentInput('');
    setCurrentOutput('');
    setIsSpeaking(false);


    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      };
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
      
      inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = 0;

      const personaConfig = PERSONAS[persona];
      const systemInstruction = personaConfig.instruction;
      const voiceName = personaConfig.voice;

      sessionPromiseRef.current = connectLiveSession({
        onopen: () => {
          setStatus('connected');
          if (!mediaStreamRef.current || !inputAudioContextRef.current) return;
          const source = inputAudioContextRef.current.createMediaStreamSource(mediaStreamRef.current);
          scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
          
          scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);

            let sum = 0.0;
            for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);

            if (rms > VAD_ENERGY_THRESHOLD) {
                setIsSpeaking(true);
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                }
                silenceTimerRef.current = setTimeout(() => {
                    setIsSpeaking(false);
                }, VAD_SILENCE_TIMEOUT);
            }

            const pcmBlob = createPcmBlob(inputData);
            sessionPromiseRef.current?.then((session) => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };

          source.connect(scriptProcessorRef.current);
          scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
            let localCurrentInput = currentInput;
            let localCurrentOutput = currentOutput;

            if (message.serverContent?.outputTranscription) {
                const newText = message.serverContent.outputTranscription.text;
                setCurrentOutput(prev => prev + newText);
                localCurrentOutput += newText;
            }
            if (message.serverContent?.inputTranscription) {
                const newText = message.serverContent.inputTranscription.text;
                setCurrentInput(prev => prev + newText);
                localCurrentInput += newText;
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
                const outputCtx = outputAudioContextRef.current;
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputCtx.destination);
                source.addEventListener('ended', () => sourcesRef.current.delete(source));
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
            }
        },
        onerror: (e) => {
          console.error('Session error:', e);
          setStatus('error');
          cleanup();
        },
        onclose: () => {
          setStatus((prevStatus) => {
            if (prevStatus === 'connected' || prevStatus === 'connecting') {
              return 'idle';
            }
            return prevStatus;
          });
        },
      }, systemInstruction, voiceName);
    } catch (err) {
      console.error('Failed to start voice session:', err);
      setStatus('error');
      alert('لم نتمكن من الوصول إلى الميكروفون. يرجى التحقق من الأذونات.');
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle': return 'اضغط لبدء محادثة صوتية';
      case 'connecting': return 'جاري الاتصال...';
      case 'connected': return isSpeaking ? '...أنت تتحدث' : 'أنا أستمع...';
      case 'error': return 'حدث خطأ. يرجى المحاولة مرة أخرى.';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white relative">
      <header className="flex items-center p-4 bg-gray-800/50 justify-between">
        <div className="flex items-center">
            <button onClick={onExit} className="p-2 rounded-full hover:bg-gray-700">
                <ChevronLeftIcon className="transform -rotate-180" />
            </button>
            <h1 className="text-xl font-bold mr-4">محادثة صوتية ({PERSONAS[persona].name})</h1>
        </div>
        <button onClick={onMenuClick} className="p-2 rounded-full hover:bg-gray-700">
            <MenuIcon />
        </button>
      </header>
      
      <main className="flex-1 overflow-y-auto p-6 space-y-4">
        {transcript.map((item) => (
            <TranscriptMessage key={item.id} item={item} onSetFeedback={handleSetFeedback} />
        ))}
        {currentInput && (
             <div className="flex items-start gap-3 flex-row-reverse">
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-gray-600 ${isSpeaking ? 'animate-pulse' : ''}`}>
                    <UserIcon className="w-5 h-5"/>
                </div>
                <div className="p-3 rounded-lg max-w-lg bg-primary-600 text-lg">
                    {currentInput}
                </div>
             </div>
        )}
        {currentOutput && (
             <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-primary-500 animate-pulse">
                    <BotIcon className="w-5 h-5"/>
                </div>
                <div className="p-3 rounded-lg max-w-lg bg-gray-700 text-lg">
                    {currentOutput}
                </div>
             </div>
        )}
        <div ref={transcriptEndRef} />
      </main>

      <footer className="p-6 text-center bg-gray-900 border-t border-gray-700/50">
        <p className="text-gray-400 mb-4 h-6">{getStatusText()}</p>
        
        {status !== 'connected' && status !== 'connecting' ? (
             <button onClick={handleConnect} className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto shadow-lg transform hover:scale-105 transition-transform">
                <PhoneIcon className="w-10 h-10"/>
             </button>
        ) : (
             <button onClick={handleDisconnect} className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center mx-auto shadow-lg transform hover:scale-105 transition-transform">
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
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-gray-600' : 'bg-primary-500'}`}>
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

export default VoiceChatView;