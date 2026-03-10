<script lang="ts">
  let { label, description = '', checked = $bindable() } = $props<{
    label: string;
    description?: string;
    checked: boolean;
  }>();
</script>

<div class="flex items-center justify-between border-t border-white/10 pt-4 pb-2">
  <div>
    <div class="text-sm text-white/80 font-medium">{label}</div>
    {#if description}
      <div class="text-xs text-white/40">{description}</div>
    {/if}
  </div>
  <label class="relative inline-flex cursor-pointer items-center">
    <input type="checkbox" bind:checked class="peer sr-only" />
    <div
      class="h-6 w-11 rounded-full bg-white/10 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-500 peer-checked:after:translate-x-full peer-focus:outline-none"
    ></div>
  </label>
</div>
