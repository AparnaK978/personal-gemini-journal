export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export type JournalMood = 'thoughtful' | 'grateful' | 'calm' | 'energized' | 'challenging' | 'creative';

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  mood?: JournalMood | string;
  tags?: string[];
  summary?: string;
  insights?: string[];
  actionItems?: string[];
  messageCount: number;
  createdAt: any;
  updatedAt: any;
}

export interface JournalMessage {
  id: string;
  entryId: string;
  userId: string;
  role: 'user' | 'model';
  content: string;
  sequence?: number;
  turnIndex?: number;
  createdAt: any;
}

export interface GeminiChatResponse {
  role: 'model';
  reply: string;
  suggestions?: string[];
}

export interface GeminiSummaryResponse {
  summary: string;
  mood: string;
  tags: string[];
  insights: string[];
  actionItems: string[];
}
