<script>
  import { recordingHistory, recordings, sessionRecordedToday, sessionTotalTime, sessionActiveTime, totalRecordingSize, onlineCount, recordingCount, totalCount, getProviderColor, allTimeStats } from '@lib/store.js'
  import { BarChart3, Clock, HardDrive, Film, Activity, Globe, Heart, Database, User } from 'lucide-svelte'

  let modelSortBy = $state('count')

  function formatDuration(ms) {
    if (!ms || ms <= 0) return '0s'
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    const parts = []
    if (h > 0) parts.push(`${h}h`)
    if (m > 0) parts.push(`${m}m`)
    if (s > 0 || parts.length === 0) parts.push(`${s}s`)
    return parts.join(' ')
  }

  function formatSize(bytes) {
    if (!bytes || bytes <= 0) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  let todayDuration = $derived(
    $recordingHistory
      .filter(r => r.timestamp && new Date(r.timestamp).toDateString() === new Date().toDateString())
      .reduce((sum, r) => sum + (r.duration || 0), 0)
  )

  let avgDuration = $derived(
    $allTimeStats.totalSessions > 0 ? $allTimeStats.totalDuration / $allTimeStats.totalSessions : 0
  )

  let uniqueModels = $derived(Object.keys($allTimeStats.models || {}).length)

  let favoriteModel = $derived(() => {
    const entries = Object.entries($allTimeStats.models || {})
    if (entries.length === 0) return null
    return entries.sort((a, b) => b[1].count - a[1].count)[0]
  })

  let providerStats = $derived(
    Object.entries($allTimeStats.providers || {}).sort((a, b) => b[1].count - a[1].count)
  )

  let modelStats = $derived(
    Object.entries($allTimeStats.models || {}).sort((a, b) => {
      if (modelSortBy === 'count') return b[1].count - a[1].count
      if (modelSortBy === 'duration') return b[1].duration - a[1].duration
      return (b[1].totalDataRecorded || 0) - (a[1].totalDataRecorded || 0)
    })
  )
</script>

<div class="flex-1 overflow-y-auto p-4 space-y-4">
  <!-- Overview Cards -->
  <div class="grid grid-cols-4 gap-3">
    <div class="p-3 rounded-xl bg-surface-800 border border-white/5">
      <div class="flex items-center gap-2 mb-2">
        <Globe size={14} class="text-green-400" />
        <span class="text-[11px] text-white/50 font-medium">Online</span>
      </div>
      <div class="text-2xl font-bold text-white">{$onlineCount}</div>
      <div class="text-[10px] text-white/30 mt-1">of {$totalCount} total</div>
    </div>

    <div class="p-3 rounded-xl bg-surface-800 border border-white/5">
      <div class="flex items-center gap-2 mb-2">
        <Activity size={14} class="text-red-400" />
        <span class="text-[11px] text-white/50 font-medium">Recording</span>
      </div>
      <div class="text-2xl font-bold text-white">{$recordingCount}</div>
      <div class="text-[10px] text-white/30 mt-1">active streams</div>
    </div>

    <div class="p-3 rounded-xl bg-surface-800 border border-white/5">
      <div class="flex items-center gap-2 mb-2">
        <HardDrive size={14} class="text-purple-400" />
        <span class="text-[11px] text-white/50 font-medium">Current Size</span>
      </div>
      <div class="text-2xl font-bold text-white">{formatSize($totalRecordingSize)}</div>
      <div class="text-[10px] text-white/30 mt-1">live recording</div>
    </div>

    <div class="p-3 rounded-xl bg-surface-800 border border-white/5">
      <div class="flex items-center gap-2 mb-2">
        <Film size={14} class="text-blue-400" />
        <span class="text-[11px] text-white/50 font-medium">Total Sessions</span>
      </div>
      <div class="text-2xl font-bold text-white">{$allTimeStats.totalSessions}</div>
      <div class="text-[10px] text-white/30 mt-1">all time</div>
    </div>
  </div>

  <!-- Session Stats -->
  <div class="p-4 rounded-xl bg-surface-800 border border-white/5">
    <h3 class="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">Today's Session</h3>
    <div class="grid grid-cols-3 gap-4">
      <div>
        <div class="text-[11px] text-white/40 mb-1">Recordings Today</div>
        <div class="text-lg font-bold text-white">{$sessionRecordedToday}</div>
      </div>
      <div>
        <div class="text-[11px] text-white/40 mb-1">Total Duration Today</div>
        <div class="text-lg font-bold text-white">{formatDuration(todayDuration)}</div>
      </div>
      <div>
        <div class="text-[11px] text-white/40 mb-1">Active Time</div>
        <div class="text-lg font-bold text-white">{formatDuration($sessionActiveTime)}</div>
      </div>
    </div>
  </div>

  <!-- All Time Stats -->
  <div class="p-4 rounded-xl bg-surface-800 border border-white/5">
    <h3 class="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">All Time</h3>
    <div class="grid grid-cols-3 gap-4">
      <div>
        <div class="text-[11px] text-white/40 mb-1">Total Duration</div>
        <div class="text-lg font-bold text-white">{formatDuration($allTimeStats.totalDuration)}</div>
      </div>
      <div>
        <div class="text-[11px] text-white/40 mb-1">Average Duration</div>
        <div class="text-lg font-bold text-white">{formatDuration(avgDuration)}</div>
      </div>
      <div>
        <div class="text-[11px] text-white/40 mb-1">Unique Models</div>
        <div class="text-lg font-bold text-white">{uniqueModels}</div>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-white/5">
      <div class="flex items-center gap-3">
        <Heart size={16} class="text-pink-400 shrink-0" />
        <div>
          <div class="text-[11px] text-white/40 mb-1">Favorite Model</div>
          {#if favoriteModel()}
            <div class="text-lg font-bold text-white">{favoriteModel()[0]}</div>
            <div class="text-[10px] text-white/30">{favoriteModel()[1].count} recordings</div>
          {:else}
            <div class="text-lg font-bold text-white/30">—</div>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-3">
        <Database size={16} class="text-cyan-400 shrink-0" />
        <div>
          <div class="text-[11px] text-white/40 mb-1">Total Data Recorded</div>
          <div class="text-lg font-bold text-white">{formatSize($allTimeStats.totalDataRecorded)}</div>
          <div class="text-[10px] text-white/30">all sessions</div>
        </div>
      </div>
    </div>
  </div>

  <!-- Per Provider Stats -->
  {#if providerStats.length > 0}
    <div class="p-4 rounded-xl bg-surface-800 border border-white/5">
      <h3 class="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">By Provider</h3>
      <div class="space-y-2">
        {#each providerStats as [provider, stats]}
          {@const color = getProviderColor(provider)}
          {@const maxCount = providerStats[0][1].count}
          <div class="flex items-center gap-3">
            <span
              class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md w-24 text-center shrink-0"
              style="background-color: {color}33; color: {color};"
            >
              {provider}
            </span>
            <div class="flex-1 h-5 bg-surface-900 rounded-md overflow-hidden">
              <div
                class="h-full rounded-md transition-all duration-500"
                style="width: {(stats.count / maxCount) * 100}%; background-color: {color}40;"
              ></div>
            </div>
            <div class="text-right shrink-0 w-32">
              <span class="text-xs font-bold text-white">{stats.count}</span>
              <span class="text-[10px] text-white/40"> recordings</span>
              <span class="text-[10px] text-white/30 ml-2">{formatDuration(stats.duration)}</span>
              <span class="text-[10px] text-white/30 ml-2">{formatSize(stats.totalDataRecorded || 0)}</span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Model List -->
  {#if modelStats.length > 0}
    <div class="p-4 rounded-xl bg-surface-800 border border-white/5">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-bold text-white/60 uppercase tracking-widest">Models</h3>
        <div class="flex items-center gap-1">
          <span class="text-[10px] text-white/30 mr-1">Sort:</span>
          <button
            onclick={() => modelSortBy = 'count'}
            class="px-2 py-0.5 text-[10px] rounded-md transition-all cursor-pointer {modelSortBy === 'count' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}"
          >Recordings</button>
          <button
            onclick={() => modelSortBy = 'duration'}
            class="px-2 py-0.5 text-[10px] rounded-md transition-all cursor-pointer {modelSortBy === 'duration' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}"
          >Duration</button>
          <button
            onclick={() => modelSortBy = 'size'}
            class="px-2 py-0.5 text-[10px] rounded-md transition-all cursor-pointer {modelSortBy === 'size' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}"
          >Size</button>
        </div>
        <span class="text-[10px] text-white/30">{modelStats.length} models</span>
      </div>
      <div class="space-y-1 max-h-80 overflow-y-auto">
        {#each modelStats as [nametag, stats], i}
          {@const color = getProviderColor(stats.provider)}
          {@const maxValue = modelSortBy === 'count' ? modelStats[0][1].count : modelSortBy === 'duration' ? modelStats[0][1].duration : (modelStats[0][1].totalDataRecorded || 0)}
          {@const barValue = modelSortBy === 'count' ? stats.count : modelSortBy === 'duration' ? stats.duration : (stats.totalDataRecorded || 0)}
          <div class="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-700 transition-colors">
            <span class="text-[10px] text-white/30 w-5 text-right shrink-0">{i + 1}</span>
            <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style="background-color: {color}33;">
              <User size={12} style="color: {color};" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-xs font-medium text-white truncate">{nametag}</div>
              <div class="text-[10px] text-white/30">{stats.provider}</div>
            </div>
            <div class="flex items-center gap-3 shrink-0">
              <div class="text-right">
                <div class="text-xs font-bold text-white">{stats.count}</div>
                <div class="text-[10px] text-white/30">recordings</div>
              </div>
              <div class="text-right w-16">
                <div class="text-xs font-bold text-white">{formatDuration(stats.duration)}</div>
                <div class="text-[10px] text-white/30">duration</div>
              </div>
              <div class="text-right w-20">
                <div class="text-xs font-bold text-white">{formatSize(stats.totalDataRecorded || 0)}</div>
                <div class="text-[10px] text-white/30">size</div>
              </div>
              <div class="w-20 h-1.5 bg-surface-900 rounded-full overflow-hidden shrink-0">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  style="width: {maxValue > 0 ? (barValue / maxValue) * 100 : 0}%; background-color: {color};"
                ></div>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
