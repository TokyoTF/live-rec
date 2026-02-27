export default class Cam4Extension {
  constructor(ExtensionExtra) {
    this.config = {
      name: 'cam4',
      color: '#3b82f6',
      domain: 'cam4.com',
      referer: true,
      patterns: ['https://*.cam4.com/*', 'https://*.xcdnpro.com/*'],
      version: '1.0.0',
    }
    this.extension = new ExtensionExtra(this.config)
    this.status_types = this.extension.status_types
  }

  async requestApi(nametag) {
    const res = await this.extension.fetch('https://webchat.cam4.com/requestAccess?roomname=' + nametag, {
      method: 'POST',
      headers: { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' }
    })
    return await res.json()
  }

  async getStreamInfo(nametag) {
    const res = await this.extension.fetch('https://cam4.com/rest/v1.0/profile/' + nametag + '/streamInfo', {
      headers: { Referer: 'https://cam4.com/' + nametag }
    })
    return res.status == 200 ? await res.json() : null
  }

  getFinalStatus(apiRes, streamInfo) {
    if (apiRes.status == 'success' && streamInfo?.canUseCDN) return this.status_types.ONLINE
    if (apiRes.privateStream || apiRes.privateRoom || (streamInfo && !streamInfo.canUseCDN)) return this.status_types.PRIVATE
    if (apiRes.status == 'roomOffline' || !streamInfo) return this.status_types.OFFLINE
    return this.status_types.NOT_EXIST
  }

  async getInfo(nametag) {
    const [apiRes, streamInfo] = await Promise.all([this.requestApi(nametag), this.getStreamInfo(nametag)])
    const status = this.getFinalStatus(apiRes, streamInfo)
    return { status, thumb: this.getThumb(nametag, status),streamInfo }
  }

  getThumb(nametag, status) {
    return status == this.status_types.ONLINE || status == this.status_types.PRIVATE
      ? 'https://snapshots.xcdnpro.com/thumbnails/' + nametag
      : ''
  }

  async extract(nametag, cachedData = null) {
    const { status, thumb, streamInfo } = cachedData || (await this.getInfo(nametag))

    if (status === this.status_types.OFFLINE || status === this.status_types.NOT_EXIST) {
      return this.extension.createResponse({ nametag, status, thumb })
    }

    const url = streamInfo?.canUseCDN ? streamInfo.cdnURL : ''

    let resolutions = []

    if (status == this.status_types.ONLINE && url) {
      resolutions = await this.extension.getResolutions(url)
      if (!resolutions) status = this.status_types.OFFLINE
    }

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
