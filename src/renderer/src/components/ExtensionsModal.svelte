<script>
  import { XIcon, PuzzleIcon, RefreshCwIcon, DownloadIcon, CheckIcon, LoaderIcon } from 'lucide-svelte'
  import { send, on } from '@lib/ipc.js'
  import { notify } from '@lib/store.js'
  import { onDestroy } from 'svelte'
  import { tooltip } from '@lib/tooltip.js'

  let { showModal = $bindable(false), closeModal } = $props()
  let extensions = $state([])
  let updates = $state([])
  let githubExtensions = $state([])
  let checking = $state(false)
  let updating = $state('')
  let loadingGithub = $state(false)

  const unsubs = []

  unsubs.push(on('extensions:list', (_e, data) => {
    extensions = data
  }))

  unsubs.push(on('extensions:check-updates', (_e, data) => {
    checking = false
    updates = data.updates || []
    if (data.updates?.length > 0) {
      notify(`${data.updates.length} extension updates found`, 'info')
    }
  }))

  unsubs.push(on('extensions:update', (_e, data) => {
    updating = ''
    if (data.success && data.extensions) {
      extensions = data.extensions
      updates = updates.filter(u => u.name !== data.name)
      githubExtensions = githubExtensions.filter(g => g.name !== data.name)
      notify(`${data.name} extension updated!`, 'success')
    } else {
      notify(`Failed to update ${data.name}: ${data.error}`, 'error')
    }
  }))

  unsubs.push(on('extensions:get-github-list', (_e, data) => {
    loadingGithub = false
    if (data.success) {

      githubExtensions = data.extensions.filter(g => 
        !extensions.some(e => e.name.toLowerCase() === g.name.toLowerCase())
      )
    }
  }))

  onDestroy(() => unsubs.forEach(u => u()))

  function open() {
    showModal = true
    send('extensions:list')
    loadingGithub = true
    send('extensions:get-github-list')
  }

  function close() {
    showModal = false
    updates = []
  }

  function checkUpdates() {
    checking = true
    send('extensions:check-updates')
  }

  function updateExtension(name) {
    updating = name
    send('extensions:update', { name })
  }

  function getUpdate(name) {
    return updates.find(u => u.name === name)
  }
</script>

<!-- Trigger Button -->
<button
  class="p-2 bg-surface-700 hover:bg-surface-600 text-white transition-all cursor-pointer rounded-full"
  onclick={open}
  use:tooltip={"Extensions"}
>
  <PuzzleIcon size={16} />
</button>

<!-- Modal Overlay -->
{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-999 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={close}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-surface-800 border border-white/10 rounded-2xl p-5 w-[420px] shadow-2xl shadow-black/40"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <PuzzleIcon size={16} class="text-accent-400" />
          <h2 class="text-sm font-semibold text-white/90">Extensions</h2>
        </div>
        <div class="flex items-center gap-1">
          <button
            class="p-1.5 rounded-lg hover:bg-surface-600 text-white/40 hover:text-white/70 transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            onclick={checkUpdates}
            disabled={checking}
            use:tooltip={"Check for updates"}
          >
            <RefreshCwIcon size={14} class={checking ? 'animate-spin' : ''} />
          </button>
          <button
            class="p-1 rounded-lg hover:bg-surface-600 text-white/40 hover:text-white/70 transition-all cursor-pointer"
            onclick={close}
          >
            <XIcon size={16} />
          </button>
        </div>
      </div>

      <!-- Extensions List -->
      <div class="space-y-1.5 max-h-[400px] overflow-y-auto">
        {#if extensions.length === 0}
          <p class="text-xs text-white/30 text-center py-4">No extensions loaded</p>
        {:else}
          {#each extensions as ext}
            {@const upd = getUpdate(ext.name)}
            <div class="flex items-center justify-between px-3 py-2.5 rounded-xl bg-surface-700/50 border border-white/5">
              <div class="flex flex-col">
                <span class="text-sm text-white/80 font-medium capitalize">{ext.name}</span>
                <span class="text-[10px] text-white/25 font-mono">
                  v{ext.version}
                  {#if upd}
                    <span class="text-accent-400">→ v{upd.newVersion}</span>
                  {/if}
                </span>
              </div>
              <div class="flex items-center gap-1">
                {#if upd}
                  {#if updating === ext.name}
                    <LoaderIcon size={14} class="text-accent-400 animate-spin" />
                  {:else}
                    <button
                      class="p-1.5 rounded-lg bg-accent-500/20 hover:bg-accent-500/30 text-accent-400 transition-all cursor-pointer"
                      onclick={() => updateExtension(ext.name)}
                      use:tooltip={"Update to v" + upd.newVersion}
                    >
                      <DownloadIcon size={12} />
                    </button>
                  {/if}
                {:else if updates.length > 0}
                  <CheckIcon size={14} class="text-online/50" />
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <!-- Add New from GitHub -->
      {#if githubExtensions.length > 0}
        <div class="mt-4 pt-4 border-t border-white/5">
          <h3 class="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Available on GitHub</h3>
          <div class="space-y-1.5 max-h-[200px] overflow-y-auto">
            {#each githubExtensions as ext}
              <div class="flex items-center justify-between px-3 py-2 rounded-xl bg-surface-700/30 border border-white/5">
                <span class="text-sm text-white/60 capitalize">{ext.name}</span>
                <button
                  class="p-1.5 rounded-lg bg-accent-500/10 hover:bg-accent-500/20 text-accent-400 transition-all cursor-pointer disabled:opacity-30"
                  onclick={() => updateExtension(ext.name)}
                  disabled={updating === ext.name}
                >
                  {#if updating === ext.name}
                    <LoaderIcon size={12} class="animate-spin" />
                  {:else}
                    <DownloadIcon size={12} />
                  {/if}
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Footer -->
      <div class="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <p class="text-[11px] text-white/25">{extensions.length} extension{extensions.length !== 1 ? 's' : ''} loaded</p>
        {#if updates.length > 0}
          <p class="text-[11px] text-accent-400">{updates.length} update{updates.length !== 1 ? 's' : ''} available</p>
        {/if}
      </div>
    </div>
  </div>
{/if}
