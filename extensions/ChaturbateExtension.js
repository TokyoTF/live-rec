import CBProxy from '../lib/cbProxy.class.js'

const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'

export default class ChaturbateExtension {
  constructor(ExtensionExtra) {
    this.config = {
      name: 'chaturbate',
      color: '#f97316',
      domain: 'chaturbate.com',
      referer: true,
      get_url_new: true,
      patterns: ['https://*.chaturbate.com/*', 'https://*.mmcdn.com/*'],
      version: '3.1.0'
    }
    this.extension = new ExtensionExtra(this.config)
    this.status_types = this.extension.status_types
  }

  async requestApi(nametag) {
    const body = new URLSearchParams()
    body.append('room_slug', nametag)
    body.append('bandwidth', 'high')

    const res = await fetch('https://chaturbate.com/get_edge_hls_url_ajax/', {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': IPAD_UA
      },
      body
    })

    return await res.json()
  }

  async getInfo(nametag) {
    const res = await this.requestApi(nametag)

    const status =
      res.room_status == 'public'
        ? this.status_types.ONLINE
        : res.room_status == 'private'
          ? this.status_types.PRIVATE
          : !res.success
            ? this.status_types.NOT_EXIST
            : this.status_types.OFFLINE

    return { status, thumb: this.getThumb(nametag, status), res }
  }

  getThumb(nametag, status) {
    return status == this.status_types.ONLINE || status == this.status_types.PRIVATE
      ? `https://thumb.live.mmcdn.com/riw/${nametag}.jpg`
      : 'https://web.static.mmcdn.com/images/logo.svg?hash=e41cf1a9ae04'
  }

  async #fetchPlaylist(url) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': IPAD_UA },
        signal: AbortSignal.timeout(10000)
      })
      if (!res.ok) return []
      const data = await res.text()
      const { Parser } = await import('m3u8-parser')
      const parser = new Parser()
      parser.push(data)
      parser.end()
      const playlists = parser.manifest?.playlists || []
      return playlists.map(el => {
        let resolvedUrl = el.uri
        if (!resolvedUrl.startsWith('http')) {
          const base = url.substring(0, url.lastIndexOf('/') + 1)
          resolvedUrl = base + resolvedUrl
        }
        let fps = el.attributes?.['FRAME-RATE'] || ''
        if (!fps && el.attributes?.NAME) {
          const fpsMatch = el.attributes.NAME.match(/FPS:(\d+)/)
          if (fpsMatch) fps = fpsMatch[1]
        }
        return {
          resolution: el.attributes?.RESOLUTION,
          url: resolvedUrl,
          fps: fps ? Number(fps).toFixed(0) : ''
        }
      }).sort((a, b) => (b.resolution?.height || 0) - (a.resolution?.height || 0))
    } catch {
      return []
    }
  }

  async extract(nametag, cachedData = null) {
    const { res, status, thumb } = await this.getInfo(nametag)

    if (status === this.status_types.OFFLINE || status === this.status_types.NOT_EXIST) {
      return this.extension.createResponse({ nametag, status, thumb })
    }

    const url = res.url
    const resolutions = await this.#fetchPlaylist(url)

    let finalUrl = url
    if (!url.includes('playlist.m3u8')) {
      const freshRes = await this.requestApi(nametag)
      if (freshRes && freshRes.success && freshRes.url) {
        finalUrl = freshRes.url
      }
    }

    return this.extension.createResponse({
      nametag,
      status,
      url: finalUrl,
      resolutions,
      thumb
    })
  }

  async getStreamUrlForRec(nametag, proxy = '', selectedResolution = null) {
    try {
      const existing = CBProxy.getProxy(nametag)
      if (existing && !existing.stopped) {
        const proxyAge = Date.now() - (existing.createdAt || 0)
        const MAX_PROXY_AGE = 30 * 60 * 1000
        if (proxyAge < MAX_PROXY_AGE) {
          return { url: existing.url }
        }
        console.log(`CBProxy too old (${Math.round(proxyAge / 1000)}s), recreating for ${nametag}`)
        CBProxy.stopProxy(nametag)
      }

      const res = await this.requestApi(nametag)
      if (!res || !res.success || !res.url || res.room_status !== 'public') {
        return null
      }

      const streamUrl = res.url
      const roomUrl = `https://chaturbate.com/${nametag}/`

      const cbProxy = new CBProxy(
        nametag,
        streamUrl,
        roomUrl,
        '',
        async (name, currentUrl) => {
          try {
            const fresh = await this.requestApi(name)
            if (fresh && fresh.success && fresh.url) return fresh.url
          } catch {}
          return null
        },
        selectedResolution
      )

      await cbProxy.start()
      return { url: cbProxy.url }
    } catch (err) {
      console.error(`CBProxy start failed for ${nametag}:`, err.message)
      return null
    }
  }

  async getStreamUrl(nametag, proxy = '', selectedResolution = null) {
    return this.getStreamUrlForRec(nametag, proxy, selectedResolution)
  }

  async update(nametag) {
    const { status, thumb, res } = await this.getInfo(nametag)
    return this.extension.createUpdate({
      status,
      thumb,
      url: !res.url.includes('playlist.m3u8') ? res.url : null
    })
  }
}
