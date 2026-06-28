import { Parser } from 'm3u8-parser'
import ffmpeg from 'fluent-ffmpeg'
import dateFormat from 'date-format'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import path from 'path'
import os from 'os'
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
  const options = isCBProxy
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

    let outputPath = info.outputPath || path.join(saveFolderPath, `${this.FileDate(info.nametag, info.provider, info.dateformat)}.${config.recformat || 'mkv'}`)

  const outputOpts = ['-c copy', '-bsf:a aac_adtstoasc', '-map 0:v:0', '-map 0:a:0', ...extraParams]

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
      retryMax: 20,
      retryDelay: 4000
    }

    command.on('codecData', (data) => {
      recObj.codec = data
    })

    command.on('progress', (progress) => {
      recObj.stats = progress
    })

    command.on('error', (err) => {
      Logger.error(`ffmpeg error (${info.nametag}):`, err.message)
      const r = Sites.#recordings.find(n => n.nametag === info.nametag && n.provider === info.provider)
      if (r && !r.paused) r.recording = false
      if (Sites.#onError) Sites.#onError({ nametag: info.nametag, provider: info.provider, error: this.errorFormat(info.nametag, info.provider, err.message) })
    })

    command.on('end', () => {
      const r = Sites.#recordings.find(n => n.nametag === info.nametag && n.provider === info.provider)

      if (r && r.keepAlive && r.retryCount < r.retryMax) {
        r.retryCount++
        Logger.info(`Stream ended, attempting reconnect ${r.retryCount}/${r.retryMax} for ${info.nametag}...`)
        r.recording = false

        setTimeout(() => {
          this.recInit({
            nametag: info.nametag,
            provider: info.provider,
            dateformat: info.dateformat,
            resolutions: info.resolutions,
            selresolution: info.selresolution,
            ffmpegparams: info.ffmpegparams,
            referer: info.referer,
            keepAlive: true
          })
        }, r.retryDelay)
      } else {
        Logger.stop(`Recording finished: ${info.nametag}`)
        if (r) {
          r.recording = false
          r.keepAlive = false
        }
      }
    })

    const index = Sites.#recordings.findIndex(r => r.nametag === info.nametag && r.provider === info.provider)
    if (index !== -1) {
      if (Sites.#recordings[index].recording) {
        Logger.info(`Recording already active for ${info.nametag}, skipping re-initialization.`)
        return Sites.#recordings[index].objectFFmpeg
      }
      Sites.#recordings[index] = recObj
    } else {
      Sites.#recordings.push(recObj)
    }

    return command
  }

  async rec(nametag, type, url, status, provider, dateformat,resolutions,selresolution, ffmpegparams, referer = '', keepAlive = true) {
    try {
      let recording = Sites.#recordings.find(r => r.nametag === nametag && r.provider === provider)

      if (!recording) {
        if (type === 'startRec') {
          await this.recInit({ nametag, provider, dateformat,resolutions, selresolution, ffmpegparams, referer, keepAlive })
          return this.rec(nametag, type, url, status, provider, dateformat, null, null, ffmpegparams, referer, keepAlive)
        }
        return false
      }

      if (type === 'startRec' && !recording.recording && url && status === 'online') {
        // Always re-initialize to ensure a fresh FFmpeg instance
        await this.recInit({ nametag, provider, dateformat,resolutions,selresolution, ffmpegparams, referer, keepAlive })
        recording = Sites.#recordings.find(r => r.nametag === nametag && r.provider === provider)

        const { objectFFmpeg: command } = recording
        Logger.ffmpeg(`Starting process for ${nametag}: ${url}`)
        recording.recording = true
        recording.paused = false
  command.input(url)
  command.inputOptions([...recording.inputOptions, '-referer', referer])
  .on('start', (cmdline) => {
    Logger.info(`ffmpeg cmd: ${cmdline}`)
    Logger.success(`Process started: ${nametag}-${provider}`)
            recording.realtime = true
            recording.startTime = Date.now()
            recording.pausedAccumulator = 0
            recording.pausedAt = null
          })

  // Delay to ensure stream is ready
  setTimeout(() => command.run(), 2000)
      } else if (type === 'startRec' && recording.paused && url && status === 'online') {
        // Resume from paused (private) state: preserve timings and update the command
        Logger.info(`Resuming recording for ${nametag} after private: ${url}`)

        // Calculate new accumulator
        recording.pausedAccumulator += (recording.pausedAt ? (Date.now() - recording.pausedAt) : 0)
        recording.pausedAt = null
        recording.paused = false
        recording.recording = true

        // Re-initialize a fresh FFmpeg instance with the same output path for continuous recording
        await this.recInit({ nametag, provider, dateformat,resolutions,selresolution, ffmpegparams, referer, keepAlive, outputPath: recording.outputPath })
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
        try { recording.objectFFmpeg.kill() } catch (e) { /* already dead */ }
        if (provider === 'chaturbate') CBProxy.stopProxy(nametag)
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
        }
 else if (status === 'private') {
          const config = this.loadjson()
          if (config.pauseforprivate !== false) {
            if (!recording.paused && (recording.recording || recording.startTime)) {
              Logger.info(`Model ${nametag} went private, pausing recording.`)
              recording.paused = true
              recording.pausedAt = Date.now()
              recording.recording = false
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
      Sites.#recordings.splice(index, 1)
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
      timeRec: this.getRecTime(rec)
    } : null
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


  errorFormat(nametag,provider,error) {
    if (error.includes('code 3436169992')) {
      return `Error ${nametag} - ${provider}: Error opening input file`
    } else if (error.includes('ffmpeg was killed with signal SIGKILL')) {
      return `Rec ${nametag} - ${provider}: stopped`
    }
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
