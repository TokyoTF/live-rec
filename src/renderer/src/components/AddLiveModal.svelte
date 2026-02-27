<script>
  import { PlusIcon, LinkIcon, XIcon } from 'lucide-svelte'
  import { parseStreamInput } from '@lib/url-parser.js'
  import { 
    PROVIDERS, PROVIDER_COLORS, 
    addRecording, notify 
  } from '@lib/store.js'
  import { send, on } from '@lib/ipc.js'
  import { onDestroy } from 'svelte'
  import { tooltip } from '@lib/tooltip.js'

  let unsub = on('Models:imported', (_e, lines) => {
    let addCount = 0
    lines.forEach(line => {
      const p = parseStreamInput(line)
      if (p.nametag && p.provider) {
        if(addRecording(p.provider, p.nametag, groupName)) addCount++
      }
    })
    close()
    if (addCount > 0) notify(`Successfully imported ${addCount} cameras`, 'success')
  })

  onDestroy(() => {
    if (unsub) unsub()
  })

  let isOpen = $state(false)
  let input = $state('')
  let manualProvider = $state('chaturbate')
  let groupName = $state('')
  let parsed = $derived(input ? parseStreamInput(input) : { provider: null, nametag: '', isUrl: false })
  let error = $state('')

  function handleSubmit() {
    const provider = parsed.isUrl ? parsed.provider : manualProvider
    const nametag = parsed.nametag

    if (!provider || !nametag) {
      error = 'Please enter a valid URL or nametag'
      return
    }

    const success = addRecording(provider, nametag, groupName)
    if (!success) {
      error = 'This cam is already being tracked'
      notify('This cam is already being tracked', 'error')
      return
    }

    notify(`Added ${nametag} successfully`, 'success')

    input = ''
    groupName = ''
    error = ''
    isOpen = false
  }

  function triggerBulkImport() {
    send('Models:importFile')
  }

  function close() {
    isOpen = false
    input = ''
    groupName = ''
    error = ''
  }
</script>

<!-- Trigger Button -->
<button
  class="p-2 rounded-full bg-accent-500/20 hover:bg-accent-500/30 border border-accent-500/30 text-accent-400 transition-all cursor-pointer"
  onclick={() => isOpen = true}
  use:tooltip={"Add Live"}
>

  <PlusIcon size={16} />
</button>

<!-- Modal Overlay -->
{#if isOpen}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={close}>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="bg-surface-800 border border-white/10 rounded-2xl p-5 w-[420px] shadow-2xl shadow-black/40"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-white/90">Add New Live</h2>
        <button
          class="p-1 rounded-lg hover:bg-surface-600 text-white/40 hover:text-white/70 transition-all cursor-pointer"
          onclick={close}
        >
          <XIcon size={16} />
        </button>
      </div>

      <!-- Input -->
      <div class="space-y-4">
        <div>
          <label for="url-input" class="text-[11px] text-white/40 uppercase tracking-wider mb-1 block">URL or Nametag</label>
          <div class="relative">
            <LinkIcon size={14} class="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              id="url-input"
              type="text"
              bind:value={input}
              placeholder="https://chaturbate.com/modelname or just modelname"
              class="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-700 border border-white/8 text-sm text-white/90 placeholder-white/25 outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all"
              onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>

        <div>
          <label for="group-input" class="text-[11px] text-white/40 uppercase tracking-wider mb-1 block">Group Name (Optional)</label>
          <div class="relative">
            <input
              id="group-input"
              type="text"
              bind:value={groupName}
              placeholder="e.g. Favorites, Private"
              class="w-full px-4 py-2.5 rounded-xl bg-surface-700 border border-white/8 text-sm text-white/90 placeholder-white/25 outline-none focus:border-accent-500/50 focus:ring-1 focus:ring-accent-500/20 transition-all"
              onkeydown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>

        <!-- Auto-detected or manual provider -->
        {#if parsed.isUrl && parsed.provider}
          <div class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-online/10 border border-online/20">
            <span class="w-2 h-2 rounded-full bg-online"></span>
            <span class="text-xs text-online">
              Detected: <strong style="color: {$PROVIDER_COLORS[parsed.provider]}">{parsed.provider}</strong> / <strong>{parsed.nametag}</strong>
            </span>
          </div>
        {:else if input && !parsed.isUrl}
          <div>
            <label for="provider-select" class="text-[11px] text-white/40 uppercase tracking-wider mb-1 block">Select Provider</label>
            <select
              id="provider-select"
              bind:value={manualProvider}
              class="w-full px-4 py-2.5 rounded-xl bg-surface-700 border border-white/8 text-sm text-white/80 outline-none focus:border-accent-500/50 transition-all cursor-pointer"
            >
              {#each $PROVIDERS as p}
                <option value={p.value}>{p.name}</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Error -->
        {#if error}
          <p class="text-xs text-notexist">{error}</p>
        {/if}

        <!-- Submit -->
        <button
          class="w-full py-2.5 rounded-full bg-accent-500 hover:bg-accent-400 text-white text-sm font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          onclick={handleSubmit}
          disabled={!parsed.nametag}
        >
          Add to Recording List
        </button>

        <button
          class="w-full py-2.5 rounded-full bg-surface-700 hover:bg-surface-600 border border-surface-600 text-white text-sm font-medium transition-all cursor-pointer"
          onclick={triggerBulkImport}
        >
          Bulk Import from .txt
        </button>
      </div>
    </div>
  </div>
{/if}
