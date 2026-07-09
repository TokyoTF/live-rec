import http from 'node:http'
import zlib from 'node:zlib'
import { URL } from 'node:url'
import { fetch as undiciFetch, ProxyAgent } from 'undici'
import Logger from './Logger.class.js'

const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'

const CHUNKLIST_NAME_RE = /((?:chunklist|audio)_\w+)/

const TRUSTED_SUFFIXES = ['chaturbate.com', 'mmcdn.com', 'highwebmedia.com']

function isTrustedUrl(urlStr) {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = (u.hostname || '').toLowerCase()
    return TRUSTED_SUFFIXES.some(s => host === s || host.endsWith('.' + s))
  } catch { return false }
}

function baseUrlOf(url) {
  const idx = url.lastIndexOf('/')
  return idx !== -1 ? url.substring(0, idx + 1) : url + '/'
}

function fileNameOf(url) {
  const afterSlash = url.substring(url.lastIndexOf('/') + 1)
  return afterSlash.split('?')[0]
}

function harvestChunklistMap(absolutized) {
  const out = {}
  for (const line of absolutized.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('chunklist_')) continue
    const m = CHUNKLIST_NAME_RE.exec(trimmed)
    if (m) out[m[1]] = trimmed
  }
  for (const mi of absolutized.matchAll(/URI="(https?:\/\/[^"]*chunklist_[^"]*)"/gi)) {
    const m = CHUNKLIST_NAME_RE.exec(mi[1])
    if (m) out[m[1]] = mi[1]
  }
  return out
}

async function decompressBody(buffer, res) {
  const ce = (res.headers.get('content-encoding') || '').toLowerCase()
  if (ce === 'gzip' || buffer[0] === 0x1f && buffer[1] === 0x8b) {
    try { return await zlib.promises.gunzip(buffer) } catch {}
  } else if (ce === 'deflate') {
    try { return await zlib.promises.inflate(buffer) } catch {
      try { return await zlib.promises.inflate(buffer, { finishFlush: zlib.Z_SYNC_FLUSH }) } catch {}
    }
  }
  return buffer
}

const ENDLIST_BODY = Buffer.from(
  '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-PLAYLIST-TYPE:VOD\n' +
  '#EXT-X-TARGETDURATION:1\n#EXT-X-MEDIA-SEQUENCE:0\n' +
  '#EXTINF:0.001,\nabout:blank\n#EXT-X-ENDLIST\n', 'utf-8'
)

class CBProxy {
  static #instances = new Map()

  static getProxy(nametag) {
    return CBProxy.#instances.get(nametag) || null
  }

  static stopProxy(nametag) {
    const proxy = CBProxy.#instances.get(nametag)
    if (proxy) {
      proxy.stop()
      CBProxy.#instances.delete(nametag)
    }
  }

  #server = null
  #port = 0
  #nametag = ''
  #state = {}
  #monitorTimer = null
  #reconnectTimer = null
  #stopped = false
  #proxyDead = false
  #onRefreshUrl = null
  #selectedResolution = null
  #lastMasterTime = 0
  createdAt = 0

  constructor(nametag, streamUrl, roomUrl, proxy = '', onRefreshUrl = null, selectedResolution = null) {
    this.#nametag = nametag
    this.#onRefreshUrl = onRefreshUrl
    this.#selectedResolution = selectedResolution
    this.createdAt = Date.now()
    this.#state = {
      streamUrl,
      headers: {
        'User-Agent': IPAD_UA,
        'Referer': roomUrl
      },
      proxy,
      urlMap: {},
      chunklistCache: {},
      segCdnUrls: {},
      latestSeg: {},
      lastRefresh: 0,
      lastRequest: Date.now(),
      requestCount: 0,
      reconnecting: false,
      stopping: false,
      terminal: false,
      masterBody: Buffer.from('#EXTM3U\n#EXT-X-VERSION:3\n', 'utf-8')
    }
  }

  get port() { return this.#port }
  get url() { return `http://127.0.0.1:${this.#port}/master.m3u8` }
  get stopped() { return this.#stopped }

  async start() {
    this.#server = http.createServer((req, res) => {
      this.#handle(req, res).catch(err => {
        // Logger.error(`CBProxy unhandled error for ${this.#nametag}:`, err.message)
        if (!res.headersSent) { res.writeHead(500); res.end() }
      })
    })

    return new Promise((resolve, reject) => {
      this.#server.listen(0, '127.0.0.1', async () => {
        this.#port = this.#server.address().port
        // Logger.info(`CBProxy started for ${this.#nametag} on port ${this.#port}`)

        for (let i = 1; i <= 5; i++) {
          try {
            await this.#buildInitialState()
            // Logger.info(`CBProxy initial build OK for ${this.#nametag}`)
            break
          } catch (err) {
            // Logger.error(`CBProxy initial build attempt ${i}/5 failed for ${this.#nametag}: ${err.message}`)
            if (i < 5) await new Promise(r => setTimeout(r, 2000))
            else {
              this.#server.close()
              reject(new Error(`CBProxy initial build failed after 5 attempts: ${err.message}`))
              return
            }
          }
        }

        this.#startMonitor()
        CBProxy.#instances.set(this.#nametag, this)
        resolve(this.#port)
      })

      this.#server.on('error', (err) => {
        // Logger.error(`CBProxy server error for ${this.#nametag}:`, err.message)
        reject(err)
      })
    })
  }

  stop() {
    if (this.#stopped) return
    this.#stopped = true
    this.#state.stopping = true
    // Logger.info(`CBProxy stopping for ${this.#nametag}`)
    if (this.#monitorTimer) { clearInterval(this.#monitorTimer); this.#monitorTimer = null }
    if (this.#reconnectTimer) { clearTimeout(this.#reconnectTimer); this.#reconnectTimer = null }
    this.#server?.close()
    CBProxy.#instances.delete(this.#nametag)
  }

  async #fetchUpstream(urlStr) {
    const proxy = this.#state.proxy
    const headers = { ...this.#state.headers }
    const proxyUrl = proxy ? (proxy.includes('://') ? proxy : `http://${proxy}`) : null

    if (proxyUrl && !this.#proxyDead) {
      try {
        const dispatcher = new ProxyAgent(proxyUrl, { connect: { timeout: 5000 } })
        const res = await undiciFetch(urlStr, { headers, dispatcher, signal: AbortSignal.timeout(8000) })
        if (res.ok) return res
        // Logger.warn(`CBProxy proxy HTTP ${res.status} for ${this.#nametag}, marking dead`)
        this.#proxyDead = true
      } catch (err) {
        // Logger.warn(`CBProxy proxy dead for ${this.#nametag}: ${err.message}`)
        this.#proxyDead = true
      }
    }

    const res = await fetch(urlStr, { headers, signal: AbortSignal.timeout(10000) })
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${urlStr.split('?')[0]}`)
    return res
  }

  async #fetchBody(urlStr) {
    const res = await this.#fetchUpstream(urlStr)
    const raw = Buffer.from(await res.arrayBuffer())
    const body = await decompressBody(raw, res)
    return body.toString('utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  }

  async #fetchRaw(urlStr) {
    const res = await this.#fetchUpstream(urlStr)
    const raw = Buffer.from(await res.arrayBuffer())
    const body = await decompressBody(raw, res)
    const ct = res.headers.get('content-type') || 'video/mp4'
    return { body, ct }
  }

  #absolutize(text, baseUrl) {
    let result = text
    result = result.replace(/^(?!https?:\/\/)(?!#)(.+)$/gm, (m, p1) => {
      try { return new URL(p1, baseUrl).href } catch { return p1 }
    })
    result = result.replace(/URI="(?!https?:\/\/)(.*?)"/gi, (m, p1) => {
      try { return `URI="${new URL(p1, baseUrl).href}"` } catch { return m }
    })
    return result
  }

  #rewriteMasterForClient(absolutized) {
    const lines = absolutized.split('\n')
    const inputStreamInfCount = lines.filter(l => l.startsWith('#EXT-X-STREAM-INF:')).length
    const filtered = this.#selectedResolution
      ? this.#filterByResolution(lines, this.#selectedResolution)
      : lines
    const sorted = this.#sortByBandwidthDescending(filtered)

    let result = sorted.join('\n')
    result = result.replace(/^(https?:\/\/[^\s]+\.m3u8[^\s]*)$/gm, (m, url) => {
      const nm = CHUNKLIST_NAME_RE.exec(url)
      if (!nm) return url
      return `http://127.0.0.1:${this.#port}/chunklist?name=${nm[1]}`
    })
    result = result.replace(/URI="(https?:\/\/[^"]+\.m3u8[^"]*)"/gi, (m, url) => {
      const nm = CHUNKLIST_NAME_RE.exec(url)
      if (!nm) return m
      return `URI="http://127.0.0.1:${this.#port}/chunklist?name=${nm[1]}"`
    })
    const outputStreamInfCount = result.split('\n').filter(l => l.startsWith('#EXT-X-STREAM-INF:')).length
    if (inputStreamInfCount !== outputStreamInfCount) {
      // Logger.warn(`CBProxy rewriteMaster: stream-inf count changed ${inputStreamInfCount} → ${outputStreamInfCount} for ${this.#nametag}`)
    }
    return result
  }

  #filterByResolution(lines, targetRes) {
    const target = targetRes.toString().trim()
    const targetHeight = parseInt(target) || 0
    const targetFull = target.includes('x') ? target : null

    const streamBlocks = []
    let current = []
    for (const line of lines) {
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        if (current.length > 0) streamBlocks.push(current)
        current = [line]
      } else if (current.length > 0 && !line.startsWith('#EXT')) {
        current.push(line)
      } else {
        if (current.length > 0) { streamBlocks.push(current); current = [] }
        streamBlocks.push([line])
      }
    }
    if (current.length > 0) streamBlocks.push(current)

    const matched = streamBlocks.filter(block => {
      if (!block[0].startsWith('#EXT-X-STREAM-INF:')) return true
      const resMatch = block[0].match(/RESOLUTION=(\d+x\d+)/)
      if (!resMatch) return false
      const [, res] = resMatch
      if (targetFull) return res === targetFull
      const height = parseInt(res.split('x')[1])
      return height === targetHeight
    })

    const streamMatchCount = matched.filter(block => block[0].startsWith('#EXT-X-STREAM-INF:')).length
    if (streamMatchCount === 0) {
      // Logger.warn(`CBProxy resolution ${targetRes} not found, using all variants`)
      return lines
    }
    return matched.flat()
  }

  #sortByBandwidthDescending(lines) {
    const streamBlocks = []
    let current = []
    for (const line of lines) {
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        if (current.length > 0) streamBlocks.push(current)
        current = [line]
      } else if (current.length > 0 && !line.startsWith('#EXT')) {
        current.push(line)
      } else {
        if (current.length > 0) { streamBlocks.push(current); current = [] }
        streamBlocks.push([line])
      }
    }
    if (current.length > 0) streamBlocks.push(current)

    streamBlocks.sort((a, b) => {
      const bwA = parseInt((a[0].match(/BANDWIDTH=(\d+)/) || [])[1] || '0')
      const bwB = parseInt((b[0].match(/BANDWIDTH=(\d+)/) || [])[1] || '0')
      return bwB - bwA
    })

    const result = []
    const nonStream = []
    for (const block of streamBlocks) {
      if (block[0].startsWith('#EXT-X-STREAM-INF:')) {
        result.push(...block)
      } else {
        nonStream.push(...block)
      }
    }
    return [...nonStream, ...result]
  }

  #rewriteChunklistForClient(absolutized) {
    let result = absolutized
    result = result.replace(/^(https?:\/\/[^\s]+\.m4s[^\s]*)$/gm, (m, url) => {
      const fname = fileNameOf(url)
      return `http://127.0.0.1:${this.#port}/segment/${fname}?url=${encodeURIComponent(url)}`
    })
    result = result.replace(/URI="(https?:\/\/[^"]+\.m4s[^"]*)"/gi, (m, url) => {
      const fname = fileNameOf(url)
      return `URI="http://127.0.0.1:${this.#port}/segment/${fname}?url=${encodeURIComponent(url)}"`
    })
    result = result.replace(/URI="(https?:\/\/[^"]+\.m3u8[^"]*)"/gi, (m, url) => {
      const nm = CHUNKLIST_NAME_RE.exec(url)
      if (!nm) return m
      return `URI="http://127.0.0.1:${this.#port}/chunklist?name=${nm[1]}"`
    })
    return result
  }

  #harvestSegmentMaps(absolutized, typeKey) {
    for (const line of absolutized.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('.m4s')) continue
      const segName = fileNameOf(trimmed)
      this.#state.segCdnUrls[segName] = trimmed
      if (typeKey) this.#state.latestSeg[typeKey] = trimmed
    }
  }

  async #buildInitialState() {
    const text = await this.#fetchBody(this.#state.streamUrl)
    // Logger.info(`CBProxy raw upstream (${text.length}B) for ${this.#nametag}: ${text.substring(0, 600)}`)
    if (!text.includes('#EXTINF') && !text.includes('chunklist') && !text.includes('#EXT-X-STREAM-INF')) {
      throw new Error('master playlist has no valid content')
    }
    const base = baseUrlOf(this.#state.streamUrl)
    const absolutized = this.#absolutize(text, base)
    this.#state.urlMap = harvestChunklistMap(absolutized)
    const rewritten = this.#rewriteMasterForClient(absolutized)
    const hasStreamInf = rewritten.includes('#EXT-X-STREAM-INF')
    // Logger.info(`CBProxy build initial: urlMap keys=${Object.keys(this.#state.urlMap).join(',')} hasStreamInf=${hasStreamInf}`)
    this.#state.masterBody = Buffer.from(rewritten, 'utf-8')
  }

  async #refreshStreamUrl() {
    if (!this.#onRefreshUrl) return null
    try {
      // Logger.info(`CBProxy requesting new stream URL for ${this.#nametag} (proxy dead=${this.#proxyDead})`)
      const newUrl = await this.#onRefreshUrl(this.#nametag, '')
      if (newUrl && newUrl !== this.#state.streamUrl) {
        // Logger.info(`CBProxy got new stream URL for ${this.#nametag}: ${newUrl.split('?')[0]}`)
        this.#state.streamUrl = newUrl
        this.#proxyDead = false
        return newUrl
      }
      if (newUrl) {
        this.#state.streamUrl = newUrl
        this.#proxyDead = false
        return newUrl
      }
    } catch (err) {
      // Logger.error(`CBProxy refreshStreamUrl failed for ${this.#nametag}: ${err.message}`)
    }
    return null
  }

  async #refreshSession() {
    const now = Date.now()
    if (now - this.#state.lastRefresh < 2000) return false
    this.#state.lastRefresh = now

    try {
      let text = await this.#fetchBody(this.#state.streamUrl)
      if (!text.includes('#EXTINF') && !text.includes('chunklist') && !text.includes('#EXT-X-STREAM-INF')) {
        if (this.#proxyDead) {
          const newUrl = await this.#refreshStreamUrl()
          if (newUrl) text = await this.#fetchBody(newUrl)
        }
        if (!text.includes('#EXTINF') && !text.includes('chunklist') && !text.includes('#EXT-X-STREAM-INF')) {
          throw new Error('refresh got invalid content')
        }
      }

      const base = baseUrlOf(this.#state.streamUrl)
      const absolutized = this.#absolutize(text, base)
      const newMap = harvestChunklistMap(absolutized)

      Object.assign(this.#state.urlMap, newMap)
      this.#state.chunklistCache = {}
      this.#state.segCdnUrls = {}
      this.#state.latestSeg = {}
      this.#state.masterBody = Buffer.from(this.#rewriteMasterForClient(absolutized), 'utf-8')

      // Logger.info(`CBProxy session refreshed for ${this.#nametag} keys=${Object.keys(newMap).join(',')}`)
      return true
    } catch (err) {
      if (this.#proxyDead) {
        const newUrl = await this.#refreshStreamUrl()
        if (newUrl) {
          try {
            const text = await this.#fetchBody(newUrl)
            const base = baseUrlOf(newUrl)
            const absolutized = this.#absolutize(text, base)
            const newMap = harvestChunklistMap(absolutized)

            Object.assign(this.#state.urlMap, newMap)
            this.#state.chunklistCache = {}
            this.#state.segCdnUrls = {}
            this.#state.latestSeg = {}
            this.#state.masterBody = Buffer.from(this.#rewriteMasterForClient(absolutized), 'utf-8')

            // Logger.info(`CBProxy session refreshed (new URL) for ${this.#nametag} keys=${Object.keys(newMap).join(',')}`)
            return true
          } catch (err2) {
            // Logger.error(`CBProxy refresh with new URL failed for ${this.#nametag}: ${err2.message}`)
          }
        }
      }
      // Logger.error(`CBProxy refresh failed for ${this.#nametag}: ${err.message}`)
      return false
    }
  }

  #triggerReconnect(reason) {
    if (this.#state.reconnecting || this.#state.stopping || this.#state.terminal) return
    this.#state.reconnecting = true
    // Logger.info(`CBProxy reconnect triggered for ${this.#nametag}: ${reason}`)

    let attempt = 0
    const tryReconnect = async () => {
      if (this.#state.stopping || this.#state.terminal) { this.#state.reconnecting = false; return }
      attempt++
      if (attempt > 5) {
        // Logger.error(`CBProxy reconnect exhausted for ${this.#nametag}`)
        this.#state.reconnecting = false
        this.#state.terminal = true
        return
      }

      const ok = await this.#refreshSession()
      if (ok) {
        // Logger.info(`CBProxy reconnect OK for ${this.#nametag} attempt ${attempt}`)
        this.#state.reconnecting = false
        return
      }

      this.#reconnectTimer = setTimeout(tryReconnect, 2000)
    }

    tryReconnect()
  }

  async #handle(req, res) {
    const parsedUrl = new URL(req.url, `http://127.0.0.1:${this.#port}`)
    const pathname = parsedUrl.pathname

    this.#state.lastRequest = Date.now()
    this.#state.requestCount++

    if (pathname === '/chunklist') {
      // Logger.info(`CBProxy req #${this.#state.requestCount} ${pathname}${parsedUrl.search} for ${this.#nametag}`)
      await this.#handleChunklist(parsedUrl, res)
    } else if (pathname.startsWith('/segment')) {
      // Logger.info(`CBProxy req #${this.#state.requestCount} ${pathname}${parsedUrl.search} for ${this.#nametag}`)
      await this.#handleSegment(parsedUrl, res)
    } else {
      const now = Date.now()
      const sinceLast = now - this.#lastMasterTime
      if (sinceLast < 500) {
        this.#sendHls(res, this.#state.masterBody)
        return
      }
      this.#lastMasterTime = now
      // Logger.info(`CBProxy master body (${this.#state.masterBody.length}B) for ${this.#nametag}: ${this.#state.masterBody.toString('utf-8').substring(0, 600)}`)
      this.#sendHls(res, this.#state.masterBody)
    }
  }

  async #handleChunklist(parsedUrl, res) {
    if (this.#state.terminal) {
      this.#sendHls(res, ENDLIST_BODY)
      return
    }

    const name = parsedUrl.searchParams.get('name')
    if (!name) { res.writeHead(400); res.end(); return }

    const cdnUrl = this.#state.urlMap[name]
    if (!cdnUrl) {
      // Logger.warn(`CBProxy chunklist name=${name} not in urlMap for ${this.#nametag}`)
      const cached = this.#state.chunklistCache[name]
      if (cached) { this.#sendHls(res, cached); return }
      this.#sendHls(res, ENDLIST_BODY)
      return
    }

    try {
      const text = await this.#fetchBody(cdnUrl)
      const base = baseUrlOf(cdnUrl)
      const absolutized = this.#absolutize(text, base)
      this.#harvestSegmentMaps(absolutized, name)
      const rewritten = this.#rewriteChunklistForClient(absolutized)
      const payload = Buffer.from(rewritten, 'utf-8')
      this.#state.chunklistCache[name] = payload
      // Logger.info(`CBProxy chunklist OK name=${name} (${payload.length}B) for ${this.#nametag}`)
      this.#sendHls(res, payload)
    } catch (err) {
      // Logger.error(`CBProxy chunklist fail for ${this.#nametag} name=${name}: ${err.message}`)
      this.#triggerReconnect(`chunklist fail name=${name}: ${err.message}`)

      if (this.#state.stopping || this.#state.terminal) {
        this.#sendHls(res, ENDLIST_BODY)
        return
      }

      const cached = this.#state.chunklistCache[name]
      if (cached) {
        // Logger.info(`CBProxy serving cached chunklist for ${name}`)
        this.#sendHls(res, cached)
        return
      }

      this.#sendHls(res, ENDLIST_BODY)
    }
  }

  async #handleSegment(parsedUrl, res) {
    if (this.#state.terminal) { res.writeHead(410); res.end(); return }

    const segUrl = parsedUrl.searchParams.get('url')
    if (!segUrl) { res.writeHead(400); res.end(); return }
    if (!isTrustedUrl(segUrl)) {
      // Logger.warn(`CBProxy segment SSRF blocked: ${segUrl}`)
      res.writeHead(403); res.end(); return
    }

    const segName = fileNameOf(segUrl)

    try {
      const { body, ct } = await this.#fetchRaw(segUrl)
      // Logger.info(`CBProxy segment OK ${segName} (${body.length}B) for ${this.#nametag}`)
      res.writeHead(200, { 'Content-Type': ct, 'Content-Length': body.length })
      res.end(body)
      return
    } catch (err) {
      // Logger.error(`CBProxy segment fail tier1 ${segName}: ${err.message}`)
      this.#triggerReconnect(`segment fail: ${segName}`)
    }

    const fallback = this.#state.segCdnUrls[segName]
    if (fallback && fallback !== segUrl && isTrustedUrl(fallback)) {
      try {
        const { body, ct } = await this.#fetchRaw(fallback)
        res.writeHead(200, { 'Content-Type': ct, 'Content-Length': body.length })
        res.end(body)
        return
      } catch {}
    }

    const tm = segName.match(/(video|audio)_(\d+)/)
    if (tm) {
      for (const [tk, latestUrl] of Object.entries(this.#state.latestSeg)) {
        if (tk.includes(tm[1]) && tk.includes(tm[2]) && isTrustedUrl(latestUrl)) {
          try {
            const { body, ct } = await this.#fetchRaw(latestUrl)
            res.writeHead(200, { 'Content-Type': ct, 'Content-Length': body.length })
            res.end(body)
            return
          } catch { break }
        }
      }
    }

    res.writeHead(502)
    res.end()
  }

  #sendHls(res, data) {
    res.writeHead(200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache'
    })
    res.end(data)
  }

  #startMonitor() {
    this.#monitorTimer = setInterval(() => {
      if (this.#state.stopping) { this.stop(); return }
      const idle = Date.now() - this.#state.lastRequest
      if (idle > 30000 && this.#state.requestCount > 0) {
        // Logger.info(`CBProxy idle 30s, stopping for ${this.#nametag}`)
        this.stop()
      }
    }, 5000)
  }
}

export default CBProxy
