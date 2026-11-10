import http from 'node:http'
import { URL } from 'node:url'
import { Agent, fetch as undiciFetch } from 'undici'
import Logger from './Logger.class.js'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0'

const PKEY = 'B0p93vi8Uj6AYyZb'

// Shared pool: a new Agent per request leaks sockets. family:4 because IPv6
// is broken on some networks and undici would hang on AAAA records.
const sharedAgent = new Agent({
  connections: 32,
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 60_000,
  connect: { family: 4, timeout: 10_000 }
})

async function drain(res) {
  try {
    if (res?.body && !res.body.locked) await res.body.cancel()
  } catch { /* ignore */ }
}

const TRUSTED_SUFFIXES = ['doppiocdn.media', 'doppiocdn.live', 'doppiocdn.com', 'sacdnssedge.com', 'stripchat.com']

function isTrustedUrl(urlStr) {
  try {
    const u = new URL(urlStr)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    const host = (u.hostname || '').toLowerCase()
    return TRUSTED_SUFFIXES.some((s) => host === s || host.endsWith('.' + s))
  } catch {
    return false
  }
}

const PSCH_TOKEN_RE = /#EXT-X-MOUFLON:PSCH:v2:(\S+)/g

function masterUrlOf(streamName) {
  return `https://edge-hls.doppiocdn.media/hls/${streamName}/master/${streamName}_auto.m3u8?playlistType=lowLatency`
}

/**
 * Local proxy for Stripchat HLS so ffmpeg only talks to 127.0.0.1.
 *
 * The CDN (doppiocdn.media, lowLatency playlists) only serves the real stream
 * when the variant playlist is requested with `&psch=v2&pkey=<key>`; without
 * it you get a 6s advert. This proxy:
 *
 *   /master.m3u8          -> upstream master, variants -> /media.m3u8?u=&k=
 *   /media.m3u8?u=&k=     -> upstream variant with psch/pkey, all media URLs
 *                            rewritten to /segment?u=<real url>
 *   /segment?u=           -> streams the real segment bytes
 */
class StripchatProxy {
  static #instances = new Map()

  static getProxy(nametag) {
    return StripchatProxy.#instances.get(nametag) || null
  }

  static stopProxy(nametag) {
    const proxy = StripchatProxy.#instances.get(nametag)
    if (proxy) {
      proxy.stop()
      StripchatProxy.#instances.delete(nametag)
    }
  }

  #server = null
  #port = 0
  #nametag = ''
  #streamName = ''
  #selectedResolution = null
  #monitorTimer = null
  #stopped = false
  #state = {}

  constructor(nametag, streamName, selectedResolution = null) {
    this.#nametag = nametag
    this.#streamName = streamName
    this.#selectedResolution = selectedResolution
    this.#state = {
      masterText: '',
      fallbackTokens: [],
      lastMasterFetch: 0,
      lastRequest: Date.now(),
      requestCount: 0,
      stopping: false
    }
  }

  get port() { return this.#port }
  get url() { return `http://127.0.0.1:${this.#port}/master.m3u8` }
  get stopped() { return this.#stopped }

  async start() {
    this.#server = http.createServer((req, res) => {
      this.#handle(req, res).catch((err) => {
        Logger.error(`StripchatProxy unhandled error for ${this.#nametag}:`, err.message)
        if (!res.headersSent) { res.writeHead(500); res.end() }
      })
    })

    return new Promise((resolve, reject) => {
      this.#server.listen(0, '127.0.0.1', async () => {
        this.#port = this.#server.address().port
        for (let i = 1; i <= 3; i++) {
          try {
            await this.#refreshMaster()
            break
          } catch (err) {
            if (i < 3) await new Promise((r) => setTimeout(r, 1500))
            else {
              this.#server.close()
              reject(new Error(`StripchatProxy initial master fetch failed: ${err.message}`))
              return
            }
          }
        }
        this.#startMonitor()
        StripchatProxy.#instances.set(this.#nametag, this)
        resolve(this.#port)
      })
      this.#server.on('error', (err) => reject(err))
    })
  }

  stop() {
    if (this.#stopped) return
    this.#stopped = true
    this.#state.stopping = true
    if (this.#monitorTimer) { clearInterval(this.#monitorTimer); this.#monitorTimer = null }
    this.#server?.close()
    StripchatProxy.#instances.delete(this.#nametag)
  }

  #headers() {
    return {
      'User-Agent': UA,
      Accept: '*/*',
      Referer: 'https://stripchat.com/',
      Origin: 'https://stripchat.com'
    }
  }

  async #fetchUpstream(urlStr, timeout = 12000) {
    const res = await undiciFetch(urlStr, {
      headers: this.#headers(),
      dispatcher: sharedAgent,
      signal: AbortSignal.timeout(timeout)
    })
    if (!res.ok) {
      await drain(res)
      throw new Error(`HTTP ${res.status} from ${urlStr.split('?')[0]}`)
    }
    return res
  }

  async #fetchText(urlStr, timeout) {
    const res = await this.#fetchUpstream(urlStr, timeout)
    return await res.text()
  }

  async #refreshMaster() {
    const text = await this.#fetchText(masterUrlOf(this.#streamName))
    if (!text.includes('#EXT-X-STREAM-INF') && !text.includes('.m3u8')) {
      throw new Error('master has no variants')
    }
    this.#state.masterText = text
    this.#state.fallbackTokens = [...text.matchAll(PSCH_TOKEN_RE)].map((m) => m[1])
    this.#state.lastMasterFetch = Date.now()
  }

  #filterMasterByResolution(lines, targetRes) {
    const targetHeight = parseInt(targetRes) || 0
    if (!targetHeight) return lines
    const blocks = []
    let current = []
    for (const line of lines) {
      if (line.startsWith('#EXT-X-STREAM-INF:')) {
        if (current.length) blocks.push(current)
        current = [line]
      } else if (current.length && !line.startsWith('#')) {
        current.push(line)
        blocks.push(current)
        current = []
      } else {
        if (current.length) { blocks.push(current); current = [] }
        blocks.push([line])
      }
    }
    if (current.length) blocks.push(current)

    const matched = blocks.filter((block) => {
      if (!block[0].startsWith('#EXT-X-STREAM-INF:')) return true
      const resMatch = block[0].match(/RESOLUTION=(\d+x\d+)/)
      if (!resMatch) return false
      return parseInt(resMatch[1].split('x')[1]) === targetHeight
    })
    const hasStreamMatch = matched.some((b) => b[0].startsWith('#EXT-X-STREAM-INF:'))
    return hasStreamMatch ? matched.flat() : lines
  }

  async #handle(req, res) {
    const parsedUrl = new URL(req.url, `http://127.0.0.1:${this.#port}`)
    const pathname = parsedUrl.pathname
    this.#state.lastRequest = Date.now()
    this.#state.requestCount++

    if (pathname === '/master.m3u8') {
      await this.#handleMaster(parsedUrl, res)
    } else if (pathname === '/media.m3u8') {
      await this.#handleMedia(parsedUrl, res)
    } else if (pathname === '/segment') {
      await this.#handleSegment(parsedUrl, res)
    } else {
      res.writeHead(404)
      res.end()
    }
  }

  async #handleMaster(parsedUrl, res) {
    if (!this.#state.masterText || Date.now() - this.#state.lastMasterFetch > 2000) {
      try {
        await this.#refreshMaster()
      } catch {
        if (!this.#state.masterText) {
          res.writeHead(502)
          res.end()
          return
        }
        // keep serving the last known master
      }
    }

    let lines = this.#state.masterText.replace(/\r/g, '').split('\n')
    if (this.#selectedResolution) lines = this.#filterMasterByResolution(lines, this.#selectedResolution)

    const out = []
    for (const line of lines) {
      const t = line.trim()
      if (!t || t.startsWith('#')) {
        if (t.startsWith('#EXT-X-MOUFLON')) continue // strip anti-piracy tags
        out.push(line)
      } else {
        out.push(`/media.m3u8?u=${encodeURIComponent(t)}&k=${encodeURIComponent(PKEY)}`)
      }
    }
    this.#sendHls(res, out.join('\n'))
  }

  async #handleMedia(parsedUrl, res) {
    const u = parsedUrl.searchParams.get('u')
    let k = parsedUrl.searchParams.get('k') || PKEY
    if (!u || !isTrustedUrl(u)) {
      res.writeHead(403)
      res.end()
      return
    }

    const sep = u.includes('?') ? '&' : '?'
    let text = null
    let lastErr = null
    // primary key first, then any PSCH token from the master as fallback
    const keys = [k, ...this.#state.fallbackTokens.filter((t) => t !== k)]
    for (const key of keys.slice(0, 4)) {
      try {
        const candidate = await this.#fetchText(`${u}${sep}psch=v2&pkey=${encodeURIComponent(key)}`)
        if (candidate.includes('MOUFLON-ADVERT') || !candidate.includes('#EXT')) {
          lastErr = new Error('upstream returned advert playlist')
          continue
        }
        text = candidate
        break
      } catch (err) {
        lastErr = err
        if (err.message && err.message.includes('HTTP 403')) break
      }
    }
    if (!text) {
      Logger.warn(`StripchatProxy media fetch failed for ${this.#nametag}: ${lastErr?.message}`)
      res.writeHead(502)
      res.end()
      return
    }

    // Rewrite every media URL (segment lines and URI="..." attributes) to the
    // local segment endpoint so the client only talks to this proxy.
    const out = []
    for (const rawLine of text.replace(/\r/g, '').split('\n')) {
      const line = rawLine.trimEnd()
      if (line.startsWith('#')) {
        out.push(
          line.replace(/URI="(https?:\/\/[^"]+)"/gi, (mm, uri) => {
            if (!isTrustedUrl(uri)) return mm
            return `URI="/segment?u=${encodeURIComponent(uri)}"`
          })
        )
        continue
      }
      const t = line.trim()
      if (!t) { out.push(line); continue }
      let abs = t
      if (!/^https?:/i.test(t)) {
        try { abs = new URL(t, u).href } catch { /* keep as-is */ }
      }
      if (isTrustedUrl(abs)) {
        out.push(`/segment?u=${encodeURIComponent(abs)}`)
      } else {
        out.push(t)
      }
    }
    this.#sendHls(res, out.join('\n'))
  }

  async #handleSegment(parsedUrl, res) {
    const u = parsedUrl.searchParams.get('u')
    if (!u || !isTrustedUrl(u)) {
      res.writeHead(403)
      res.end()
      return
    }
    try {
      const upstream = await undiciFetch(u, {
        headers: this.#headers(),
        dispatcher: sharedAgent,
        signal: AbortSignal.timeout(20000)
      })
      if (!upstream.ok) {
        await drain(upstream)
        res.writeHead(upstream.status)
        res.end()
        return
      }
      const buf = Buffer.from(await upstream.arrayBuffer())
      res.writeHead(200, {
        'Content-Type': upstream.headers.get('content-type') || 'video/mp4',
        'Content-Length': buf.length,
        'Cache-Control': 'no-cache'
      })
      res.end(buf)
    } catch (err) {
      Logger.warn(`StripchatProxy segment fail for ${this.#nametag}: ${err.message} ${u.split('/').pop()}`)
      res.writeHead(502)
      res.end()
    }
  }

  #sendHls(res, text) {
    const data = Buffer.from(text, 'utf-8')
    res.writeHead(200, {
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Content-Length': data.length,
      'Cache-Control': 'no-cache'
    })
    res.end(data)
  }

  #startMonitor() {
    this.#monitorTimer = setInterval(() => {
      if (this.#state.stopping) { this.stop() }
    }, 5000)
  }
}

export default StripchatProxy
