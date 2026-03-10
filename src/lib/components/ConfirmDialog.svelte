<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';

  let {
    title = 'Confirm',
    message = 'Are you sure?',
    confirmLabel = 'Delete',
    onConfirm,
    onCancel
  } = $props<{
    title?: string;
    message?: string;
    confirmLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
  }>();

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter') onConfirm();
  }
</script>

<div
  class="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm"
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  onkeydown={handleKeydown}
>
  <div
    class="mx-4 w-full max-w-sm rounded-2xl border p-5 shadow-2xl"
    style="background: var(--surface-base); border-color: var(--border-default);"
  >
    <div class="flex items-start gap-3">
      <div class="shrink-0 rounded-full bg-red-500/10 p-2">
        <AlertTriangle class="h-5 w-5 text-red-400" />
      </div>
      <div class="flex-1">
        <h3 class="text-sm font-semibold text-white">{title}</h3>
        <p class="mt-1 text-xs text-white/60">{message}</p>
      </div>
    </div>

    <div class="mt-4 flex justify-end gap-2">
      <button
        onclick={onCancel}
        class="rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 transition-colors"
      >
        Cancel
      </button>
      <button
        onclick={onConfirm}
        class="rounded-lg bg-red-500/80 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-500 transition-colors"
      >
        {confirmLabel}
      </button>
    </div>
  </div>
</div>
