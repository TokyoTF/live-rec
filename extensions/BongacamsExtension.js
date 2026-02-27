export default class BongacamsExtension {
  constructor(ExtensionExtra) {
    this.config = {
      name: 'bongacams',
      color: '#22c55e',
      domain: 'bongacams.com',
      referer: true,
      patterns: [
        'https://*.bongacams.com/*',
        'https://*.bongacams.net/*',
        'https://*.bcvcdn.com/*'
      ],
      version: '1.0.0'
    }
    this.extension = new ExtensionExtra(this.config)
    this.status_types = this.extension.status_types
  }

  async requestApi(nametag) {
    let body = new FormData()
    body.append('args[]', nametag)
    body.append('method', 'getRoomData')

    const res = await this.extension.fetch('https://bongacams.net/tools/amf.php', {
      method: 'POST',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      body: body
    })
    return await res.json()
  }

  async getInfo(nametag) {
    const res = await this.requestApi(nametag)

    const status =
      res.localData?.videoServerUrl &&
      res.performerData?.showType == 'public' &&
      !res.performerData?.isAway &&
      res.performerData?.isOnline
        ? this.status_types.ONLINE
        : (res.localData?.videoServerUrl &&
              res.performerData?.showType == 'private' &&
              res.performerData?.isOnline) ||
            (res.localData?.videoServerUrl &&
              res.performerData?.isAway &&
              res.performerData?.isOnline)
          ? this.status_types.PRIVATE
          : res.status == 'error'
            ? this.status_types.NOT_EXIST
            : this.status_types.OFFLINE
    return { status, thumb: this.getThumb(res, status), res }
  }

  getThumb(res, status) {
    return status == this.status_types.ONLINE || status == this.status_types.PRIVATE
      ? `https://mobile-edge${res.localData?.vsid}.bcvcdn.com/stream_${res.performerData?.username}.jpg`
      : ''
  }

  async extract(nametag, cachedData = null) {
    const { res, status, thumb } = cachedData || (await this.getInfo(nametag))
    
    if (status === this.status_types.OFFLINE || status === this.status_types.NOT_EXIST) {
      return this.extension.createResponse({ nametag, status, thumb })
    }

    const url = res.localData?.videoServerUrl
      ? `https:${res.localData.videoServerUrl}/hls/stream_${res.performerData?.username}/playlist.m3u8`
      : ''

    let resolutions = []

    if (status == this.status_types.ONLINE || (status == this.status_types.PRIVATE && url)) {
      resolutions = await this.extension.getResolutions(url)
    }

    return this.extension.createResponse({ nametag, status, url, resolutions, thumb })
  }

  async update(nametag) {
    const { status, thumb } = this.getInfo(nametag)

    return this.extension.createUpdate({
      status,
      thumb
    })
  }
}
