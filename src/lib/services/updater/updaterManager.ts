import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export interface UpdateInfo {
  version: string;
  body: string;
  date: string;
}

export interface UpdateProgress {
  contentLength: number;
  downloaded: number;
}

/**
 * Check for available updates via the configured endpoints.
 * Returns update info if available, or null if already up to date.
 */
export async function checkForUpdate(): Promise<{ info: UpdateInfo; update: Update } | null> {
  try {
    const update = await check();

    if (!update) return null;

    return {
      info: {
        version: update.version,
        body: update.body ?? '',
        date: update.date ?? ''
      },
      update
    };
  } catch {
    // Silently ignore update check failures (no network, no release published, etc.)
    return null;
  }
}

/**
 * Download and install the given update, reporting progress via callback.
 * On Windows the app exits automatically after install.
 * On other platforms we call relaunch().
 */
export async function downloadAndInstallUpdate(
  update: Update,
  onProgress?: (progress: UpdateProgress) => void
): Promise<void> {
  let downloaded = 0;
  let contentLength = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        contentLength = event.data.contentLength ?? 0;
        downloaded = 0;
        onProgress?.({ contentLength, downloaded });
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        onProgress?.({ contentLength, downloaded });
        break;
      case 'Finished':
        onProgress?.({ contentLength, downloaded: contentLength });
        break;
    }
  });

  await relaunch();
}
