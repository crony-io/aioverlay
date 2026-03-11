import {
  mkdir,
  readTextFile,
  readFile,
  writeFile,
  remove,
  exists,
  BaseDirectory
} from '@tauri-apps/plugin-fs';
import type { Conversation, ConversationMeta, ChatMessage } from '$lib/types';
import { encryptString, tryDecrypt } from '$lib/services/crypto/chatEncryption';
import { showError } from '$lib/stores/errorStore.svelte';

const CONVERSATIONS_DIR = 'conversations';
const INDEX_FILE = `${CONVERSATIONS_DIR}/index.json`;

/** Ensure the conversations directory exists */
async function ensureDir(): Promise<void> {
  const dirExists = await exists(CONVERSATIONS_DIR, { baseDir: BaseDirectory.AppData });
  if (!dirExists) {
    await mkdir(CONVERSATIONS_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Encrypted read / write helpers with automatic plaintext migration
// ---------------------------------------------------------------------------

/**
 * Write an encrypted file. The data is AES-256-GCM encrypted before
 * being written as binary.
 */
async function writeEncrypted(path: string, json: string): Promise<void> {
  const encrypted = await encryptString(json);
  await writeFile(path, encrypted, { baseDir: BaseDirectory.AppData });
}

/**
 * Read a file that may be encrypted or plaintext JSON.
 * - First tries binary read + AES-GCM decrypt.
 * - Falls back to plaintext read (pre-encryption migration).
 * - If plaintext succeeds, re-saves as encrypted (auto-migrate).
 */
async function readEncrypted(path: string): Promise<string | null> {
  try {
    const binary = await readFile(path, { baseDir: BaseDirectory.AppData });
    const decrypted = await tryDecrypt(binary);
    if (decrypted !== null) return decrypted;
  } catch {
    // Binary read failed — try text
  }

  // Fallback: plaintext JSON (legacy / pre-encryption)
  try {
    const text = await readTextFile(path, { baseDir: BaseDirectory.AppData });
    // Validate it's actually JSON before returning
    JSON.parse(text);
    // Auto-migrate: re-write as encrypted
    try {
      await writeEncrypted(path, text);
    } catch {
      // Migration write failed — non-critical, will try again next save
    }
    return text;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Load the conversation index (list of metadata) */
export async function loadConversationList(): Promise<ConversationMeta[]> {
  await ensureDir();

  const indexExists = await exists(INDEX_FILE, { baseDir: BaseDirectory.AppData });
  if (!indexExists) return [];

  try {
    const raw = await readEncrypted(INDEX_FILE);
    if (!raw) return [];
    return JSON.parse(raw) as ConversationMeta[];
  } catch (e) {
    showError(e);
    return [];
  }
}

/** Save the conversation index */
async function saveIndex(index: ConversationMeta[]): Promise<void> {
  await ensureDir();
  await writeEncrypted(INDEX_FILE, JSON.stringify(index));
}

/** Load a full conversation by ID */
export async function loadConversation(id: string): Promise<Conversation | null> {
  const filePath = `${CONVERSATIONS_DIR}/${id}.json`;

  try {
    const fileExists = await exists(filePath, { baseDir: BaseDirectory.AppData });
    if (!fileExists) return null;

    const raw = await readEncrypted(filePath);
    if (!raw) return null;
    return JSON.parse(raw) as Conversation;
  } catch (e) {
    showError(e);
    return null;
  }
}

/** Save a conversation (updates both the file and the index) */
export async function saveConversation(conversation: Conversation): Promise<void> {
  await ensureDir();

  const filePath = `${CONVERSATIONS_DIR}/${conversation.id}.json`;
  conversation.updatedAt = Date.now();

  await writeEncrypted(filePath, JSON.stringify(conversation));

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
  } catch (e) {
    showError(e);
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

/** Create a new ephemeral conversation (not persisted to disk) */
export function createEphemeralConversation(): Conversation {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title: 'Ephemeral Chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
    ephemeral: true
  };
}

/** Generate a title from the first user message, stripping markdown images */
export function generateTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === 'user');
  if (!firstUserMsg) return 'New Conversation';

  // Strip markdown images ![alt](data:...) before generating title
  const text = firstUserMsg.content.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim();

  if (!text) return 'Screenshot Analysis';
  if (text.length <= 40) return text;
  return text.substring(0, 40) + '…';
}
