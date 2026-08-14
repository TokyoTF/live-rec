import { writable, derived, get } from 'svelte/store'
import { send, on, invoke, cleanupAll } from './ipc.js'
import time from 'humanize-duration'

if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => {
    window.__liveRecState = get(recordings)
    window.__liveRecLoaded = get(isLoaded)
    window.__liveRecHistory = get(recordingHistory)
    window.__liveRecGroupBy = get(groupBy)
    window.__liveRecOrderByStatus = get(orderByStatus)
  })
}

// ── Time Formatter ──
const timeFormatter = time.humanizer({
  language: 'shortEn',
  languages: {
    shortEn: {
      y: () => 'y', mo: () => 'mo', w: () => 'w', d: () => 'd',
      h: () => 'h', m: () => 'm', s: () => 's', ms: () => 'ms'
    }
  },
  round: true
})

function formatTime(ms) {
  return ms ? timeFormatter(ms, { largest: 2 }) : '0 s'
}


// 1. ROUTER STATE

export const isSettingsOpen = writable(false)

export function openSettings() { isSettingsOpen.set(true) }
export function closeSettings() { isSettingsOpen.set(false) }
export function toggleSettings() { isSettingsOpen.update(v => !v) }
export function getIsSettingsOpen() { return get(isSettingsOpen) } // Compatibility


// 2. NOTIFICATIONS STATE

export const toasts = writable([])

export function notify(message, type = 'info', duration = 3000) {
  const id = Date.now() + Math.random().toString(36).substr(2, 9)
  toasts.update(t => [...t, { id, message, type, duration }])

  if (duration > 0) {
    setTimeout(() => {
      dismiss(id)
    }, duration)
  }
  return id
}

export function dismiss(id) {
  toasts.update(t => t.filter(t => t.id !== id))
}


// 3. CONFIG STATE

export const ffmpegPath = writable('')
export const saveFolder = writable('')
export const nasPath = writable('')
export const dateFormat = writable('model-site-dd-MM-yyyy_hh-mm-ss')
export const autoRec = writable(true)
export const autoRecMode = writable('all')
export const reclist = writable([])
export const autoCreateFolder = writable(false)
export const showStats = writable(false)
export const showTags = writable(false)
export const viewMode = writable('grid')
export const notifications = writable(true)
export const theme = writable('dark')
export const devmode = writable(false)
export const isDev = writable(false)
export const groupBy = writable('none')
export const pollInterval = writable(70000)
export const offlinePollInterval = writable(180000)
export const maxRecDuration = writable(0)
export const maxRecFileSize = writable(0)
export const ffmpegParams = writable('')
export const minimizeToTray = writable(false)
export const proxyList = writable('')
export const recFormat = writable('mkv')
export const pauseForPrivate = writable(true)
export const concatOnResume = writable(true)
export const useragent = writable('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0')
export const recQuality = writable('best')
export const extBranch = writable('main')
export const maxproxytry = writable(3)
export const mkvmergePath = writable('')
export const mkvmergeEnabled = writable(true)
export const providers = writable([])

export const recordingHistory = writable([])

export const allTimeStats = writable({
  totalSessions: 0,
  totalDuration: 0,
  totalDataRecorded: 0,
  models: {},
  providers: {}
})

export const calendarData = writable({ onlineEvents: [] })

export function trackOnlineStatus(nametag, provider, status) {
  send('calendar:track', { nametag, provider, status, timestamp: Date.now() })
}

export function loadCalendarData() {
  send('calendar:load')
}

export function addToHistory(record) {
  let newHistory
  recordingHistory.update(h => {
    newHistory = [{
      id: Date.now(),
      timestamp: Date.now(),
      ...record
    }, ...h].slice(0, 100)
    return newHistory
  })
  send('Modify:config', {
    name: 'recordinghistory',
    value: newHistory
  })

  allTimeStats.update(s => {
    const updated = { ...s }
    updated.totalSessions++
    updated.totalDuration += record.duration || 0
    updated.totalDataRecorded += record.fileSize || 0
    if (!updated.models[record.nametag]) {
      updated.models[record.nametag] = { count: 0, duration: 0, totalDataRecorded: 0, provider: record.provider }
    }
    updated.models[record.nametag].count++
    updated.models[record.nametag].duration += record.duration || 0
    updated.models[record.nametag].totalDataRecorded += record.fileSize || 0
    if (!updated.providers[record.provider]) {
      updated.providers[record.provider] = { count: 0, duration: 0, totalDataRecorded: 0 }
    }
    updated.providers[record.provider].count++
    updated.providers[record.provider].duration += record.duration || 0
    updated.providers[record.provider].totalDataRecorded += record.fileSize || 0
    send('Modify:config', { name: 'alltimestats', value: updated })
    return updated
  })
}

// Helper: Effectively get save path
export const effectiveSavePath = derived([nasPath, saveFolder], ([$nas, $save]) => $nas || $save)

// Compatibility Getters
export function getFfmpegPath() { return get(ffmpegPath) }
export function getSaveFolder() { return get(saveFolder) }
export function getNasPath() { return get(nasPath) }
export function getDateFormat() { return get(dateFormat) }
export function getAutoRec() { return get(autoRec) }
export function getAutoRecMode() { return get(autoRecMode) }
export function getRecList() { return get(reclist) }
export function setRecList(v) { reclist.set(v); saveConfig() }
export function getAutoCreateFolder() { return get(autoCreateFolder) }
export function getShowStats() { return get(showStats) }
export function getShowTags() { return get(showTags) }
export function getViewMode() { return get(viewMode) }
export function getNotifications() { return get(notifications) }
export function getGroupBy() { return get(groupBy) }
export function getPollInterval() { return get(pollInterval) }
export function getOfflinePollInterval() { return get(offlinePollInterval) }
export function getMaxRecDuration() { return get(maxRecDuration) }
export function getMaxRecFileSize() { return get(maxRecFileSize) }
export function getFfmpegParams() { return get(ffmpegParams) }
export function getMinimizeToTray() { return get(minimizeToTray) }
export function getProxyList() { return get(proxyList) }
export function getRecFormat() { return get(recFormat) }
export function getEffectiveSavePath() { return get(effectiveSavePath) }
export function getPauseForPrivate() { return get(pauseForPrivate) }
export function getConcatOnResume() { return get(concatOnResume) }
export function getUserAgent() { return get(useragent) }
export function getRecQuality() { return get(recQuality) }
export function getExtBranch() { return get(extBranch) }
export function getMaxProxyTry() { return get(maxproxytry) }
export function getProviders() { return get(providers) }

export const isDevMode = derived(devmode, $d => $d)
export function getDevMode() { return get(devmode) }
export function getIsDev() { return get(isDev) }

// Setters (with auto-save)
export function setDevMode(v) { devmode.set(v); saveConfig() }
export function setDateFormat(v) { dateFormat.set(v); saveConfig() }
export function setAutoRec(v) { autoRec.set(v); saveConfig() }
export function setAutoRecMode(v) { autoRecMode.set(v); saveConfig() }
export function setAutoCreateFolder(v) { autoCreateFolder.set(v); saveConfig() }
export function setNasPath(v) { nasPath.set(v); saveConfig() }
export function setShowStats(v) { showStats.set(v); saveConfig() }
export function setShowTags(v) { showTags.set(v); saveConfig() }
export function setViewMode(v) { viewMode.set(v); saveConfig() }
export function setNotifications(v) { notifications.set(v); saveConfig() }
export function setGroupBy(v) { groupBy.set(v); saveConfig() }
export function setPollInterval(v) { pollInterval.set(v); saveConfig() }
export function setOfflinePollInterval(v) { offlinePollInterval.set(v); saveConfig() }
export function setMaxRecDuration(v) { maxRecDuration.set(v); saveConfig() }
export function setMaxRecFileSize(v) { maxRecFileSize.set(v); saveConfig() }
export function setFfmpegParams(v) { ffmpegParams.set(v); saveConfig() }
export function setMinimizeToTray(v) { minimizeToTray.set(v); saveConfig() }
export function setProxyList(v) { proxyList.set(v); saveConfig() }
export function clearProxyList() { proxyList.set(''); saveConfig() }
export function setRecFormat(v) { recFormat.set(v); saveConfig() }
export function setPauseForPrivate(v) { pauseForPrivate.set(v); saveConfig() }
export function setConcatOnResume(v) { concatOnResume.set(v); saveConfig() }
export function setUserAgent(v) { useragent.set(v); saveConfig() }
export function setRecQuality(v) { recQuality.set(v); saveConfig() }
export function setExtBranch(v) { extBranch.set(v); saveConfig() }
export function setMaxProxyTry(v) { maxproxytry.set(v); saveConfig() }
export function setMkvmergeEnabled(v) { mkvmergeEnabled.set(v); saveConfig() }

// Config Methods
export function selectFolder() { send('Select:Folder', { type: 'folder' }) }
export function selectFFmpeg() { send('Select:Folder', { type: 'file' }) }
export function selectMkvmerge() { send('Select:Folder', { type: 'mkvmerge' }) }
export function openLogs() { send('log:open') }
export function selectProxyList() { send('Select:Folder', { type: 'proxylist' }) }
export function syncDevExtensions() { send('extensions:sync-dev') }
export function openSaveFolder() { send('Folder:open', { path: get(effectiveSavePath) }) }
export function exportConfig() { send('Config:export') }
export function importConfig() { send('Config:import') }

export function saveConfig() {
  send('Modify:config', {
    name: 'raw',
    value: [
      { name: 'autorec', value: get(autoRec) },
      { name: 'autorecmode', value: get(autoRecMode) },
      { name: 'dateformat', value: get(dateFormat) },
      { name: 'naspath', value: get(nasPath) },
      { name: 'autocreatefolder', value: get(autoCreateFolder) },
      { name: 'showstats', value: get(showStats) },
      { name: 'showtags', value: get(showTags) },
      { name: 'viewmode', value: get(viewMode) },
      { name: 'notifications', value: get(notifications) },
      { name: 'theme', value: get(theme) },
      { name: 'groupby', value: get(groupBy) },
      { name: 'pollinterval', value: get(pollInterval) },
      { name: 'offlinepollinterval', value: get(offlinePollInterval) },
      { name: 'maxrecduration', value: get(maxRecDuration) },
      { name: 'maxrecfilesize', value: get(maxRecFileSize) },
      { name: 'ffmpegparams', value: get(ffmpegParams) },
      { name: 'minimizetotray', value: get(minimizeToTray) },
      { name: 'proxylist', value: get(proxyList) },
      { name: 'recformat', value: get(recFormat) },
      { name: 'pauseforprivate', value: get(pauseForPrivate) },
      { name: 'concatonresume', value: get(concatOnResume) },
      { name: 'useragent', value: get(useragent) },
      { name: 'recquality', value: get(recQuality) },
      { name: 'extbranch', value: get(extBranch) },
      { name: 'maxproxytry', value: get(maxproxytry) },
      { name: 'mkvmergepath', value: get(mkvmergePath) },
      { name: 'mkvmergenable', value: get(mkvmergeEnabled) },
      { name: 'devmode', value: get(devmode) },
      { name: 'recordinghistory', value: get(recordingHistory) },
      { name: 'alltimestats', value: get(allTimeStats) },
      { name: 'reclist', value: get(reclist) }
    ]
  })
}


// 4. RECORDER STATE

export const recordings = writable([])
export const isLoaded = writable(false)
export const isInitialized = writable(false)
export const orderByStatus = writable(false)
export const currentStream = writable({ url: '', nametag: '' })
export const playerHidden = writable(false)
let isInitializing = false

// Compatibility Getters
export function getRecordings() { return get(recordings) }
export function getIsLoaded() { return get(isLoaded) }
export function getIsInitialized() { return get(isInitialized) }
export function getOrderByStatus() { return get(orderByStatus) }
export function getCurrentStream() { return get(currentStream) }

// Derived counts
export const onlineCount = derived(recordings, $r => $r.filter(r => r.status === 'online').length)
export const recordingCount = derived(recordings, $r => $r.filter(r => r.statusRec === true).length)
export const offlineCount = derived(recordings, $r => $r.filter(r => r.status === 'offline').length)
export const privateCount = derived(recordings, $r => $r.filter(r => r.status === 'private').length)
export const totalCount = derived(recordings, $r => $r.length)

// Session stats
export const sessionRecordedToday = derived(recordingHistory, $h => {
  const today = new Date().toDateString()
  return $h.filter(r => r.timestamp && new Date(r.timestamp).toDateString() === today).length
})
export const sessionActiveTime = derived(recordings, $r => {
  return $r.reduce((total, r) => {
    if (r.statusRec !== true) return total
    return total + (r.timeRec || 0)
  }, 0)
})
export const sessionTotalTime = derived(recordingHistory, $h => {
  const today = new Date().toDateString()
  return $h
    .filter(r => r.timestamp && new Date(r.timestamp).toDateString() === today)
    .reduce((sum, r) => sum + (r.duration || 0), 0)
})

export const totalRecordingSize = writable(0)

// Update availability state (set by updater IPC events)
export const updateAvailable = writable(false)
export const updateVersion = writable('')

// Extension update state
export const extensionUpdates = writable([])

export function getOnlineCount() { return get(onlineCount) }
export function getRecordingCount() { return get(recordingCount) }
export function getTotalCount() { return get(totalCount) }

// Recorder Methods
function pickUrl(resolutions) {
  if (!resolutions?.length) return ''
  const q = get(recQuality)
  if (q === 'lowest') return resolutions[resolutions.length - 1].url
  if (q === 'optimal') return resolutions[Math.floor(resolutions.length / 2)].url
  return resolutions[0].url // 'best'
}

function pickResolution(resolutions) {
  if (!resolutions?.length) return null
  const q = get(recQuality)
  if (q === 'lowest') return resolutions[resolutions.length - 1]
  if (q === 'optimal') return resolutions[Math.floor(resolutions.length / 2)]
  return resolutions[0] // 'best'
}

export function setOrderByStatus(v) {
  orderByStatus.set(v)
  sortRecordings()
}

export function setCurrentStream(url, nametag) {
  currentStream.set({ url, nametag })
}

export function addRecording(provider, nametag, group = '') {
  const $recs = get(recordings)
  const exists = $recs.find(
    (item) => item.nametag === nametag && item.provider === provider
  )
  if (exists || !nametag || !provider) return false

  recordings.update(r => [...r, {
    nametag,
    provider,
    group,
    tags: [],
    status: 'loading',
    statusRec: false,
    timeRec: 0,
    timeFormat: '0 s'
  }])

  reclist.update(r => [...r, { nametag, provider, group, favorite: false, tags: [] }])
  send('Modify:config', { name: 'reclist', value: { nametag, provider, group } })
  send('rec:add', { name: nametag, provider })
  return true
}

export function removeRecording(nametag, provider) {
  const currentView = get(currentStream)

  if(currentView.nametag === nametag && currentView.url) {
    setCurrentStream('','')
  }

  recordings.update(r => r.filter(
    (n) => !(n.nametag === nametag && n.provider === provider)
  ))

  send('rec:live:remove', { nametag, provider })
}

export function updateTags(nametag, provider, tags) {
  recordings.update(r => {
    const draft = [...r]
    const idx = draft.findIndex(n => n.nametag === nametag && n.provider === provider)
    if (idx !== -1) draft[idx] = { ...draft[idx], tags }
    return draft
  })
  reclist.update(r => {
    const draft = [...r]
    const idx = draft.findIndex(n => n.nametag === nametag && n.provider === provider)
    if (idx !== -1) draft[idx] = { ...draft[idx], tags }
    return draft
  })
  send('Modify:config', { name: 'reclist', value: get(reclist) })
}

export const allTags = derived(recordings, $r => {
  const tagSet = new Set()
  $r.forEach(r => (r.tags || []).forEach(t => tagSet.add(t)))
  return [...tagSet].sort()
})

export function startRec(nametag, provider, url, resolution,selresolution) {
  recordings.update(r => {
    const idx = r.findIndex(i => i.nametag === nametag && i.provider === provider)
    if (idx !== -1) {
      const draft = [...r]
      draft[idx] = { ...draft[idx], statusRec: 'waiting', paused: false, timeRec: 0, timeFormat: '0 s' }
      return draft
    }
    return r
  })
  send('rec:live:status', {
    status: 'online',
    nametag,
    type: 'startRec',
    provider,
    url,
    resolution,
    selresolution
  })
}

async function downloadThumbnail(url) {
  if (!url) return null
  const filename = `${Date.now()}-${Math.random() * 20}`
  return invoke('download:thumbnail', { url, filename })
}

export function stopRec(nametag, provider, resolutions) {
  send('rec:live:status', {
    status: 'online',
    nametag,
    type: 'stopRec',
    provider,
    url: resolutions?.[0]?.url || ''
  })
}

export function selectStream(provider, nametag, url = '') {
  const $providers = get(providers)
  const config = $providers.find(p => p.name === provider)
  if (config?.get_url_new) {
    send('res:status', { nametag, provider })
  }

  const rec = get(recordings).find(
    (n) => n.nametag === nametag && n.provider === provider
  )

  if (rec) {
    const finalUrl = rec.url || pickUrl(rec.resolutions)
    if (finalUrl) {
      currentStream.set({ url: finalUrl, nametag })
    }
  }
}

export function updateAllStatus() {
  get(recordings).forEach((v, i) => {
    setTimeout(() => {
      send('res:status', { nametag: v.nametag, provider: v.provider })
    }, 200 * i)
  })
}

function sortRecordings() {
  if (isInitializing) return
  const statusOrder = 'onlineprivateloadingofflinenotexist'
  const isOrdered = get(orderByStatus)
  recordings.update(r => [...r].sort((a, b) => {
    const cmp = statusOrder.indexOf(String(a.status)) - statusOrder.indexOf(String(b.status))
    return isOrdered ? cmp : -cmp
  }))
}

function findIndex(nametag, provider) {
  return get(recordings).findIndex(
    (item) => item.nametag === nametag && item.provider === provider
  )
}


// 5. CONSTANTS / DERIVED

export const PROVIDERS = derived(providers, $p => $p.map(p => ({ ...p, value: p.name })))
export const DOMAIN_TO_PROVIDER = derived(PROVIDERS, $p => Object.fromEntries($p.map(p => [p.domain, p.name])))
export const PROVIDER_COLORS = derived(PROVIDERS, $p => Object.fromEntries($p.map(p => [p.name, p.color || '#888888'])))

export function getProviderColor(provider) {
  const $pc = get(PROVIDER_COLORS)
  return $pc[provider] || '#888888'
}

// Compatibility functions
export function getPROVIDERS() { return get(PROVIDERS) }
export function getDOMAIN_TO_PROVIDER() { return get(DOMAIN_TO_PROVIDER) }
export function getPROVIDER_COLORS() { return get(PROVIDER_COLORS) }

export const STATUS_COLORS = {
  online: 'bg-online',
  private: 'bg-private',
  offline: 'bg-offline',
  notexist: 'bg-notexist',
}

export const DATE_FORMATS = [
  { value: 'model-site-dd-MM-yyyy_hh-mm-ss', label: 'model-site-dd-MM-yyyy_hh-mm-ss' },
  { value: 'model-site-yyyyMMdd-hhmmss', label: 'model-site-yyyyMMdd-hhmmss' },
  { value: 'model-yyyyMMdd-hhmmss', label: 'model-yyyyMMdd-hhmmss' },
]


// INITIALIZATION & IPC LISTENERS

let pollTimer = null
let counterInterval = null
export function init() {
  cleanupAll()

  if (window.__liveRecState) {
    recordings.set(window.__liveRecState)
    isLoaded.set(true)
    isInitialized.set(true)
    window.__liveRecState = null
    if (window.__liveRecHistory) {
      recordingHistory.set(window.__liveRecHistory)
      window.__liveRecHistory = null
    }
    if (window.__liveRecGroupBy) {
      groupBy.set(window.__liveRecGroupBy)
      window.__liveRecGroupBy = null
    }
    if (window.__liveRecOrderByStatus !== undefined) {
      orderByStatus.set(window.__liveRecOrderByStatus)
      window.__liveRecOrderByStatus = undefined
    }
    window.__liveRecInitCalled = true
    return
  }

  if (window.__liveRecInitCalled) return
  window.__liveRecInitCalled = true

  on('Load:config', (_event, args) => {
      ffmpegPath.set(args.ffmpegselect || '')
      saveFolder.set(args.savefolder || '')
      nasPath.set(args.naspath || '')
      dateFormat.set(args.dateformat || 'model-site-dd-MM-yyyy_hh-mm-ss')
      autoRec.set(args.autorec ?? true)
      autoRecMode.set(args.autorecmode || 'all')
      autoCreateFolder.set(args.autocreatefolder ?? false)
      showStats.set(args.showstats ?? false)
      showTags.set(args.showtags ?? false)
      viewMode.set(args.viewmode || 'grid')
      notifications.set(args.notifications ?? true)
      theme.set(args.theme || 'dark')
      groupBy.set(args.groupby || 'none')
      pollInterval.set(args.pollinterval ?? 50000)
      offlinePollInterval.set(args.offlinepollinterval ?? 120000)
      maxRecDuration.set(args.maxrecduration ?? 0)
      maxRecFileSize.set(args.maxrecfilesize ?? 0)
      ffmpegParams.set(args.ffmpegparams || '')
      minimizeToTray.set(args.minimizetotray ?? false)
      proxyList.set(args.proxylist || '')
      recFormat.set(args.recformat || 'mkv')
      pauseForPrivate.set(args.pauseforprivate ?? true)
      concatOnResume.set(args.concatonresume ?? true)
      useragent.set(args.useragent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0')
      recQuality.set(args.recquality || 'best')
      extBranch.set(args.extbranch || 'main')
      maxproxytry.set(args.maxproxytry ?? 3)
      mkvmergePath.set(args.mkvmergepath || '')
      mkvmergeEnabled.set(args.mkvmergenable ?? true)
      devmode.set(args.devmode ?? false)
      isDev.set(args.isDev ?? false)
      providers.set(args.providers || [])
      recordingHistory.set(args.recordinghistory || [])
      allTimeStats.set(args.alltimestats || { totalSessions: 0, totalDuration: 0, totalDataRecorded: 0, models: {}, providers: {} })
      reclist.set(args.reclist || [])
      setOrderByStatus(args.orderby === 'status')
      loadFromConfig(args.reclist || [])

      on('calendar:load', (_event, args) => {
        calendarData.set(args || { onlineEvents: [] })
      })
      loadCalendarData()
    })

    on('Select:Folder', (_event, args) => {
      if (args.ffmpeg) ffmpegPath.set(args.ffmpeg)
      if (args.mkvmerge) mkvmergePath.set(args.mkvmerge)
      if (args.svfolder) saveFolder.set(args.svfolder)
      if (args.proxylist) proxyList.set(args.proxylist)
    })

    on('rec:add', (_event, args) => {
      const idx = findIndex(args.data.nametag, args.provider)

      if (idx !== -1) {
        recordings.update(r => {
          const draft = [...r]
          draft[idx] = {
            ...draft[idx],
            statusRec: args.data.statusRec,
            paused: args.data.paused || false,
            realtime: args.data.realtime || false,
            codec: args.data.codec || null,
            stats: args.data.stats || null,
            url: args.data.url,
            thumb: args.data.thumb,
            timeRec: args.data.timeRec || 0,
            status: args.data.status,
            resolutions: args.data.resolutions,
            timeFormat: formatTime(args.data.timeRec),
            group: args.data.group ?? draft[idx].group,
            force_type: args.data.force_type,
            _recoveryPending: false
          }
          return draft
        })

        if (args.data.status === 'online' || args.data.status === 'offline') {
          trackOnlineStatus(args.data.nametag, args.provider, args.data.status)
        }
      }
      sortRecordings()
      if (!get(currentStream).url && args.data.status === 'online') {
        //currentStream.set({ url: args.data.url, nametag: args.data.nametag })
      }
    })

    on('rec:error', (_event, args) => {
      notify(args.error, 'error', 7000)
    })

    on('rec:concat', (_event, args) => {
      const idx = findIndex(args.nametag, args.provider)
      if (idx !== -1) {
        recordings.update(r => {
          const draft = [...r]
          draft[idx] = { ...draft[idx], concat: args.status === 'start' ? args.fileCount : false }
          return draft
        })
      }
    })

    on('rec:live:status', (_event, args) => {
      if (args.totalSize != null) totalRecordingSize.set(args.totalSize)
      const idx = findIndex(args.nametag, args.provider)
      if (idx !== -1) {
        recordings.update(r => {
          const draft = [...r]
          const isRecording = args.status === 'waiting' ? 'waiting' : !!args.status
          const isPaused = !!args.paused
          const wasRecording = draft[idx].statusRec
          const finalDuration = draft[idx].timeRec || 0
          const finalFileSize = args.fileSize || 0
          const newTimeRec = isRecording ? (args.timeRec != null ? args.timeRec : (draft[idx].timeRec || 0)) : 0
          if (args.status === false && wasRecording && finalDuration > 0) {
            downloadThumbnail(draft[idx].thumb).then(thumbPath => {
              addToHistory({
                nametag: args.nametag,
                provider: args.provider,
                duration: finalDuration,
                thumb: thumbPath || draft[idx].thumb,
                fileSize: finalFileSize
              })
            })
          }
          draft[idx] = {
            ...draft[idx],
            statusRec: isRecording,
            paused: isPaused,
            realtime: args.realtime,
            codec: args.codec,
            stats: args.stats,
            timeRec: newTimeRec,
            timeFormat: isRecording ? (args.timeRec != null ? formatTime(args.timeRec) : (draft[idx].timeFormat || '0 s')) : '0 s',
            outputPath: args.outputPath || draft[idx].outputPath || null,
            recUrl: args.url || draft[idx].recUrl || null,
            recResolution: args.selresolution || draft[idx].recResolution || null,
            recProvider: args.provider_ || draft[idx].recProvider || null,
            recFiles: args.files || draft[idx].recFiles || [],
            fileSize: args.fileSize || 0,
            startTime: args.startTime || draft[idx].startTime || null,
            retryCount: args.retryCount ?? null,
            retryMax: args.retryMax ?? null
          }
          return draft
        })
      }
    })

    on('res:status', (_event, args) => {
      const idx = findIndex(args.nametag, args.provider)
      const currentView = get(currentStream)

      if (idx === -1) return

      const prevStatus = get(recordings)[idx]?.status
      const cur = get(recordings)[idx]
      console.log(`[STORE] res:status: ${args.nametag} prevStatus=${prevStatus} newStatus=${args.data.status} resolutions=${args.data.resolutions?.length || cur?.resolutions?.length || 0} _recoveryPending=${cur?._recoveryPending} _recoveryLastAttempt=${cur?._recoveryLastAttempt || 0} statusRec=${cur?.statusRec}`)

      recordings.update(r => {
        const draft = [...r]
        const group = args.data.group !== undefined ? args.data.group : draft[idx].group
        const newStatus = args.data.status
        const newThumb = newStatus === 'offline' ? '' : (args.data.thumb || draft[idx].thumb)
        draft[idx] = {
          ...draft[idx],
          thumb: newThumb,
          status: newStatus,
          url: args.data.url || draft[idx].url,
          resolutions: args.data.resolutions || draft[idx].resolutions,
          group: group,
          _recoveryPending: draft[idx]._recoveryPending || false,
          _recoveryLastAttempt: draft[idx]._recoveryLastAttempt || 0
        }

        if (currentView.nametag === args.nametag && (args.data.status === 'offline' || args.data.status === 'private')) {
          setCurrentStream('','')
        }

        if (args.data.status === 'online') {
          const now = Date.now()
          const lastAttempt = draft[idx]._recoveryLastAttempt || 0
          const cooldownMs = 30000
          if (draft[idx].paused || (prevStatus === 'private' && draft[idx].startTime)) {
            if (!draft[idx]._recoveryPending) {
              draft[idx]._recoveryPending = true
              draft[idx]._resumeRecording = true
              draft[idx]._recoveryLastAttempt = now
              send('rec:recovery', { name: args.nametag, provider: args.provider })
            }
          } else if ((prevStatus === 'private' || prevStatus === 'offline')) {
            const wasPrivate = prevStatus === 'private'
            const pfp = get(pauseForPrivate)
            if (wasPrivate && !pfp) {
              // pause disabled: recording was already stopped, skip recovery
            } else if (!draft[idx]._recoveryPending && (now - lastAttempt > cooldownMs)) {
              draft[idx]._recoveryPending = true
              draft[idx]._recoveryLastAttempt = now
              send('rec:recovery', { name: args.nametag, provider: args.provider })
            }
          } else if (!draft[idx].resolutions?.length && !draft[idx].statusRec) {
            if (!draft[idx]._recoveryPending && (now - lastAttempt > cooldownMs)) {
              draft[idx]._recoveryPending = true
              draft[idx]._recoveryLastAttempt = now
              send('rec:recovery', { name: args.nametag, provider: args.provider })
            }
          } else if (get(autoRec) && !draft[idx].statusRec) {
            send('rec:auto', { nametag: args.nametag, provider: args.provider })
          }
        }
        return draft
      })
      sortRecordings()

      if (args.data.status !== prevStatus) {
        trackOnlineStatus(args.nametag, args.provider, args.data.status)
      }
    })

    on('rec:recovery', (_event, args) => {
      const idx = findIndex(args.data.nametag, args.provider)
      if (idx === -1) return
      console.log(`[STORE] rec:recovery received: ${args.data.nametag} status=${args.data.status} resolutions=${args.data.resolutions?.length || 0} url=${(args.data.url || '').substring(0, 80)}`)
      const shouldResume = get(recordings)[idx]?._resumeRecording
      recordings.update(r => {
        const draft = [...r]
        draft[idx] = {
          ...draft[idx],
          nametag: args.data.nametag,
          status: args.data.status,
          url: args.data.url,
          statusRec: args.data.statusRec,
          paused: args.data.paused || false,
          timeRec: args.data.timeRec,
          timeFormat: formatTime(args.data.timeRec),
          resolutions: args.data.resolutions,
          thumb: args.data.thumb,
          group: args.data.group !== undefined ? args.data.group : draft[idx].group,
          _recoveryPending: false,
          _resumeRecording: false,
          lastCheck: Date.now()
        }
        if (args.data.status === 'online' && get(autoRec)) {
          send('rec:auto', { nametag: args.data.nametag, provider: args.provider })
        }
        return draft
      })
      sortRecordings()
      if (args.data.status === 'online' && shouldResume && args.data.resolutions?.length) {
        const picked = pickResolution(args.data.resolutions)
        startRec(args.data.nametag, args.provider, picked?.url || '', args.data.resolutions, picked?.resolution?.height ?? null)
      }
      if (args.data.status === 'online') {
        setTimeout(() => {
          send('res:status', { nametag: args.data.nametag, provider: args.provider })
        }, 8000)
      }
    })

    on('rec:auto', (_event, args) => {
      if (!get(autoRec)) return

      const mode = get(autoRecMode)
      const $reclist = get(reclist)

      if (args?.nametag && args?.provider) {
        const rec = get(recordings).find(r => r.nametag === args.nametag && r.provider === args.provider)
        if (rec && rec.status === 'online' && !rec.statusRec && pickUrl(rec.resolutions)) {
          if (mode === 'all' || (mode === 'favorites' && $reclist.some(f => f.nametag === args.nametag && f.provider === args.provider && f.favorite === true))) {
            const picked = pickResolution(rec.resolutions)
            startRec(rec.nametag, rec.provider, picked?.url || '', rec.resolutions, picked?.resolution?.height ?? null)
          }
        }
      } else {
        get(recordings).forEach((rec) => {
          if (rec.status === 'online' && !rec.statusRec && pickUrl(rec.resolutions)) {
            const isFav = $reclist.some(f => f.nametag === rec.nametag && f.provider === rec.provider && f.favorite === true)
            if (mode === 'all' || (mode === 'favorites' && isFav)) {
              const picked = pickResolution(rec.resolutions)
              startRec(rec.nametag, rec.provider, picked?.url || '', rec.resolutions, picked?.resolution?.height ?? null)
            }
          }
        })
      }
    })

    on('rec:totalSize', (_event, size) => {
      totalRecordingSize.set(size || 0)
    })

    function schedulePoll() {
      pollTimer = setTimeout(() => {
        const $recs = get(recordings)
        if ($recs.length && get(isLoaded) && get(isInitialized)) {
          let delayIndex = 0
          const now = Date.now()
          $recs.forEach((v) => {
            const isOffline = v.status === 'offline' || v.status === 'private' || v.status === 'notexist'
            const interval = isOffline ? (get(offlinePollInterval) || 120000) : (get(pollInterval) || 50000)

            if (!v.lastCheck || now - v.lastCheck >= interval - 2000) {
              v.lastCheck = now
              setTimeout(() => {
                send('res:status', { nametag: v.nametag, provider: v.provider })
              }, 600 * delayIndex)
              delayIndex++
            }
          })
        }
        schedulePoll()
      }, 10000)
    }
    schedulePoll()

    counterInterval = setInterval(() => {
      if (!get(isLoaded)) return
      recordings.update(r => {
        const draft = [...r]
        draft.forEach((n, idx) => {
          if (n.statusRec === true && !n.paused) {
            const newTime = (n.timeRec || 0) + 1000
            draft[idx] = {
              ...draft[idx],
              timeRec: newTime,
              timeFormat: formatTime(newTime)
            }

            const maxMs = get(maxRecDuration) * 60 * 1000
            if (maxMs > 0 && newTime >= maxMs) {
              stopRec(n.nametag, n.provider, n.resolutions)
            }
          }
        })
        return draft
      })
    }, 1000)

    on('updater:available', (_e, info) => {
      updateAvailable.set(true)
      updateVersion.set(info?.version || '')
    })

    on('updater:downloaded', (_e, info) => {
      updateAvailable.set(true)
      updateVersion.set(info?.version || get(updateVersion))
    })

    on('extensions:check-updates', (_e, data) => {
      extensionUpdates.set(data.updates || [])
    })

    send('Load:config')

    // Check for extension updates on startup
    send('extensions:check-updates')
    isInitialized.set(true)

}

export function loadFromConfig(reclist) {
  if (!reclist.length) {
    isLoaded.set(true)
    return
  }
  recordings.set(reclist.map((item) => ({
    nametag: item.nametag,
    provider: item.provider,
    group: item.group || '',
    tags: item.tags || [],
    status: 'loading',
    statusRec: false,
    timeRec: 0,
    timeFormat: '0 s'
  })))
  isLoaded.set(true)

  isInitializing = true
  const delay = 1500
  const initialDelay = 1500
  setTimeout(() => {
    get(recordings).forEach((item, index) => {
      if (!item.nametag && !item.provider) return
      setTimeout(() => {
        send('rec:add', { name: item.nametag, provider: item.provider })
      }, delay * index)
    })
    setTimeout(() => {
      isInitializing = false
      sortRecordings()
    }, delay * reclist.length + 500)
  }, initialDelay)
}
