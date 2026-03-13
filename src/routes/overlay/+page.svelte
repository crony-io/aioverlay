<script lang="ts">
  import { onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';

  let isSelecting = $state(false);
  let startX = $state(0);
  let startY = $state(0);
  let currentX = $state(0);
  let currentY = $state(0);
  let isCapturing = $state(false); // To prevent multiple captures

  // We need to know the offset of this monitor to pass absolute desktop coordinates
  let monitorX = $state(0);
  let monitorY = $state(0);

  onMount(() => {
    // Read the query params to get monitor offset
    const params = new URLSearchParams(window.location.search);
    monitorX = parseFloat(params.get('x') || '0');
    monitorY = parseFloat(params.get('y') || '0');

    // Also close on Escape key
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelCapture();
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0 || isCapturing) return; // Only left click
    startX = e.clientX;
    startY = e.clientY;
    currentX = e.clientX;
    currentY = e.clientY;
    isSelecting = true;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isSelecting) return;
    currentX = e.clientX;
    currentY = e.clientY;
  }

  async function handleMouseUp(e: MouseEvent) {
    if (!isSelecting) return;
    isSelecting = false;
    currentX = e.clientX;
    currentY = e.clientY;

    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    if (width < 5 || height < 5) {
      // Too small, probably an accidental click
      return cancelCapture();
    }

    isCapturing = true;

    // Calculate absolute desktop coordinates
    const localX = Math.min(startX, currentX);
    const localY = Math.min(startY, currentY);

    const absoluteX = monitorX + localX;
    const absoluteY = monitorY + localY;

    try {
      // Rust handles closing overlays, capturing, emitting the event,
      // and showing the main window — all from a stable context.
      await invoke('capture_region', {
        x: absoluteX,
        y: absoluteY,
        width,
        height
      });
    } catch {
      cancelCapture();
    }
  }

  async function cancelCapture() {
    isCapturing = true;
    await invoke('cancel_screenshot_mode');
  }

  let rectX = $derived(Math.min(startX, currentX));
  let rectY = $derived(Math.min(startY, currentY));
  let rectW = $derived(Math.max(0, Math.abs(currentX - startX)));
  let rectH = $derived(Math.max(0, Math.abs(currentY - startY)));

  // The clip-path creates a hollow rectangle in the middle of a shaded background.
  // Using an SVG mask is the most reliable way to create a transparent hole.
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="fixed inset-0 z-50 cursor-crosshair select-none"
  onmousedown={handleMouseDown}
  onmousemove={handleMouseMove}
  onmouseup={handleMouseUp}
  oncontextmenu={(e) => {
    e.preventDefault();
    cancelCapture();
  }}
>
  <svg class="h-full w-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <mask id="cutoutMask">
        <!-- White reveals everything (so the black tint applies everywhere) -->
        <rect width="100%" height="100%" fill="white" />
        <!-- Black hides the tint (creates the cutout) -->
        {#if isSelecting}
          <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="black" />
        {/if}
      </mask>
    </defs>
    <!-- The dim background covering the whole screen, utilizing the mask to cut the hole -->
    <!-- Using a lighter black tint so that the real desktop can be heavily visible -->
    <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.45)" mask="url(#cutoutMask)" />

    <!-- Optional borderline around the selection -->
    {#if isSelecting}
      <rect
        x={rectX}
        y={rectY}
        width={rectW}
        height={rectH}
        fill="none"
        stroke="#818cf8"
        stroke-width="1.5"
        stroke-dasharray="4, 4"
      />
      <!-- Dimension label -->
      {#if rectW > 0 && rectH > 0}
        <g transform={`translate(${rectX}, ${Math.max(0, rectY - 25)})`}>
          <rect width="70" height="20" rx="4" fill="rgba(0, 0, 0, 0.6)" x="0" y="0" />
          <text
            x="35"
            y="14"
            fill="white"
            font-size="12px"
            font-family="system-ui"
            text-anchor="middle"
            font-weight="500"
          >
            {Math.round(rectW)} × {Math.round(rectH)}
          </text>
        </g>
      {/if}
    {/if}
  </svg>
</div>

{#if isCapturing}
  <!-- Prevent further interaction while waiting for capture to finish closing -->
  <div class="fixed inset-0 z-100"></div>
{/if}
