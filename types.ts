export interface User {
  email: string;
  isDeveloper: boolean;
}

export interface TextPart {
  text: string;
}

export interface ImagePart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export type Part = TextPart | ImagePart;


export interface GroundingAttribution {
  web: {
    uri: string;
    title: string;
  };
}

export interface GroundingChunk {
  web: {
    uri: string;
    title: string;
  };
}


export interface Message {
  id: string;
  role: 'user' | 'model';
  parts: Part[];
  timestamp: string;
  feedback?: 'liked' | 'disliked';
  groundingAttribution?: GroundingAttribution[];
}

export type Persona = 'pro' | 'normal' | 'learning' | 'creative' | 'developer' | 'lover' | 'islamic' | 'prep_student_2026';

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  persona: Persona;
}