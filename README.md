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
5. **AI Mood & Progress Insights & Deterministic Caching:**
   - Private, aggregate cognitive synthesis across the user's historical journal entries.
   - Discovers recurring themes, emotional language trajectories, celebrated milestones, and constructive growth areas.
   - Deterministic SHA-256 fingerprinting based on parent entry IDs, timestamps, and recorded moods prevents redundant Gemini API calls and token consumption.
   - Cache-aware **Refresh Insights** returns cached insights immediately if journal entries have not changed; **Force Re-analyze** allows on-demand re-synthesis.
   - Single-entry conservative handling ensures no speculative multi-day trends or clinical extrapolations are made from a single snapshot.
   - Generates tailored reflection prompts for future journal entries with a 1-click "Journal on this" workflow.
   - Explicit reflective observation notice clarifying insights are reflective personal inquiries and not medical, clinical, or psychiatric diagnoses.
6. **Data Loss Prevention:**
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
| **AI Engine** | Google GenAI SDK (`@google/genai`) | Multi-turn chat, entry synthesis & longitudinal mood & progress insights |

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

    // Default deny all access
    match /{document=**} {
      allow read, write: if false;
    }

    // User profile document
    match /users/{userId} {
      allow read: if isOwner(userId);
      allow create: if isOwner(userId)
                    && request.resource.data.id == userId;
      allow update: if isOwner(userId)
                    && request.resource.data.id == userId;
      allow delete: if isOwner(userId);

      // Journal entries subcollection
      match /entries/{entryId} {
        allow read: if isOwner(userId);
        allow create: if isOwner(userId)
                      && request.resource.data.userId == userId;
        allow update: if isOwner(userId)
                      && request.resource.data.userId == resource.data.userId;
        allow delete: if isOwner(userId);

        // Multi-turn messages subcollection
        match /messages/{messageId} {
          allow read: if isOwner(userId);
          allow create: if isOwner(userId)
                        && request.resource.data.userId == userId;
          allow update: if isOwner(userId)
                        && request.resource.data.userId == resource.data.userId;
          allow delete: if isOwner(userId);
        }
      }

      // AI Mood & Progress Insights subcollection
      match /insights/{insightId} {
        allow read: if isOwner(userId);
        allow create: if isOwner(userId)
                      && request.resource.data.userId == userId;
        allow update: if isOwner(userId)
                      && request.resource.data.userId == resource.data.userId;
        allow delete: if isOwner(userId);
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
4. **Structured Entry Synthesis:**
   - Click **Gemini Synthesis**.
   - Verify that Gemini generates a 2-sentence summary, detected mood, cognitive insights, and action items.
   - Confirm the summary appears in the entry list sidebar snippet.
5. **AI Mood & Progress Insights & Cache-Aware Synthesis:**
   - Switch to the **Insights** tab or click the **Mood & Progress Insights** sidebar button.
   - **Zero-Entry Test**: When no entries exist, verify the friendly empty state with a prompt to write a reflection.
   - **Single-Entry Test**: Write a single journal entry and click **Generate Insights**. Verify conservative synthesis (acknowledging the single snapshot without inventing multi-day trajectory trends).
   - **Cache-Hit Test**: Without modifying journal entries, click **Refresh Insights**. Observe immediate return with zero redundant Gemini API calls.
   - **Force Re-analyze Test**: Click **Force Re-analyze**. Verify a fresh synthesis is generated and saved as a new historical insight.
   - **Multi-Entry Synthesis**: Write 3+ reflections across different days and moods. Generate insights and verify:
     - Prominent primary mood and emotional trajectory narrative
     - Mathematical mood frequency distribution chips
     - Recurring core themes with reflection occurrence counts
     - Accomplishments & milestones checklist
     - Challenges & growth opportunities
     - Practical reflection prompts with "Journal on this" action buttons
   - Verify that clicking "Journal on this" opens a new journal entry pre-filled with the selected reflection prompt.
   - Verify the reflective observation notice (disclaimer) is clearly displayed.
   - Refresh the browser or log out and log back in; verify the latest insights remain persisted in Firestore and re-hydrate immediately.
6. **Cross-User Data Isolation Verification:**
   - Sign out and sign in with a different Google account.
   - Confirm the previous user's entries, messages, and insights are not accessible or visible.
