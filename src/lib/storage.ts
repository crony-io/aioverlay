import { Stronghold, Store, Client } from '@tauri-apps/plugin-stronghold';

const VAULT_PATH = 'aioverlay_keys.vault';
const STORE_NAME = 'api_keys';
const VAULT_PASS = 'aioverlay-secure-local-key';

let strongholdInstance: Stronghold | null = null;
let storeInstance: Store | null = null;

async function initStorage() {
  if (storeInstance) return storeInstance;
  
  try {
    strongholdInstance = await Stronghold.load(VAULT_PATH, VAULT_PASS);
    
    let client: Client;
    try {
      client = await strongholdInstance.loadClient(STORE_NAME);
    } catch {
      client = await strongholdInstance.createClient(STORE_NAME);
    }
    
    storeInstance = client.getStore();
    return storeInstance;
  } catch (error) {
    console.error('Failed to initialize Stronghold:', error);
    throw error;
  }
}

export async function saveApiKey(provider: string, key: string): Promise<void> {
  const store = await initStorage();
  const bytes = Array.from(new TextEncoder().encode(key));
  await store.insert(provider, bytes);
  await strongholdInstance?.save();
}

export async function getApiKey(provider: string): Promise<string | null> {
  const store = await initStorage();
  try {
    const data = await store.get(provider);
    if (!data) return null;
    return new TextDecoder().decode(data);
  } catch {
    return null;
  }
}

export async function removeApiKey(provider: string): Promise<void> {
  const store = await initStorage();
  await store.remove(provider);
  await strongholdInstance?.save();
}
