# Personal Gemini Journal

A user-authenticated personal reflection and journaling web application featuring **Firebase Authentication (Google Sign-In)**, **Cloud Firestore** for private document persistence, **Gemini AI** for multi-turn empathetic reflection and structured cognitive synthesis, deployed as a full-stack container on **Google Cloud Run**.

---

## Architecture & Security Highlights

1. **Strict User Data Isolation:**
   - Database schema uses owner-isolated subcollections: `/users/{userId}/entries/{entryId}` and `/users/{userId}/entries/{entryId}/messages/{messageId}`.
   - Cloud Firestore Security Rules enforce zero-trust policies (`request.auth.uid == userId`) blocking cross-tenant reads, writes, and modifications.
2. **Zero Client-Side Secret Leakage:**
   - The frontend never bundles or references `GEMINI_API_KEY`.
   - All AI interactions pass through the Cloud Run backend (`/api/journal/chat` and `/api/journal/summarize`) requiring a valid Firebase ID token in the `Authorization: Bearer <token>` header.
3. **Multi-Turn Conversational Brainstorming:**
   - Explore thoughts, reframe challenges, and brainstorm solutions in real-time with Gemini.
   - All turns (user prompts and Gemini replies) are persistently saved to Firestore in the user's private thread.
4. **Structured Cognitive Synthesis:**
   - Automated extraction of emotional tone, 2-sentence summary, cognitive patterns, and actionable micro-steps.
5. **Data Loss Prevention:**
   - Debounced auto-saving and manual save options.
   - Undefined-value stripping to prevent Firestore runtime write exceptions.
   - Draft preservation if network or AI calls encounter transient issues.

---

## Tech Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind CSS, Lucide Icons | Responsive single-screen dashboard & reflection editor |
| **Authentication** | Firebase Authentication | Google Sign-In with popup, token rotation & verification |
| **Database** | Cloud Firestore | Realtime document sync, multi-turn history & owner isolation |
| **Backend & Runtime** | Node.js, Express, Cloud Run | ID token validation, rate-limiting, and secure Gemini proxy |
| **AI Engine** | Google GenAI SDK (`@google/genai`) | Multi-turn chat & structured JSON reflection summaries |

---

## Prerequisites & Cloud APIs

Ensure the following Google Cloud APIs are enabled in your Google Cloud Project:

```bash
gcloud services enable \
  run.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com \
  secretmanager.googleapis.com \
  generativelanguage.googleapis.com
```

---

## Environment Variables Configuration

Create a `.env` file based on `.env.example`:

```env
# Required for Gemini AI API calls (Retrieved from Google AI Studio / Cloud Secret Manager)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY"

# Firebase Project ID (Used for server-side ID token verification)
FIREBASE_PROJECT_ID="gen-lang-client-0499390612"

# Application URL
APP_URL="http://localhost:3000"
```

---

## Cloud Firestore Security Rules

Deploy the secure rules defined in `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isSignedIn() && request.auth.uid == userId;
    }

    match /{document=**} {
      allow read, write: if false;
    }

    match /users/{userId} {
      allow read, write: if isOwner(userId);

      match /entries/{entryId} {
        allow read, delete: if isOwner(userId);
        allow create: if isOwner(userId) && request.resource.data.userId == userId;
        allow update: if isOwner(userId) && request.resource.data.userId == resource.data.userId;

        match /messages/{messageId} {
          allow read, write: if isOwner(userId);
        }
      }
    }
  }
}
```

---

## Cloud Run Deployment

Deploy the container directly to Cloud Run:

```bash
# 1. Build and push container or deploy from source
gcloud run deploy personal-gemini-journal \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars FIREBASE_PROJECT_ID="gen-lang-client-0499390612" \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

---

## Local Development & Testing

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Start Dev Server:**
   ```bash
   npm run dev
   ```
   Server will boot on `http://localhost:3000`.

3. **Verify Build:**
   ```bash
   npm run build
   ```

---

## Walkthrough Test Cases

1. **Authentication Flow:**
   - Open the application unauthenticated; verify the Landing Page renders with zero journal entries exposed.
   - Click **Sign in with Google**. Verify the popup completes and redirects to the private dashboard.
   - Verify the user avatar and email are visible in the top navigation.
2. **Journal Entry Creation & Auto-Save:**
   - Click **New Journal Reflection**.
   - Type a title, select a mood (e.g., *Grateful* or *Thoughtful*), and write content.
   - Verify the auto-save indicator transitions from `Unsaved changes` → `Saving...` → `Saved to Firestore`.
3. **Multi-Turn Discussion with Gemini:**
   - Under the journal entry, click a suggestion chip like *"Help me reframe this challenge positively"* or type a custom prompt.
   - Confirm the user message appears in the thread.
   - Confirm Gemini streams or responds with empathetic, constructive reflection.
   - Inspect Firestore: verify both the user and model messages are persisted in `/users/{userId}/entries/{entryId}/messages`.
4. **Structured Synthesis:**
   - Click **Gemini Synthesis**.
   - Verify that Gemini generates a 2-sentence summary, detected mood, cognitive insights, and action items.
   - Confirm the summary appears in the entry list sidebar snippet.
5. **Cross-User Data Isolation Verification:**
   - Sign out and sign in with a different Google account.
   - Confirm the previous user's entries, messages, and reflections are not visible.
