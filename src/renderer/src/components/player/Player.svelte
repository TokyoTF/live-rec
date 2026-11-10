<script>
  import { currentStream, recordings, playerHidden, refreshCurrentStreamUrl } from '@lib/store.js'
  import { EyeOff } from 'lucide-svelte'
  import { onMount, onDestroy } from 'svelte'
  import { get } from 'svelte/store'

  import '@videojs/html/live-video/player'
  import '@videojs/html/live-video/neutral-skin'
  import '@videojs/html/media/hlsjs-video'
  import { resolveAdapterType } from '@videojs/html'

  // Dragging state
  let x = $state(window.innerWidth - 340)
  let y = $state(window.innerHeight - 240)
  let isDragging = $state(false)
  let offset = { x: 0, y: 0 }
  let dragOrigin = { x: 0, y: 0 }
  let moved = false
  let suppressClick = false
  let playerElement = $state()
  // Data/blob URLs are self-contained and don't carry expiring tokens.
  function needsUrlRefresh(url) {
    return typeof url === 'string' && url.length > 0 && !url.startsWith('data:') && !url.startsWith('blob:')
  }

  // Start in "refreshing" state when there is a stored URL: on mount we
  // re-extract a fresh URL before letting the media element load.
  let refreshing = $state(needsUrlRefresh(get(currentStream).url))

  function clampToBounds() {
    if (!playerElement) return
    const padding = 20
    const w = playerElement.offsetWidth || 320
    const h = playerElement.offsetHeight || 240
    const maxX = window.innerWidth - w - padding
    const maxY = window.innerHeight - h - padding

    x = Math.max(padding, Math.min(x, maxX))
    y = Math.max(padding, Math.min(y, maxY))
  }

  function snapToCorner() {
    if (!playerElement) return
    const padding = 20
    const w = playerElement.offsetWidth || 320
    const h = playerElement.offsetHeight || 240

    let clampedX = Math.max(padding, Math.min(x, window.innerWidth - w - padding))
    let clampedY = Math.max(padding+70, Math.min(y, window.innerHeight - h - padding+70))

    const corners = [
      { x: padding, y: padding+70 },
      { x: window.innerWidth - w - padding, y: padding+70 },
      { x: padding, y: window.innerHeight - h - padding },
      { x: window.innerWidth - w - padding, y: window.innerHeight - h - padding }
    ]

    let closestCorner = corners[0]
    let minDistance = Infinity

    for (const corner of corners) {
      const dist = Math.hypot(clampedX - corner.x, clampedY - corner.y)
      if (dist < minDistance) {
        minDistance = dist
        closestCorner = corner
      }
    }

    x = closestCorner.x
    y = closestCorner.y
  }

  // Ignore drags that start on the player's own controls (bottom bar, sliders,
  // menus...) so seeking/volume still work. The skin lives in an open shadow
  // root, so composedPath exposes those elements.
  function isPlayerControl(e) {
    return e.composedPath().some((el) => {
      const name = el?.localName
      return typeof name === 'string' && /^media-(controls|button|slider|menu|popover|tooltip|dialog)/.test(name)
    })
  }

  function onMouseDown(e) {
    if (e.button !== 0 || isPlayerControl(e)) return
    isDragging = true
    moved = false
    dragOrigin = { x: e.clientX, y: e.clientY }
    offset.x = e.clientX - x
    offset.y = e.clientY - y
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function onMouseMove(e) {
    if (!isDragging) return
    if (!moved && Math.hypot(e.clientX - dragOrigin.x, e.clientY - dragOrigin.y) < 4) return
    moved = true
    x = e.clientX - offset.x
    y = e.clientY - offset.y
  }

  function onMouseUp() {
    isDragging = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    if (moved) {
      snapToCorner()
      // The click that follows this mouseup must not hide the player.
      suppressClick = true
      setTimeout(() => { suppressClick = false }, 0)
    }
  }

  function onHideClick() {
    if (suppressClick) return
    playerHidden.set(true)
  }

  function onMinimized() {
    if (playerElement) {
      const player = playerElement.querySelector('live-video-player')
      if (player?.store?.pause) player.store.pause()
    }
  }

  function onFullscreenChange() {
    if (!document.fullscreenElement) {
      setTimeout(clampToBounds, 100)
    }
  }


  onMount(() => {
    window.addEventListener('resize', snapToCorner)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    setTimeout(snapToCorner, 100)

    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.on('window:minimized', onMinimized)
    }

    // Re-extract the stream URL before mounting the media element: HLS tokens
    // (chaturbate) expire, and a hidden player remounts much later with a
    // stale URL, failing with a 403 on the manifest.
    if (refreshing) {
      refreshCurrentStreamUrl().finally(() => { refreshing = false })
    }
  })

  onDestroy(() => {
    window.removeEventListener('resize', snapToCorner)
    document.removeEventListener('fullscreenchange', onFullscreenChange)

    if (window.electron && window.electron.ipcRenderer) {
      window.electron.ipcRenderer.removeListener('window:minimized', onMinimized)
    }
  })

  function onMediaLoadStart(event) {
    const media = event.currentTarget
    if (media) media.volume = 0.2
  }

  function setHlsSource(node, src) {
    node.source = { src, type: 'application/vnd.apple.mpegurl' }
    return {
      update(newSrc) {
        node.source = { src: newSrc, type: 'application/vnd.apple.mpegurl' }
      }
    }
  }

  const blobUrlCache = new Map()
  function toPlayableUrl(url) {
    if (!url?.startsWith('data:')) return url
    if (blobUrlCache.has(url)) return blobUrlCache.get(url)
    const [meta, b64] = url.split(',')
    const mime = meta.match(/data:([^;]+)/)?.[1] || 'application/x-mpegurl'
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }))
    blobUrlCache.set(url, objectUrl)
    return objectUrl
  }

  let currentRec = $derived($recordings.find((r) => r.nametag === $currentStream.nametag))
  let adapterType = $derived(
    ($currentStream.url && ($currentStream.url.startsWith('data:') || $currentStream.url.startsWith('blob:')))
      ? 'hls'
      : currentRec?.force_type && /mpeg|m3u/i.test(currentRec.force_type)
        ? 'hls'
        : resolveAdapterType($currentStream.url, currentRec?.force_type || undefined)
  )
  let mediaSrc = $derived(toPlayableUrl($currentStream.url))
  let hasMedia = $derived(!refreshing && typeof mediaSrc === 'string' && mediaSrc.trim().length > 0)
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  bind:this={playerElement}
  class="fixed z-100 w-80 rounded-xl border border-white/10 bg-surface-800/80 backdrop-blur-xl shadow-2xl overflow-hidden {isDragging
    ? 'shadow-accent-500/20 ring-1 ring-accent-500/30'
    : 'hover:shadow-black/40'}"
  style="left: {x}px; top: {y}px; transition: {isDragging
    ? 'none'
    : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'};"
>
  <!-- Video only: the eye is the single control and floats over the video -->
  <div class="relative cursor-move" onmousedown={onMouseDown}>
    {#if hasMedia}
      {#key $currentStream}
        <live-video-player
          content-title={$currentStream.nametag || ''}
        >
          <live-video-neutral-skin style="display: block; width: 100%; aspect-ratio: 16 / 9;" class="overflow-hidden bg-black/40">
            {#if adapterType === 'hls'}
              <hlsjs-video
                use:setHlsSource={mediaSrc}
                stream-type="live"
                playsinline
                disableremoteplayback
                autoplay
                onloadstart={onMediaLoadStart}
              ></hlsjs-video>
            {:else}
              <!-- svelte-ignore a11y_media_has_caption -->
              <video
                src={mediaSrc}
                playsinline
                disableremoteplayback
                autoplay
                onloadstart={onMediaLoadStart}
              ></video>
            {/if}
          </live-video-neutral-skin>
        </live-video-player>
      {/key}
    {:else}
      <div class="w-full aspect-video bg-black/40 flex items-center justify-center select-none">
        <span class="text-[11px] text-white/40">{refreshing ? 'Loading stream…' : 'No stream selected'}</span>
      </div>
    {/if}

    <button
      onclick={onHideClick}
      title="Hide player"
      aria-label="Hide player"
      class="absolute top-2 right-2 z-20 p-1.5 rounded-md border border-white/10 bg-black/35 hover:bg-black/70 backdrop-blur-sm text-white/70 hover:text-white shadow-lg transition-all cursor-pointer"
    >
      <EyeOff size={12} />
    </button>
  </div>
</div>

<style>
  :global(live-video-neutral-skin) {
    border-radius: 8px;
    overflow: hidden;
  }
</style>
