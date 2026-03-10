import { mkdir, readTextFile, writeTextFile, remove, exists, BaseDirectory } from '@tauri-apps/plugin-fs';
import type { Conversation, ConversationMeta, ChatMessage } from '$lib/types';

const CONVERSATIONS_DIR = 'conversations';
const INDEX_FILE = `${CONVERSATIONS_DIR}/index.json`;

/** Ensure the conversations directory exists */
async function ensureDir(): Promise<void> {
  const dirExists = await exists(CONVERSATIONS_DIR, { baseDir: BaseDirectory.AppData });
  if (!dirExists) {
    await mkdir(CONVERSATIONS_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  }
}

/** Load the conversation index (list of metadata) */
export async function loadConversationList(): Promise<ConversationMeta[]> {
  await ensureDir();

  const indexExists = await exists(INDEX_FILE, { baseDir: BaseDirectory.AppData });
  if (!indexExists) return [];

  try {
    const raw = await readTextFile(INDEX_FILE, { baseDir: BaseDirectory.AppData });
    return JSON.parse(raw) as ConversationMeta[];
  } catch {
    return [];
  }
}

/** Save the conversation index */
async function saveIndex(index: ConversationMeta[]): Promise<void> {
  await ensureDir();
  await writeTextFile(INDEX_FILE, JSON.stringify(index, null, 2), { baseDir: BaseDirectory.AppData });
}

/** Load a full conversation by ID */
export async function loadConversation(id: string): Promise<Conversation | null> {
  const filePath = `${CONVERSATIONS_DIR}/${id}.json`;

  try {
    const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });
    if (!fileExists) return null;

    const raw = await readTextFile(filePath, { baseDir: BaseDirectory.AppData });
    return JSON.parse(raw) as Conversation;
  } catch {
    return null;
  }
}

/** Save a conversation (updates both the file and the index) */
export async function saveConversation(conversation: Conversation): Promise<void> {
  await ensureDir();

  const filePath = `${CONVERSATIONS_DIR}/${conversation.id}.json`;
  conversation.updatedAt = Date.now();

  await writeTextFile(filePath, JSON.stringify(conversation, null, 2), { baseDir: BaseDirectory.AppData });

  // Update the index
  const index = await loadConversationList();
  const meta: ConversationMeta = {
    id: conversation.id,
    title: conversation.title,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: conversation.messages.length
  };

  const existingIndex = index.findIndex((item) => item.id === conversation.id);
  if (existingIndex >= 0) {
    index[existingIndex] = meta;
  } else {
    index.unshift(meta);
  }

  await saveIndex(index);
}

/** Delete a conversation */
export async function deleteConversation(id: string): Promise<void> {
  const filePath = `${CONVERSATIONS_DIR}/${id}.json`;

  try {
    const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });
    if (fileExists) {
      await remove(filePath, { baseDir: BaseDirectory.AppData });
    }
  } catch {
    // File may not exist — safe to continue
  }

  const index = await loadConversationList();
  const filtered = index.filter((item) => item.id !== id);
  await saveIndex(filtered);
}

/** Create a new empty conversation */
export function createConversation(): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: 'New Conversation',
    createdAt: now,
    updatedAt: now,
    messages: []
  };
}

/** Generate a title from the first user message */
export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === 'user');
  if (!firstUserMsg) return 'New Conversation';

  const text = firstUserMsg.content.trim();
  if (text.length <= 40) return text;
  return text.substring(0, 40) + '…';
}
