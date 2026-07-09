<script>
  import { recordingHistory, getProviderColor, saveConfig } from '@lib/store.js'
  import { invoke } from '@lib/ipc.js'
  import { Film, Clock, Trash2, HardDrive } from 'lucide-svelte'

  function formatDate(ts) {
    const d = new Date(ts)
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).replace(',', '')
  }

  function formatDuration(ms) {
    if (!ms) return '0s'
    const sec = Math.floor(ms / 1000)
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
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

  function removeRecord(id) {
    recordingHistory.update(h => h.filter(r => r.id !== id))
    saveConfig()
  }

  function clearHistory() {
    recordingHistory.set([])
    saveConfig()
    invoke('thumbnails:clear')
  }

  function getColor(provider) {
    const color = getProviderColor(provider)
    return { backgroundColor: color + '33', color }
  }
</script>

  {#if $recordingHistory.length === 0}
    <div class="flex flex-col items-center justify-center h-full gap-3 text-white/30">
      <Film size={40} strokeWidth={1} />
      <p class="text-sm">No recordings yet</p>
      <p class="text-xs">Completed recordings will appear here</p>
    </div>
  {:else}
    <div class="flex-1 overflow-y-auto p-3 space-y-2">
      {#each $recordingHistory as record (record.id)}
        <div class="flex items-center gap-3 p-2 bg-surface-800 rounded-lg hover:bg-surface-700 transition-colors">
          <div class="w-20 h-12 rounded-md overflow-hidden bg-surface-900 shrink-0 flex items-center justify-center">
            <img
              src={record.thumb?.includes('http')
                ? record.thumb
                : 'liverec://' + record.thumb?.replace(/\\/g, '/')}
              alt={record.nametag}
              class="w-full h-full object-cover"
              onerror={(e) => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='block'; }}
            />
            <span class="text-[10px] text-white/40 text-center hidden">Thumbnail not loaded</span>
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span
                class="text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0"
                style="background-color: {getColor(record.provider).backgroundColor}; color: {getColor(record.provider).color};"
              >
                {record.provider}
              </span>
              <span class="text-sm font-medium text-white/90 truncate">{record.nametag}</span>
            </div>
            <div class="flex items-center gap-2 mt-1 text-[11px] text-white/50">
              <Clock size={12} />
              <span>End Time: {formatDate(record.timestamp)}</span>
              <span class="text-white/30">•</span>
              <span>Recording Duration: {formatDuration(record.duration)}</span>
              {#if record.fileSize}
                <span class="text-white/30">•</span>
                <HardDrive size={12} />
                <span>{formatSize(record.fileSize)}</span>
              {/if}
            </div>
          </div>

          <button
            onclick={() => removeRecord(record.id)}
            class="p-1.5 rounded-full hover:bg-surface-600 text-white/30 hover:text-red-400 transition-colors shrink-0 cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      {/each}
    </div>

    <div class="p-3 border-t border-white/5">
      <button
        onclick={clearHistory}
        class="flex items-center gap-2 px-3 py-2 text-xs text-white/60 hover:text-white bg-surface-800 hover:bg-surface-700 rounded-lg transition-colors"
      >
        <Trash2 size={14} />
        Clear History
      </button>
    </div>
  {/if}
