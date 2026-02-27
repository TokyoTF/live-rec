<script>
  import { SettingsIcon, Minus, Square, X, InfoIcon, RotateCwIcon } from 'lucide-svelte'
  import { toggleSettings } from '@lib/store.js'
  import { tooltip } from '@lib/tooltip.js'
  import UpdaterModal from '@components/UpdaterModal.svelte'
  import ExtensionsModal from '@components/ExtensionsModal.svelte'
  import Logo from '@assets/icon.png'

  const minimize = () => window.electron.ipcRenderer.send('window:minimize')
  const maximize = () => window.electron.ipcRenderer.send('window:maximize')
  const close = () => window.electron.ipcRenderer.send('window:close')
  const reload = () => window.electron.ipcRenderer.send('window:reload')

  let updaterModalOpen = $state(false)
  let extensionsModalOpen = $state(false)
</script>

<header class="drag-region flex items-center justify-between px-4 py-2.5 bg-surface-800 border-b border-white/5 shrink-0">
  <div class="flex items-center gap-2.5">
    <img width="30" height="30" src={Logo} alt="" />
    <h1 class="text-sm font-bold text-white">Live Rec</h1>
  </div>

  <div class="no-drag flex items-center gap-2">
    <button
      class="p-2 bg-surface-700 hover:bg-surface-600 text-white transition-all cursor-pointer rounded-full"
      use:tooltip={"Settings"}
      onclick={toggleSettings}
    >
      <SettingsIcon size={16} />
    </button>

    <ExtensionsModal bind:showModal={extensionsModalOpen} closeModal={() => (extensionsModalOpen = false)} />

    <button
      class="p-2 bg-surface-700 hover:bg-surface-600 text-white transition-all cursor-pointer rounded-full"
      use:tooltip={"Reload App"}
      onclick={reload}
    >
      <RotateCwIcon size={16} />
    </button>

    <button
      class="p-2 bg-surface-700 hover:bg-surface-600 text-white transition-all cursor-pointer rounded-full mr-2"
      use:tooltip={"About & Updates"}
      onclick={() => (updaterModalOpen = true)}
    >
      <InfoIcon size={16} />
    </button>

    <div class="w-px h-4 bg-white/10 mx-1"></div>

    <button
      class="p-2 hover:bg-surface-600 text-white transition-all cursor-pointer rounded-full"
      use:tooltip={"Minimize"}
      onclick={minimize}
    >
      <Minus size={16} />
    </button>

    <button
      class="p-2 hover:bg-surface-600 text-white transition-all cursor-pointer rounded-full"
      use:tooltip={"Maximize"}
      onclick={maximize}
    >
      <Square size={14} />
    </button>

    <button
      class="p-2 hover:bg-red-600 text-white transition-all cursor-pointer rounded-full"
      use:tooltip={"Close"}
      onclick={close}
    >
      <X size={16} />
    </button>
  </div>
</header>

<UpdaterModal bind:showModal={updaterModalOpen} closeModal={() => updaterModalOpen = false} />
