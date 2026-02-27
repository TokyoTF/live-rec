<script>
  import { onMount, onDestroy } from 'svelte'
  import { Monitor, Radio, Layout, ExternalLink, Power } from 'lucide-svelte'

  let online = $state(0)
  let recording = $state(0)
  let total = $state(0)
  let unsub
  let pollTimer

  function showApp() {
    window.electron.ipcRenderer.send('tray:show-app')
  }

  function quitApp() {
    window.electron.ipcRenderer.send('tray:quit-app')
  }

  function requestStats() {
    window.electron.ipcRenderer.send('tray:get-stats')
  }

  onMount(() => {
    unsub = window.electron.ipcRenderer.on('tray:stats-reply', (_event, data) => {
      online = data.online
      recording = data.recording
      total = data.total
    })

    requestStats()
    pollTimer = setInterval(requestStats, 12000)
  })

  onDestroy(() => {
    if (unsub) unsub()
    if (pollTimer) clearInterval(pollTimer)
  })
</script>

<div
  class="h-screen w-full bg-surface-900 text-white/90 font-sans flex flex-col p-3 select-none overflow-hidden rounded-xl border border-white/10 shadow-2xl box-border"
>
  <!-- Header -->
  <div class="flex items-center gap-2 px-1 mb-3">
    <div class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
    <span class="text-xs font-bold uppercase tracking-wider text-white/50">Live Rec Status</span>
  </div>

  <!-- Stats Grid -->
  <div class="grid grid-cols-1 gap-1.5 mb-3">
    <div
      class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5"
    >
      <div class="flex items-center gap-2.5">
        <Monitor size={14} class="text-blue-400" />
        <span class="text-xs font-medium text-white/70">Online</span>
      </div>
      <span class="text-xs font-bold text-blue-400">{online}</span>
    </div>

    <div
      class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5"
    >
      <div class="flex items-center gap-2.5">
        <Radio size={14} class="text-red-400" />
        <span class="text-xs font-medium text-white/70">Recording</span>
      </div>
      <span class="text-xs font-bold text-red-400">{recording}</span>
    </div>

    <div
      class="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5"
    >
      <div class="flex items-center gap-2.5">
        <Layout size={14} class="text-purple-400" />
        <span class="text-xs font-medium text-white/70">Total Cams</span>
      </div>
      <span class="text-xs font-bold text-purple-400">{total}</span>
    </div>
  </div>

  <div class="h-px bg-white/5 mb-2 mx-1"></div>

  <!-- Actions -->
  <div class="flex flex-col gap-1">
    <button
      onclick={showApp}
      class="flex items-center gap-3 px-3 py-2 text-xs font-medium text-left hover:bg-white/10 rounded-lg transition-all active:scale-95 text-white/80 hover:text-white"
    >
      <ExternalLink size={14} class="text-accent-400" />
      Show App
    </button>

    <button
      onclick={quitApp}
      class="flex items-center gap-3 px-3 py-2 text-xs font-medium text-left hover:bg-red-500/10 hover:text-red-400 rounded-lg transition-all active:scale-95 text-white/60 group"
    >
      <Power size={14} class="group-hover:text-red-400" />
      Quit App
    </button>
  </div>
</div>

<style>
  :global(html),
  :global(body) {
    background-color: transparent !important;
    overflow: hidden;
  }
</style>
