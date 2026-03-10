<script lang="ts">
  import { ChevronDown } from 'lucide-svelte';
  import type { Snippet } from 'svelte';

  let {
    title,
    icon,
    defaultOpen = true,
    children
  } = $props<{
    title: string;
    icon?: Snippet;
    defaultOpen?: boolean;
    children: Snippet;
  }>();

  let open = $derived.by(() => defaultOpen);
  let isOpen = $state<boolean | null>(null);

  /** Use manual override if user toggled, otherwise follow defaultOpen */
  let expanded = $derived(isOpen ?? open);

  function toggle() {
    isOpen = !expanded;
  }
</script>

<div class="border-t border-white/10 pt-3">
  <button onclick={toggle} class="flex w-full items-center justify-between py-1 group">
    <div class="flex items-center gap-2">
      {#if icon}
        <span class="text-white/30 group-hover:text-white/50 transition-colors">
          {@render icon()}
        </span>
      {/if}
      <span
        class="text-xs font-semibold text-white/50 uppercase tracking-wider group-hover:text-white/70 transition-colors"
      >
        {title}
      </span>
    </div>
    <ChevronDown
      class="h-3.5 w-3.5 text-white/30 transition-transform duration-200 {expanded
        ? 'rotate-0'
        : '-rotate-90'}"
    />
  </button>

  {#if expanded}
    <div class="mt-2 flex flex-col gap-3">
      {@render children()}
    </div>
  {/if}
</div>
