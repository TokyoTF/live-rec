export default class CamsodaExtension {
  constructor(ExtensionExtra) {
    this.config = {
      name: 'camsoda',
      color: '#ec4899',
      domain: 'camsoda.com',
      referer: true,
      use_net: true,
      patterns: ['https://*.camsoda.com/*'],
      version: '1.3.0',
      get_url_new: true
    }
    this.extension = new ExtensionExtra(this.config)
    this.status_types = this.extension.status_types
  }

  async requestApi(nametag) {
    const num = Math.floor(Math.random() * 90000) + 1000
    const url = `https://www.camsoda.com/api/v1/video/vtoken/${nametag}?username=guest_${num}`
    const res = await this.extension.fetch(url, {
      headers: {
        'Referer': 'https://www.camsoda.com/',
        'Accept': 'application/json'
      }
    })
    const text = await res.text()
    return JSON.parse(text)
  }

  getStatus(videoData) {
    if (!videoData || !videoData.stream_name) return this.status_types.OFFLINE
    const vtokenStatus = videoData.status
    if (vtokenStatus === 'online' && videoData.edge_servers?.length) return this.status_types.ONLINE
    if (vtokenStatus === 'online' && videoData.private_servers?.length) return this.status_types.PRIVATE
    return this.status_types.OFFLINE
  }

  async getInfo(nametag) {
    const videoData = await this.requestApi(nametag)
    const status = this.getStatus(videoData)
    const thumb = await this.getThumb(nametag, status)
    return { status, thumb, videoData }
  }

  async getThumb(nametag, status) {
    if (status !== this.status_types.ONLINE && status !== this.status_types.PRIVATE) return ''
    try {
      const url = `https://www.camsoda.com/${nametag}`
      const res = await this.extension.fetch(url, {
        headers: { 'Referer': 'https://www.camsoda.com/' }
      })
      const html = await res.text()
      const match = html.match(/https:\/\/media[^"'\s]*\.webp/)
      return match ? match[0] : ''
    } catch {
      return ''
    }
  }

  async extract(nametag, cachedData = null) {
    const { videoData, status, thumb } = cachedData || (await this.getInfo(nametag))

    if (status === this.status_types.OFFLINE || status === this.status_types.NOT_EXIST) {
      return this.extension.createResponse({ nametag, status, thumb })
    }

    if (!videoData || !videoData.token) {
      return this.extension.createResponse({ nametag, status: this.status_types.OFFLINE, thumb })
    }

    const serverList = status === this.status_types.PRIVATE
      ? (videoData.private_servers || [])
      : (videoData.edge_servers || [])

    let url = ''
    if (serverList.length && videoData.stream_name) {
      const server = serverList[0]
      const token = encodeURIComponent(videoData.token)
      if (server.includes('edge')) {
        url = `https://${server}/${videoData.stream_name}_v1/index.m3u8?token=${token}`
      } else {
        url = `https://${server}/${videoData.app || 'live'}/mp4:${videoData.stream_name}_aac/playlist.m3u8?token=${token}`
      }
    }

    if (!url) {
      return this.extension.createResponse({ nametag, status: this.status_types.OFFLINE, thumb })
    }

    const prefixUrl = url.slice(0, url.indexOf('playlist.m3u8') !== -1 ? url.indexOf('playlist.m3u8') : url.indexOf('index.m3u8'))
    const resolutions = status === this.status_types.ONLINE
      ? await this.extension.getResolutions(url, prefixUrl)
      : []

    return this.extension.createResponse({
      nametag,
      status,
      url,
      resolutions,
      thumb
    })
  }

  async update(nametag) {
    const { status, thumb } = await this.getInfo(nametag)
    return this.extension.createUpdate({
      status,
      thumb
    })
  }
}
