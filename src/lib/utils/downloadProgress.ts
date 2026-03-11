/**
 * Shared download progress formatting utilities.
 * Used by both LocalModelSetup and ModelDownloader components.
 */

interface ProgressLike {
  bytesDownloaded: number;
  totalBytes: number;
  phase: string;
  error?: string | null;
  /** Only present on llama-server downloads */
  assetIndex?: number;
  totalAssets?: number;
}

/** Compute overall download percentage (0–100). */
export function computePercent(progress: ProgressLike | null): number {
  if (!progress || progress.totalBytes <= 0) return 0;
  return Math.round((progress.bytesDownloaded / progress.totalBytes) * 100);
}

/** Format progress into a human-readable status string. */
export function formatStatus(progress: ProgressLike | null): string {
  if (!progress) return '';

  if (progress.phase === 'downloading') {
    const mbDown = (progress.bytesDownloaded / 1024 / 1024).toFixed(1);
    const mbTotal = (progress.totalBytes / 1024 / 1024).toFixed(1);
    const assetLabel =
      progress.totalAssets && progress.totalAssets > 1
        ? ` (${(progress.assetIndex ?? 0) + 1}/${progress.totalAssets})`
        : '';
    return `Downloading${assetLabel}: ${mbDown} / ${mbTotal} MB`;
  }
  if (progress.phase === 'verifying') return 'Verifying integrity…';
  if (progress.phase === 'extracting') return 'Extracting files…';
  if (progress.phase === 'complete') return 'Download complete!';
  if (progress.phase === 'error') return progress.error ?? 'Download failed';
  return '';
}
