import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  getDocs,
  writeBatch,
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { JournalEntry, JournalMessage, UserInsight } from '../types';

/**
 * Determines whether a value is a Firestore sentinel object (FieldValue or Timestamp)
 * that must be preserved as-is and not traversed as a plain object.
 */
function isFirestoreSpecial(val: any): boolean {
  if (!val || typeof val !== 'object') return false;
  if (val instanceof Date) return true;
  if (typeof val.toDate === 'function') return true; // Firestore Timestamp
  if ('_methodName' in val) return true; // Firestore FieldValue (serverTimestamp, increment, deleteField)
  if (
    val.constructor &&
    val.constructor.name &&
    (val.constructor.name.includes('FieldValue') || val.constructor.name.includes('Timestamp'))
  ) {
    return true;
  }
  return false;
}

/**
 * Strips undefined values recursively from objects to prevent Firestore exceptions
 * while carefully preserving Firestore FieldValue sentinels (serverTimestamp, increment, etc.)
 */
export function sanitizePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !isFirestoreSpecial(value)) {
      result[key] = sanitizePayload(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Helper to extract millisecond timestamp from various Date/Timestamp formats
 */
function getMessageTime(m: JournalMessage): number {
  if (!m || !m.createdAt) return 0;
  if (typeof m.createdAt === 'number') return m.createdAt;
  if (m.createdAt instanceof Date) return m.createdAt.getTime();
  if (typeof m.createdAt.toMillis === 'function') return m.createdAt.toMillis();
  if (typeof m.createdAt.toDate === 'function') return m.createdAt.toDate().getTime();
  if (typeof m.createdAt.seconds === 'number') return m.createdAt.seconds * 1000;
  return 0;
}

/**
 * Ensures conversation messages are always ordered strictly chronologically and as alternating dialogue turns:
 * User 1 -> Gemini 1 -> User 2 -> Gemini 2 -> User 3 -> Gemini 3...
 */
export function orderConversationMessages(rawMessages: JournalMessage[]): JournalMessage[] {
  if (!rawMessages || rawMessages.length <= 1) return rawMessages || [];

  // 1. If all messages already have explicit sequential indices, sort strictly by sequence
  const hasAllSequences = rawMessages.every((m) => typeof m.sequence === 'number');
  if (hasAllSequences) {
    return [...rawMessages].sort((a, b) => (a.sequence! - b.sequence!));
  }

  // 2. Sort by timestamp as candidate order
  const sortedByTime = [...rawMessages].sort((a, b) => {
    const tA = getMessageTime(a);
    const tB = getMessageTime(b);
    if (tA && tB && tA !== tB) return tA - tB;
    if (typeof a.sequence === 'number' && typeof b.sequence === 'number') {
      return a.sequence - b.sequence;
    }
    return 0;
  });

  // Check if sortedByTime naturally alternates (no grouping where all users precede all models)
  let isAlternating = true;
  for (let i = 0; i < sortedByTime.length; i++) {
    const expected = i % 2 === 0 ? 'user' : 'model';
    if (sortedByTime[i].role !== expected && i < sortedByTime.length - 1) {
      isAlternating = false;
      break;
    }
  }

  if (isAlternating) {
    return sortedByTime.map((m, idx) => ({
      ...m,
      sequence: typeof m.sequence === 'number' ? m.sequence : idx,
      turnIndex: typeof m.turnIndex === 'number' ? m.turnIndex : Math.floor(idx / 2) + 1
    }));
  }

  // 3. Resilient Interleaving for skewed/grouped legacy timestamps
  // (e.g. [U1, U2, U3, M1, M2, M3] -> [U1, M1, U2, M2, U3, M3])
  const userMsgs = sortedByTime.filter((m) => m.role === 'user');
  const modelMsgs = sortedByTime.filter((m) => m.role === 'model');

  const ordered: JournalMessage[] = [];
  const maxTurns = Math.max(userMsgs.length, modelMsgs.length);
  for (let i = 0; i < maxTurns; i++) {
    if (i < userMsgs.length) {
      ordered.push({
        ...userMsgs[i],
        sequence: i * 2,
        turnIndex: i + 1
      });
    }
    if (i < modelMsgs.length) {
      ordered.push({
        ...modelMsgs[i],
        sequence: i * 2 + 1,
        turnIndex: i + 1
      });
    }
  }

  return ordered;
}

/**
 * Real-time listener for user journal entries
 */
export function subscribeToEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError: (error: Error) => void
) {
  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('updatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: JournalEntry[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        entries.push({
          id: docSnap.id,
          userId: data.userId || userId,
          title: data.title || 'Untitled Reflection',
          content: data.content || '',
          mood: data.mood || 'thoughtful',
          tags: data.tags || [],
          summary: data.summary,
          insights: data.insights,
          actionItems: data.actionItems,
          messageCount: data.messageCount || 0,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date()
        });
      });
      onUpdate(entries);
    },
    (err) => {
      console.error('Error fetching journal entries:', err);
      onError(err);
    }
  );
}

/**
 * Real-time listener for multi-turn messages within a journal entry
 */
export function subscribeToMessages(
  userId: string,
  entryId: string,
  onUpdate: (messages: JournalMessage[]) => void,
  onError: (error: Error) => void
) {
  const messagesRef = collection(db, 'users', userId, 'entries', entryId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const rawMessages: JournalMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        rawMessages.push({
          id: docSnap.id,
          entryId: data.entryId || entryId,
          userId: data.userId || userId,
          role: data.role as 'user' | 'model',
          content: data.content || '',
          sequence: typeof data.sequence === 'number' ? data.sequence : undefined,
          turnIndex: typeof data.turnIndex === 'number' ? data.turnIndex : undefined,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate()
            : (data.createdAt instanceof Date ? data.createdAt : new Date())
        });
      });

      // Normalize and sort messages into strictly alternating, chronological dialogue turns
      const normalizedMessages = orderConversationMessages(rawMessages);
      onUpdate(normalizedMessages);
    },
    (err) => {
      console.error('Error fetching entry messages:', err);
      onError(err);
    }
  );
}

/**
 * Create a new journal entry
 */
export async function createJournalEntry(
  userId: string,
  data: Partial<JournalEntry>
): Promise<string> {
  const entriesRef = collection(db, 'users', userId, 'entries');
  const newDocRef = doc(entriesRef);
  const now = serverTimestamp();

  const payload = sanitizePayload({
    id: newDocRef.id,
    userId,
    title: data.title?.trim() || 'New Reflection',
    content: data.content || '',
    mood: data.mood || 'thoughtful',
    tags: data.tags || [],
    summary: data.summary || '',
    insights: data.insights || [],
    actionItems: data.actionItems || [],
    messageCount: 0,
    createdAt: now,
    updatedAt: now
  });

  await setDoc(newDocRef, payload);
  return newDocRef.id;
}

/**
 * Update an existing journal entry
 */
export async function updateJournalEntry(
  userId: string,
  entryId: string,
  data: Partial<JournalEntry>
): Promise<void> {
  const entryDocRef = doc(db, 'users', userId, 'entries', entryId);
  const payload = sanitizePayload({
    ...data,
    updatedAt: serverTimestamp()
  });

  // Ensure userId and createdAt cannot be overwritten
  delete payload.userId;
  delete payload.createdAt;
  delete payload.id;

  await updateDoc(entryDocRef, payload);
}

/**
 * Delete a journal entry and its messages
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  const entryDocRef = doc(db, 'users', userId, 'entries', entryId);
  
  // Clean up messages in subcollection
  const messagesRef = collection(db, 'users', userId, 'entries', entryId, 'messages');
  const messagesSnap = await getDocs(messagesRef);
  
  const batch = writeBatch(db);
  messagesSnap.forEach((msgDoc) => {
    batch.delete(msgDoc.ref);
  });
  batch.delete(entryDocRef);

  await batch.commit();
}

/**
 * Add a message (user or model) to an entry's thread
 */
export async function addJournalMessage(
  userId: string,
  entryId: string,
  role: 'user' | 'model',
  content: string,
  sequence?: number,
  turnIndex?: number
): Promise<string> {
  const messagesRef = collection(db, 'users', userId, 'entries', entryId, 'messages');
  const newMsgRef = doc(messagesRef);
  const now = serverTimestamp();

  const payload = sanitizePayload({
    id: newMsgRef.id,
    entryId,
    userId,
    role,
    content: content.trim(),
    sequence,
    turnIndex,
    createdAt: now
  });

  await setDoc(newMsgRef, payload);

  // Increment message count and touch updatedAt on entry
  const entryDocRef = doc(db, 'users', userId, 'entries', entryId);
  await updateDoc(entryDocRef, {
    messageCount: increment(1),
    updatedAt: now
  }).catch((err) => {
    console.warn('Failed to increment entry messageCount:', err);
  });

  return newMsgRef.id;
}

/**
 * Atomically writes a complete conversational turn (User message + Gemini response)
 * ensuring sequential indexing, identical turn pairing, and accurate messageCount.
 */
export async function addJournalConversationTurn(
  userId: string,
  entryId: string,
  userContent: string,
  modelContent: string,
  currentMessageCount: number
): Promise<{ userMessageId: string; modelMessageId: string }> {
  const messagesRef = collection(db, 'users', userId, 'entries', entryId, 'messages');
  const userMsgRef = doc(messagesRef);
  const modelMsgRef = doc(messagesRef);
  const entryDocRef = doc(db, 'users', userId, 'entries', entryId);

  const turnIndex = Math.floor(currentMessageCount / 2) + 1;
  const userSequence = currentMessageCount;
  const modelSequence = currentMessageCount + 1;
  const now = serverTimestamp();

  const userPayload = sanitizePayload({
    id: userMsgRef.id,
    entryId,
    userId,
    role: 'user',
    content: userContent.trim(),
    sequence: userSequence,
    turnIndex,
    createdAt: now
  });

  const modelPayload = sanitizePayload({
    id: modelMsgRef.id,
    entryId,
    userId,
    role: 'model',
    content: modelContent.trim(),
    sequence: modelSequence,
    turnIndex,
    createdAt: now
  });

  const batch = writeBatch(db);
  batch.set(userMsgRef, userPayload);
  batch.set(modelMsgRef, modelPayload);
  batch.update(entryDocRef, {
    messageCount: increment(2),
    updatedAt: now
  });

  await batch.commit();

  return {
    userMessageId: userMsgRef.id,
    modelMessageId: modelMsgRef.id
  };
}

/**
 * Delete a single message from an entry's thread
 */
export async function deleteJournalMessage(
  userId: string,
  entryId: string,
  messageId: string
): Promise<void> {
  const msgDocRef = doc(db, 'users', userId, 'entries', entryId, 'messages', messageId);
  await deleteDoc(msgDocRef);

  // Re-sync message count on entry to prevent negative counts
  const messagesRef = collection(db, 'users', userId, 'entries', entryId, 'messages');
  const snap = await getDocs(messagesRef);
  const entryDocRef = doc(db, 'users', userId, 'entries', entryId);
  await updateDoc(entryDocRef, {
    messageCount: snap.size,
    updatedAt: serverTimestamp()
  }).catch((err) => {
    console.warn('Failed to update entry messageCount on message deletion:', err);
  });
}

/**
 * Clear all messages from an entry's thread and reset messageCount
 */
export async function clearJournalMessages(
  userId: string,
  entryId: string
): Promise<void> {
  const messagesRef = collection(db, 'users', userId, 'entries', entryId, 'messages');
  const snap = await getDocs(messagesRef);
  const entryDocRef = doc(db, 'users', userId, 'entries', entryId);

  // Delete message documents in chunks (respecting Firestore 500-write batch limits)
  const docs = snap.docs;
  const chunkSize = 400;

  if (docs.length > 0) {
    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach((docSnap) => batch.delete(docSnap.ref));
      // In the final batch, reset messageCount to 0
      if (i + chunkSize >= docs.length) {
        batch.update(entryDocRef, {
          messageCount: 0,
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
    }
  } else {
    // If no message documents exist, still ensure messageCount on the entry is set to 0
    await updateDoc(entryDocRef, {
      messageCount: 0,
      updatedAt: serverTimestamp()
    }).catch(() => {});
  }
}

/**
 * Real-time subscription to user's AI Mood & Progress Insights
 */
export function subscribeToInsights(
  userId: string,
  onUpdate: (insights: UserInsight[]) => void,
  onError?: (error: Error) => void
): () => void {
  const insightsRef = collection(db, 'users', userId, 'insights');
  const q = query(insightsRef, orderBy('generatedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const insights: UserInsight[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        const moodDist = (data.moodAnalysis?.moodDistribution || {}) as Record<string, any>;
        let moodDistSum = 0;
        for (const count of Object.values(moodDist)) {
          if (typeof count === 'number') moodDistSum += count;
        }
        const resolvedEntryCount = typeof data.entryCount === 'number' && data.entryCount > 0
          ? Number(data.entryCount)
          : (moodDistSum > 0 ? moodDistSum : 0);

        return {
          id: docSnap.id,
          userId: data.userId || userId,
          entryFingerprint: data.entryFingerprint || undefined,
          entryCount: resolvedEntryCount,
          dateRange: data.dateRange || { from: 'Recent', to: 'Today' },
          recurringThemes: data.recurringThemes || [],
          moodAnalysis: data.moodAnalysis || {
            predominantMood: 'Thoughtful',
            emotionalTrajectory: '',
            moodDistribution: {},
            languageObservations: []
          },
          accomplishments: data.accomplishments || [],
          challenges: data.challenges || [],
          growthAreas: data.growthAreas || [],
          reflectionPrompts: data.reflectionPrompts || [],
          disclaimer: data.disclaimer || 'These insights are reflective AI-generated observations based on your personal journal entries.',
          generatedAt: data.generatedAt?.toDate ? data.generatedAt.toDate() : new Date()
        };
      });

      // Deterministic sort with ID collision tie-breaker
      insights.sort((a, b) => {
        const timeA = a.generatedAt instanceof Date ? a.generatedAt.getTime() : 0;
        const timeB = b.generatedAt instanceof Date ? b.generatedAt.getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return b.id.localeCompare(a.id);
      });

      onUpdate(insights);
    },
    (err) => {
      console.error('Failed to subscribe to insights:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Persist newly generated AI insights for the authenticated user
 */
export async function saveUserInsight(
  userId: string,
  insightData: Omit<UserInsight, 'id' | 'userId' | 'generatedAt'>
): Promise<string> {
  const insightsCol = collection(db, 'users', userId, 'insights');
  const newDocRef = doc(insightsCol);

  const moodDist = (insightData.moodAnalysis?.moodDistribution || {}) as Record<string, any>;
  let moodDistSum = 0;
  for (const count of Object.values(moodDist)) {
    if (typeof count === 'number') moodDistSum += count;
  }
  const resolvedCount = typeof insightData.entryCount === 'number' && insightData.entryCount > 0
    ? Number(insightData.entryCount)
    : (moodDistSum > 0 ? moodDistSum : 0);

  const payload = sanitizePayload({
    userId,
    entryFingerprint: insightData.entryFingerprint || null,
    entryCount: resolvedCount,
    dateRange: insightData.dateRange,
    recurringThemes: insightData.recurringThemes,
    moodAnalysis: insightData.moodAnalysis,
    accomplishments: insightData.accomplishments,
    challenges: insightData.challenges,
    growthAreas: insightData.growthAreas,
    reflectionPrompts: insightData.reflectionPrompts,
    disclaimer: insightData.disclaimer,
    generatedAt: serverTimestamp()
  });

  await setDoc(newDocRef, payload);
  return newDocRef.id;
}

/**
 * Delete a specific insight record
 */
export async function deleteUserInsight(
  userId: string,
  insightId: string
): Promise<void> {
  const docRef = doc(db, 'users', userId, 'insights', insightId);
  await deleteDoc(docRef);
}

