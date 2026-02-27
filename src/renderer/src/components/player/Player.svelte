<script>
  import { currentStream, recordings, showStats } from '@lib/store.js'
  import { onMount, onDestroy } from 'svelte'

  import 'vidstack/player/styles/base.css'
  import 'vidstack/player/styles/plyr/theme.css'
  import 'vidstack/player'
  import 'vidstack/player/layouts/plyr'
  import 'vidstack/player/ui'

  // Dragging state
  let x = $state(window.innerWidth - 340)
  let y = $state(window.innerHeight - 240)
  let isDragging = $state(false)
  let offset = { x: 0, y: 0 }
  let playerElement = $state()

  function snapToCorner() {
    if (!playerElement) return
    const padding = 20
    const w = playerElement.offsetWidth || 320
    const h = playerElement.offsetHeight || 240

    const corners = [
      { x: padding, y: padding }, // Top-Left
      { x: window.innerWidth - w - padding, y: padding }, // Top-Right
      { x: padding, y: window.innerHeight - h - padding }, // Bottom-Left
      { x: window.innerWidth - w - padding, y: window.innerHeight - h - padding } // Bottom-Right
    ]

    let closestCorner = corners[0]
    let minDistance = Infinity
    
    for (const corner of corners) {
      const dist = Math.hypot(x - corner.x, y - corner.y)
      if (dist < minDistance) {
        minDistance = dist
        closestCorner = corner
      }
    }

    x = closestCorner.x
    y = closestCorner.y
  }

  function onMouseDown(e) {
    isDragging = true
    offset.x = e.clientX - x
    offset.y = e.clientY - y
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function onMouseMove(e) {
    if (!isDragging) return
    x = e.clientX - offset.x
    y = e.clientY - offset.y
  }

  function onMouseUp() {
    isDragging = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    snapToCorner()
  }

  function onMinimized() {
    if (playerElement) {
      const player = playerElement.querySelector('media-player')
      if (player) player.pause()
    }
  }

  onMount(() => {
    window.addEventListener('resize', snapToCorner)
    setTimeout(snapToCorner, 100)

    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('window:minimized', onMinimized)
    }
  })

  onDestroy(() => {
    window.removeEventListener('resize', snapToCorner)

    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.removeListener('window:minimized', onMinimized)
    }
  })

  // Get stats for current stream
  let currentRec = $derived(
    $recordings.find(r => r.nametag === $currentStream.nametag)
  )
  
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div 
  bind:this={playerElement}
  class="fixed z-100 w-80 rounded-xl border border-white/10 bg-surface-800/80 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col group {isDragging ? 'shadow-accent-500/20 ring-1 ring-accent-500/30' : 'hover:shadow-black/40'}"
  style="left: {x}px; top: {y}px; transition: {isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'};"
>
  <!-- Header / Drag handle -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div 
    class="px-3 py-2 border-b border-white/5 flex items-center justify-between cursor-move select-none active:cursor-grabbing bg-surface-700/40"
    onmousedown={onMouseDown}
  >
    <div class="flex items-center gap-2">
      <div class="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(34,211,238,0.5)] {currentRec?.status === 'online' || currentRec?.status === 'private' ? 'pulse-online' : ''}"></div>
      <span class="text-[11px] font-semibold text-white/70 truncate max-w-[180px]">
        {$currentStream.nametag || 'No stream selected'}
      </span>
    </div>
    {#if currentRec?.statusRec}
      <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-recording/30">
        <span class="w-1 h-1 rounded-full bg-recording"></span>
        <span class="text-[9px] font-bold text-white tracking-wider">REC</span>
      </div>
    {/if}
  </div>

  <div class="flex-1 p-1.5 relative">
    {#key $currentStream}
      <media-player
        liveEdgeTolerance={1}
        volume={0.2}
        src={currentRec?.force_type ? { src: $currentStream.url, type: currentRec.force_type } : $currentStream.url}
        crossOrigin={false} 
        streamType="live" 
        autoplay
        class="rounded-lg overflow-hidden aspect-video bg-black/40"
      >
        <media-provider></media-provider>
        <media-plyr-layout></media-plyr-layout>
      </media-player>
    {/key}

    <!-- Stats Overlay -->
    {#if $showStats && currentRec?.statusRec && (currentRec.codec || currentRec.stats)}
      <div class="mt-2 p-2 rounded-lg bg-surface-900/50 backdrop-blur-md border border-white/5 text-[10px] text-white/80 font-mono space-y-1 transition-opacity">
        {#if currentRec.codec}
          <div class="flex justify-between gap-4">
            <span class="text-white/40">CODEC</span>
            <span class="truncate">{currentRec.codec.video}</span>
          </div>
        {/if}
        {#if currentRec.stats}
          <div class="flex justify-between gap-4">
            <span class="text-white/40">BITRATE</span>
            <span>{currentRec.stats.currentKbps} kbps</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-white/40">FPS</span>
            <span>{currentRec.stats.currentFps}</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  :global(media-player) {
    aspect-ratio: 16/9;
    width: 100%;
  }
</style>
