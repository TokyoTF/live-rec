<script>
  import { getToasts, dismiss } from '@lib/store.js'
  import { XIcon, InfoIcon, CircleAlert, CircleCheck } from 'lucide-svelte'
  import { fly, fade } from 'svelte/transition'

  let toasts = $derived(getToasts())

  const icons = {
    info: InfoIcon,
    error: CircleAlert,
    success: CircleCheck,
    warning: CircleAlert
  }

  const colors = {
    info: 'bg-surface-700/90 border-surface-500 text-white',
    error: 'bg-red-900/90 border-red-500/50 text-red-100',
    success: 'bg-green-900/90 border-green-500/50 text-green-100',
    warning: 'bg-yellow-900/90 border-yellow-500/50 text-yellow-100'
  }
</script>

<div class="fixed top-4 right-4 z-9999 flex flex-col gap-2 no-drag pointer-events-none">
  {#each toasts as toast (toast.id)}
    {@const Icon = icons[toast.type] || InfoIcon}
    <div
      in:fly={{ x: 50, duration: 300 }}
      out:fade={{ duration: 200 }}
      class="flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-md min-w-[280px] pointer-events-auto {colors[toast.type] || colors.info}"
    >
      <div class="flex items-center justify-center p-1 rounded-full bg-black/20">
        <Icon size={16} class="shrink-0" />
      </div>
      <span class="flex-1 text-sm font-medium drop-shadow-sm">{toast.message}</span>
      <button
        class="p-1 hover:bg-white/10 rounded-md transition-colors cursor-pointer"
        onclick={() => dismiss(toast.id)}
        aria-label="Dismiss"
      >
        <XIcon size={14} />
      </button>
    </div>
  {/each}
</div>
