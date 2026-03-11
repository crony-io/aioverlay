/**
 * Global error store — any part of the app can call `showError()`
 * to display an error dialog to the user via ConfirmDialog.
 */

let _error = $state<string | null>(null);

export const errorStore = {
  get error() {
    return _error;
  },

  /** Show an error message in the global dialog */
  show(message: string) {
    _error = message;
  },

  /** Dismiss the current error dialog */
  dismiss() {
    _error = null;
  }
};

/**
 * Convenience function — importable from any .ts or .svelte file.
 * Usage: `showError('Something went wrong')` or `showError(err)`
 */
export function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  errorStore.show(message);
}
