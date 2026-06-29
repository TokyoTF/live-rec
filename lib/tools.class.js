import { Parser } from 'm3u8-parser'
import ffmpeg from 'fluent-ffmpeg'
import dateFormat from 'date-format'
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync, renameSync } from 'node:fs'
import path from 'path'
import os from 'os'
import { BrowserWindow } from 'electron'
import Logger from './logger.class.js'
import CBProxy from './cbProxy.class.js'


export default class Sites {
  static #recordings = []
  static #onError = null
  static #proxyPool = []
  static #proxyIndex = 0
  static #assignedProxies = new Map()

  static setErrorCallback(cb) {
    this.#onError = cb
  }

  constructor() {}

  loadProxyPool() {
    const config = this.loadjson()
    if (config.proxylist && existsSync(config.proxylist)) {
      try {
        const list = readFileSync(config.proxylist, 'utf8')
          .split('\n')
          .map(p => p.trim())
          .filter(p => p && !p.startsWith('#'))
        Sites.#proxyPool = list
        Sites.#proxyIndex = 0
      } catch (err) {
        Logger.error('Error reading proxylist:', err.message)
      }
    }
  }

  getNextProxy() {
    if (Sites.#proxyPool.length === 0) return ''
    const proxy = Sites.#proxyPool[Sites.#proxyIndex % Sites.#proxyPool.length]
    Sites.#proxyIndex++
    return proxy
  }

  assignProxyToStream(nametag, provider) {
    const key = `${nametag}-${provider}`
    if (!Sites.#assignedProxies.has(key)) {
      const proxy = this.getNextProxy()
      Sites.#assignedProxies.set(key, proxy)
      Logger.info(`Assigned proxy ${proxy} to ${key}`)
    }
    return Sites.#assignedProxies.get(key)
  }

  getProxyForStream(nametag, provider) {
    const key = `${nametag}-${provider}`
    return Sites.#assignedProxies.get(key) || ''
  }

  releaseProxy(nametag, provider) {
    const key = `${nametag}-${provider}`
    Sites.#assignedProxies.delete(key)
  }

  FileDate(nametag, provider, dateformat = '') {
    const originalformat = String(dateformat).replace('model-', '').replace('site-', '').trim()
    const prefix = [
      dateformat.includes('model-') ? nametag : '',
      dateformat.includes('site-') ? provider : ''
    ].filter(Boolean).join('-')

    const dateStr = dateFormat(originalformat || 'yyyy-MM-dd_hh-mm-ss', new Date())
    return prefix ? `${prefix}-${dateStr}` : dateStr
  }

  static #FolderMain = path.join(os.homedir(), 'Documents', 'live-rec')

  getProxy() {
    const config = this.loadjson()
    if (config.proxylist && existsSync(config.proxylist)) {
      try {
        const list = readFileSync(config.proxylist, 'utf8')
          .split('\n')
          .map(p => p.trim())
          .filter(p => p && !p.startsWith('#'))
        if (list.length > 0) {
          return list[Math.floor(Math.random() * list.length)]
        }
      } catch (err) {
        Logger.error('Error reading proxylist:', err.message)
      }
    }
    return ''
  }


  async recInit(info) {
    const config = this.loadjson()
    const ua = config.useragent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0'
  const extraParams = info.ffmpegparams ? info.ffmpegparams.trim().split(/\s+/) : []
  const isCBProxy = info.provider === 'chaturbate'
  const isProxy = info.provider === 'camsoda'
  const options = isCBProxy || isProxy
    ? [
        '-live_start_index', '-1',
        '-user_agent', ua
      ]
    : [
        '-reconnect', '1',
        '-reconnect_at_eof', '1',
        '-reconnect_streamed', '1',
        '-reconnect_on_network_error', '1',
        '-reconnect_delay_max', '3',
        '-live_start_index', '-1',
        '-user_agent', ua
      ]

  if (info.cookies) {
    options.push('-headers', `Cookie: ${info.cookies}\r\n`)
  }

  // Public proxy pool disabled — Chaturbate uses local CBProxy, others connect directly.
  // if (!isCBProxy && info.useProxy) {
  //   const proxy = this.assignProxyToStream(info.nametag, info.provider)
  //   if (proxy) {
  //     const proxyUrl = proxy.includes('://') ? proxy : `http://${proxy}`
  //     options.push('-http_proxy', proxyUrl)
  //   }
  // }

    let saveFolderPath = config.savefolder

    if (config.autocreatefolder) {
      const dateStr = dateFormat('yyyy-MM-dd', new Date())
      const folderName = `${info.provider} - ${info.nametag}`
      saveFolderPath = path.join(config.savefolder, dateStr, folderName)
    }

    if (!existsSync(saveFolderPath)) {
      mkdirSync(saveFolderPath, { recursive: true })
    }

    let recFormat = config.recformat || 'mkv'
    let outputPath = info.outputPath || path.join(saveFolderPath, `${this.FileDate(info.nametag, info.provider, info.dateformat)}.${recFormat}`)

  const outputOpts = ['-c', 'copy', '-map', '0:v?', '-map', '0:a?', ...extraParams]

  const command = new ffmpeg()
  .setFfmpegPath(config.ffmpegselect)
  .outputOptions(outputOpts)
  .output(outputPath)

  const recObj = {
  nametag: info.nametag,
  provider: info.provider,
  objectFFmpeg: command,
  outputPath: outputPath,
  inputOptions: options,
  recording: false,
      paused: false,
      realtime: false,
      codec: null,
      stats: null,
      startTime: null,
      pausedAccumulator: 0,
      pausedAt: null,
      keepAlive: info.keepAlive || false,
      retryCount: 0,
      retryMax: 6,
      retryDelay: 4000,
      url: info.url || null,
      referer: info.referer || '',
      cookies: info.cookies || '',
      dateformat: info.dateformat || '',
      resolutions: info.resolutions || null,
      selresolution: info.selresolution || null,
      ffmpegparams: info.ffmpegparams || '',
      files: info.files || [],
      maxFileSizeMB: (config.maxrecfilesize || 0) * 1024
    }

    const handleError = (err) => {
      Logger.error(`ffmpeg error (${info.nametag}):`, err.message)
      try {
        const exists = existsSync(outputPath)
        const size = exists ? statSync(outputPath).size : 0
        Logger.error(`output=${outputPath} exists=${exists} size=${size}`)
      } catch {}
      const r = Sites.#recordings.find(n => n.nametag === info.nametag && n.provider === info.provider)
      if (Sites.#onError) Sites.#onError({ nametag: info.nametag, provider: info.provider, error: this.errorFormat(info.nametag, info.provider, err.message) })
      const isUserStop = err.message.includes('SIGKILL') || err.message.includes('killed')
      if (isUserStop || !Sites.#isRecoverableError(err.message)) {
        if (r && !r.paused) r.recording = false
        return
      }
      Sites.#attemptReconnect(info.nametag, info.provider)
    }

    const handleEnd = () => {
      try {
        const exists = existsSync(outputPath)
        const size = exists ? statSync(outputPath).size : 0
        Logger.ffmpeg(`ffmpeg end (${info.nametag}): output=${outputPath} exists=${exists} size=${size}`)
      } catch {}
      const r = Sites.#recordings.find(n => n.nametag === info.nametag && n.provider === info.provider)
      if (r && (r.paused || !r.keepAlive)) {
        Logger.ffmpeg(`Stream ended (paused=${r.paused}), skipping reconnect for ${info.nametag}`)
        return
      }
      Sites.#attemptReconnect(info.nametag, info.provider)
    }

    command.on('codecData', (data) => {
      recObj.codec = data
      //Logger.info(`codecData (${info.nametag}): ${JSON.stringify(data)}`)
    })

    command.on('stderr', (line) => {
      //Logger.info(`ffmpeg stderr (${info.nametag}): ${line}`)
    })

    command.on('progress', (progress) => {
      recObj.stats = progress
      const totalSize = this.getTotalRecordingSize()
      const mainWin = BrowserWindow.getAllWindows()[0]
      if (mainWin && !mainWin.isDestroyed()) {
        mainWin.webContents.send('rec:totalSize', totalSize)
      }
      const maxFileSizeMB = recObj.maxFileSizeMB
      if (maxFileSizeMB > 0) {
        if (!recObj._lastSizeCheck) recObj._lastSizeCheck = 0
        const now = Date.now()
        if (now - recObj._lastSizeCheck < 5000) return
        recObj._lastSizeCheck = now
        try {
          const sizeMB = statSync(recObj.outputPath).size / (1024 * 1024)
          if (sizeMB >= maxFileSizeMB) {
            Logger.info(`File size limit reached for ${info.nametag} (${sizeMB.toFixed(1)}MB >= ${maxFileSizeMB}MB), splitting...`)
            if (recObj.outputPath && !recObj.files.includes(recObj.outputPath)) {
              recObj.files.push(recObj.outputPath)
            }
            try { recObj.objectFFmpeg.kill() } catch {}
            const ext = path.extname(recObj.outputPath)
            const base = recObj.outputPath.slice(0, -ext.length)
            const segNum = recObj.files.length
            const newPath = `${base}.part${segNum}${ext}`
            recObj.outputPath = newPath
            const newCmd = new ffmpeg()
              .setFfmpegPath(config.ffmpegselect)
              .outputOptions(['-c', 'copy', '-map', '0:v?', '-map', '0:a?', ...(recObj.ffmpegparams ? recObj.ffmpegparams.trim().split(/\s+/) : [])])
              .output(newPath)
            recObj.objectFFmpeg = newCmd
            newCmd.on('codecData', (data) => { recObj.codec = data })
            newCmd.on('progress', (p) => { recObj.stats = p })
            newCmd.on('error', handleError)
            newCmd.on('end', handleEnd)
            newCmd.input(info.url)
            newCmd.inputOptions([...recObj.inputOptions, '-referer', info.referer])
            setTimeout(() => newCmd.run(), 1000)
          }
        } catch {}
      }
    })

    command.on('error', handleError)
    command.on('end', handleEnd)

    const index = Sites.#recordings.findIndex(r => r.nametag === info.nametag && r.provider === info.provider)
    if (index !== -1) {
      if (Sites.#recordings[index].recording) {
        Logger.info(`Recording already active for ${info.nametag}, skipping re-initialization.`)
        return Sites.#recordings[index]
      }
      const existing = Sites.#recordings[index]
      recObj.startTime = existing.startTime
      recObj.pausedAccumulator = existing.pausedAccumulator
      recObj.pausedAt = existing.pausedAt
      recObj.paused = existing.paused
      recObj.retryCount = existing.retryCount
      recObj.keepAlive = existing.keepAlive
      recObj.files = existing.files.length > 0 ? existing.files : (recObj.outputPath ? [recObj.outputPath] : [])
      Sites.#recordings[index] = recObj
    } else {
      Sites.#recordings.push(recObj)
    }

    return command
  }

  async rec(nametag, type, url, status, provider, dateformat,resolutions,selresolution, ffmpegparams, referer = '', keepAlive = true, cookies = '') {
    try {
      let recording = Sites.#recordings.find(r => r.nametag === nametag && r.provider === provider)

      if (!recording) {
        if (type === 'startRec') {
          await this.recInit({ nametag, provider, dateformat,resolutions, selresolution, ffmpegparams, referer, keepAlive, cookies })
          return this.rec(nametag, type, url, status, provider, dateformat, null, null, ffmpegparams, referer, keepAlive, cookies)
        }
        return false
      }

      if (type === 'startRec' && !recording.recording && url && status === 'online') {
        const isResume = recording.startTime && (recording.pausedAccumulator > 0 || recording.pausedAt)
        // Always re-initialize to ensure a fresh FFmpeg instance
        await this.recInit({ nametag, provider, dateformat,resolutions,selresolution, ffmpegparams, referer, keepAlive, url, files: isResume ? recording.files : [], cookies })
        recording = Sites.#recordings.find(r => r.nametag === nametag && r.provider === provider)

        const { objectFFmpeg: command } = recording
        Logger.ffmpeg(`Starting process for ${nametag}: ${url}`)
        recording.recording = true
        recording.paused = false
        recording.url = url
        recording.retryCount = 0
  command.input(url)
  command.inputOptions([...recording.inputOptions, '-referer', referer])
  .on('start', (cmdline) => {
    Logger.info(`ffmpeg cmd: ${cmdline}`)
    Logger.success(`Process started: ${nametag}-${provider}`)
            recording.realtime = true
            if (!isResume) {
              recording.startTime = Date.now()
              recording.pausedAccumulator = 0
            }
            recording.pausedAt = null
          })

  // Delay to ensure stream is ready
  setTimeout(() => command.run(), 2000)
      } else if (type === 'startRec' && recording.paused && url && status === 'online') {
        // Resume from paused (private) state: preserve timings and create new file
        Logger.info(`Resuming recording for ${nametag} after private: ${url}`)

        // Calculate new accumulator
        recording.pausedAccumulator += (recording.pausedAt ? (Date.now() - recording.pausedAt) : 0)
        recording.pausedAt = null
        recording.paused = false
        recording.recording = true
        recording.url = url
        recording.retryCount = 0

        // Re-initialize with new file, passing existing files for concat later
        await this.recInit({ nametag, provider, dateformat,resolutions,selresolution, ffmpegparams, referer, keepAlive, files: recording.files, cookies })
        recording = Sites.#recordings.find(r => r.nametag === nametag && r.provider === provider)
        const { objectFFmpeg: command } = recording

  command.input(url)
  command.inputOptions([...recording.inputOptions, '-referer', referer])
  recording.realtime = true

        setTimeout(() => command.run(), 2000)
      } else if (type === 'stopRec' && (recording.recording || recording.paused)) {
        recording.recording = false
        recording.paused = false
        recording.pausedAt = null
        recording.startTime = null
        if (recording.outputPath && !recording.files.includes(recording.outputPath)) {
          recording.files.push(recording.outputPath)
        }
        try { recording.objectFFmpeg.kill() } catch (e) { /* already dead */ }
        if (provider === 'chaturbate') CBProxy.stopProxy(nametag)
        const filesToConcat = [...recording.files]
        const finalOutput = recording.outputPath
        if (filesToConcat.length > 1) {
          Sites.#concatFiles(nametag, provider, filesToConcat, finalOutput)
        }
      } else if (type === 'checkRec') {
        if (status === 'offline') {
          if (recording.recording) {
            Logger.info(`Model ${nametag} went offline, stopping recording.`)
            recording.recording = false
            try { recording.objectFFmpeg.kill() } catch (e) { /* already dead */ }
          }
          if (recording.paused) {
            Logger.info(`Model ${nametag} confirmed offline (was paused).`)
            recording.paused = false
            recording.pausedAt = null
            recording.startTime = null
          }
          if (recording.outputPath && !recording.files.includes(recording.outputPath)) {
            recording.files.push(recording.outputPath)
          }
          const filesToConcat = [...recording.files]
          const finalOutput = recording.outputPath
          recording.startTime = null
          recording.files = []
          if (filesToConcat.length > 1) {
            Sites.#concatFiles(nametag, provider, filesToConcat, finalOutput)
          }
        }
 else if (status === 'private') {
          const config = this.loadjson()
          if (config.pauseforprivate !== false) {
            if (!recording.paused && (recording.recording || recording.startTime)) {
              Logger.info(`Model ${nametag} went private, pausing recording.`)
              recording.paused = true
              recording.pausedAt = Date.now()
              recording.recording = false
              if (recording.outputPath && !recording.files.includes(recording.outputPath)) {
                recording.files.push(recording.outputPath)
              }
              try { recording.objectFFmpeg.kill() } catch (e) { /* already dead */ }
            }
          } else {
            Logger.info(`Model ${nametag} went private (pause disabled), stopping recording.`)
            recording.recording = false
            recording.paused = false
            recording.pausedAt = null
            recording.startTime = null
            try { recording.objectFFmpeg.kill() } catch (e) { /* already dead */ }
          }
        } else if (status === 'online') {
          if (recording.paused && recording.pausedAt) {
            Logger.info(`Model ${nametag} went online, resuming time.`)
            recording.pausedAccumulator += (Date.now() - recording.pausedAt)
            recording.pausedAt = null
            recording.paused = false
          }
        }
      }

      return recording
    } catch (error) {
      Logger.error(`Error in rec (${nametag}):`, error)
      const recording = Sites.#recordings.find(r => r.nametag === nametag && r.provider === provider)
      if (recording) {
        recording.recording = false
        recording.paused = false
        try { recording.objectFFmpeg.kill() } catch (e) { /* already dead */ }
      }
      return false
    }
  }

  removeRec(nametag, provider) {
    const index = Sites.#recordings.findIndex(r => r.nametag === nametag && r.provider === provider)
    if (index !== -1) {
      const recording = Sites.#recordings[index]
      if (recording.recording) {
        recording.recording = false
        recording.objectFFmpeg.kill()
      }
      if (recording.outputPath && !recording.files.includes(recording.outputPath)) {
        recording.files.push(recording.outputPath)
      }
      const filesToConcat = [...recording.files]
      const finalOutput = recording.outputPath
      Sites.#recordings.splice(index, 1)
      if (filesToConcat.length > 1) {
        Sites.#concatFiles(nametag, provider, filesToConcat, finalOutput)
      }
    }
    if (provider === 'chaturbate') CBProxy.stopProxy(nametag)
    this.modifyjson({ raw: { name: 'reclistremove', value: { nametag, provider } } })
  }

  getRecording(nametag, provider) {
    const rec = Sites.#recordings.find(r => r.nametag === nametag && r.provider === provider)

    return rec ? {
      statusRec: rec.recording || rec.paused,
      paused: rec.paused,
      realtime: rec.realtime,
      codec: rec.codec,
      stats: rec.stats,
      startTime: rec.startTime,
      timeRec: this.getRecTime(rec),
      outputPath: rec.outputPath,
      url: rec.url,
      selresolution: rec.selresolution,
      provider: rec.provider,
      files: rec.files || [],
      fileSize: this.#getFilesSize([...(rec.files || []), rec.outputPath].filter(Boolean))
    } : null
  }

  #getFilesSize(files) {
    let total = 0
    for (const f of files) {
      try { if (existsSync(f)) total += statSync(f).size } catch {}
    }
    return total
  }

  getTotalRecordingSize() {
    let totalBytes = 0
    for (const rec of Sites.#recordings) {
      if (!rec.recording && !rec.paused) continue
      const files = [...(rec.files || []), rec.outputPath].filter(Boolean)
      for (const f of files) {
        try { if (existsSync(f)) totalBytes += statSync(f).size } catch {}
      }
    }
    return totalBytes
  }

  getRecTime(rec) {
    if (!rec || (!rec.recording && !rec.paused) || !rec.startTime) return 0
    let time = Date.now() - rec.startTime - (rec.pausedAccumulator || 0)
    if (rec.pausedAt) {
      time -= (Date.now() - rec.pausedAt)
    }
    return Math.max(0, time)
  }

  /**
   * @param {object} m3u8
   */

  resolutions(m3u8) {
    if (!m3u8.active || !m3u8.data) return []

    const parser = new Parser()
    parser.push(m3u8.data)
    parser.end()


    const playlists = parser.manifest.playlists || []
    const resolutions = playlists.map(el => {
      let url = !m3u8.prefixUrl.directurl ? m3u8.prefixUrl + el.uri : m3u8.prefixUrl.directurl
      if(url.includes('#')) {
        url = url.replace('#', '')
      }

      let fps = el.attributes['FRAME-RATE'] || ''
      if (!fps && el.attributes.NAME) {
        const fpsMatch = el.attributes.NAME.match(/FPS:(\d+)/)
        if (fpsMatch) fps = fpsMatch[1]
      }

      return {
        resolution: el.attributes.RESOLUTION,
        url: url,
        fps: fps ? Number(fps).toFixed(0) : ''
      }
    }).sort((a, b) => (b.resolution?.height || 0) - (a.resolution?.height || 0))

    return resolutions
  }


  errorFormat(nametag, provider, error) {
    if (error.includes('ffmpeg was killed with signal SIGKILL')) {
      return `Rec ${nametag} - ${provider}: stopped`
    }
    return `Error ${nametag} - ${provider}: ${error}`
  }

  static #RECOVERABLE_ERRORS = [
    'End of file',
    'end of file',
    'EOF',
    'Connection reset',
    'connection reset',
    'Timed out',
    'timed out',
    'Connection refused',
    'connection refused',
    'Connection failed',
    'connection failed',
    'Network is unreachable',
    'network is unreachable',
    'No route to host',
    'no route to host',
    'I/O error',
    'i/o error',
    'Error number -138',
    'error number -138',
    'Server returned 404',
    'Server returned 5',
    'exit signal',
    'Input/output error'
  ]

  static #concatFiles(nametag, provider, files, finalOutput) {
    if (!files || files.length <= 1) return Promise.resolve()

    return new Promise((resolve) => {
      const config = new Sites().loadjson()
      const ffmpegPath = config.ffmpegselect

      const existingFiles = files.filter(f => existsSync(f))
      if (existingFiles.length <= 1) {
        resolve()
        return
      }

      const tempOutput = finalOutput + '.tmp.concat'
      const listPath = finalOutput + '.concat.txt'

      const listContent = existingFiles.map(f => `file '${f.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n')
      writeFileSync(listPath, listContent)

      Logger.info(`Concatenating ${existingFiles.length} files for ${nametag}...`)
      Logger.info(`Concat list: ${listPath}`)
      Logger.info(`Concat output: ${tempOutput}`)

      setTimeout(() => {
        ffmpeg()
          .setFfmpegPath(ffmpegPath)
          .input(listPath)
          .inputOptions(['-f', 'concat', '-safe', '0'])
          .outputOptions(['-c', 'copy'])
          .output(tempOutput)
          .on('end', () => {
            Logger.info(`Concat done: ${finalOutput}`)
            try { renameSync(tempOutput, finalOutput) } catch {}
            for (const f of existingFiles) {
              try { unlinkSync(f) } catch {}
            }
            try { unlinkSync(listPath) } catch {}
            resolve()
          })
          .on('error', (err) => {
            Logger.error(`Concat failed for ${nametag}: ${err.message}`)
            try { unlinkSync(tempOutput) } catch {}
            try { unlinkSync(listPath) } catch {}
            resolve()
          })
          .run()
      }, 1000)
    })
  }

  static #isRecoverableError(errMessage) {
    return Sites.#RECOVERABLE_ERRORS.some(e => errMessage.includes(e))
  }

  static #attemptReconnect(nametag, provider) {
    const r = Sites.#recordings.find(n => n.nametag === nametag && n.provider === provider)
    if (!r || r.paused || !r.keepAlive || r.retryCount >= r.retryMax) {
      if (r && !r.paused) {
        Logger.stop(`Recording finished: ${nametag} (retries exhausted or keepAlive off)`)
        r.recording = false
        r.keepAlive = false
        if (Sites.#onError) Sites.#onError({ nametag, provider, error: `Recording stopped: ${nametag} - ${provider}: reconnect failed after retries` })
      }
      return
    }

    r.retryCount++
    r.recording = false
    const retryDelay = Math.min(r.retryDelay * r.retryCount, 15000)
    Logger.info(`Attempting reconnect ${r.retryCount}/${r.retryMax} for ${nametag} (delay ${retryDelay}ms)...`)

    setTimeout(async () => {
      try {
        const recObj = Sites.#recordings.find(n => n.nametag === nametag && n.provider === provider)
        if (!recObj || recObj.recording) return

        const savedRetryCount = recObj.retryCount
        const savedKeepAlive = recObj.keepAlive

        const sites = new Sites()
        await sites.recInit({
          nametag,
          provider,
          dateformat: recObj.dateformat,
          resolutions: recObj.resolutions,
          selresolution: recObj.selresolution,
          ffmpegparams: recObj.ffmpegparams,
          referer: recObj.referer,
          keepAlive: true,
          url: recObj.url,
          cookies: recObj.cookies
        })

        const fresh = Sites.#recordings.find(n => n.nametag === nametag && n.provider === provider)
        if (fresh) {
          fresh.retryCount = savedRetryCount
          fresh.keepAlive = savedKeepAlive
        }

        if (recObj.url) {
          await sites.rec(
            nametag, 'startRec', recObj.url, 'online', provider,
            recObj.dateformat, recObj.resolutions, recObj.selresolution,
            recObj.ffmpegparams, recObj.referer, true
          )
          const afterRec = Sites.#recordings.find(n => n.nametag === nametag && n.provider === provider)
          if (afterRec) {
            afterRec.retryCount = savedRetryCount
            afterRec.keepAlive = savedKeepAlive
          }
        }
      } catch (err) {
        Logger.error(`Reconnect failed for ${nametag}:`, err.message)
      }
    }, retryDelay)
  }


  headersDefault(extra = {}) {
    return JSON.stringify({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      ...extra
    })
  }

  loadjson() {
    try {
      const configPath = path.join(Sites.#FolderMain, 'config.json')
      const config = readFileSync(configPath, 'utf8')
      return JSON.parse(config)
    } catch (error) {
      Logger.config('Error loading config:', error.message)
      return { reclist: [] }
    }
  }

  modifyjson(args) {
    try {
      const configPath = path.join(Sites.#FolderMain, 'config.json')
      const config = this.loadjson()

      const handlers = {
        reclist: (c, v) => {
          if (Array.isArray(v)) {
            c.reclist = v
          } else {
            c.reclist = c.reclist || []
            c.reclist.push(v)
          }
        },
        reclistremove: (c, v) => {
          c.reclist = (c.reclist || []).filter(
            n => !(n.nametag === v.nametag && n.provider === v.provider)
          )
        },
        reclistupdate: (c, v) => {
          const idx = (c.reclist || []).findIndex(
            r => r.nametag === v.nametag && r.provider === v.provider
          )
          if (idx !== -1) c.reclist[idx] = v
        }
      }

      if (handlers[args.raw.name]) {
        handlers[args.raw.name](config, args.raw.value)
      } else {
        config[args.raw.name] = args.raw.value
      }

      writeFileSync(configPath, JSON.stringify(config, null, 2))
    } catch (error) {
      Logger.config('Error modifying config:', error.message)
    }
  }
}
