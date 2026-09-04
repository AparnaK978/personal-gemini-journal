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

export interface InsightTheme {
  theme: string;
  description: string;
  occurrences?: number;
}

export interface MoodAnalysisData {
  predominantMood: string;
  emotionalTrajectory: string;
  moodDistribution: Record<string, number>;
  languageObservations: string[];
}

export interface UserInsight {
  id: string;
  userId: string;
  entryFingerprint?: string;
  generatedAt: any;
  entryCount: number;
  dateRange: {
    from: string;
    to: string;
  };
  recurringThemes: InsightTheme[];
  moodAnalysis: MoodAnalysisData;
  accomplishments: string[];
  challenges: string[];
  growthAreas: string[];
  reflectionPrompts: string[];
  disclaimer: string;
}

export interface InsightsResponse {
  insights: Omit<UserInsight, 'id' | 'userId' | 'generatedAt'>;
  entryCount: number;
  cached?: boolean;
  entryFingerprint?: string;
}
