import type { AIProviderID } from '$lib/services/ai/types';

/** Valid provider IDs for validation */
const VALID_PROVIDERS: AIProviderID[] = ['openai', 'anthropic', 'gemini', 'local'];

/** Possible states for the local llama-server lifecycle */
export type ServerStatus = 'idle' | 'starting' | 'ready' | 'error';

/** localStorage keys */
const KEYS = {
  PROVIDER: 'activeProvider',
  MODEL: 'activeModel',
  SYSTEM_PROMPT: 'systemPrompt',
  WEB_SEARCH: 'webSearchEnabled'
} as const;

function loadProvider(): AIProviderID {
  const stored = localStorage.getItem(KEYS.PROVIDER);
  if (stored && VALID_PROVIDERS.includes(stored as AIProviderID)) {
    return stored as AIProviderID;
  }
  return 'openai';
}

/**
 * Reactive settings store — shared across all components.
 * Reads initial values from localStorage, and persists on every write.
 */
let _activeProvider = $state<AIProviderID>(loadProvider());
let _activeModel = $state(localStorage.getItem(KEYS.MODEL) || '');
let _systemPrompt = $state(localStorage.getItem(KEYS.SYSTEM_PROMPT) || '');
let _webSearchEnabled = $state(localStorage.getItem(KEYS.WEB_SEARCH) === 'true');
let _activeModelSupportsVision = $state(false);
let _serverStatus = $state<ServerStatus>('idle');
let _serverStatusMessage = $state('');

/** Monotonically increasing revision counter — bumped on every write so
 *  non-rune consumers (like chatStore.ts) can snapshot the latest values. */
let _revision = $state(0);

export const settingsStore = {
  get activeProvider() {
    return _activeProvider;
  },
  set activeProvider(v: AIProviderID) {
    _activeProvider = v;
    localStorage.setItem(KEYS.PROVIDER, v);
    _revision++;
  },

  get activeModel() {
    return _activeModel;
  },
  set activeModel(v: string) {
    _activeModel = v;
    localStorage.setItem(KEYS.MODEL, v);
    _revision++;
  },

  get systemPrompt() {
    return _systemPrompt;
  },
  set systemPrompt(v: string) {
    _systemPrompt = v;
    localStorage.setItem(KEYS.SYSTEM_PROMPT, v);
    _revision++;
  },

  get webSearchEnabled() {
    return _webSearchEnabled;
  },
  set webSearchEnabled(v: boolean) {
    _webSearchEnabled = v;
    localStorage.setItem(KEYS.WEB_SEARCH, String(v));
    _revision++;
  },

  get revision() {
    return _revision;
  },

  /** Whether the currently active model supports vision (image input) */
  get activeModelSupportsVision() {
    return _activeModelSupportsVision;
  },
  set activeModelSupportsVision(v: boolean) {
    _activeModelSupportsVision = v;
  },

  /** Current local server lifecycle status */
  get serverStatus(): ServerStatus {
    return _serverStatus;
  },
  set serverStatus(v: ServerStatus) {
    _serverStatus = v;
  },

  /** Human-readable server status message shown in the UI */
  get serverStatusMessage() {
    return _serverStatusMessage;
  },
  set serverStatusMessage(v: string) {
    _serverStatusMessage = v;
  },

  /**
   * Whether the app is ready to accept and send messages.
   * Cloud providers are always ready; local provider requires the server to be running.
   */
  get isReadyToSend(): boolean {
    if (_activeProvider !== 'local') return true;
    return _serverStatus === 'ready';
  }
};
