import { getAuthToken } from '../lib/firebase';
import { GeminiChatResponse, GeminiSummaryResponse } from '../types';

export class AIServiceError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AIServiceError';
    this.statusCode = statusCode;
  }
}

/**
 * Safely parses response, verifying Content-Type and handling both JSON and HTML errors gracefully
 */
async function parseJsonResponse<T>(response: Response, defaultErrorMsg: string): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (!response.ok) {
    let errorMsg = defaultErrorMsg;
    if (isJson) {
      try {
        const errData = await response.json();
        if (errData && errData.error) {
          errorMsg = errData.error;
        } else if (errData && errData.message) {
          errorMsg = errData.message;
        }
      } catch {
        errorMsg = `Server error (${response.status}: ${response.statusText || 'Error'})`;
      }
    } else {
      const rawText = await response.text();
      if (rawText.includes('<!doctype') || rawText.includes('<html')) {
        errorMsg = `Server returned an HTML error page (${response.status} ${response.statusText || 'Service Unavailable'}). Please retry in a moment.`;
      } else if (rawText.trim().length > 0) {
        errorMsg = rawText.slice(0, 150);
      } else {
        errorMsg = `Server returned status ${response.status} (${response.statusText || 'Error'})`;
      }
    }
    throw new AIServiceError(errorMsg, response.status);
  }

  // Response is OK (2xx), but verify that the content type is JSON
  if (!isJson) {
    const rawText = await response.text();
    console.error('Unexpected non-JSON response payload:', rawText.slice(0, 200));
    throw new AIServiceError(
      `Received unexpected response format (${response.status} ${contentType || 'non-JSON'}). Please retry.`,
      response.status
    );
  }

  try {
    const data = await response.json();
    return data as T;
  } catch (err: any) {
    throw new AIServiceError(
      `Failed to parse server response as JSON: ${err?.message || 'Invalid format'}`,
      response.status
    );
  }
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

  const response = await fetch('/api/journal/chat', {
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
  });

  return await parseJsonResponse<GeminiChatResponse>(response, 'Failed to get reflection from Gemini');
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

  const response = await fetch('/api/journal/summarize', {
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
  });

  return await parseJsonResponse<GeminiSummaryResponse>(response, 'Failed to generate journal summary');
}
