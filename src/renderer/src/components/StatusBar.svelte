<script>
  import { onlineCount, recordingCount, totalCount } from '@lib/store.js'
  import { CircleIcon, CircleDotIcon, ListIcon } from 'lucide-svelte'
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
</div>
