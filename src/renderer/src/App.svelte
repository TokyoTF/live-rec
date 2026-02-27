<script>
  import { onDestroy, onMount } from 'svelte'
  import Header from '@components/Header.svelte'
  import Player from '@components/player/Player.svelte'
  import Dashboard from '@pages/Dashboard.svelte'
  import Settings from '@pages/Settings.svelte'
  import TrayMenu from '@components/TrayMenu.svelte'
  import Toast from '@components/Toast.svelte'
  import { 
    init, destroy, 
    getOnlineCount, getRecordingCount, getTotalCount 
  } from '@lib/store.js'
  import { on, send } from '@lib/ipc.js'

  let isTray = false
  let unsubStats

  onMount(() => {
    isTray = window.location.hash === '#tray'
    if (!isTray) {
      // Initialize state and listeners
      init()

      // Respond to tray window stats requests
      unsubStats = on('tray:get-stats', () => {
        send('tray:stats-reply', {
          online: getOnlineCount(),
          recording: getRecordingCount(),
          total: getTotalCount()
        })
      })
    }
  })

  onDestroy(() => {
    if (!isTray) {
      destroy()
      if (unsubStats) unsubStats()
    }
  })
</script>

{#if isTray}
  <main class="h-screen w-screen overflow-hidden bg-transparent">
    <TrayMenu />
  </main>
{:else}
  <main class="flex flex-col h-screen bg-surface-900 text-white/90 font-sans">
    <Header />

    <div class="flex flex-1 overflow-hidden">
      <!-- Main Views -->
      <div class="flex-1 overflow-hidden flex flex-col relative">
        <Dashboard />
        <Settings />
      </div>

      <!-- Mini Player (always visible) -->
      <Player />
    </div>
  </main>
{/if}

<Toast />
