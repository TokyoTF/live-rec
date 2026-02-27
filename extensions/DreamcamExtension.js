export default class DreamcamExtension {
  constructor(ExtensionExtra) {
    this.config = {
      name: 'dreamCam',
      color: '#a855f7',
      domain: 'dreamcam.com',
      referer: true,
      patterns: ['https://*.dreamcam.com/*', 'https://*.dreamcamtrue.com/*'],
      version: '1.0.0'
    }
    this.extension = new ExtensionExtra(this.config)
    this.status_types = this.extension.status_types
  }

  async requestApi(nametag) {
    const res = await this.extension.fetch(
      'https://bss.dreamcamtrue.com/api/clients/v1/broadcasts/models/' +
        nametag +
        '?show-hidden=true&stream-types=video2D,video3D&partnerId=dreamcam_oauth2'
    )
    return await res.json()
  }

  async getInfo(nametag) {
    const res = await this.requestApi(nametag)
    const status = res.broadcastStatus == 'public'
      ? this.status_types.ONLINE
      : res.broadcastStatus == 'private'
        ? this.status_types.PRIVATE
        : res.message == 'Not Found'
          ? this.status_types.NOT_EXIST
          : this.status_types.OFFLINE

    return { status, thumb: this.getThumb(res, status), res }
  }

  getThumb(res, status) {
    return status == this.status_types.ONLINE || status == this.status_types.PRIVATE
      ? res.thumbnailsUrl.preview2D
      : res.modelProfilePhotoUrl
  }

  async extract(nametag, cachedData = null) {
    const { status, thumb, res } = cachedData || (await this.getInfo(nametag))

    if (status === this.status_types.OFFLINE || status === this.status_types.NOT_EXIST) {
      return this.extension.createResponse({ nametag, status, thumb })
    }

    const stream = res.streams?.[1]
    const url = stream?.url || ''

    let resolutions = []

    if (status == this.status_types.ONLINE && stream) {
      resolutions = [
        {
          resolution: { width: stream.resolutionInfo.width, height: stream.resolutionInfo.height },
          url: stream.url,
          fps: 30
        }
      ]
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
