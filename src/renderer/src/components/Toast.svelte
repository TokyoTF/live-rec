<script>
  import { toasts, dismiss } from '@lib/store.js'
  import { XIcon, InfoIcon, CircleAlert, CircleCheck } from 'lucide-svelte'
  import { fly, fade } from 'svelte/transition'
  import { onDestroy } from 'svelte'

  let toastsValue = $state([])
  const unsubscribe = toasts.subscribe(v => { toastsValue = v })
  onDestroy(unsubscribe)

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

<div class="fixed z-999 left-4 bottom-6 flex flex-col gap-2 no-drag pointer-events-none">
  {#each toastsValue as toastItem (toastItem.id)}
    {@const Icon = icons[toastItem.type] || InfoIcon}
    <div
      in:fly={{ x: 50, duration: 300 }}
      out:fade={{ duration: 200 }}
      class="flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-md min-w-64 pointer-events-auto {colors[toastItem.type] || colors.info}"
    >
      <div class="flex items-center justify-center p-1 rounded-full bg-black/20">
        <Icon size={16} class="shrink-0" />
      </div>
      <span class="flex-1 text-sm font-medium drop-shadow-sm">{toastItem.message}</span>
      <button
        class="p-1 hover:bg-white/10 rounded-md transition-colors cursor-pointer"
        onclick={() => dismiss(toastItem.id)}
        aria-label="Dismiss"
      >
        <XIcon size={14} />
      </button>
    </div>
  {/each}
</div>
