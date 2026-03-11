import { Stronghold } from '@tauri-apps/plugin-stronghold';
import type { Store, Client } from '@tauri-apps/plugin-stronghold';
import { exists, readTextFile, writeTextFile, remove, BaseDirectory } from '@tauri-apps/plugin-fs';
import { storeProviderKey } from '$lib/services/ai/rustProxy';
import { showError } from '$lib/stores/errorStore.svelte';

/** Secure vault path (new per-install encrypted vault) */
const VAULT_PATH = 'keys.vault';
const STORE_NAME = 'api_keys';

/** Salt file used to derive a unique vault password per installation */
const SALT_FILE = 'vault.salt';

/** Legacy vault path and password — used only for one-time migration */
const LEGACY_VAULT_PATH = 'aioverlay_keys.vault';
const LEGACY_PASS = 'aioverlay-secure-local-key';

/** Provider IDs whose keys may exist in the legacy vault */
const KNOWN_PROVIDERS = ['openai', 'anthropic', 'gemini'] as const;

let strongholdInstance: Stronghold | null = null;
let storeInstance: Store | null = null;

// ---------------------------------------------------------------------------
// Per-install vault password derivation
// ---------------------------------------------------------------------------

/**
 * Generate or read a per-install random salt stored in AppData.
 * Each installation gets a unique 32-byte hex salt so the vault password
 * is never a hard-coded constant shared across installs.
 */
export async function getOrCreateSalt(): Promise<string> {
  try {
    const saltExists = await exists(SALT_FILE, { baseDir: BaseDirectory.AppData });
    if (saltExists) {
      const salt = await readTextFile(SALT_FILE, { baseDir: BaseDirectory.AppData });
      if (salt && salt.length === 64) return salt;
    }
  } catch {
    // Salt doesn't exist yet — will be created below
  }

  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const salt = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  await writeTextFile(SALT_FILE, salt, { baseDir: BaseDirectory.AppData });
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
    const legacySh = await Stronghold.load(LEGACY_VAULT_PATH, LEGACY_PASS);
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

async function initStorage(): Promise<Store> {
  if (storeInstance) return storeInstance;

  const salt = await getOrCreateSalt();
  const password = await deriveVaultPassword(salt);

  // Check if the secure vault already exists
  let secureVaultExists = false;
  try {
    secureVaultExists = await exists(VAULT_PATH, { baseDir: BaseDirectory.AppData });
  } catch {
    // Assume it doesn't exist
  }

  if (!secureVaultExists) {
    // Check for a legacy vault that needs migration
    let legacyExists = false;
    try {
      legacyExists = await exists(LEGACY_VAULT_PATH, { baseDir: BaseDirectory.AppData });
    } catch {
      // No legacy vault
    }

    if (legacyExists) {
      const migratedKeys = await readLegacyKeys();

      // Create new secure vault
      strongholdInstance = await Stronghold.load(VAULT_PATH, password);
      const client = await strongholdInstance.createClient(STORE_NAME);
      storeInstance = client.getStore();

      // Write migrated keys into the new vault
      for (const [key, value] of migratedKeys) {
        await storeInstance.insert(key, Array.from(new TextEncoder().encode(value)));
      }
      await strongholdInstance.save();

      // Remove legacy vault file
      try {
        await remove(LEGACY_VAULT_PATH, { baseDir: BaseDirectory.AppData });
      } catch {
        // Legacy vault removal is non-critical
      }

      return storeInstance;
    }
  }

  // Normal path: load or create the secure vault
  strongholdInstance = await Stronghold.load(VAULT_PATH, password);

  let client: Client;
  try {
    client = await strongholdInstance.loadClient(STORE_NAME);
  } catch {
    client = await strongholdInstance.createClient(STORE_NAME);
  }

  storeInstance = client.getStore();
  return storeInstance;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function saveApiKey(provider: string, key: string): Promise<void> {
  const store = await initStorage();
  const bytes = Array.from(new TextEncoder().encode(key));
  await store.insert(provider, bytes);
  await strongholdInstance?.save();
  // Sync to Rust's in-memory SecureKeyStore so HTTP proxy can use it
  await storeProviderKey(provider, key);
}

export async function getApiKey(provider: string): Promise<string | null> {
  const store = await initStorage();
  try {
    const data = await store.get(provider);
    if (!data) return null;
    return new TextDecoder().decode(data);
  } catch (e) {
    showError(e);
    return null;
  }
}

export async function removeApiKey(provider: string): Promise<void> {
  const store = await initStorage();
  await store.remove(provider);
  await strongholdInstance?.save();
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
