<script>
  import { recordingHistory, recordings, sessionRecordedToday, sessionTotalTime, sessionActiveTime, totalRecordingSize, onlineCount, recordingCount, totalCount, getProviderColor } from '@lib/store.js'
  import { BarChart3, Clock, HardDrive, Film, Activity, Globe } from 'lucide-svelte'

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

  let totalHistoryDuration = $derived(
    $recordingHistory.reduce((sum, r) => sum + (r.duration || 0), 0)
  )

  let avgDuration = $derived(
    $recordingHistory.length > 0 ? totalHistoryDuration / $recordingHistory.length : 0
  )

  let providerStats = $derived(() => {
    const stats = {}
    for (const r of $recordingHistory) {
      if (!stats[r.provider]) stats[r.provider] = { count: 0, duration: 0 }
      stats[r.provider].count++
      stats[r.provider].duration += r.duration || 0
    }
    return Object.entries(stats).sort((a, b) => b[1].count - a[1].count)
  })

  let todayDuration = $derived(
    $recordingHistory
      .filter(r => r.timestamp && new Date(r.timestamp).toDateString() === new Date().toDateString())
      .reduce((sum, r) => sum + (r.duration || 0), 0)
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
      <div class="text-2xl font-bold text-white">{$recordingHistory.length}</div>
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
        <div class="text-lg font-bold text-white">{formatDuration(totalHistoryDuration)}</div>
      </div>
      <div>
        <div class="text-[11px] text-white/40 mb-1">Average Duration</div>
        <div class="text-lg font-bold text-white">{formatDuration(avgDuration)}</div>
      </div>
      <div>
        <div class="text-[11px] text-white/40 mb-1">Unique Models</div>
        <div class="text-lg font-bold text-white">{new Set($recordingHistory.map(r => r.nametag)).size}</div>
      </div>
    </div>
  </div>

  <!-- Per Provider Stats -->
  {#if providerStats().length > 0}
    <div class="p-4 rounded-xl bg-surface-800 border border-white/5">
      <h3 class="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">By Provider</h3>
      <div class="space-y-2">
        {#each providerStats() as [provider, stats]}
          {@const color = getProviderColor(provider)}
          {@const maxCount = providerStats()[0][1].count}
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
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
