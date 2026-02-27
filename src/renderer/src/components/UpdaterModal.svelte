<script>
  import { onMount, onDestroy } from 'svelte'
  import { send, on } from '@lib/ipc.js'
  import { XIcon, DownloadIcon, CheckCircle2Icon, AlertCircleIcon, InfoIcon } from 'lucide-svelte'
  import { notify } from '@lib/store.js'
  import { tooltip } from '@lib/tooltip.js'

  let { showModal = $bindable(false), closeModal = () => {} } = $props()

  let status = $state('idle') // idle, checking, available, downloading, downloaded, error, not_available
  let progress = $state(0)
  let versionInUse = $state('')
  let updateInfo = $state(null)
  let errorMsg = $state('')

  let unsubs = []

  onMount(() => {
    // Get current version synchronously via IPC
    versionInUse = window.electron.ipcRenderer.sendSync('app:version')

    unsubs.push(on('updater:available', (_e, info) => {
      status = 'available'
      updateInfo = info
      notify(`Update ${info.version} available!`, 'success')
      showModal = true // Show modal automatically if update is available
    }))

    unsubs.push(on('updater:not-available', () => {
      status = 'not_available'
      notify('You are using the latest version.', 'info')
    }))

    unsubs.push(on('updater:error', (_e, err) => {
      status = 'error'
      errorMsg = err
      notify('Error checking for updates', 'error')
    }))

    unsubs.push(on('updater:progress', (_e, prog) => {
      status = 'downloading'
      progress = prog.percent
    }))

    unsubs.push(on('updater:downloaded', (_e, info) => {
      status = 'downloaded'
      updateInfo = info
      notify('Update downloaded and ready to install!', 'success', 0) // No auto-dismiss
    }))
  })

  onDestroy(() => {
    unsubs.forEach(u => u())
  })

  function checkUpdate() {
    status = 'checking'
    send('updater:check')
  }

  function downloadUpdate() {
    status = 'downloading'
    progress = 0
    send('updater:download')
  }

  function installUpdate() {
    send('updater:install')
  }

  // Effect to handle opening the modal
  $effect(() => {
    if (showModal && status === 'idle') {
      checkUpdate()
    }
  })
</script>

{#if showModal}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm" onclick={closeModal}>
    <div
      class="bg-surface-800 border border-white/10 rounded-2xl p-6 w-[400px] shadow-2xl shadow-black/40"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-[15px] font-bold text-white/90">About & Updates</h2>
        <button
          class="p-1.5 rounded-lg hover:bg-surface-600 text-white/40 hover:text-white/80 transition-all cursor-pointer"
          onclick={closeModal}
        >
          <XIcon size={18} />
        </button>
      </div>

      <!-- Current Version -->
      <div class="flex items-center gap-3 p-4 mb-6 rounded-xl bg-surface-700/50 border border-white/5">
        <div class="p-2 rounded-full bg-surface-600 text-white/70">
          <InfoIcon size={24} />
        </div>
        <div>
          <h3 class="font-semibold text-white/90">Live Rec</h3>
          <p class="text-xs text-white/50">Version {versionInUse}</p>
        </div>
      </div>

      <!-- Update Status Area -->
      <div class="space-y-4">
        {#if status === 'checking'}
          <div class="flex flex-col items-center justify-center py-6">
            <div class="spinner w-8! h-8! border-[3px]! m-0! mb-4"></div>
            <p class="text-sm font-medium text-white/60">Checking for updates...</p>
          </div>
        {:else if status === 'not_available'}
          <div class="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle2Icon size={40} class="text-green-500 mb-3" />
            <p class="text-sm font-bold text-white/90">You're up to date!</p>
            <p class="text-xs text-white/50 mt-1">Live Rec is running the latest version.</p>
            <button
              class="mt-5 px-6 py-2 rounded-full bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium transition-all"
              onclick={closeModal}
            >
              Close
            </button>
          </div>
        {:else if status === 'available'}
          <div class="space-y-4">
            <div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <h3 class="text-sm font-bold text-blue-400 mb-1">New Update Available!</h3>
              <p class="text-xs text-white/70">Version {updateInfo?.version || 'Unknown'} is ready to download.</p>
            </div>
            <button
              class="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all cursor-pointer shadow-lg shadow-blue-900/40"
              onclick={downloadUpdate}
            >
              <DownloadIcon size={16} /> Download Update
            </button>
          </div>
        {:else if status === 'downloading'}
          <div class="space-y-3">
            <div class="flex justify-between text-xs text-white/70">
              <span>Downloading update...</span>
              <span class="font-bold">{Math.round(progress)}%</span>
            </div>
            <!-- Progress bar background -->
            <div class="w-full h-2 bg-surface-900 rounded-full overflow-hidden">
              <!-- Progress bar fill -->
              <div 
                class="h-full bg-blue-500 rounded-full transition-all duration-300 relative overflow-hidden"
                style="width: {progress}%"
              >
                <!-- Shimmer effect -->
                <div class="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
              </div>
            </div>
          </div>
        {:else if status === 'downloaded'}
          <div class="space-y-4 text-center">
            <CheckCircle2Icon size={40} class="text-green-500 mx-auto mb-2" />
            <p class="text-sm font-bold text-white/90">Update Ready to Install</p>
            <p class="text-xs text-white/50">The application will restart to apply the update.</p>
            
            <button
              class="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-all cursor-pointer shadow-lg shadow-green-900/40 mt-2"
              onclick={installUpdate}
            >
              Restart and Install
            </button>
          </div>
        {:else if status === 'error'}
          <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center space-y-3">
            <AlertCircleIcon size={32} class="text-red-400 mx-auto" />
            <div>
              <p class="text-sm font-bold text-red-400">Update Failed</p>
              <p class="text-xs text-white/60 mt-1 line-clamp-2" use:tooltip={errorMsg}>{errorMsg}</p>
            </div>
            <button
              class="px-5 py-2 mt-2 rounded-full bg-surface-700 hover:bg-surface-600 text-white text-xs font-medium transition-all"
              onclick={checkUpdate}
            >
              Try Again
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
