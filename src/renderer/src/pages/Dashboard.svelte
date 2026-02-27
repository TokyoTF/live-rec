<script>
  import StatusBar from '@components/StatusBar.svelte'
  import AddLiveModal from '@components/AddLiveModal.svelte'
  import CamCard from '@components/CamCard.svelte'
  import { 
    recordings, isLoaded, removeOfflineRecordings, updateAllStatus, orderByStatus, setOrderByStatus,
    viewMode, setViewMode, groupBy,
    providers,
    notify
  } from '@lib/store.js'
  import { SettingsIcon, LayoutGrid, LayoutList, RefreshCcwIcon, Trash2Icon, ArrowUpDownIcon } from 'lucide-svelte'
  import { tooltip } from '@lib/tooltip.js'

  let filter = $state('all')

  let filteredRecordings = $derived.by(() => {
    const recs = $recordings
    if (filter === 'all') return recs
    if (filter === 'online') return recs.filter((r) => r.status === 'online')
    if (filter === 'recording') return recs.filter((r) => r.statusRec)
    if (filter === 'offline') return recs.filter((r) => r.status === 'offline' || r.status === 'private')
    return recs
  })

  let groupedRecordings = $derived.by(() => {
    const recs = filteredRecordings
    const groupKey = $groupBy
    if (groupKey === 'none') return null

    const groups = {}
    recs.forEach((rec) => {
      let key = 'Other'
      if (groupKey === 'site') key = rec.provider || 'Other'
      else if (groupKey === 'group') key = rec.group || 'No Group'
      
      if (!groups[key]) groups[key] = []
      groups[key].push(rec)
    })
    return groups
  })

  const filterTabs = [
    { key: 'all', label: 'All' },
    { key: 'online', label: 'Online' },
    { key: 'recording', label: 'Recording' },
    { key: 'offline', label: 'Offline' },
  ]
</script>

<div class="flex flex-col h-full">
  <StatusBar />

  <!-- Toolbar -->
  <div class="flex items-center gap-4 px-4 py-3 border-b border-white/5">
    <!-- Filter tabs: All, Online, Recording, Offline -->
    <div class="flex items-center gap-1.5">
      {#each filterTabs as tab}
        <button
          class="px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer rounded-full {filter === tab.key
            ? 'bg-white text-black'
            : 'bg-surface-700 text-white hover:bg-surface-600'}"
          onclick={() => filter = tab.key}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="flex-1"></div>
    <AddLiveModal />
    <div class="w-px h-5 bg-white/10"></div>
    <!-- Action buttons: Sort, Refresh, Clear Offline -->
    <div class="flex items-center gap-1.5">
      <button 
        onclick={() => setOrderByStatus(!$orderByStatus)}
        class="p-2 transition-all cursor-pointer rounded-full {$orderByStatus ? 'bg-surface-500 text-white' : 'bg-surface-700 hover:bg-surface-600 text-gray-400 hover:text-white'}"
        use:tooltip={"Sort: " + ($orderByStatus ? 'Online First' : 'Default Order')}
      >
        <ArrowUpDownIcon size={16} />
      </button>

      <button onclick={() => { updateAllStatus(); notify('Refreshing all cameras...', 'info', 2000) }} class="p-2 text-white transition-all cursor-pointer bg-surface-700 hover:bg-surface-600 rounded-full" use:tooltip={"Refresh All"}>
        <RefreshCcwIcon size={16} />
      </button>

      {#if filter === 'offline' && filteredRecordings.length > 0}
        <button onclick={() => { removeOfflineRecordings(); notify('Offline cameras cleared', 'success', 2500) }} class="p-2 text-accent-400 transition-all cursor-pointer bg-accent-500/20 hover:bg-accent-500/30 rounded-full" use:tooltip={"Clear Offline"}>
          <Trash2Icon size={16} />
        </button>
      {/if}
    </div>

    <!-- Divider -->
    <div class="w-px h-5 bg-white/10"></div>

    <!-- View Toggle & Add Live -->
    <div class="flex items-center gap-1.5">
    
      <div class="flex items-center bg-surface-700 rounded-lg p-0.5">
        <button
          class="p-1.5 transition-all cursor-pointer rounded-md {$viewMode === 'grid' ? 'bg-surface-500 text-white' : 'text-gray-400 hover:text-white'}"
          onclick={() => setViewMode('grid')}
          use:tooltip={"Grid View"}
        >
          <LayoutGrid size={16} />
        </button>
        <button
          class="p-1.5 transition-all cursor-pointer rounded-md {$viewMode === 'list' ? 'bg-surface-500 text-white' : 'text-gray-400 hover:text-white'}"
          onclick={() => setViewMode('list')}
          use:tooltip={"List View"}
        >
          <LayoutList size={16} />
        </button>
      </div>
      
    </div>
  </div>

  <!-- Snippet definition (must be outside the {#if} chain) -->
  {#snippet camGrid(items)}
    <div class={$viewMode === 'grid' 
      ? "grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3" 
      : "flex flex-col gap-2"}>
      {#each items as item (item.nametag + '-' + item.provider)}
        {#if item.nametag}
          <CamCard
            nametag={item.nametag}
            statusRec={item.statusRec}
            thumb={item.thumb}
            provider={item.provider}
            status={item.status}
            resolutions={item.resolutions}
            timeRec={item.timeFormat}
            paused={item.paused}
            codec={item.codec}
            stats={item.stats}
          />
        {/if}
      {/each}
    </div>
  {/snippet}

  <!-- Grid -->
  <div class="flex-1 overflow-y-auto p-4">
    {#if !$isLoaded}
      <div class="flex items-center justify-center h-full">
        <div class="spinner"></div>
      </div>
    {:else if filteredRecordings.length === 0}
      <div class="flex flex-col items-center justify-center h-full gap-3 text-white/30">
        <SettingsIcon size={40} strokeWidth={1} />
        <p class="text-sm">{filter === 'all' ? 'No cameras added yet' : `No ${filter} cameras`}</p>
        {#if filter === 'all'}
          {#if $providers.length === 0}
            <div class="flex flex-col items-center gap-2 mt-2 px-6 py-4 rounded-2xl bg-accent-500/5 border border-accent-500/10">
              <p class="text-xs text-accent-400 font-medium">No extensions installed</p>
              <p class="text-[10px] text-white/40 text-center max-w-[200px]">Extensions are required to fetch camera information. Open the extensions menu to download them from GitHub.</p>
            </div>
          {:else}
            <p class="text-xs">Click "Add Live" to get started</p>
          {/if}
        {/if}
      </div>
    {:else if !groupedRecordings}
      {@render camGrid(filteredRecordings)}
    {:else}
      <!-- Grouped View -->
      <div class="space-y-8">
        {#each Object.entries(groupedRecordings) as [groupName, items]}
          <div class="space-y-4">
            <div class="flex items-center gap-3 px-1">
              <h3 class="text-sm font-bold text-white/60 uppercase tracking-widest">{groupName}</h3>
              <div class="h-px flex-1 bg-white/5"></div>
              <span class="text-[10px] font-medium text-white/30">{items.length} CAMERAS</span>
            </div>
            
            {@render camGrid(items)}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
