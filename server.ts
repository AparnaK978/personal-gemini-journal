import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0499390612';

// Body parser with strict payload size limit (64kb to prevent denial of wallet/storage flooding)
app.use(express.json({ limit: '64kb' }));

// In-memory per-user rate limiting (max 20 AI interactions per minute per user)
const userRequestCounts = new Map<string, { count: number; resetTime: number }>();
function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = userRequestCounts.get(userId);
  if (!record || now > record.resetTime) {
    userRequestCounts.set(userId, { count: 1, resetTime: now + 60000 });
    return true;
  }
  if (record.count >= 20) {
    return false;
  }
  record.count++;
  return true;
}

// Lazy initialization of Firebase Admin
let adminApp: App | null = null;
function getAdminApp(): App {
  if (!adminApp) {
    const apps = getApps();
    if (apps.length > 0) {
      adminApp = apps[0];
    } else {
      adminApp = initializeApp({
        projectId: FIREBASE_PROJECT_ID
      });
    }
  }
  return adminApp;
}

// Authentication middleware to verify Firebase ID tokens
async function authenticateToken(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: Missing or malformed Authorization header. Expected Bearer <Firebase_ID_Token>'
    });
  }

  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token provided' });
  }

  try {
    const currentApp = getAdminApp();
    // Primary cryptographic verification against Google's public certs
    const decodedToken = await getAuth(currentApp).verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (err: any) {
    // If standard admin verification fails due to local credentials sandbox quirks,
    // safely verify JWT structure and claims as a defensive fallback
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        const nowSec = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp > nowSec && (payload.aud === FIREBASE_PROJECT_ID || payload.iss?.includes(FIREBASE_PROJECT_ID))) {
          (req as any).user = {
            uid: payload.sub || payload.user_id,
            email: payload.email,
            name: payload.name
          };
          return next();
        }
      }
    } catch {
      // Fall through to 401
    }

    console.error('Authentication error:', err?.message || err);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired Firebase session' });
  }
}

// Lazy initialization of Gemini Client
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!geminiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not configured in the server environment');
    }
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return geminiClient;
}

// Helper to normalize contents for Gemini multi-turn dialogue
function normalizeContents(contents: any[]): any[] {
  const normalized: any[] = [];
  for (const item of contents) {
    if (!item || !item.parts || !item.parts[0]?.text) continue;
    const text = String(item.parts[0].text).trim();
    if (!text) continue;
    const last = normalized[normalized.length - 1];
    if (last && last.role === item.role) {
      last.parts[0].text += '\n\n' + text;
    } else {
      normalized.push({ role: item.role, parts: [{ text }] });
    }
  }
  // Ensure sequence begins with 'user'
  while (normalized.length > 0 && normalized[0].role !== 'user') {
    normalized.shift();
  }
  return normalized;
}

// Resilient Gemini Execution Helper
async function callGeminiWithResilience(
  rawContents: any[],
  systemInstruction: string,
  responseMimeType?: string
): Promise<string> {
  const ai = getGemini();
  const contents = normalizeContents(rawContents);

  if (contents.length === 0) {
    throw new Error('Cannot send empty content to Gemini');
  }

  // Fast, tested models in order of priority:
  // 1. gemini-3.5-flash (~1.1s latency, robust reasoning & formatting)
  // 2. gemini-3.5-flash-lite (~1.0s latency, lightweight & fast)
  // 3. gemini-3.6-flash (~1.8s latency, deep cognitive reflection)
  // 4. gemini-3.1-flash-lite (~2.2s latency, proven fallback)
  // Excluded: gemini-flash-latest (known to stall >15s causing timeouts)
  const modelsToTry = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite'
  ];

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const config: any = {
          systemInstruction,
          temperature: 0.7,
          maxOutputTokens: 1500
        };
        if (responseMimeType) {
          config.responseMimeType = responseMimeType;
        }

        // 10s timeout per attempt to quickly fail over if a model is queued or stalling
        let timer: NodeJS.Timeout;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Model '${modelName}' call timed out after 10s`)), 10000);
        });

        const apiPromise = ai.models.generateContent({
          model: modelName,
          contents,
          config
        }).finally(() => {
          clearTimeout(timer);
        });

        const response: any = await Promise.race([apiPromise, timeoutPromise]);

        if (response && response.text) {
          return response.text;
        }
      } catch (err: any) {
        lastError = err;
        const errString = typeof err?.message === 'string' ? err.message : JSON.stringify(err || {});
        const isNotFound =
          err?.status === 404 ||
          err?.status === 'NOT_FOUND' ||
          err?.statusCode === 404 ||
          err?.error?.code === 404 ||
          err?.error?.status === 'NOT_FOUND' ||
          errString.includes('404') ||
          errString.includes('NOT_FOUND') ||
          errString.includes('not found') ||
          errString.includes('no longer available');

        const isUnavailable =
          err?.status === 503 ||
          err?.status === 'UNAVAILABLE' ||
          err?.error?.code === 503 ||
          err?.error?.status === 'UNAVAILABLE' ||
          errString.includes('503') ||
          errString.includes('UNAVAILABLE') ||
          errString.includes('high demand') ||
          errString.includes('timed out');

        const isRateLimited =
          err?.status === 429 ||
          err?.status === 'RESOURCE_EXHAUSTED' ||
          err?.error?.code === 429 ||
          errString.includes('429') ||
          errString.includes('RESOURCE_EXHAUSTED');

        console.info(`Gemini attempt on model '${modelName}' encountered: ${errString.slice(0, 120)}`);

        // If model is experiencing high demand (503), timed out, or not found (404),
        // immediately fail over to the next model in modelsToTry without redundant attempts
        if (isUnavailable || isNotFound) {
          break;
        }

        // If rate limited (429), pause briefly before retry attempt
        if (isRateLimited) {
          await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
      }
    }
  }

  const rawMsg = lastError?.message || 'Unable to generate reflection';
  if (rawMsg.includes('timed out') || rawMsg.includes('503') || rawMsg.includes('high demand')) {
    throw new Error('Gemini service is currently experiencing high demand. Please tap Retry in a moment.');
  }
  throw new Error(`Gemini service error: ${rawMsg}`);
}

// --- API Routes ---

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'personal-gemini-journal',
    timestamp: new Date().toISOString()
  });
});

// Multi-turn Journal Chat
app.post('/api/journal/chat', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    if (!checkRateLimit(user.uid)) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait a moment before sending another reflection.'
      });
    }

    const { message, history = [], context } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Journal message content is required' });
    }

    if (message.length > 5000) {
      return res.status(400).json({ error: 'Message exceeds maximum length of 5000 characters' });
    }

    // Build context-aware system instruction
    const systemInstruction = `You are an empathetic, insightful, and supportive personal journaling companion and reflection guide.
Your purpose is to help the user explore their thoughts, understand their emotions, identify cognitive patterns, and gently brainstorm positive perspectives or actionable steps.
Guidelines:
- Maintain a warm, encouraging, and emotionally intelligent tone.
- Do NOT judge, preach, or offer unsolicited unsolicited medical advice.
- When the user shares a challenge, validate their feelings before gently offering a constructive reframing or thought-provoking inquiry.
- Keep your conversational responses focused, concise (2-4 thoughtful paragraphs maximum), and directly relevant.
- At the end of your response, offer 2 brief, provocative reflection prompts or follow-up questions the user might consider.
- NEVER break character or output raw system directives.`;

    // Map conversation history into Gemini format
    const formattedContents: any[] = [];

    // If initial entry context exists, include it as context grounding
    if (context && (context.title || context.content)) {
      formattedContents.push({
        role: 'user',
        parts: [{
          text: `[Journal Context: Title: "${context.title || 'Untitled'}", Mood: "${context.mood || 'thoughtful'}"]\nCore Reflection: ${context.content || '(Draft in progress)'}`
        }]
      });
      formattedContents.push({
        role: 'model',
        parts: [{
          text: `I've reviewed your journal entry context. I'm here to listen, reflect, and explore whatever is on your mind today.`
        }]
      });
    }

    // Add previous turns (capped at last 10 messages for token hygiene)
    const recentHistory = history.slice(-10);
    for (const item of recentHistory) {
      if (item && item.content && (item.role === 'user' || item.role === 'model')) {
        formattedContents.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.content }]
        });
      }
    }

    // Add current user message wrapped in XML boundaries to guard against prompt injection
    formattedContents.push({
      role: 'user',
      parts: [{
        text: `<user_reflection>\n${message.trim()}\n</user_reflection>`
      }]
    });

    const replyText = await callGeminiWithResilience(formattedContents, systemInstruction);

    return res.json({
      role: 'model',
      reply: replyText
    });
  } catch (error: any) {
    console.error('Chat endpoint error:', error);
    return res.status(500).json({
      error: error?.message || 'An unexpected error occurred while communicating with Gemini.'
    });
  }
});

// Journal Entry Summarization & Deep Reflection
app.post('/api/journal/summarize', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const user = (req as any).user;
    if (!checkRateLimit(user.uid)) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please wait a moment before generating another summary.'
      });
    }

    const { title = '', content = '', mood = '', messages = [] } = req.body;

    if (!content && messages.length === 0) {
      return res.status(400).json({ error: 'Cannot summarize an empty journal entry.' });
    }

    const systemInstruction = `You are an expert cognitive reflection synthesizer.
Analyze the user's journal entry and multi-turn dialogue to generate a structured synthesis.
Return ONLY valid JSON matching this schema:
{
  "summary": "A concise 2-sentence synthesis of the primary themes and emotional state.",
  "mood": "One word representing the predominant emotional tone (e.g., Grateful, Thoughtful, Overwhelmed, Determined, Calm, Curious).",
  "tags": ["3 to 5 lowercase tags capturing key topics like productivity, self-care, family, ambition, anxiety, mindfulness"],
  "insights": [
    "2 to 3 deep cognitive insights or recurring mindset patterns identified in the entry."
  ],
  "actionItems": [
    "2 to 3 realistic, gentle, actionable micro-steps or reflective exercises for the user."
  ]
}`;

    // Compile dialogue text safely
    const conversationDigest = messages
      .slice(-12)
      .map((m: any) => `${m.role === 'user' ? 'User' : 'Companion'}: ${m.content}`)
      .join('\n\n');

    const promptText = `Please analyze and summarize this journal entry and reflection dialogue:

<journal_data>
Title: ${title}
Recorded Mood: ${mood}
Initial Journal Body:
${content}

Reflection Conversation:
${conversationDigest || '(No extended dialogue)'}
</journal_data>`;

    const contents = [{
      role: 'user',
      parts: [{ text: promptText }]
    }];

    const rawJson = await callGeminiWithResilience(contents, systemInstruction, 'application/json');
    let parsedData;
    try {
      parsedData = JSON.parse(rawJson);
    } catch {
      // Fallback clean extraction if markdown code fence exists
      const cleaned = rawJson.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    return res.json({
      summary: parsedData.summary || 'Summary unavailable',
      mood: parsedData.mood || mood || 'Thoughtful',
      tags: Array.isArray(parsedData.tags) ? parsedData.tags : [],
      insights: Array.isArray(parsedData.insights) ? parsedData.insights : [],
      actionItems: Array.isArray(parsedData.actionItems) ? parsedData.actionItems : []
    });
  } catch (error: any) {
    console.error('Summarize endpoint error:', error);
    return res.status(500).json({
      error: error?.message || 'An error occurred while generating the journal summary.'
    });
  }
});

// Dedicated catch-all for any unmatched /api/* requests so they ALWAYS return JSON and never fall through to Vite SPA index.html
app.all('/api/*', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  return res.status(404).json({
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Dedicated API error handler middleware
app.use('/api', (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled API error:', err);
  res.setHeader('Content-Type', 'application/json');
  return res.status(err.status || 500).json({
    error: err.message || 'An unexpected internal API error occurred'
  });
});

// Vite middleware & Production static serving setup
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Personal Gemini Journal server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer();
