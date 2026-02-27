export default class ChaturbateExtension {
  constructor(ExtensionExtra) {
    this.config = {
      name: 'chaturbate',
      color: '#f97316',
      domain: 'chaturbate.com',
      referer: true,
      patterns: ['https://*.chaturbate.com/*', 'https://*.mmcdn.com/*'],
      version: '1.0.0'
    }
    this.extension = new ExtensionExtra(this.config)
    this.status_types = this.extension.status_types
  }

  async requestApi(nametag) {
    const body = new FormData()
    body.append('room_slug', nametag)
    body.append('bandwidth', 'high')

    const res = await this.extension.fetch('https://chaturbate.com/get_edge_hls_url_ajax/', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
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

  async extract(nametag, cachedData = null) {
    const { res, status, thumb } = cachedData || (await this.getInfo(nametag))

    if (status === this.status_types.OFFLINE || status === this.status_types.NOT_EXIST) {
      return this.extension.createResponse({ nametag, status, thumb })
    }

    const url = res.url
    const resolutions =
      status == this.status_types.ONLINE ? await this.extension.getResolutions(url) : ''

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
