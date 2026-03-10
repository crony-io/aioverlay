<script lang="ts">
  import { X, Check, Maximize } from 'lucide-svelte';

  let { screenshotData, onConfirm, onCancel } = $props<{
    screenshotData: { data: string; width: number; height: number };
    onConfirm: (croppedBase64: string) => void;
    onCancel: () => void;
  }>();

  let canvasEl: HTMLCanvasElement | undefined = $state();
  let isSelecting = $state(false);
  let startX = $state(0);
  let startY = $state(0);
  let endX = $state(0);
  let endY = $state(0);
  let hasSelection = $state(false);

  /** Cached HTMLImageElement — loaded once, reused for every redraw */
  let cachedImg: HTMLImageElement | null = null;

  /** Scale factors for mapping canvas coords to actual image pixels */
  let scaleX = $state(1);
  let scaleY = $state(1);

  /** Load the screenshot image once on mount and draw it */
  $effect(() => {
    if (!canvasEl) return;

    const img = new Image();
    img.onload = () => {
      if (!canvasEl) return;

      cachedImg = img;

      // Fit canvas to window
      const displayW = window.innerWidth;
      const displayH = window.innerHeight;
      canvasEl.width = displayW;
      canvasEl.height = displayH;

      scaleX = img.naturalWidth / displayW;
      scaleY = img.naturalHeight / displayH;

      const ctx = canvasEl.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, displayW, displayH);
    };
    img.src = `data:image/png;base64,${screenshotData.data}`;
  });

  /** Redraw the screenshot with selection overlay using the cached image */
  function redraw() {
    if (!canvasEl || !cachedImg) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(cachedImg, 0, 0, canvasEl.width, canvasEl.height);

    if (hasSelection || isSelecting) {
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const w = Math.abs(endX - startX);
      const h = Math.abs(endY - startY);

      // Dim everything outside selection
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

      // Clear the selected area to show original
      ctx.clearRect(x, y, w, h);
      ctx.drawImage(cachedImg, x * scaleX, y * scaleY, w * scaleX, h * scaleY, x, y, w, h);

      // Selection border
      ctx.strokeStyle = '#818cf8';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);

      // Dimension label
      const realW = Math.round(w * scaleX);
      const realH = Math.round(h * scaleY);
      if (realW > 0 && realH > 0) {
        const label = `${realW} × ${realH}`;
        ctx.font = '12px system-ui';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        const textW = ctx.measureText(label).width + 12;
        ctx.fillRect(x, y - 22, textW, 20);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, x + 6, y - 7);
      }
    }
  }

  function handleMouseDown(e: MouseEvent) {
    startX = e.clientX;
    startY = e.clientY;
    endX = e.clientX;
    endY = e.clientY;
    isSelecting = true;
    hasSelection = false;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isSelecting) return;
    endX = e.clientX;
    endY = e.clientY;
    redraw();
  }

  function handleMouseUp() {
    if (!isSelecting) return;
    isSelecting = false;

    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);

    if (w > 5 && h > 5) {
      hasSelection = true;
    } else {
      hasSelection = false;
    }
    redraw();
  }

  /** Use the full screenshot without cropping */
  function useFullScreenshot() {
    onConfirm(screenshotData.data);
  }

  /** Crop the selected region and return as base64 */
  function confirmSelection() {
    if (!hasSelection || !canvasEl) {
      useFullScreenshot();
      return;
    }

    const x = Math.min(startX, endX);
    const y = Math.min(startY, endY);
    const w = Math.abs(endX - startX);
    const h = Math.abs(endY - startY);

    // Crop from the original image at native resolution
    const cropCanvas = document.createElement('canvas');
    const realX = Math.round(x * scaleX);
    const realY = Math.round(y * scaleY);
    const realW = Math.round(w * scaleX);
    const realH = Math.round(h * scaleY);

    cropCanvas.width = realW;
    cropCanvas.height = realH;

    const ctx = cropCanvas.getContext('2d');
    if (!ctx) {
      useFullScreenshot();
      return;
    }

    if (!cachedImg) {
      useFullScreenshot();
      return;
    }

    ctx.drawImage(cachedImg, realX, realY, realW, realH, 0, 0, realW, realH);
    const dataUrl = cropCanvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1] || '';
    onConfirm(base64);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-9999 cursor-crosshair select-none"
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
>
  <canvas bind:this={canvasEl} class="h-full w-full"></canvas>

  <!-- Action buttons -->
  <div
    class="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-white/10 bg-black/70 px-4 py-2 backdrop-blur-md"
  >
    <button
      onclick={onCancel}
      class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
      aria-label="Cancel"
    >
      <X class="h-3.5 w-3.5" />
      Cancel
    </button>

    <div class="h-5 w-px bg-white/10"></div>

    <button
      onclick={useFullScreenshot}
      class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
      aria-label="Use full screenshot"
    >
      <Maximize class="h-3.5 w-3.5" />
      Full Screen
    </button>

    <button
      onclick={confirmSelection}
      disabled={!hasSelection}
      class="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      aria-label="Confirm selection"
    >
      <Check class="h-3.5 w-3.5" />
      Confirm
    </button>
  </div>

  <!-- Help text -->
  {#if !hasSelection && !isSelecting}
    <div
      class="absolute top-6 left-1/2 -translate-x-1/2 rounded-lg bg-black/60 px-4 py-2 text-xs text-white/80 backdrop-blur-md"
    >
      Drag to select a region, or use Full Screen
    </div>
  {/if}
</div>
