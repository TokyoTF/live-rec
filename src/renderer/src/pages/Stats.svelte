<script>
  import { recordingHistory, recordings, sessionRecordedToday, sessionTotalTime, sessionActiveTime, totalRecordingSize, onlineCount, recordingCount, totalCount, getProviderColor, allTimeStats, calendarData } from '@lib/store.js'
  import { BarChart3, Clock, HardDrive, Film, Activity, Globe, Heart, Database, User, ChevronLeft, ChevronRight, Calendar, Search } from 'lucide-svelte'

  let activeTab = $state('overview')
  let modelSortBy = $state('count')
  let calMonth = $state(new Date().getMonth())
  let calYear = $state(new Date().getFullYear())
  let selectedDay = $state(null)
  let calModelFilter = $state('')
  let detailModel = $state('')
  let detailSearch = $state('')

  let heatTooltip = $state({ show: false, x: 0, y: 0, day: '', hour: '', count: 0, size: 0 })

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

  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  function prevMonth() {
    selectedDay = null
    if (calMonth === 0) { calMonth = 11; calYear-- }
    else { calMonth-- }
  }

  function nextMonth() {
    selectedDay = null
    if (calMonth === 11) { calMonth = 0; calYear++ }
    else { calMonth++ }
  }

  function goToday() {
    const now = new Date()
    calMonth = now.getMonth()
    calYear = now.getFullYear()
    selectedDay = now.getDate()
  }

  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate()
  }

  function getFirstDayOfWeek(year, month) {
    return new Date(year, month, 1).getDay()
  }

  let calDays = $derived(() => {
    const daysInMonth = getDaysInMonth(calYear, calMonth)
    const firstDay = getFirstDayOfWeek(calYear, calMonth)
    const events = $calendarData.onlineEvents || []
    const days = []

    for (let i = 0; i < firstDay; i++) {
      days.push({ day: null, models: [] })
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dayStart = new Date(calYear, calMonth, d, 0, 0, 0).getTime()
      const dayEnd = new Date(calYear, calMonth, d, 23, 59, 59, 999).getTime()

      const dayModels = new Map()
      for (const ev of events) {
        const online = ev.onlineAt
        const offline = ev.offlineAt || Date.now()
        if (online <= dayEnd && offline >= dayStart) {
          const overlapStart = Math.max(online, dayStart)
          const overlapEnd = Math.min(offline, dayEnd)
          const duration = overlapEnd - overlapStart
          if (!dayModels.has(ev.nametag)) {
            dayModels.set(ev.nametag, { nametag: ev.nametag, provider: ev.provider, duration: 0 })
          }
          dayModels.get(ev.nametag).duration += duration
        }
      }

      days.push({ day: d, models: [...dayModels.values()] })
    }
    return days
  })

  let selectedDayModels = $derived(() => {
    if (!selectedDay) return []
    const days = calDays()
    const idx = getFirstDayOfWeek(calYear, calMonth) + selectedDay - 1
    return days[idx]?.models || []
  })

  let calAllModels = $derived(() => {
    const events = $calendarData.onlineEvents || []
    const modelSet = new Map()
    for (const ev of events) {
      if (!modelSet.has(ev.nametag)) {
        modelSet.set(ev.nametag, { nametag: ev.nametag, provider: ev.provider })
      }
    }
    return [...modelSet.values()].sort((a, b) => a.nametag.localeCompare(b.nametag))
  })

  let filteredCalModels = $derived(
    calModelFilter
      ? calAllModels().filter(m => m.nametag.toLowerCase().includes(calModelFilter.toLowerCase()))
      : calAllModels()
  )

  let allModelNames = $derived(
    Object.entries($allTimeStats.models || {}).map(([name, s]) => ({ name, provider: s.provider })).sort((a, b) => a.name.localeCompare(b.name))
  )

  let filteredDetailModels = $derived(
    detailSearch
      ? allModelNames.filter(m => m.name.toLowerCase().includes(detailSearch.toLowerCase()))
      : allModelNames
  )

  let detailStats = $derived(detailModel ? $allTimeStats.models?.[detailModel] : null)

  let detailHistory = $derived(
    detailModel
      ? $recordingHistory.filter(r => r.nametag === detailModel).sort((a, b) => b.timestamp - a.timestamp)
      : []
  )

  let detailOnlineEvents = $derived(
    detailModel
      ? ($calendarData.onlineEvents || []).filter(e => e.nametag === detailModel).sort((a, b) => b.onlineAt - a.onlineAt)
      : []
  )

  let detailHeatmap = $derived.by(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0))

    for (const ev of detailOnlineEvents) {
      const start = new Date(ev.onlineAt)
      const end = ev.offlineAt ? new Date(ev.offlineAt) : new Date()
      const d = new Date(start)
      while (d <= end) {
        const dayOfWeek = d.getDay()
        const hour = d.getHours()
        grid[dayOfWeek][hour]++
        d.setHours(d.getHours() + 1)
      }
    }

    if (detailOnlineEvents.length === 0 && detailHistory.length > 0) {
      for (const rec of detailHistory) {
        if (!rec.timestamp || !rec.duration) continue
        const start = new Date(rec.timestamp)
        const end = new Date(start.getTime() + rec.duration)
        const d = new Date(start)
        while (d <= end) {
          const dayOfWeek = d.getDay()
          const hour = d.getHours()
          grid[dayOfWeek][hour]++
          d.setHours(d.getHours() + 1)
        }
      }
    }

    return grid
  })

  let detailHeatmapSizes = $derived.by(() => {
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
    for (const rec of detailHistory) {
      if (!rec.timestamp || !rec.duration) continue
      const size = rec.fileSize || 0
      const start = new Date(rec.timestamp)
      const end = new Date(start.getTime() + rec.duration)
      const d = new Date(start)
      while (d <= end) {
        const dayOfWeek = d.getDay()
        const hour = d.getHours()
        grid[dayOfWeek][hour] += size
        d.setHours(d.getHours() + 1)
      }
    }
    return grid
  })

  let detailMaxHeat = $derived(Math.max(1, ...detailHeatmap.flat()))
</script>

<div class="flex-1 overflow-y-auto p-4 space-y-4">
  <!-- Tabs -->
  <div class="flex items-center gap-1 p-1 bg-surface-800 rounded-full border border-white/5 w-fit">
    <button
      onclick={() => activeTab = 'overview'}
      class="px-4 py-1.5 text-[11px] font-bold rounded-full transition-all cursor-pointer {activeTab === 'overview' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}"
    >
      <span class="flex items-center gap-1.5"><BarChart3 size={12} /> Overview</span>
    </button>
    <button
      onclick={() => activeTab = 'calendar'}
      class="px-4 py-1.5 text-[11px] font-bold rounded-full transition-all cursor-pointer {activeTab === 'calendar' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}"
    >
      <span class="flex items-center gap-1.5"><Calendar size={12} /> Calendar</span>
    </button>
    <button
      onclick={() => activeTab = 'modeldetail'}
      class="px-4 py-1.5 text-[11px] font-bold rounded-full transition-all cursor-pointer {activeTab === 'modeldetail' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}"
    >
      <span class="flex items-center gap-1.5"><User size={12} /> Model Detail</span>
    </button>
  </div>

  {#if activeTab === 'overview'}
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
              class="px-2 py-0.5 text-[10px] rounded-full transition-all cursor-pointer {modelSortBy === 'count' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}"
            >Recordings</button>
            <button
              onclick={() => modelSortBy = 'duration'}
              class="px-2 py-0.5 text-[10px] rounded-full transition-all cursor-pointer {modelSortBy === 'duration' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}"
            >Duration</button>
            <button
              onclick={() => modelSortBy = 'size'}
              class="px-2 py-0.5 text-[10px] rounded-full transition-all cursor-pointer {modelSortBy === 'size' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'}"
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

  {:else if activeTab === 'calendar'}
    <div class="flex gap-4">
      <!-- Calendar Grid -->
      <div class="flex-1">
        <div class="p-4 rounded-xl bg-surface-800 border border-white/5">
          <!-- Month Navigation -->
          <div class="flex items-center justify-between mb-4">
            <button onclick={prevMonth} class="p-1.5 rounded-lg hover:bg-surface-700 text-white/50 hover:text-white transition-all cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <div class="flex items-center gap-3">
              <h3 class="text-sm font-bold text-white">{MONTH_NAMES[calMonth]} {calYear}</h3>
              <button onclick={goToday} class="px-2 py-0.5 text-[10px] rounded-md bg-white/10 text-white/60 hover:text-white transition-all cursor-pointer">
                Today
              </button>
            </div>
            <button onclick={nextMonth} class="p-1.5 rounded-lg hover:bg-surface-700 text-white/50 hover:text-white transition-all cursor-pointer">
              <ChevronRight size={16} />
            </button>
          </div>

          <!-- Day Headers -->
          <div class="grid grid-cols-7 gap-1 mb-1">
            {#each DAY_NAMES as dayName}
              <div class="text-center text-[10px] font-bold text-white/30 py-1">{dayName}</div>
            {/each}
          </div>

          <!-- Calendar Days -->
          <div class="grid grid-cols-7 gap-1">
            {#each calDays() as cell}
              {#if cell.day === null}
                <div class="aspect-square"></div>
              {:else}
                {@const isSelected = selectedDay === cell.day}
                {@const isToday = cell.day === new Date().getDate() && calMonth === new Date().getMonth() && calYear === new Date().getFullYear()}
                <button
                  onclick={() => selectedDay = isSelected ? null : cell.day}
                  class="aspect-square rounded-lg p-1 flex flex-col items-center justify-start transition-all cursor-pointer relative {isSelected ? 'bg-white/15 ring-1 ring-white/20' : 'hover:bg-surface-700'} {isToday && !isSelected ? 'ring-1 ring-accent-500/40' : ''}"
                >
                  <span class="text-[11px] font-medium {isToday ? 'text-accent-400' : 'text-white/70'}">{cell.day}</span>
                  {#if cell.models.length > 0}
                    <div class="flex flex-wrap gap-0.5 mt-0.5 justify-center">
                      {#each cell.models.slice(0, 6) as m}
                        {@const color = getProviderColor(m.provider)}
                        <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background-color: {color};"></span>
                      {/each}
                      {#if cell.models.length > 6}
                        <span class="text-[7px] text-white/30">+{cell.models.length - 6}</span>
                      {/if}
                    </div>
                  {/if}
                </button>
              {/if}
            {/each}
          </div>
        </div>
      </div>

      <!-- Sidebar: Day Detail + Model Legend -->
      <div class="w-72 space-y-4">
        <!-- Selected Day Detail -->
        {#if selectedDay}
          <div class="p-4 rounded-xl bg-surface-800 border border-white/5">
            <h3 class="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">
              {MONTH_NAMES[calMonth]} {selectedDay}, {calYear}
            </h3>
            {#if selectedDayModels().length > 0}
              <div class="space-y-2">
                {#each selectedDayModels() as m}
                  {@const color = getProviderColor(m.provider)}
                  <div class="flex items-center gap-2 p-2 rounded-lg bg-surface-900">
                    <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {color};"></span>
                    <div class="flex-1 min-w-0">
                      <div class="text-xs font-medium text-white truncate">{m.nametag}</div>
                      <div class="text-[10px] text-white/30">{m.provider}</div>
                    </div>
                    <div class="text-[10px] font-bold text-white/60 shrink-0">
                      {formatDuration(m.duration)}
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-[11px] text-white/30 text-center py-4">No online models this day</div>
            {/if}
          </div>
        {:else}
          <div class="p-4 rounded-xl bg-surface-800 border border-white/5">
            <h3 class="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">Selected Day</h3>
            <div class="text-[11px] text-white/30 text-center py-4">Click a day to see details</div>
          </div>
        {/if}

        <!-- Model Legend -->
        <div class="p-4 rounded-xl bg-surface-800 border border-white/5 max-h-96 overflow-y-auto">
          <h3 class="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">Models</h3>
          <input
            type="text"
            placeholder="Search..."
            bind:value={calModelFilter}
            class="w-full px-2 py-1 mb-2 bg-surface-900 border border-white/10 rounded-md text-[11px] text-white/80 placeholder-white/25 outline-none focus:border-accent-500/50"
          />
          {#if filteredCalModels.length > 0}
            <div class="space-y-1">
              {#each filteredCalModels as m}
                {@const color = getProviderColor(m.provider)}
                <div class="flex items-center gap-2 py-1">
                  <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {color};"></span>
                  <span class="text-[11px] text-white/70 truncate">{m.nametag}</span>
                  <span class="text-[9px] text-white/30 ml-auto">{m.provider}</span>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-[11px] text-white/30 text-center py-2">No data yet</div>
          {/if}
        </div>
      </div>
    </div>

  {:else if activeTab === 'modeldetail'}
    <div class="flex gap-4">
      <!-- Model Selector Sidebar -->
      <div class="w-64 shrink-0">
        <div class="p-4 rounded-xl bg-surface-800 border border-white/5">
          <h3 class="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">Select Model</h3>
          <div class="relative mb-3">
            <Search size={12} class="absolute left-2 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Search models..."
              bind:value={detailSearch}
              class="w-full pl-7 pr-2 py-1.5 bg-surface-900 border border-white/10 rounded-md text-[11px] text-white/80 placeholder-white/25 outline-none focus:border-accent-500/50"
            />
          </div>
          <div class="space-y-0.5 max-h-[60vh] overflow-y-auto">
            {#each filteredDetailModels as m}
              {@const color = getProviderColor(m.provider)}
              {@const isSelected = detailModel === m.name}
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                onclick={() => detailModel = m.name}
                class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all cursor-pointer {isSelected ? 'bg-white/10' : 'hover:bg-surface-700'}"
              >
                <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {color};"></span>
                <span class="text-[11px] {isSelected ? 'text-white font-medium' : 'text-white/70'} truncate">{m.name}</span>
                <span class="text-[9px] text-white/30 ml-auto shrink-0">{m.provider}</span>
              </div>
            {/each}
            {#if filteredDetailModels.length === 0}
              <div class="text-[11px] text-white/30 text-center py-4">No models found</div>
            {/if}
          </div>
        </div>
      </div>

      <!-- Detail Content -->
      <div class="flex-1 min-w-0">
        {#if detailModel && detailStats}
          {@const color = getProviderColor(detailStats.provider)}

          <!-- Model Header -->
          <div class="p-4 rounded-xl bg-surface-800 border border-white/5 mb-4">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style="background-color: {color}33;">
                <User size={20} style="color: {color};" />
              </div>
              <div>
                <div class="text-lg font-bold text-white">{detailModel}</div>
                <div class="text-[11px] text-white/40">{detailStats.provider}</div>
              </div>
            </div>
          </div>

          <!-- Stats Cards -->
          <div class="grid grid-cols-4 gap-3 mb-4">
            <div class="p-3 rounded-xl bg-surface-800 border border-white/5">
              <div class="text-[11px] text-white/40 mb-1">Recordings</div>
              <div class="text-2xl font-bold text-white">{detailStats.count}</div>
            </div>
            <div class="p-3 rounded-xl bg-surface-800 border border-white/5">
              <div class="text-[11px] text-white/40 mb-1">Total Duration</div>
              <div class="text-2xl font-bold text-white">{formatDuration(detailStats.duration)}</div>
            </div>
            <div class="p-3 rounded-xl bg-surface-800 border border-white/5">
              <div class="text-[11px] text-white/40 mb-1">Data Recorded</div>
              <div class="text-2xl font-bold text-white">{formatSize(detailStats.totalDataRecorded || 0)}</div>
            </div>
            <div class="p-3 rounded-xl bg-surface-800 border border-white/5">
              <div class="text-[11px] text-white/40 mb-1">Avg Duration</div>
              <div class="text-2xl font-bold text-white">{formatDuration(detailStats.count > 0 ? detailStats.duration / detailStats.count : 0)}</div>
            </div>
          </div>

          <!-- Online Heatmap -->
          <div class="p-4 rounded-xl bg-surface-800 border border-white/5 mb-4">
            <h3 class="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">Online Schedule</h3>
            <div class="overflow-x-auto">
              <div class="inline-block min-w-[600px]">
                <!-- Hour labels -->
                <div class="flex gap-0.5 mb-0.5 ml-10">
                  {#each Array(24) as _, h}
                    <div class="w-[22px] text-center text-[9px] text-white/25 shrink-0">{h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm'}</div>
                  {/each}
                </div>
                <!-- Grid rows -->
                {#each ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] as dayName, dayIdx}
                  <div class="flex items-center gap-0.5 mb-0.5">
                    <span class="w-9 text-[9px] text-white/30 text-right pr-1 shrink-0">{dayName}</span>
                    {#each Array(24) as _, h}
                      {@const val = detailHeatmap[dayIdx][h]}
                      {@const intensity = detailMaxHeat > 0 ? val / detailMaxHeat : 0}
                      {@const sizeVal = detailHeatmapSizes[dayIdx][h]}
                      {@const hourLabel = h === 0 ? '12 AM' : h < 12 ? h + ' AM' : h === 12 ? '12 PM' : (h - 12) + ' PM'}
                      <!-- svelte-ignore a11y_no_static_element_interactions -->
                      <div
                        class="w-[22px] h-4 rounded-sm transition-colors shrink-0 cursor-default"
                        style="background-color: {color}; opacity: {val > 0 ? 0.15 + intensity * 0.85 : 0.08};"
                        onmouseenter={(e) => {
                          const rect = e.target.getBoundingClientRect()
                          heatTooltip = { show: true, x: rect.left + rect.width / 2, y: rect.top - 8, day: dayName, hour: hourLabel, count: val, size: sizeVal }
                        }}
                        onmouseleave={() => { heatTooltip = { ...heatTooltip, show: false } }}
                      ></div>
                    {/each}
                  </div>
                {/each}
              </div>
            </div>
          </div>

          <!-- Recording History -->
          <div class="p-4 rounded-xl bg-surface-800 border border-white/5">
            <h3 class="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">Recording History ({detailHistory.length})</h3>
            {#if detailHistory.length > 0}
              <div class="space-y-1 max-h-80 overflow-y-auto">
                {#each detailHistory as rec}
                  {@const date = new Date(rec.timestamp)}
                  <div class="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-surface-700 transition-colors">
                    <div class="w-12 h-8 rounded overflow-hidden bg-surface-900 shrink-0">
                      {#if rec.thumb}
                        <img
                          src={rec.thumb?.includes('http') ? rec.thumb : 'liverec://' + rec.thumb?.replace(/\\/g, '/')}
                          alt=""
                          class="w-full h-full object-cover"
                          onerror={(e) => { e.currentTarget.style.display='none'; }}
                        />
                      {/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-[11px] text-white/70">{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    <div class="text-right shrink-0">
                      <div class="text-[11px] font-bold text-white">{formatDuration(rec.duration)}</div>
                      <div class="text-[9px] text-white/30">{formatSize(rec.fileSize || 0)}</div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              <div class="text-[11px] text-white/30 text-center py-6">No recordings for this model</div>
            {/if}
          </div>
        {:else}
          <div class="p-8 rounded-xl bg-surface-800 border border-white/5 text-center">
            <User size={32} class="text-white/10 mx-auto mb-3" />
            <div class="text-sm text-white/30">Select a model to view details</div>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

{#if heatTooltip.show}
  <div
    class="fixed z-50 pointer-events-none px-3 py-2 rounded-lg bg-surface-900 border border-white/10 shadow-xl"
    style="left: {heatTooltip.x}px; top: {heatTooltip.y}px; transform: translate(-50%, -100%);"
  >
    <div class="text-[11px] font-bold text-white">{heatTooltip.day} {heatTooltip.hour}</div>
    {#if heatTooltip.count > 0}
      <div class="text-[10px] text-white/60 mt-0.5">{heatTooltip.count} recording{heatTooltip.count !== 1 ? 's' : ''}</div>
      <div class="text-[10px] text-white/40">{formatSize(heatTooltip.size)}</div>
    {:else}
      <div class="text-[10px] text-white/30 mt-0.5">No activity</div>
    {/if}
  </div>
{/if}
