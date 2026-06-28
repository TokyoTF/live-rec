<script>
  import { onlineCount, recordingCount, totalCount, sessionRecordedToday, sessionActiveTime, sessionTotalTime } from '@lib/store.js'
  import { CircleIcon, CircleDotIcon, ListIcon, Clock, Activity, HardDrive } from 'lucide-svelte'

  function formatDuration(ms) {
    if (!ms || ms <= 0) return '0s'
    const totalSec = Math.floor(ms / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  function formatMinutes(ms) {
    if (!ms || ms <= 0) return '0m'
    const totalMin = Math.floor(ms / 60000)
    if (totalMin >= 60) {
      const h = Math.floor(totalMin / 60)
      const m = totalMin % 60
      return `${h}h ${m}m`
    }
    return `${totalMin}m`
  }
</script>

<div class="flex items-center gap-4 px-4 py-2 bg-surface-800 border-b border-surface-600">
  <div class="flex items-center gap-1.5 text-xs text-white">
    <CircleIcon size={10} class="text-green-500 fill-green-500" />
    <span class="font-bold">{$onlineCount}</span>
    <span class="text-gray-400">Online</span>
  </div>

  <div class="flex items-center gap-1.5 text-xs text-white">
    <CircleDotIcon size={10} class="text-red-500" />
    <span class="font-bold">{$recordingCount}</span>
    <span class="text-gray-400">Recording</span>
  </div>

  <div class="flex items-center gap-1.5 text-xs text-white">
    <ListIcon size={10} class="text-gray-400" />
    <span class="font-bold">{$totalCount}</span>
    <span class="text-gray-400">Total</span>
  </div>

  <div class="w-px h-4 bg-white/10"></div>

  <!-- Session Stats -->
  <div class="flex items-center gap-1.5 text-xs text-white">
    <HardDrive size={10} class="text-blue-400" />
    <span class="font-bold">{sessionRecordedToday}</span>
    <span class="text-gray-400">Today</span>
  </div>

  <div class="flex items-center gap-1.5 text-xs text-white">
    <Clock size={10} class="text-amber-400" />
    <span class="font-bold">{formatMinutes($sessionTotalTime)}</span>
    <span class="text-gray-400">Recorded</span>
  </div>

  {#if $sessionActiveTime > 0}
    <div class="flex items-center gap-1.5 text-xs text-white">
      <Activity size={10} class="text-emerald-400" />
      <span class="font-bold">{formatDuration($sessionActiveTime)}</span>
      <span class="text-gray-400">Active</span>
    </div>
  {/if}
</div>
