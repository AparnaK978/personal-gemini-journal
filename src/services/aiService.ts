import { getAuthToken } from '../lib/firebase';
import { GeminiChatResponse, GeminiSummaryResponse, InsightsResponse, JournalEntry } from '../types';

export class AIServiceError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AIServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * Safely fetches an API endpoint and parses JSON with automatic retry if the server is warming up
 */
async function fetchJsonWithRetry<T>(
  url: string,
  options: RequestInit,
  defaultErrorMsg: string,
  maxRetries: number = 4
): Promise<T> {
  let attempt = 0;

  const fetchOptions: RequestInit = {
    credentials: 'include',
    ...options,
    headers: {
      ...options.headers
    }
  };

  while (attempt <= maxRetries) {
    let response: Response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (err: any) {
      if (attempt < maxRetries) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, 1200 + attempt * 400));
        continue;
      }
      throw new AIServiceError(`Network error connecting to AI service: ${err?.message || 'Check connection'}`, 0);
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    // Check if the server reverse-proxy returned a "Starting Server..." page or transient 502/503
    if (!isJson && response.status === 200) {
      const text = await response.text();
      if (text.includes('Starting Server...') || text.includes('<title>Starting Server') || text.includes('Starting Server')) {
        if (attempt < maxRetries) {
          attempt++;
          await new Promise((resolve) => setTimeout(resolve, 1500 + attempt * 500));
          continue;
        }
        throw new AIServiceError('The AI server was completing initialization. Please click Generate Insights again.', 503);
      }

      if (text.includes('__cookie_check') || text.includes('Action required to load your app')) {
        throw new AIServiceError('Browser security verification required. Please refresh the page to continue.', 403);
      }

      throw new AIServiceError(`Received unexpected response format (${response.status} ${contentType || 'non-JSON'}). Please retry.`, response.status);
    }

    if (!response.ok) {
      if ((response.status === 502 || response.status === 503) && attempt < maxRetries) {
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, 1500 + attempt * 500));
        continue;
      }

      let errorMsg = defaultErrorMsg;
      if (isJson) {
        try {
          const errData = await response.json();
          if (errData?.error) {
            errorMsg = errData.error;
          } else if (errData?.message) {
            errorMsg = errData.message;
          }
        } catch {
          errorMsg = `Server error (${response.status}: ${response.statusText || 'Error'})`;
        }
      } else {
        const rawText = await response.text();
        if (rawText.includes('<!doctype') || rawText.includes('<html')) {
          errorMsg = `Server is temporarily unavailable (${response.status}). Please retry in a moment.`;
        } else if (rawText.trim().length > 0) {
          errorMsg = rawText.slice(0, 150);
        } else {
          errorMsg = `Server returned status ${response.status} (${response.statusText || 'Error'})`;
        }
      }
      throw new AIServiceError(errorMsg, response.status);
    }

    // Response is OK and is JSON
    try {
      const data = await response.json();
      return data as T;
    } catch (err: any) {
      throw new AIServiceError(`Failed to parse server response: ${err?.message || 'Invalid format'}`, response.status);
    }
  }

  throw new AIServiceError(defaultErrorMsg, 500);
}

export async function askGemini(
  entryId: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'model'; content: string }>,
  entryContext?: { title: string; content: string; mood?: string }
): Promise<GeminiChatResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new AIServiceError('Authentication required. Please sign in to converse with Gemini.', 401);
  }

  return await fetchJsonWithRetry<GeminiChatResponse>(
    '/api/journal/chat',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        entryId,
        message: userMessage,
        history: conversationHistory,
        context: entryContext
      })
    },
    'Failed to get reflection from Gemini'
  );
}

export async function generateJournalSummary(
  entryId: string,
  title: string,
  content: string,
  mood: string,
  messages: Array<{ role: 'user' | 'model'; content: string }>
): Promise<GeminiSummaryResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new AIServiceError('Authentication required. Please sign in to summarize your journal.', 401);
  }

  return await fetchJsonWithRetry<GeminiSummaryResponse>(
    '/api/journal/summarize',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        entryId,
        title,
        content,
        mood,
        messages
      })
    },
    'Failed to generate journal summary'
  );
}

export async function generateMoodAndProgressInsights(
  entries: JournalEntry[],
  options?: {
    forceRefresh?: boolean;
    currentFingerprint?: string;
    cachedInsight?: any;
  }
): Promise<InsightsResponse> {
  const token = await getAuthToken();
  if (!token) {
    throw new AIServiceError('Authentication required. Please sign in to analyze your journal insights.', 401);
  }

  if (!entries || entries.length === 0) {
    throw new AIServiceError('Please create at least one reflection entry before generating insights.', 400);
  }

  // Exclude empty drafts that have no written content and only a default/empty title
  const validEntries = entries.filter((e) => {
    if (!e) return false;
    const content = (e.content || '').trim();
    const title = (e.title || '').trim();
    const isDefaultTitle = !title || title.toLowerCase() === 'new reflection' || title.toLowerCase() === 'untitled';
    return content.length > 0 || !isDefaultTitle;
  });

  if (validEntries.length === 0) {
    throw new AIServiceError('Please write your thoughts in at least one reflection entry before generating insights.', 400);
  }

  // Pass lightweight parent entry representations only (no nested conversation messages)
  const payloadEntries = validEntries.map((e) => ({
    id: e.id,
    title: e.title,
    content: e.content ? e.content.slice(0, 800) : '',
    mood: e.mood || 'thoughtful',
    tags: e.tags || [],
    createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : (e.createdAt?.toDate ? e.createdAt.toDate().toISOString() : (e.createdAt || undefined)),
    updatedAt: e.updatedAt instanceof Date ? e.updatedAt.toISOString() : (e.updatedAt?.toDate ? e.updatedAt.toDate().toISOString() : (e.updatedAt || undefined))
  }));

  return await fetchJsonWithRetry<InsightsResponse>(
    '/api/journal/insights',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        forceRefresh: options?.forceRefresh === true,
        currentFingerprint: options?.currentFingerprint ? String(options.currentFingerprint) : undefined,
        cachedInsight: options?.cachedInsight || undefined,
        entries: payloadEntries
      })
    },
    'Failed to generate mood & progress insights from Gemini'
  );
}

