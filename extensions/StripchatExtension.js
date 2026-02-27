import { Buffer } from 'buffer'

export default class StripchatExtension {
  constructor(ExtensionExtra) {
    this.config = {
      name: 'stripchat',
      color: '#ef4444',
      domain: 'stripchat.com',
      referer: true,
      patterns: [
        'https://*.stripchat.com/*',
        'https://*.doppiocdn.live/*',
        'https://*.doppiocdn.com/*',
        'https://*.sacdnssedge.com/*'
      ],
      version: '1.0.0'
    }
    this.extension = new ExtensionExtra(this.config)
    this.status_types = this.extension.status_types
  }

  async scrapeApi(nametag) {
    const res = await this.extension.fetch(
      `https://stripchat.com/api/front/v2/models/username/${nametag}/cam`
    )
    return await res.json()
  }

  async getInfo(nametag) {
    const res = await this.scrapeApi(nametag)
    const cam = res.user.user
    const status =
      cam.status == 'public' && res.cam.isCamAvailable && res.cam.isCamActive
        ? this.status_types.ONLINE
        : cam.status == 'private' ||
            cam.status == 'groupShow' ||
            cam.status == 'p2p' ||
            cam.status == 'virtualPrivate' ||
            cam.status == 'p2pVoice'
          ? this.status_types.PRIVATE
          : cam.status == 'off' || cam.status == 'idle'
            ? this.status_types.OFFLINE
            : cam.isDeleted
              ? this.status_types.NOT_EXIST
              : this.status_types.OFFLINE

    const streamName = res.cam.streamName || null

    return { status, thumb: this.getThumb(streamName, status), streamName }
  }

  getThumb(streamName, status) {
    if (
      !streamName ||
      (status !== this.status_types.ONLINE && status !== this.status_types.PRIVATE)
    )
      return ''
    const timestamp = new Date().getTime().toString().slice(0, -3) - 140
    return `https://img.doppiocdn.live/thumbs/${timestamp}/${streamName}_webp`
  }

  async extract(nametag, cachedData = null) {
    const { status, thumb, streamName } = cachedData || (await this.getInfo(nametag))

    if (status === this.status_types.OFFLINE || status === this.status_types.NOT_EXIST) {
      return this.extension.createResponse({ nametag, status, thumb })
    }

    const masterUrl = `https://edge-hls.doppiocdn.live/hls/${streamName}/master/${streamName}_auto.m3u8`
    const resData = await this.extension.getResolutions(masterUrl, '#', true)
    
    let resolutions = [], blob, domain

    if (resData && resData.streamdata) {
      domain = resData.streamdata.match(/([a-z0-9-]+)\.doppiocdn\.live/g)[0]

      resData.streamdata = resData.streamdata.replace(
        /[a-z0-9-]+\.doppiocdn\.live\/hls/g,
        'media-hls.sacdnssedge.com/' + String(domain).split('.')[0]
      )
      blob =
        'data:application/x-mpegurl;base64,' + Buffer.from(resData.streamdata).toString('base64')

      resData.resolutions.map((el) => {
        resolutions.push({
          url: el.url.replace(
            /[a-z0-9-]+\.doppiocdn\.live\/hls/g,
            'media-hls.sacdnssedge.com/' + String(domain).split('.')[0]
          ),
          resolution: el.resolution,
          fps: el.fps
        })
      })
    }

    return this.extension.createResponse({
      nametag,
      status,
      url: blob,
      resolutions,
      thumb,
      force_type:'video/x-mpegUrl'
    })
  }

  async update(nametag) {
    const { status,thumb } = await this.getInfo(nametag)

    return this.extension.createUpdate({
      status,
      thumb
    })
  }
}
