import { GoogleGenAI, Chat, LiveServerMessage, Modality, Blob, GenerateContentResponse, Part as GenaiPart, Content } from '@google/genai';
import type { Message, GroundingChunk, Part } from '../types';

let ai: GoogleGenAI | null = null;

const getAi = () => {
    if (!ai) {
        if (!process.env.API_KEY) {
            throw new Error("API_KEY environment variable not set");
        }
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
};

export const generateGroundedResponseStream = async (
  prompt: string, 
  history: Message[],
  systemInstruction: string,
): Promise<AsyncGenerator<GenerateContentResponse>> => {
  try {
    const genAI = getAi();
    
    // Send only the last 20 messages to keep the payload small and fast
    const recentHistory = history.slice(-20);
    const historyForApi = recentHistory.map(msg => ({
        role: msg.role,
        parts: msg.parts.map(p => ('text' in p ? {text: p.text} : {text: ''}))
    }));


    const responseStream = await genAI.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: [...historyForApi, { role: 'user', parts: [{text: prompt}]}],
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }],
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    return responseStream;
  } catch (error) {
    console.error("Error getting stream from Gemini:", error);
    throw new Error("عفواً، حدث خطأ ما. يرجى المحاولة مرة أخرى.");
  }
};

export const generateContentWithImage = async (
    prompt: string,
    image: { mimeType: string; data: string } | null,
    generateImage: boolean,
    history: Message[],
    systemInstruction: string, // Kept for future models that might support it
): Promise<{ parts: Part[] }> => {
    try {
        const genAI = getAi();

        const currentUserParts: GenaiPart[] = [];
        if (image) {
            currentUserParts.push({
                inlineData: {
                    mimeType: image.mimeType,
                    data: image.data,
                },
            });
        }
        if (prompt) {
            currentUserParts.push({ text: prompt });
        }
        
        // Send only the last 20 messages to keep the payload small and fast
        const recentHistory = history.slice(-20);
        const historyForApi: Content[] = recentHistory.map(msg => ({
            role: msg.role,
            parts: msg.parts.map(p => {
                if ('text' in p) {
                    return { text: p.text };
                }
                if ('inlineData' in p) {
                    return { inlineData: p.inlineData };
                }
                return { text: '' };
            }).filter(p => 'text' in p ? p.text : p.inlineData)
        }));

        const config: { responseModalities?: Modality[] } = {};
        if (generateImage) {
            config.responseModalities = [Modality.IMAGE];
        }

        const response: GenerateContentResponse = await genAI.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: [...historyForApi, { role: 'user', parts: currentUserParts }],
            config: config,
        });
        
        if (generateImage) {
            // We are expecting image parts for generation/editing.
            // The model can also return text, so we return all parts.
            const modelParts = response.candidates?.[0]?.content?.parts;
            if (modelParts && modelParts.length > 0) {
                return { parts: modelParts as Part[] };
            }
            // Fallback if image generation failed.
            return { parts: [{ text: "عفواً، لم أتمكن من إنشاء أو تعديل الصورة. قد يكون الطلب غير واضح." }] };
        } else {
            // We are expecting a text response for analysis.
            const text = response.text;
            if (text) {
                return { parts: [{ text }] };
            }
            // Fallback for analysis failure.
            return { parts: [{ text: "عفواً، لم أتمكن من تحليل الصورة. يرجى المحاولة مرة أخرى." }] };
        }

    } catch (error) {
        console.error("Error with multimodal generation:", error);
        return { parts: [{ text: "عفواً، حدث خطأ فني أثناء معالجة طلبك المتعلق بالصورة." }] };
    }
};


// --- Live API Service ---

// FIX: Define the LiveSession type locally as it is not exported from the SDK.
export interface LiveSession {
    sendRealtimeInput: (input: { media: Blob; }) => void;
    sendToolResponse: (response: any) => void;
    close: () => void;
}

// Audio Encoding/Decoding functions
export function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // FIX: Corrected typo from Int116Array to Int16Array.
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export function createPcmBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// Live Session Connection
export const connectLiveSession = (callbacks: {
    onopen: () => void;
    onmessage: (message: LiveServerMessage) => void;
    onerror: (e: ErrorEvent) => void;
    onclose: (e: CloseEvent) => void;
}, systemInstruction: string, voiceName: string): Promise<LiveSession> => {
    const genAI = getAi();
    return genAI.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks,
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } },
            },
            systemInstruction: systemInstruction,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            // Disable thinking to ensure the fastest possible response time.
            thinkingConfig: { thinkingBudget: 0 },
        },
    });
};