<script>
  import { PlayIcon, XIcon, Heart, Activity, Tag } from 'lucide-svelte'
  import { PROVIDER_COLORS, selectStream, removeRecording, startRec, stopRec, viewMode, autoRec, autoRecMode, reclist, showStats, showTags, updateTags } from '@lib/store.js'
  import { send } from '@lib/ipc.js'
  import { onMount, onDestroy, tick } from 'svelte'

  let {
    status,
    thumb,
    nametag,
    provider,
    statusRec,
    paused,
    resolutions,
    timeRec,
    recoveryPending,
    codec,
    stats,
    tags = [],
    outputPath,
    recUrl,
    recResolution,
    recProvider
  } = $props()

  let localRecUrl = $state('')
  let tagInput = $state('')
  let showTagInput = $state(false)
  let tagWrapper = $state(null)

  $effect(() => {
    if (resolutions?.length > 0 && !localRecUrl) {
      localRecUrl = resolutions[0].url
    }
  })

  let isFavorite = $derived($reclist.some(r => r.nametag === nametag && r.provider === provider && r.favorite === true))
  let selectedResLabel = $derived(() => {
    const res = resolutions?.find(r => r.url === localRecUrl)
    return res ? `${res.resolution.width}x${res.resolution.height}` : ''
  })
  let statsPos = $state({ show: false, above: true, x: 0, y: 0 })
  let statsTipEl = $state(null)

  function checkStatsPosition(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const above = rect.top > 120
    const y = above ? rect.top - 6 : rect.bottom + 6
    statsPos = { show: true, above, x: rect.left + rect.width / 2, y }
    tick().then(() => {
      if (!statsTipEl) return
      const tipW = statsTipEl.offsetWidth
      const tipH = statsTipEl.offsetHeight
      const clampedX = Math.min(Math.max(rect.left + rect.width / 2, tipW / 2 + 8), window.innerWidth - tipW / 2 - 8)
      let clampedY = y
      if (y + tipH > window.innerHeight - 8) {
        clampedY = rect.top - tipH - 6
      }
      if (clampedX !== statsPos.x || clampedY !== statsPos.y) statsPos = { ...statsPos, x: clampedX, y: clampedY }
    })
  }

  function hideStats() {
    statsPos = { ...statsPos, show: false }
  }

  function handleTagOutside(e) {
    if (showTagInput && tagWrapper && !tagWrapper.contains(e.target)) {
      showTagInput = false
    }
  }

  function handlePlayClick() {
    selectStream(provider, nametag, localRecUrl)
  }

  function handleRecToggle() {
    if (!statusRec && !paused) {
      const recUrl = localRecUrl || resolutions?.[0]?.url || ''
      startRec(nametag, provider, recUrl, resolutions, localRecUrl)
    } else {
      stopRec(nametag, provider, resolutions)
    }
  }

  function handleRemove() {
    removeRecording(nametag, provider)
  }

  function toggleFavorite() {
    let favorite = !isFavorite
    let index = $reclist.findIndex(i => i.nametag === nametag && i.provider === provider)

    if (index !== -1) {
      reclist.update(r => {
        const draft = [...r]
        draft[index] = { ...draft[index], favorite }
        return draft
      })
      send('Modify:config', { name: 'reclistupdate', value: $reclist[index] })
    }
  }

  function addTag(e) {
    if (e.key === 'Enter' && tagInput.trim()) {
      const newTag = tagInput.trim().toLowerCase()
      if (!tags.includes(newTag)) {
        const newTags = [...tags, newTag]
        updateTags(nametag, provider, newTags)
      }
      tagInput = ''
    }
  }

  function removeTag(tag) {
    updateTags(nametag, provider, tags.filter(t => t !== tag))
  }

  onMount(() => { window.addEventListener('mousedown', handleTagOutside) })
  onDestroy(() => { window.removeEventListener('mousedown', handleTagOutside) })
</script>

<div class="group relative bg-surface-800 border border-surface-600 transition-all duration-300 {$viewMode === 'grid' ? 'rounded-xl' : 'flex items-center p-2 gap-3 rounded-xl'}">

  <!-- Thumbnail -->
  <div class="relative overflow-hidden bg-surface-900 shrink-0 {$viewMode === 'grid' ? 'aspect-video w-full rounded-t-xl' : 'w-24 h-14 rounded-lg' }">
    <img
      src={thumb || 'https://www.camsoda.com/assets/img/missing-img.jpg'}
      alt={nametag}
      class="w-full h-full object-cover transition-transform rounded-t-xl duration-500 group-hover:scale-105"
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

        <button
          class="p-1 rounded-full hover:bg-surface-600 transition-all cursor-pointer"
          onclick={toggleFavorite}
        >
          <Heart
            size={14}
            class={isFavorite ? 'fill-rose-500 text-rose-500' : 'text-white/40 hover:text-white/70'}
          />
        </button>

        {#if $showTags}
        <div class="relative" bind:this={tagWrapper}>
          <button
            class="p-1 rounded-full hover:bg-surface-600 transition-all cursor-pointer"
            onclick={() => showTagInput = !showTagInput}
          >
            <Tag size={14} class={tags.length > 0 ? 'text-accent-400' : 'text-white/40 hover:text-white/70'} />
          </button>
          {#if showTagInput}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <div class="absolute top-full right-0 mt-1 p-2 bg-surface-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-36" onclick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={tagInput}
                oninput={(e) => tagInput = e.target.value}
                onkeydown={addTag}
                placeholder="Add tag..."
                class="w-full px-2 py-1 bg-surface-700 border border-white/10 rounded-md text-[11px] text-white/80 placeholder-white/25 outline-none focus:border-accent-500/50"
              />
            </div>
          {/if}
        </div>
        {/if}

      {#if $viewMode === 'list' && statusRec}
        <div class="flex items-center gap-1.5 text-[11px] font-bold text-accent-500 ml-2">
          {#if $showStats}
            <div role="figure" class="relative inline-flex" onmouseenter={checkStatsPosition} onmouseleave={hideStats}>
              <div class="p-0.5 rounded-md hover:bg-surface-600 text-white/40 hover:text-white/70 transition-colors cursor-default">
                <Activity size={12} />
              </div>
              {#if statsPos.show}
                <div bind:this={statsTipEl} class="fixed px-2.5 py-1.5 rounded-lg bg-surface-900 border border-white/10 shadow-xl shadow-black/50 text-[9px] font-mono text-white/80 space-y-0.5 z-50 whitespace-nowrap pointer-events-none" style="left:{statsPos.x}px;top:{statsPos.y}px;transform:translateX(-50%)">
                {#if codec}
                  <div><span class="text-white/40">Codec:</span> {codec.video}</div>
                {/if}
                {#if stats}
                  <div><span class="text-white/40">Bitrate:</span> {stats.currentKbps} kbps</div>
                  <div><span class="text-white/40">FPS:</span> {stats.currentFps}</div>
                {/if}
                {#if selectedResLabel()}
                  <div><span class="text-white/40">Resolución:</span> {selectedResLabel()}</div>
                {/if}
                {#if recProvider}
                  <div><span class="text-white/40">Provider:</span> {recProvider}</div>
                {/if}
                {#if outputPath}
                  <div class="mt-1 pt-1 border-t border-white/10"><span class="text-white/40">Path:</span> <span class="text-[10px] break-all">{outputPath}</span></div>
                {/if}
              </div>
              {/if}
            </div>
          {/if}
          <span class="w-2 h-2 rounded-full {paused ? 'bg-orange-500 animate-pulse' : 'bg-recording'}"></span>
          {timeRec || '0 s'}{paused ? ' - paused' : ''}
        </div>
      {/if}
    </div>

    <!-- Recording controls -->
    {#if status === 'online' && !resolutions?.length && !recoveryPending && !statusRec}
      <div class="flex items-center gap-2 {$viewMode === 'grid' ? 'pt-1' : ''}">
        <div class="flex items-center gap-1.5 text-[11px] text-white/40">
          <div class="w-3 h-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"></div>
          <span>Loading stream...</span>
        </div>
      </div>
    {:else if (status === 'online' && resolutions?.length > 0 && !recoveryPending) || statusRec}
      <div class="flex items-center gap-2 {$viewMode === 'grid' ? 'pt-1' : ''}">
        {#if $viewMode === 'grid' && resolutions?.length > 0}
          <select
            bind:value={localRecUrl}
            disabled={statusRec}
            class="flex-1 min-w-0 px-3 py-1.5 disabled:opacity-70 disabled:hover:bg-surface-600 rounded-full bg-surface-600 border border-surface-500 text-[11px] font-medium text-white/90 outline-none focus:border-accent-500 transition-all cursor-pointer hover:bg-surface-500"
          >
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
          {#if $showStats}
            <div role="figure" class="relative inline-flex" onmouseenter={checkStatsPosition} onmouseleave={hideStats}>
              <div class="p-0.5 rounded-md hover:bg-surface-600 text-white/40 hover:text-white/70 transition-colors cursor-default">
                <Activity size={12} />
              </div>
              {#if statsPos.show}
                <div bind:this={statsTipEl} class="fixed px-2.5 py-1.5 rounded-lg bg-surface-900 border border-white/10 shadow-xl shadow-black/50 text-[9px] font-mono text-white/80 space-y-0.5 z-50 whitespace-nowrap pointer-events-none" style="left:{statsPos.x}px;top:{statsPos.y}px;transform:translateX(-50%)">
                {#if codec}
                  <div><span class="text-white/40">Codec:</span> {codec.video}</div>
                {/if}
                {#if stats}
                  <div><span class="text-white/40">Bitrate:</span> {stats.currentKbps} kbps</div>
                  <div><span class="text-white/40">FPS:</span> {stats.currentFps}</div>
                {/if}
                {#if selectedResLabel()}
                  <div><span class="text-white/40">Resolución:</span> {selectedResLabel()}</div>
                {/if}
                {#if recProvider}
                  <div><span class="text-white/40">Provider:</span> {recProvider}</div>
                {/if}
                {#if outputPath}
                  <div class="mt-1 pt-1 border-t border-white/10"><span class="text-white/40">Path:</span> <span class="text-[10px] break-all">{outputPath}</span></div>
                {/if}
              </div>
              {/if}
            </div>
          {/if}
          <span class="w-2 h-2 rounded-full {paused ? 'bg-orange-500 animate-pulse' : 'bg-recording pulse-recording'}"></span>
          {timeRec || '0 s'}{paused ? ' - paused' : ''}
        </div>
      {/if}
    {/if}

    <!-- Tags Section -->
    {#if $showTags && tags.length > 0}
      <div class="flex flex-wrap gap-1 {$viewMode === 'grid' ? 'px-3 pb-2' : 'ml-2 mt-1'}">
        {#each tags as tag}
          <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-surface-700/80 border border-white/5 rounded-md text-[9px] text-white/50">
            #{tag}
            <button onclick={() => removeTag(tag)} class="hover:text-red-400 cursor-pointer"><XIcon size={8} /></button>
          </span>
        {/each}
      </div>
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
