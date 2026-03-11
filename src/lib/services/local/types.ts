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
  /** One of: "downloading", "verifying", "extracting", "complete", "error" */
  phase: 'downloading' | 'verifying' | 'extracting' | 'complete' | 'error';
  error: string | null;
}

// ---------------------------------------------------------------------------
// Model Downloader types
// ---------------------------------------------------------------------------

/** HuggingFace model search result */
export interface HfModelResult {
  id: string;
  author: string | null;
  downloads: number;
  likes: number;
  /** HuggingFace pipeline tag (e.g. "text-generation", "image-text-to-text") */
  pipeline_tag: string | null;
  /** HuggingFace tags (e.g. ["gguf", "vision", "text-generation"]) */
  tags: string[];
}

/** Info about a GGUF file in a HuggingFace repo */
export interface GgufFileInfo {
  filename: string;
  size: number;
}

/** Metadata for a locally downloaded GGUF model */
export interface DownloadedModel {
  repoId: string;
  filename: string;
  filePath: string;
  size: number;
  downloadedAt: string;
  /** HuggingFace pipeline tag — used to determine capabilities (e.g. vision) */
  pipelineTag: string | null;
  /** HuggingFace tags — stored for capability detection */
  tags: string[];
}

/** Progress event payload for model file downloads */
export interface ModelDownloadProgress {
  filename: string;
  bytesDownloaded: number;
  totalBytes: number;
  /** One of: "downloading", "complete", "error" */
  phase: 'downloading' | 'complete' | 'error';
  error: string | null;
}
