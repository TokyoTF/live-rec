<script>
  import { recordingHistory, getProviderColor, saveConfig } from '@lib/store.js'
  import { invoke } from '@lib/ipc.js'
  import { Film, Clock, Trash2 } from 'lucide-svelte'

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

<div class="flex flex-col h-full">
  {#if $recordingHistory.length === 0}
    <div class="flex flex-col items-center justify-center h-full gap-3 text-white/30">
      <Film size={40} strokeWidth={1} />
      <p class="text-sm">No recordings yet</p>
      <p class="text-xs">Completed recordings will appear here</p>
    </div>
  {:else}
    <div class="max-h-[70vh] flex-1 overflow-y-auto p-3 space-y-2">
      {#each $recordingHistory as record (record.id)}
        <div class="flex items-center gap-3 p-2 bg-surface-800 rounded-lg hover:bg-surface-700 transition-colors">
          <div class="w-20 h-12 rounded-md overflow-hidden bg-surface-900 shrink-0">
            <img
              src={record.thumb?.includes('http')
                ? record.thumb
                : 'liverec://' + record.thumb?.replace(/\\/g, '/')}
              alt={record.nametag}
              class="w-full h-full object-cover"
            />
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
            </div>
          </div>
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
</div>
