import {
  register,
  unregister,
  unregisterAll,
  type ShortcutEvent
} from '@tauri-apps/plugin-global-shortcut';
import { readText } from '@tauri-apps/plugin-clipboard-manager';
import { getCurrentWindow } from '@tauri-apps/api/window';

/** Shortcut action identifiers */
export type ShortcutAction = 'captureText' | 'captureScreen';

/** Callback when a shortcut action fires */
export type ShortcutActionHandler = (action: ShortcutAction, payload?: string) => void;

/** LocalStorage keys for shortcut bindings */
const STORAGE_KEYS = {
  COPY_KEY: 'copyKey',
  SCREENSHOT_KEY: 'screenshotKey'
} as const;

const DEFAULT_COPY_KEY = 'CommandOrControl+Shift+C';
const DEFAULT_SCREENSHOT_KEY = 'CommandOrControl+Shift+S';

let actionHandler: ShortcutActionHandler | null = null;
let registeredShortcuts: string[] = [];

/** Get the current shortcut bindings from localStorage */
function getBindings(): { copyKey: string; screenshotKey: string } {
  return {
    copyKey: localStorage.getItem(STORAGE_KEYS.COPY_KEY) || DEFAULT_COPY_KEY,
    screenshotKey: localStorage.getItem(STORAGE_KEYS.SCREENSHOT_KEY) || DEFAULT_SCREENSHOT_KEY
  };
}

/** Show and focus the overlay window */
async function showOverlay(): Promise<void> {
  const win = getCurrentWindow();
  await win.show();
  await win.setFocus();
}

/** Handle a global shortcut event */
async function handleShortcut(event: ShortcutEvent): Promise<void> {
  if (event.state !== 'Pressed') return;

  const { copyKey, screenshotKey } = getBindings();

  if (event.shortcut === copyKey) {
    await handleCaptureText();
  } else if (event.shortcut === screenshotKey) {
    await handleCaptureScreen();
  }
}

/** Text capture: read clipboard content and send to handler */
async function handleCaptureText(): Promise<void> {
  try {
    const text = await readText();
    await showOverlay();
    actionHandler?.('captureText', text || '');
  } catch (error) {
    console.error('Failed to capture text:', error);
    await showOverlay();
    actionHandler?.('captureText', '');
  }
}

/** Screen capture: trigger the screenshot flow */
async function handleCaptureScreen(): Promise<void> {
  await showOverlay();
  actionHandler?.('captureScreen');
}

/**
 * Register all global shortcuts.
 * Call this once on app startup and again whenever bindings change.
 */
export async function registerShortcuts(): Promise<void> {
  // Unregister any previously registered shortcuts
  await unregisterCurrentShortcuts();

  const { copyKey, screenshotKey } = getBindings();

  const shortcuts = [copyKey, screenshotKey].filter(Boolean);
  // Deduplicate in case both are somehow the same
  const unique = [...new Set(shortcuts)];

  try {
    if (unique.length > 0) {
      await register(unique, handleShortcut);
      registeredShortcuts = unique;
    }
  } catch (error) {
    console.error('Failed to register global shortcuts:', error);
  }
}

/** Unregister currently registered shortcuts */
async function unregisterCurrentShortcuts(): Promise<void> {
  if (registeredShortcuts.length === 0) return;

  try {
    await unregister(registeredShortcuts);
  } catch {
    // If individual unregister fails, try unregisterAll as fallback
    try {
      await unregisterAll();
    } catch (e) {
      console.error('Failed to unregister shortcuts:', e);
    }
  }

  registeredShortcuts = [];
}

/** Set the action handler that receives shortcut events */
export function onShortcutAction(handler: ShortcutActionHandler): void {
  actionHandler = handler;
}

/** Clean up all shortcuts (call on app teardown) */
export async function cleanupShortcuts(): Promise<void> {
  actionHandler = null;
  await unregisterCurrentShortcuts();
}
