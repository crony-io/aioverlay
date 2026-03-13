import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { showError } from '$lib/stores/errorStore.svelte';

/** All configurable shortcut action identifiers */
export type ShortcutAction =
  | 'captureText'
  | 'captureScreen'
  | 'showWindow'
  | 'newChat'
  | 'toggleHistory'
  | 'toggleSettings';

/** Callback when a shortcut action fires */
export type ShortcutActionHandler = (action: ShortcutAction, payload?: unknown) => void;

/** Listener for registration status changes */
export type StatusChangeListener = (status: ShortcutRegistrationStatus) => void;

/** Per-shortcut configuration */
export interface ShortcutBinding {
  action: ShortcutAction;
  label: string;
  /** Whether this is a Tauri global shortcut (vs app-level keyboard handler) */
  global: boolean;
  storageKey: string;
  defaultKey: string;
}

/** All shortcut definitions */
export const SHORTCUT_DEFINITIONS: ShortcutBinding[] = [
  {
    action: 'captureText',
    label: 'Copy Text',
    global: true,
    storageKey: 'shortcut_captureText',
    defaultKey: 'Alt+C'
  },
  {
    action: 'captureScreen',
    label: 'Screenshot',
    global: true,
    storageKey: 'shortcut_captureScreen',
    defaultKey: 'Alt+S'
  },
  {
    action: 'showWindow',
    label: 'Show Window',
    global: true,
    storageKey: 'shortcut_showWindow',
    defaultKey: 'Alt+A'
  },
  {
    action: 'newChat',
    label: 'New Chat',
    global: false,
    storageKey: 'shortcut_newChat',
    defaultKey: 'CommandOrControl+N'
  },
  {
    action: 'toggleHistory',
    label: 'Toggle History',
    global: false,
    storageKey: 'shortcut_toggleHistory',
    defaultKey: 'CommandOrControl+H'
  },
  {
    action: 'toggleSettings',
    label: 'Toggle Settings',
    global: false,
    storageKey: 'shortcut_toggleSettings',
    defaultKey: 'CommandOrControl+,'
  }
];

/** Registration status */
export interface ShortcutRegistrationStatus {
  registered: boolean;
  shortcuts: string[];
  error: string | null;
}

let actionHandler: ShortcutActionHandler | null = null;
let registeredShortcuts: string[] = [];
let lastRegistrationError: string | null = null;
let statusListeners: StatusChangeListener[] = [];
let unlistenShortcut: UnlistenFn | null = null;
let unlistenError: UnlistenFn | null = null;
let unlistenScreenshot: UnlistenFn | null = null;
let unlistenScreenshotCancel: UnlistenFn | null = null;

/** Migrate old localStorage keys to new format (one-time) */
function migrateOldBindings(): void {
  const OLD_KEY_MAP: Record<string, string> = {
    copyKey: 'shortcut_captureText',
    screenshotKey: 'shortcut_captureScreen'
  };
  for (const [oldKey, newKey] of Object.entries(OLD_KEY_MAP)) {
    const oldVal = localStorage.getItem(oldKey);
    if (oldVal && !localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, oldVal);
      localStorage.removeItem(oldKey);
    }
  }
}

// Run migration on module load
if (typeof localStorage !== 'undefined') {
  migrateOldBindings();
}

/** Notify all status listeners */
function notifyStatusChange(): void {
  const status = getRegistrationStatus();
  for (const listener of statusListeners) {
    listener(status);
  }
}

/** Subscribe to registration status changes. Returns an unsubscribe function. */
export function onStatusChange(listener: StatusChangeListener): () => void {
  statusListeners.push(listener);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

/** Get the stored binding for a specific action */
export function getBinding(action: ShortcutAction): string {
  const def = SHORTCUT_DEFINITIONS.find((d) => d.action === action);
  if (!def) return '';
  return localStorage.getItem(def.storageKey) || def.defaultKey;
}

/** Get all current bindings as a map */
export function getAllBindings(): Record<ShortcutAction, string> {
  const result = {} as Record<ShortcutAction, string>;
  for (const def of SHORTCUT_DEFINITIONS) {
    result[def.action] = localStorage.getItem(def.storageKey) || def.defaultKey;
  }
  return result;
}

/** Save a binding for a specific action */
export function saveBinding(action: ShortcutAction, accelerator: string): void {
  const def = SHORTCUT_DEFINITIONS.find((d) => d.action === action);
  if (def) {
    localStorage.setItem(def.storageKey, accelerator);
  }
}

/** Show and focus the overlay window */
async function showOverlay(): Promise<void> {
  const win = getCurrentWindow();
  await win.show();
  await win.setFocus();
}

/** Build a map from lowercase accelerator string → action for fast lookup */
function buildShortcutMap(): Map<string, ShortcutAction> {
  const map = new Map<string, ShortcutAction>();
  for (const def of SHORTCUT_DEFINITIONS) {
    if (!def.global) continue;
    const key = localStorage.getItem(def.storageKey) || def.defaultKey;
    if (key) map.set(key.toLowerCase(), def.action);
  }
  return map;
}

/** Handle a global shortcut event emitted from Rust */
async function handleShortcutFromRust(accelerator: string): Promise<void> {
  const map = buildShortcutMap();
  const action = map.get(accelerator.toLowerCase());

  if (action === 'captureText') {
    await handleCaptureText();
  } else if (action === 'captureScreen') {
    await handleCaptureScreen();
  } else if (action === 'showWindow') {
    await showOverlay();
    actionHandler?.('showWindow');
  }
}

/**
 * Text capture: hide overlay, wait for OS to restore focus to previous window,
 * simulate Ctrl+C via enigo, read clipboard, then show overlay with captured text.
 */
async function handleCaptureText(): Promise<void> {
  try {
    const win = getCurrentWindow();
    await win.hide();

    // Wait for OS to move focus back to the window where text was selected
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Simulate Ctrl+C via Rust enigo command
    await invoke('simulate_copy');

    // Wait for clipboard to be populated by the OS
    await new Promise((resolve) => setTimeout(resolve, 200));

    const text = await readText();
    await showOverlay();

    if (!text || text.trim().length === 0) {
      showError('No text was captured. Make sure text is selected before pressing the shortcut.');
      actionHandler?.('captureText', '');
      return;
    }

    actionHandler?.('captureText', text);
  } catch (e) {
    showError(e);
    await showOverlay();
    actionHandler?.('captureText', '');
  }
}

/** Screen capture: hide overlay, trigger the live multi-monitor overlay */
async function handleCaptureScreen(): Promise<void> {
  try {
    const win = getCurrentWindow();
    await win.hide();

    await invoke('start_screenshot_mode');
    // Result handling is offloaded to 'screenshot-captured' listener
  } catch (e) {
    showError(e);
    await showOverlay();
    actionHandler?.('captureScreen');
  }
}

/**
 * Register all global shortcuts via the Rust backend.
 * Defaults are registered by Rust on app startup.
 * Call this again whenever bindings change to re-register.
 */
export async function registerShortcuts(): Promise<void> {
  // Listen for Rust-emitted shortcut events (only once)
  if (!unlistenShortcut) {
    unlistenShortcut = await listen<string>('global-shortcut-event', (event) => {
      handleShortcutFromRust(event.payload).catch((e) => showError(e));
    });
  }

  // Listen for Rust-emitted shortcut errors (only once)
  if (!unlistenError) {
    unlistenError = await listen<string>('shortcut-error', (event) => {
      showError(event.payload);
    });
  }

  // Listen for screenshot completions from the live overlay
  if (!unlistenScreenshot) {
    unlistenScreenshot = await listen<string>('screenshot-captured', async (event) => {
      await showOverlay();
      actionHandler?.('captureScreen', event.payload);
    });
  }

  // Listen for screenshot cancellations
  if (!unlistenScreenshotCancel) {
    unlistenScreenshotCancel = await listen<void>('screenshot-canceled', async () => {
      await showOverlay();
    });
  }

  // Collect the current global shortcut bindings
  const globalDefs = SHORTCUT_DEFINITIONS.filter((d) => d.global);
  const shortcuts: string[] = [];
  for (const def of globalDefs) {
    const key = localStorage.getItem(def.storageKey) || def.defaultKey;
    if (key && !shortcuts.some((s) => s.toLowerCase() === key.toLowerCase())) {
      shortcuts.push(key);
    }
  }

  if (shortcuts.length === 0) {
    lastRegistrationError = null;
    registeredShortcuts = [];
    notifyStatusChange();
    return;
  }

  // Ask Rust to re-register at the OS level
  try {
    const result = await invoke<string[]>('update_global_shortcuts', { shortcuts });
    registeredShortcuts = result;
    lastRegistrationError = null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    lastRegistrationError = msg;
    registeredShortcuts = [];
    showError(`Shortcut registration failed: ${msg}`);
  }
  notifyStatusChange();
}

/** Set the action handler that receives shortcut events */
export function onShortcutAction(handler: ShortcutActionHandler): void {
  actionHandler = handler;
}

/** Get the current shortcut registration status */
export function getRegistrationStatus(): ShortcutRegistrationStatus {
  return {
    registered: registeredShortcuts.length > 0,
    shortcuts: [...registeredShortcuts],
    error: lastRegistrationError
  };
}

/** Format an accelerator string for display (e.g. "CommandOrControl+N" → "Ctrl + N") */
export function formatAccelerator(accelerator: string): string {
  if (!accelerator) return 'Not set';
  return accelerator
    .split('+')
    .map((k) => {
      if (k.toLowerCase() === 'commandorcontrol') return 'Ctrl';
      return k;
    })
    .join(' + ');
}

/** Clean up all shortcuts (call on app teardown) */
export async function cleanupShortcuts(): Promise<void> {
  actionHandler = null;
  statusListeners = [];
  unlistenShortcut?.();
  unlistenShortcut = null;
  unlistenError?.();
  unlistenError = null;
  unlistenScreenshot?.();
  unlistenScreenshot = null;
  unlistenScreenshotCancel?.();
  unlistenScreenshotCancel = null;
  registeredShortcuts = [];
}
