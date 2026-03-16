import { Stronghold } from '@tauri-apps/plugin-stronghold';
import type { Store, Client } from '@tauri-apps/plugin-stronghold';
import { exists, readTextFile, writeTextFile, remove } from '@tauri-apps/plugin-fs';
import { appDataDir } from '@tauri-apps/api/path';
import { storeProviderKey } from '$lib/services/ai/rustProxy';
import { showError } from '$lib/stores/errorStore.svelte';

/** File names stored inside the AppData directory */
const VAULT_FILENAME = 'keys.vault';
const SALT_FILENAME = 'vault.salt';
const STORE_NAME = 'api_keys';

/** Legacy vault filename and password — used only for one-time migration */
const LEGACY_VAULT_FILENAME = 'aioverlay_keys.vault';
const LEGACY_PASS = 'aioverlay-secure-local-key';

/** Cached absolute base directory resolved once at runtime */
let resolvedAppDataDir: string | null = null;

/** Resolves and caches the absolute AppData directory path */
async function getAppDataPath(): Promise<string> {
  if (!resolvedAppDataDir) {
    resolvedAppDataDir = await appDataDir();
  }
  return resolvedAppDataDir;
}

/** Builds an absolute path inside the AppData directory */
async function appDataFile(filename: string): Promise<string> {
  const dir = await getAppDataPath();
  // Normalise separator for Windows
  const sep = dir.endsWith('\\') || dir.endsWith('/') ? '' : '/';
  return `${dir}${sep}${filename}`;
}

/** Provider IDs whose keys may exist in the legacy vault */
const KNOWN_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;

/** In-memory cache so keys survive Stronghold read failures within a session */
const keyCache = new Map<string, string>();

let strongholdInstance: Stronghold | null = null;
let storeInstance: Store | null = null;

/** Promise-based lock to prevent concurrent `initStorage()` calls */
let initPromise: Promise<Store> | null = null;

// ---------------------------------------------------------------------------
// Per-install vault password derivation
// ---------------------------------------------------------------------------

/**
 * Generate or read a per-install random salt stored in AppData.
 * Each installation gets a unique 32-byte hex salt so the vault password
 * is never a hard-coded constant shared across installs.
 */
export async function getOrCreateSalt(): Promise<string> {
  const saltPath = await appDataFile(SALT_FILENAME);
  try {
    const saltExists = await exists(saltPath);
    if (saltExists) {
      const raw = await readTextFile(saltPath);
      // Trim to handle Windows BOM/CRLF/whitespace that readTextFile may include
      const salt = raw?.trim().replace(/^\uFEFF/, '');
      if (salt && salt.length === 64 && /^[0-9a-f]{64}$/.test(salt)) return salt;
    }
  } catch {
    // Salt doesn't exist yet — will be created below
  }

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const salt = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await writeTextFile(saltPath, salt);
  return salt;
}

/**
 * Derive a unique vault password from the per-install salt using SHA-256.
 * The Stronghold plugin in lib.rs applies a second round of SHA-256 with
 * its own salt, so the final key material is double-hashed.
 */
async function deriveVaultPassword(salt: string): Promise<string> {
  const material = `aioverlay:${salt}:vault-key-v1`;
  const encoded = new TextEncoder().encode(material);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ---------------------------------------------------------------------------
// Legacy vault migration
// ---------------------------------------------------------------------------

/**
 * Read API keys from the legacy vault (hard-coded password).
 * Returns a map of provider → key, empty map on failure.
 */
async function readLegacyKeys(): Promise<Map<string, string>> {
  const keys = new Map<string, string>();
  try {
    const legacyPath = await appDataFile(LEGACY_VAULT_FILENAME);
    const legacySh = await Stronghold.load(legacyPath, LEGACY_PASS);
    let client: Client;
    try {
      client = await legacySh.loadClient(STORE_NAME);
    } catch {
      return keys;
    }

    const store = client.getStore();
    for (const provider of KNOWN_PROVIDERS) {
      try {
        const data = await store.get(provider);
        if (data) {
          keys.set(provider, new TextDecoder().decode(data));
        }
      } catch {
        // Key doesn't exist for this provider
      }
    }
  } catch {
    // Legacy vault can't be opened — nothing to migrate
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Delete vault and salt files so both are recreated from scratch.
 * Also resets module-level state so the next initStorage() call
 * performs a full re-initialisation.
 */
async function purgeVault(): Promise<void> {
  strongholdInstance = null;
  storeInstance = null;
  initPromise = null;

  for (const filename of [VAULT_FILENAME, SALT_FILENAME]) {
    try {
      const absPath = await appDataFile(filename);
      const fileExists = await exists(absPath);
      if (fileExists) {
        await remove(absPath);
      }
    } catch (e) {
      showError(`purgeVault: could not delete ${filename}: ${e}`);
    }
  }
}

/**
 * Core initialisation logic (called only once via the lock below).
 * Creates or recovers the Stronghold vault, migrating legacy keys if needed.
 */
async function doInitStorage(): Promise<Store> {
  const salt = await getOrCreateSalt();
  const password = await deriveVaultPassword(salt);
  const vaultPath = await appDataFile(VAULT_FILENAME);

  // Check if the secure vault already exists
  let secureVaultExists = false;
  try {
    secureVaultExists = await exists(vaultPath);
  } catch {
    // Assume it doesn't exist
  }

  if (!secureVaultExists) {
    // Check for a legacy vault that needs migration
    let legacyExists = false;
    try {
      const legacyPath = await appDataFile(LEGACY_VAULT_FILENAME);
      legacyExists = await exists(legacyPath);
    } catch {
      // No legacy vault
    }

    if (legacyExists) {
      const migratedKeys = await readLegacyKeys();

      // Create new secure vault using absolute path
      strongholdInstance = await Stronghold.load(vaultPath, password);
      const client = await strongholdInstance.createClient(STORE_NAME);
      storeInstance = client.getStore();

      // Write migrated keys into the new vault
      for (const [key, value] of migratedKeys) {
        await storeInstance.insert(key, Array.from(new TextEncoder().encode(value)));
      }
      await strongholdInstance.save();

      // Remove legacy vault file
      try {
        const legacyPath = await appDataFile(LEGACY_VAULT_FILENAME);
        await remove(legacyPath);
      } catch {
        // Legacy vault removal is non-critical
      }

      return storeInstance;
    }
  }

  // Normal path: load or create the secure vault.
  // If the vault exists but can't be decrypted (BadFileKey / corrupt), purge
  // both vault + salt and re-derive everything from scratch.
  try {
    strongholdInstance = await Stronghold.load(vaultPath, password);
  } catch (loadErr) {
    // Purge vault AND salt so both are regenerated
    await purgeVault();

    // Verify vault file is actually gone (Windows file-lock edge case)
    const stillExists = await exists(vaultPath).catch(() => false);
    if (stillExists) {
      throw new Error(
        `Cannot recover vault (file locked). Delete "${VAULT_FILENAME}" from AppData and restart.`,
        { cause: loadErr }
      );
    }

    // Re-derive password with the fresh salt that purgeVault created space for
    const freshSalt = await getOrCreateSalt();
    const freshPassword = await deriveVaultPassword(freshSalt);
    const freshVaultPath = await appDataFile(VAULT_FILENAME);
    strongholdInstance = await Stronghold.load(freshVaultPath, freshPassword);
  }

  let client: Client;
  try {
    client = await strongholdInstance.loadClient(STORE_NAME);
  } catch {
    client = await strongholdInstance.createClient(STORE_NAME);
  }

  storeInstance = client.getStore();
  return storeInstance;
}

/**
 * Public entry-point with a promise-based lock so only a single init
 * attempt runs at a time. Concurrent callers await the same promise.
 */
async function initStorage(): Promise<Store> {
  if (storeInstance) return storeInstance;
  if (initPromise) return initPromise;

  initPromise = doInitStorage().catch((err) => {
    // Reset so a future call can retry
    initPromise = null;
    throw err;
  });
  return initPromise;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function saveApiKey(provider: string, key: string): Promise<void> {
  const store = await initStorage();
  const bytes = Array.from(new TextEncoder().encode(key));
  await store.insert(provider, bytes);
  await strongholdInstance?.save();

  // Update in-memory cache
  keyCache.set(provider, key);

  // Sync to Rust's in-memory SecureKeyStore so HTTP proxy can use it
  await storeProviderKey(provider, key);
}

export async function getApiKey(provider: string): Promise<string | null> {
  try {
    const store = await initStorage();
    const data = await store.get(provider);
    if (!data || data.length === 0) {
      // Fall back to in-memory cache if Stronghold returned nothing
      return keyCache.get(provider) ?? null;
    }
    // Ensure we have a proper Uint8Array for TextDecoder
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const decoded = new TextDecoder().decode(bytes);
    if (decoded) keyCache.set(provider, decoded);
    return decoded;
  } catch (e) {
    showError(`Failed to read API key for ${provider}: ${e}`);
    // Fall back to in-memory cache
    return keyCache.get(provider) ?? null;
  }
}

export async function removeApiKey(provider: string): Promise<void> {
  const store = await initStorage();
  await store.remove(provider);
  await strongholdInstance?.save();

  // Clear from in-memory cache
  keyCache.delete(provider);

  // Remove from Rust's in-memory SecureKeyStore
  await storeProviderKey(provider, '');
}

/**
 * Load all stored API keys from Stronghold and push them into
 * Rust's in-memory SecureKeyStore. Must be called once on app startup
 * so the Rust HTTP proxy can authenticate requests.
 */
export async function initSecureStore(): Promise<void> {
  const providers = ['openai', 'anthropic', 'gemini'] as const;
  for (const provider of providers) {
    const key = await getApiKey(provider);
    if (key) {
      await storeProviderKey(provider, key);
    }
  }
}
