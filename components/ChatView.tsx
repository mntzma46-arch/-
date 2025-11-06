import React, { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Chat, Message, Part, Persona, GroundingChunk } from '../types';
import { generateGroundedResponseStream, generateContentWithImage } from '../services/geminiService';
import { PERSONAS } from '../constants';
import { BotIcon, SendIcon, UserIcon, PaperclipIcon, CloseIcon, DownloadIcon, MenuIcon, ChevronDownIcon, CopyIcon, CheckIcon, ThumbsUpIcon, ThumbsDownIcon, RefreshIcon } from './Icons';
import { GenerateContentResponse } from '@google/genai';

interface ChatViewProps {
  chat: Chat;
  onChatUpdate: (updates: Partial<Omit<Chat, 'id' | 'createdAt'>>) => void;
  onMenuClick: () => void;
  onNewChat: (persona: Persona) => void;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result.split(',')[1]);
            } else {
                reject(new Error('Failed to convert blob to base64'));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const PersonaSelector: React.FC<{
  currentPersona: Persona;
  onPersonaChange: (persona: Persona) => void;
}> = ({ currentPersona, onPersonaChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);
    
    return (
        <div ref={wrapperRef} className="relative">
            <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 p-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                <span>{PERSONAS[currentPersona].name}</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="absolute left-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                    {(Object.keys(PERSONAS) as Persona[]).map((key) => (
                        <button
                            key={key}
                            onClick={() => {
                                onPersonaChange(key);
                                setIsOpen(false);
                            }}
                            className={`w-full text-right px-4 py-2 text-sm ${currentPersona === key ? 'bg-primary-500 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                        >
                            {PERSONAS[key].name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code, language }) => {
    const [copied, setCopied] = useState(false);
    
    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const highlight = (str: string) =>
        str.replace(/</g, "&lt;").replace(/>/g, "&gt;")
           .replace(/(const|let|var|function|return|import|from|export|if|else|for|while|async|await|new|class|extends|super|this|true|false|null)\b/g, '<span class="text-pink-400">$1</span>')
           .replace(/(\'|`|")(.*?)(\'|`|")/g, '<span class="text-green-400">$1$2$3</span>')
           .replace(/(\/\/.*|\/\*[\s\S]*?\*\/)/g, '<span class="text-gray-500">$1</span>')
           .replace(/([A-Z_]+)\b/g, '<span class="text-yellow-400">$1</span>')
           .replace(/(\d+)/g, '<span class="text-blue-400">$1</span>');

    return (
        <div className="bg-black rounded-lg my-2 relative font-mono text-sm border border-gray-700">
            <div className="flex justify-between items-center px-4 py-1 bg-gray-800 rounded-t-lg">
                <span className="text-xs text-gray-400">{language || 'code'}</span>
                <button onClick={handleCopy} className="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-700 transition-colors">
                    {copied ? <CheckIcon className="w-3 h-3 text-green-400" /> : <CopyIcon className="w-3 h-3" />}
                    {copied ? 'تم النسخ!' : 'نسخ'}
                </button>
            </div>
            <pre className="p-4 overflow-x-auto text-white">
                <code dangerouslySetInnerHTML={{ __html: highlight(code) }} />
            </pre>
        </div>
    );
};


const ChatView: React.FC<ChatViewProps> = ({ chat, onChatUpdate, onMenuClick, onNewChat }) => {
  const [messages, setMessages] = useState<Message[]>(chat.messages);
  const [input, setInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);
  
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  };
  
  const removeImage = () => {
      setImageFile(null);
      if(imagePreview) {
          URL.revokeObjectURL(imagePreview);
      }
      setImagePreview(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  };

  const handleSend = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput && !imageFile) return;

    setIsLoading(true);
    setInput('');

    let userMessageParts: Part[] = [];
    if (trimmedInput) userMessageParts.push({ text: trimmedInput });
    
    let imagePayload: { mimeType: string; data: string } | null = null;
    if (imageFile) {
        imagePayload = { mimeType: imageFile.type, data: await blobToBase64(imageFile) };
        userMessageParts.push({ inlineData: imagePayload });
    }

    const userMessage: Message = { 
        id: uuidv4(),
        role: 'user', 
        parts: userMessageParts,
        timestamp: new Date().toISOString()
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    const systemInstruction = PERSONAS[chat.persona].instruction;
    const history = messages.map(({ groundingAttribution, ...rest }) => rest);
    const imageGenKeywords = ['ارسم', 'صورة', 'انشئ', 'تخيل', 'صمم'];
    const imageEditKeywords = ['عدل', 'غير', 'أضف', 'احذف', 'شيل', 'حط'];
    
    const isImageGenRequest = imageGenKeywords.some(keyword => trimmedInput.includes(keyword)) && !imageFile;
    const isImageEditRequest = imageEditKeywords.some(keyword => trimmedInput.includes(keyword)) && !!imageFile;
    const shouldGenerateImage = isImageGenRequest || isImageEditRequest;

    let loadingText = 'جاري كتابة رد...';
    if (isImageGenRequest) loadingText = 'جاري إنشاء الصورة...';
    else if (isImageEditRequest) loadingText = 'جاري تعديل الصورة...';
    else if (imageFile) loadingText = 'جاري تحليل الصورة...';
    else if (trimmedInput.match(/```/g)) loadingText = 'جاري كتابة الكود البرمجي...';
    setLoadingMessage(loadingText);
    
    removeImage();

    if (imageFile || isImageGenRequest) {
        const { parts } = await generateContentWithImage(trimmedInput, imagePayload, shouldGenerateImage, history, systemInstruction);
        // FIX: Explicitly type botMessage as Message to prevent type widening of the 'role' property.
        const botMessage: Message = { id: uuidv4(), role: 'model', parts, timestamp: new Date().toISOString() };
        const finalMessages = [...updatedMessages, botMessage];
        setMessages(finalMessages);
        onChatUpdate({ messages: finalMessages });
        setIsLoading(false);
        setLoadingMessage(null);
    } else {
        const botMessageId = uuidv4();
        const placeholderBotMessage: Message = { 
            id: botMessageId, 
            role: 'model', 
            parts: [{ text: '' }], 
            timestamp: new Date().toISOString() 
        };
        setMessages(prev => [...prev, placeholderBotMessage]);

        try {
            const stream = await generateGroundedResponseStream(trimmedInput, history, systemInstruction);
            
            let fullText = '';
            let finalChunk: GenerateContentResponse | undefined;
            
            for await (const chunk of stream) {
                fullText += chunk.text;
                finalChunk = chunk;
                
                setMessages(currentMessages => 
                    currentMessages.map(m => 
                        m.id === botMessageId 
                            ? { ...m, parts: [{ text: fullText }] }
                            : m
                    )
                );
            }
            
            const groundingChunks = finalChunk?.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
            
            const finalBotMessage: Message = {
                id: botMessageId,
                role: 'model',
                parts: [{ text: fullText }],
                timestamp: new Date().toISOString(),
                groundingAttribution: groundingChunks?.map(chunk => ({ web: chunk.web })),
            };

            const finalMessages = [...updatedMessages, finalBotMessage];
            onChatUpdate({ messages: finalMessages });

        } catch (error) {
            console.error("Streaming error:", error);
            const errorMessagePart = { text: (error instanceof Error ? error.message : String(error)) || "عفواً، حدث خطأ أثناء الاتصال." };
            setMessages(currentMessages => 
                currentMessages.map(m => 
                    m.id === botMessageId 
                        ? { ...m, parts: [errorMessagePart] }
                        : m
                )
            );
            // FIX: Explicitly type errorBotMessage as Message to prevent type widening of the 'role' property.
            const errorBotMessage: Message = { id: botMessageId, role: 'model', parts: [errorMessagePart], timestamp: new Date().toISOString() };
            const finalMessagesWithError = [...updatedMessages, errorBotMessage];
            onChatUpdate({ messages: finalMessagesWithError });
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handlePersonaChange = (newPersona: Persona) => {
    if (newPersona !== chat.persona) {
        onNewChat(newPersona);
    }
  };

  const handleSetFeedback = useCallback((messageId: string, feedback: 'liked' | 'disliked') => {
    const updatedMessages = messages.map(msg => 
        msg.id === messageId ? { ...msg, feedback: msg.feedback === feedback ? undefined : feedback } : msg
    );
    setMessages(updatedMessages);
    onChatUpdate({ messages: updatedMessages });
  }, [messages, onChatUpdate]);

  const handleRegenerate = useCallback(async (messageId: string) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (isLoading || messageIndex < 1 || messages[messageIndex].role !== 'model') return;

    const lastUserMessage = messages[messageIndex - 1];
    if (lastUserMessage.role !== 'user') return;

    setIsLoading(true);
    setLoadingMessage('جاري إعادة إنشاء الرد...');
    
    const history = messages.slice(0, messageIndex - 1).map(({ groundingAttribution, ...rest }) => rest);
    const lastUserTextPart = lastUserMessage.parts.find(p => 'text' in p) as Part & { text: string } | undefined;
    const lastUserImagePart = lastUserMessage.parts.find(p => 'inlineData' in p) as Part & { inlineData: any } | undefined;

    const promptText = lastUserTextPart?.text || '';
    const imagePayload = lastUserImagePart?.inlineData ? { mimeType: lastUserImagePart.inlineData.mimeType, data: lastUserImagePart.inlineData.data } : null;
    
    const wasImageResponse = messages[messageIndex].parts.some(p => 'inlineData' in p);

    if (wasImageResponse || imagePayload) {
        const { parts } = await generateContentWithImage(promptText, imagePayload, wasImageResponse, history, PERSONAS[chat.persona].instruction);
        // FIX: Explicitly type newBotMessage as Message to prevent type widening of the 'role' property.
        const newBotMessage: Message = { id: uuidv4(), role: 'model', parts, timestamp: new Date().toISOString() };
        const updatedMessages = [...messages.slice(0, messageIndex), newBotMessage];
        setMessages(updatedMessages);
        onChatUpdate({ messages: updatedMessages });
        setIsLoading(false);
        setLoadingMessage(null);
    } else {
        const newBotMessageId = uuidv4();
        const placeholderBotMessage: Message = { 
            id: newBotMessageId, 
            role: 'model', 
            parts: [{ text: '' }], 
            timestamp: new Date().toISOString() 
        };
        const messagesWithPlaceholder = [...messages.slice(0, messageIndex), placeholderBotMessage];
        setMessages(messagesWithPlaceholder);

        try {
            const stream = await generateGroundedResponseStream(promptText, history, PERSONAS[chat.persona].instruction);
            
            let fullText = '';
            let finalChunk: GenerateContentResponse | undefined;

            for await (const chunk of stream) {
                fullText += chunk.text;
                finalChunk = chunk;
                
                setMessages(currentMessages => 
                    currentMessages.map(m => 
                        m.id === newBotMessageId 
                            ? { ...m, parts: [{ text: fullText }] }
                            : m
                    )
                );
            }

            const groundingChunks = finalChunk?.candidates?.[0]?.groundingMetadata?.groundingChunks as GroundingChunk[] | undefined;
            const finalBotMessage: Message = {
                id: newBotMessageId,
                role: 'model',
                parts: [{ text: fullText }],
                timestamp: new Date().toISOString(),
                groundingAttribution: groundingChunks?.map(chunk => ({ web: chunk.web })),
            };

            const finalMessages = [...messages.slice(0, messageIndex), finalBotMessage];
            onChatUpdate({ messages: finalMessages });

        } catch (error) {
            console.error("Regeneration streaming error:", error);
            const errorMessagePart = { text: (error instanceof Error ? error.message : String(error)) || "عفواً، حدث خطأ أثناء الاتصال." };
            setMessages(currentMessages => 
                currentMessages.map(m => 
                    m.id === newBotMessageId 
                        ? { ...m, parts: [errorMessagePart] }
                        : m
                )
            );
            // FIX: Explicitly type errorBotMessage as Message to prevent type widening of the 'role' property.
            const errorBotMessage: Message = { id: newBotMessageId, role: 'model', parts: [errorMessagePart], timestamp: new Date().toISOString() };
            const finalMessagesWithError = [...messages.slice(0, messageIndex), errorBotMessage];
            onChatUpdate({ messages: finalMessagesWithError });
        } finally {
            setIsLoading(false);
            setLoadingMessage(null);
        }
    }
  }, [messages, isLoading, chat.persona, onChatUpdate]);


  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-gray-900 overflow-hidden">
      <header className="flex items-center justify-between p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700/50 z-10">
          <div className="flex items-center gap-2">
             <button onClick={onMenuClick} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                <MenuIcon />
            </button>
            <h2 className="text-lg font-semibold truncate hidden sm:block">{chat.title}</h2>
          </div>
          <PersonaSelector 
            currentPersona={chat.persona}
            onPersonaChange={handlePersonaChange}
          />
      </header>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-10">
            <BotIcon className="w-16 h-16 mx-auto text-primary-500" />
            <h2 className="mt-4 text-2xl font-semibold text-gray-700 dark:text-gray-300">
              {PERSONAS[chat.persona].welcomeHeader}
            </h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400">
              {PERSONAS[chat.persona].welcomeMessage}
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage 
            key={msg.id} 
            message={msg} 
            onSetFeedback={handleSetFeedback}
            onRegenerate={handleRegenerate}
          />
        ))}
         {isLoading && loadingMessage && messages.length > 0 && (
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                <BotIcon className="w-6 h-6 text-white" />
              </div>
              <div className="flex items-center space-x-2 pt-2 bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-none px-4 py-2">
                 <span className="text-sm text-gray-500 dark:text-gray-400">{loadingMessage}</span>
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-primary-400 rounded-full animate-pulse"></div>
              </div>
            </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 bg-white dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700/50">
        {imagePreview && (
          <div className="relative w-24 h-24 mb-2 p-1 border border-gray-300 dark:border-gray-600 rounded-md">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded" />
            <button onClick={removeImage} className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full p-0.5 hover:bg-red-500">
                <CloseIcon className="w-4 h-4" />
            </button>
          </div>
        )}
        <form onSubmit={handleSubmit} className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="اسألني أي حاجة..."
            className="w-full pl-24 pr-4 py-3 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            rows={1}
            style={{maxHeight: '100px'}}
          />
           <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
             <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"
              aria-label="Attach image"
             >
                <PaperclipIcon />
             </button>
            <button
              type="submit"
              disabled={isLoading || (!input.trim() && !imageFile)}
              className="p-2 rounded-full bg-primary-600 text-white disabled:bg-primary-400 disabled:cursor-not-allowed hover:bg-primary-700 transition-colors"
            >
              <SendIcon />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


const ChatMessage: React.FC<{ 
    message: Message;
    onSetFeedback: (messageId: string, feedback: 'liked' | 'disliked') => void;
    onRegenerate: (messageId: string) => void;
}> = React.memo(({ message, onSetFeedback, onRegenerate }) => {
    const isUser = message.role === 'user';
    const formattedTime = new Date(message.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

    const renderPart = (part: Part, index: number) => {
        if ('text' in part && part.text) {
            const codeBlockRegex = /```(\w*?)\n([\s\S]*?)```/g;
            const textParts = part.text.split(codeBlockRegex);

            if (textParts.length <= 1) {
                return <p key={index} className="whitespace-pre-wrap">{part.text}</p>;
            }
            
            return (
                <div key={index} className="whitespace-pre-wrap">
                    {textParts.map((segment, i) => {
                        if (i % 3 === 0) {
                            return <span key={i}>{segment}</span>;
                        } else if (i % 3 === 2) {
                            const language = textParts[i - 1] || '';
                            return <CodeBlock key={i} code={segment.trim()} language={language} />;
                        }
                        return null;
                    })}
                </div>
            );
        }
        if ('inlineData' in part) {
            const src = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            return (
                <div key={index} className="relative group mt-2">
                    <img src={src} alt="Generated content" className="rounded-lg max-w-full h-auto" />
                    <a
                        href={src}
                        download={`image-${Date.now()}.png`}
                        className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white p-2 rounded-full hover:bg-black/80"
                        aria-label="Download image"
                    >
                        <DownloadIcon />
                    </a>
                </div>
            );
        }
        return null;
    };
    
    return (
        <div className={`flex items-start gap-4 ${isUser ? 'flex-row-reverse' : ''} group relative`}>
             <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isUser ? 'bg-gray-300 dark:bg-gray-600' : 'bg-gradient-to-br from-primary-400 to-primary-600'}`}>
                {isUser ? <UserIcon className="w-6 h-6 text-gray-700 dark:text-gray-200"/> : <BotIcon className="w-6 h-6 text-white" />}
             </div>
             <div className="space-y-2">
                <div className={`p-4 rounded-2xl max-w-lg min-w-0 ${isUser ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-br-none' : 'bg-gray-100 dark:bg-gray-800 rounded-bl-none'}`}>
                    <div className="prose prose-sm dark:prose-invert max-w-none space-y-2">
                        {message.parts.map(renderPart).filter(Boolean)}
                    </div>
                     {message.groundingAttribution && message.groundingAttribution.length > 0 && (
                         <div className="mt-4 pt-2 border-t border-gray-200 dark:border-gray-700">
                             <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">المصادر:</h4>
                             <div className="space-y-1">
                                 {message.groundingAttribution.map((attr, i) => (
                                     <a href={attr.web.uri} key={i} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary-600 dark:text-primary-400 hover:underline truncate">
                                         {attr.web.title || attr.web.uri}
                                     </a>
                                 ))}
                             </div>
                         </div>
                     )}
                </div>
                 <div className={`flex items-center gap-4 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100 ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{formattedTime}</span>
                    {!isUser && (
                        <div className="flex items-center gap-1">
                            <button onClick={() => onSetFeedback(message.id, 'liked')} className={`p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 ${message.feedback === 'liked' ? 'text-primary-500' : 'text-gray-400'}`}>
                                <ThumbsUpIcon className="w-4 h-4"/>
                            </button>
                            <button onClick={() => onSetFeedback(message.id, 'disliked')} className={`p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 ${message.feedback === 'disliked' ? 'text-red-500' : 'text-gray-400'}`}>
                                <ThumbsDownIcon className="w-4 h-4" />
                            </button>
                            <button onClick={() => onRegenerate(message.id)} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400">
                                <RefreshIcon className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
             </div>
        </div>
    )
});

export default ChatView;