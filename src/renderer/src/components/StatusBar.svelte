<script>
  import { onlineCount, recordingCount, totalCount, offlineCount, privateCount, sessionRecordedToday, sessionActiveTime, sessionTotalTime, totalRecordingSize } from '@lib/store.js'
  import { CircleIcon, CircleDotIcon, ListIcon, Clock, Activity, HardDrive, EyeOff, Lock } from 'lucide-svelte'

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

  function formatSize(bytes) {
    if (!bytes || bytes <= 0) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
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
    <Lock size={10} class="text-yellow-500" />
    <span class="font-bold">{$privateCount}</span>
    <span class="text-gray-400">Private</span>
  </div>

  <div class="flex items-center gap-1.5 text-xs text-white">
    <CircleIcon size={10} class="text-gray-500 fill-gray-500" />
    <span class="font-bold">{$offlineCount}</span>
    <span class="text-gray-400">Offline</span>
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
    <span class="font-bold">{$sessionRecordedToday}</span>
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

  {#if $recordingCount > 0}
    <div class="flex items-center gap-1.5 text-xs text-white">
      <HardDrive size={10} class="text-purple-400" />
      <span class="font-bold">{formatSize($totalRecordingSize)}</span>
      <span class="text-gray-400">Size</span>
    </div>
  {/if}
</div>
