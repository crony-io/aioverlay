<script lang="ts">
  import ShortcutRecorder from '$lib/components/settings/ShortcutRecorder.svelte';
  import {
    SHORTCUT_DEFINITIONS,
    getRegistrationStatus,
    onStatusChange,
    saveBinding,
    registerShortcuts,
    type ShortcutAction,
    type ShortcutRegistrationStatus
  } from '$lib/services/shortcuts/shortcutManager';
  import { BadgeCheck, BadgeAlert, Globe, AppWindow } from 'lucide-svelte';

  let { bindings = $bindable() } = $props<{
    bindings: Record<ShortcutAction, string>;
  }>();

  let status = $state<ShortcutRegistrationStatus>(getRegistrationStatus());

  $effect(() => {
    const unsub = onStatusChange((s) => {
      status = s;
    });
    return unsub;
  });

  const globalDefs = SHORTCUT_DEFINITIONS.filter((d) => d.global);
  const appDefs = SHORTCUT_DEFINITIONS.filter((d) => !d.global);

  /** When a shortcut value changes, save it and re-register global shortcuts */
  async function handleChange(action: ShortcutAction, value: string) {
    if (!value || bindings[action] === value) return;
    bindings[action] = value;
    saveBinding(action, value);

    const def = SHORTCUT_DEFINITIONS.find((d) => d.action === action);
    if (def?.global) {
      await registerShortcuts();
    }
  }
</script>

<div class="flex flex-col gap-4">
  <!-- Global shortcuts (Tauri OS-level) -->
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <div
        class="flex items-center gap-1.5 text-xs font-semibold text-white/50 uppercase tracking-wider"
      >
        <Globe class="h-3 w-3" />
        Global Shortcuts
      </div>
      {#if status.registered}
        <span class="flex items-center gap-1 text-[10px] text-emerald-400/70">
          <BadgeCheck class="h-3 w-3" />
          Active
        </span>
      {:else if status.error}
        <span class="flex items-center gap-1 text-[10px] text-red-400/70" title={status.error}>
          <BadgeAlert class="h-3 w-3" />
          Failed
        </span>
      {/if}
    </div>
    {#each globalDefs as def (def.action)}
      <ShortcutRecorder
        label={def.label}
        value={bindings[def.action]}
        onChange={(v) => handleChange(def.action, v)}
      />
    {/each}
    <span class="text-[10px] text-white/30"
      >These work system-wide, even when the app is not focused</span
    >
  </div>

  <!-- App-level shortcuts -->
  <div class="flex flex-col gap-2 border-t border-white/10 pt-3">
    <div
      class="flex items-center gap-1.5 text-xs font-semibold text-white/50 uppercase tracking-wider"
    >
      <AppWindow class="h-3 w-3" />
      App Shortcuts
    </div>
    {#each appDefs as def (def.action)}
      <ShortcutRecorder
        label={def.label}
        value={bindings[def.action]}
        onChange={(v) => handleChange(def.action, v)}
      />
    {/each}
    <span class="text-[10px] text-white/30">These work only when the app window is focused</span>
  </div>

  <span class="text-xs text-white/40"
    >Click a shortcut, then press your desired key combination</span
  >
</div>
