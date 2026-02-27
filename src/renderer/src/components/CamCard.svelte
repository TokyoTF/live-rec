<script>
  import { PlayIcon, XIcon } from 'lucide-svelte'
  import { PROVIDER_COLORS, selectStream, removeRecording, startRec, stopRec, viewMode } from '@lib/store.js'

  let {
    status,
    thumb,
    nametag,
    provider,
    statusRec,
    paused,
    resolutions,
    timeRec
  } = $props()

  let localRecUrl = $state('')

  function handlePlayClick() {
    selectStream(provider, nametag, localRecUrl)
  }

  function handleRecToggle() {
    if (!statusRec && !paused) {
      const url = localRecUrl || resolutions?.[0]?.url || ''
      startRec(nametag, provider, url)
    } else {
      stopRec(nametag, provider, resolutions)
    }
  }

  function handleRemove() {
    removeRecording(nametag, provider)
  }
</script>

<div class="group relative bg-surface-800 border border-surface-600 overflow-hidden transition-all duration-300 {$viewMode === 'grid' ? 'rounded-xl' : 'flex items-center p-2 gap-3 rounded-xl'}">

  <!-- Thumbnail -->
  <div class="relative overflow-hidden bg-surface-900 shrink-0 {$viewMode === 'grid' ? 'aspect-video w-full' : 'w-24 h-14 rounded-lg' }">
    <img
      src={thumb || 'https://www.camsoda.com/assets/img/missing-img.jpg'}
      alt={nametag}
      class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
    />
    <div class="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent"></div>

    <!-- Status badge -->
    <div class="absolute top-2 left-2">
      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white bg-surface-900/80 rounded-md backdrop-blur-sm {status === 'online' || status === 'private' ? 'pulse-online' : ''}">
        <span class="w-1.5 h-1.5 rounded-full {status === 'online' ? 'bg-online' : (status === 'private' ? 'bg-private' : 'bg-offline')}"></span>
        {status || 'Loading'}
      </span>
    </div>


    <!-- Play overlay -->
    {#if status === 'online'}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer"
        onclick={handlePlayClick}
      >
        <div class="p-3 bg-black/60 hover:bg-accent-500 rounded-full backdrop-blur-sm transition-all duration-200">
          <PlayIcon size={$viewMode === 'grid' ? 32 : 16} class="text-white fill-white" />
        </div>
      </div>
    {/if}

  </div>

  <!-- Info -->
  <div class="flex-1 {$viewMode === 'grid' ? 'px-3 py-3 space-y-2' : 'flex items-center justify-between gap-4'}">
    <div class="flex items-center gap-2 min-w-0">
      <span 
        class="text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0"
        style="background-color: {$PROVIDER_COLORS[provider]}33; color: {$PROVIDER_COLORS[provider]};"
      >
        {provider}
      </span>
      <span class="text-sm font-medium text-white/90 truncate">{nametag}</span>
      
      {#if $viewMode === 'list' && statusRec}
        <div class="flex items-center gap-1.5 text-[11px] font-bold text-accent-500 ml-2">
          <span class="w-2 h-2 rounded-full {paused ? 'bg-orange-500 animate-pulse' : 'bg-recording'}"></span>
          {timeRec || '0 s'}{paused ? ' - paused' : ''}
        </div>
      {/if}
    </div>

    <!-- Recording controls -->
    {#if (status === 'online' && resolutions?.length > 0) || statusRec}
      <div class="flex items-center gap-2 {$viewMode === 'grid' ? 'pt-1' : ''}">
        {#if $viewMode === 'grid' && resolutions?.length > 0}
          <select
            bind:value={localRecUrl}
            class="flex-1 min-w-0 px-3 py-1.5 rounded-full bg-surface-600 border border-surface-500 text-[11px] font-medium text-white/90 outline-none focus:border-accent-500 transition-all cursor-pointer hover:bg-surface-500"
          >
            <option value="" disabled selected>
              {resolutions[0]?.resolution.width}x{resolutions[0]?.resolution.height} {#if resolutions[0]?.fps}{resolutions[0]?.fps}fps{/if}
            </option>
            {#each resolutions as res}
              <option value={res.url}>
                {res.resolution.width}x{res.resolution.height} {#if res.fps}{res.fps}fps{/if}
              </option>
            {/each}
          </select>
        {/if}

        <button
          class="px-4 py-1.5 text-[11px] font-bold rounded-full transition-all cursor-pointer {(!statusRec && !paused)
            ? 'bg-white hover:bg-gray-200 text-black'
            : (paused ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-recording hover:bg-recording/60 text-white')}"
          onclick={handleRecToggle}
        >
          {(!statusRec && !paused) ? 'REC' : 'STOP'}
        </button>
      </div>

      {#if (statusRec || paused) && $viewMode === 'grid'}
        <div class="flex items-center gap-1.5 text-[11px] font-bold text-accent-500 mt-1">
          <span class="w-2 h-2 rounded-full {paused ? 'bg-orange-500 animate-pulse' : 'bg-accent-500 pulse-recording'}"></span>
          {timeRec || '0 s'}{paused ? ' - paused' : ''}
        </div>
      {/if}
    {/if}

    <!-- Remove button (List view only, always visible) -->
    {#if $viewMode === 'list'}
      <button
        class="p-1.5 rounded-full bg-surface-700 hover:bg-surface-600 text-white transition-all duration-200 cursor-pointer"
        onclick={handleRemove}
      >
        <XIcon size={16} />
      </button>
    {/if}



    <!-- Remove button (Grid view handled by absolute overlay) -->
    {#if $viewMode === 'grid'}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="absolute top-2 right-2 p-1.5 rounded-full bg-surface-900/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-surface-700 text-white transition-all duration-200 cursor-pointer"
        onclick={handleRemove}
      >
        <XIcon size={16} />
      </div>
    {/if}
  </div>
</div>
