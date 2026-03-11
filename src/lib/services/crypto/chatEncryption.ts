import { getOrCreateSalt } from '$lib/storage';

/**
 * AES-256-GCM encryption for chat history files.
 *
 * Uses the per-install salt (from vault.salt) with PBKDF2 to derive
 * a unique encryption key. Each encrypted file has a random 12-byte IV
 * prepended to the ciphertext.
 *
 * Domain separation: the derivation purpose string differs from the
 * vault password derivation, so the two keys are independent.
 */

const PBKDF2_ITERATIONS = 100_000;
const IV_LENGTH = 12;
const DERIVATION_PURPOSE = 'aioverlay-chat-encryption-v1';

let cachedKey: CryptoKey | null = null;
let cachedSaltHex: string | null = null;

/** Derive an AES-256-GCM key from the per-install salt via PBKDF2. */
async function getEncryptionKey(): Promise<CryptoKey> {
  const saltHex = await getOrCreateSalt();

  // Re-derive only if salt changed (should never happen, but defensive)
  if (cachedKey && cachedSaltHex === saltHex) return cachedKey;

  const salt = new TextEncoder().encode(saltHex);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(DERIVATION_PURPOSE),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  cachedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  cachedSaltHex = saltHex;
  return cachedKey;
}

/**
 * Encrypt a plaintext string into a binary blob.
 * Layout: [12-byte IV] [AES-GCM ciphertext + auth tag]
 */
export async function encryptString(plaintext: string): Promise<Uint8Array> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  const result = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  result.set(iv);
  result.set(new Uint8Array(ciphertext), IV_LENGTH);
  return result;
}

/**
 * Decrypt a binary blob back to a plaintext string.
 * Expects the same layout produced by `encryptString`.
 */
export async function decryptString(data: Uint8Array): Promise<string> {
  const key = await getEncryptionKey();
  const iv = data.slice(0, IV_LENGTH);
  const ciphertext = data.slice(IV_LENGTH);

  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);

  return new TextDecoder().decode(plaintext);
}

/**
 * Try to decrypt binary data. If it fails (e.g. plaintext file from
 * before encryption was enabled), return null so the caller can
 * fall back to reading as plaintext JSON.
 */
export async function tryDecrypt(data: Uint8Array): Promise<string | null> {
  try {
    return await decryptString(data);
  } catch {
    return null;
  }
}
