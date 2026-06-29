import http from 'node:http'
import zlib from 'node:zlib'
import { URL } from 'node:url'
import { BrowserWindow } from 'electron'
import Logger from './logger.class.js'

async function decompressBody(buffer, headers) {
  const ce = (headers.get('content-encoding') || '').toLowerCase()
  if (ce === 'gzip' || (buffer.length > 2 && buffer[0] === 0x1f && buffer[1] === 0x8b)) {
    try { return await zlib.promises.gunzip(buffer) } catch {}
  } else if (ce === 'deflate') {
    try { return await zlib.promises.inflate(buffer) } catch {
      try { return await zlib.promises.inflate(buffer, { finishFlush: zlib.Z_SYNC_FLUSH }) } catch {}
    }
  } else if (ce === 'br') {
    try { return await zlib.promises.brotliDecompress(buffer) } catch {}
  }
  return buffer
}

let cfWindow = null
let cfReady = false

async function getCfWindow() {
  if (cfWindow && !cfWindow.isDestroyed() && cfReady) return cfWindow
  if (cfWindow && !cfWindow.isDestroyed()) {
    try { await cfWindow.loadURL('https://www.camsoda.com/') } catch {}
    await new Promise(r => setTimeout(r, 3000))
    cfReady = true
    return cfWindow
  }
  cfReady = false
  cfWindow = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    webPreferences: { webSecurity: false, contextIsolation: true, nodeIntegration: false }
  })
  cfWindow.on('closed', () => { cfWindow = null; cfReady = false })
  try { await cfWindow.loadURL('https://www.camsoda.com/') } catch {}
  await new Promise(r => setTimeout(r, 5000))
  cfReady = true
  return cfWindow
}

function toProxyUrl(resolved, port) {
  const isCrossOrigin = resolved.hostname !== '127.0.0.1'
  const hostPart = isCrossOrigin ? resolved.host : ''
  return `http://127.0.0.1:${port}${hostPart}${resolved.pathname}${resolved.search}`
}

function rewriteM3u8(content, port, baseProxyUrl) {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  return lines.map(line => {
    const trimmed = line.trim()
    if (!trimmed) return ''

    const mapMatch = trimmed.match(/^(#EXT-X-MAP:.*URI=")([^"]+)(")/)
    if (mapMatch) {
      const resolved = new URL(mapMatch[2], baseProxyUrl)
      return `${mapMatch[1]}${toProxyUrl(resolved, port)}${mapMatch[3]}`
    }

    const mediaMatch = trimmed.match(/^(#EXT-X-MEDIA:.*URI=")([^"]+)(")/)
    if (mediaMatch) {
      const resolved = new URL(mediaMatch[2], baseProxyUrl)
      return `${mediaMatch[1]}${toProxyUrl(resolved, port)}${mediaMatch[3]}`
    }

    const iFrameMatch = trimmed.match(/^(#EXT-X-I-FRAME-STREAM-INF:.*URI=")([^"]+)(")/)
    if (iFrameMatch) {
      const resolved = new URL(iFrameMatch[2], baseProxyUrl)
      return `${iFrameMatch[1]}${toProxyUrl(resolved, port)}${iFrameMatch[3]}`
    }

    const streamMatch = trimmed.match(/^(#EXT-X-STREAM-INF:.*)(,URI=")([^"]+)(")/)
    if (streamMatch) {
      const resolved = new URL(streamMatch[3], baseProxyUrl)
      return `${streamMatch[1]}${streamMatch[2]}${toProxyUrl(resolved, port)}${streamMatch[4]}`
    }

    if (!trimmed.startsWith('#')) {
      try {
        const resolved = new URL(trimmed, baseProxyUrl)
        return toProxyUrl(resolved, port)
      } catch {}
    }

    return trimmed
  }).join('\n').replace(/\.hls\.fmp4/g, '.mp4')
}

export default class CamsodaProxy {
  #server = null
  #port = 0

  async start() {
    if (this.#server) return this.#port
    await getCfWindow()

    this.#server = http.createServer(async (req, res) => {
      try {
        const pathWithHost = req.url.substring(1)
        const firstSlash = pathWithHost.indexOf('/')
        if (firstSlash === -1) {
          res.writeHead(400)
          res.end('Bad Request')
          return
        }
        const hostname = pathWithHost.substring(0, firstSlash)
        const pathAndQuery = pathWithHost.substring(firstSlash)
        const origPathAndQuery = pathAndQuery.replace(/\.mp4(?=\?|$)/g, '.hls.fmp4')
        const targetUrl = `https://${hostname}${origPathAndQuery}`

        const win = await getCfWindow()
        if (!win || win.isDestroyed()) {
          res.writeHead(503)
          res.end('Proxy unavailable')
          return
        }

        const fetchRes = await win.webContents.session.fetch(targetUrl, {
          method: req.method,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0',
            'Referer': 'https://www.camsoda.com/',
            'Accept': '*/*',
            'Accept-Encoding': 'gzip, deflate'
          }
        })

        const contentType = fetchRes.headers.get('content-type') || ''
        const rawBody = Buffer.from(await fetchRes.arrayBuffer())
        const body = await decompressBody(rawBody, fetchRes.headers)

        const isM3u8 = contentType.includes('mpegurl') || contentType.includes('x-mpegurl') || targetUrl.includes('.m3u8')

        // Logger.info(`CamsodaProxy ${fetchRes.status} ${isM3u8 ? 'm3u8' : 'segment'} ${body.length}b ${targetUrl.substring(0, 100)}`)

        if (isM3u8) {
          let text = body.toString('utf-8')
          if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1)

          if (!text.trimStart().startsWith('#EXTM3U')) {
            // Logger.info(`CamsodaProxy m3u8 response not valid (status ${fetchRes.status}), first 200 chars: ${text.trimStart().substring(0, 200)}`)
            res.writeHead(fetchRes.status, {
              'Content-Type': contentType || 'text/plain',
              'Content-Length': body.length
            })
            res.end(body)
            return
          }

          const baseProxyUrl = `http://127.0.0.1:${this.#port}/${hostname}${pathAndQuery}`
          const rewritten = rewriteM3u8(text, this.#port, baseProxyUrl)
          // Logger.info(`CamsodaProxy m3u8 rewrite:\n${rewritten}`)
          const out = Buffer.from(rewritten, 'utf-8')
          res.writeHead(fetchRes.status, {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Content-Length': out.length
          })
          res.end(out)
        } else {
          if (body.length < 2048) {
            // Logger.info(`CamsodaProxy segment hex (${body.length}b): ${body.subarray(0, Math.min(64, body.length)).toString('hex')}`)
          }
          const headers = { 'Content-Type': contentType || 'application/octet-stream', 'Content-Length': body.length }
          res.writeHead(fetchRes.status, headers)
          res.end(body)
        }
      } catch (err) {
        // Logger.error(`CamsodaProxy error: ${err.message}`)
        res.writeHead(502)
        res.end('Bad Gateway')
      }
    })

    return new Promise((resolve) => {
      this.#server.listen(0, '127.0.0.1', () => {
        this.#port = this.#server.address().port
        // Logger.info(`CamsodaProxy listening on port ${this.#port}`)
        resolve(this.#port)
      })
    })
  }

  getPort() { return this.#port }

  proxyUrl(originalUrl) {
    try {
      const u = new URL(originalUrl)
      return `http://127.0.0.1:${this.#port}/${u.host}${u.pathname}${u.search}`
    } catch { return originalUrl }
  }

  stop() {
    if (this.#server) {
      this.#server.close()
      this.#server = null
      this.#port = 0
    }
  }
}
