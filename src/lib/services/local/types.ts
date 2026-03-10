/** GPU information detected on the current system */
export interface GpuInfo {
  hasNvidia: boolean;
  nvidiaName: string | null;
  hasMetal: boolean;
  os: string;
  arch: string;
}

/** A downloadable llama.cpp variant for the current platform */
export interface LlamaVariant {
  id: string;
  label: string;
  gpuType: string;
  assetNames: string[];
  recommended: boolean;
  sizeMb: number;
}

/** Status of the current llama-server installation */
export interface InstallStatus {
  installed: boolean;
  variantId: string | null;
  version: string | null;
  binaryPath: string | null;
}

/** Download progress event payload emitted from the Rust backend */
export interface DownloadProgress {
  assetIndex: number;
  totalAssets: number;
  assetName: string;
  bytesDownloaded: number;
  totalBytes: number;
  /** One of: "downloading", "extracting", "complete", "error" */
  phase: 'downloading' | 'extracting' | 'complete' | 'error';
  error: string | null;
}
