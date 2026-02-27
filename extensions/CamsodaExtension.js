export default class CamsodaExtension {
  constructor(ExtensionExtra) {
    this.config = {
      name: 'camsoda',
      color: '#ec4899',
      domain: 'camsoda.com',
      referer: true,
      patterns: ['https://*.camsoda.com/*'],
      version: '1.0.0'
    }
    this.extension = new ExtensionExtra(this.config)
    this.status_types = this.extension.status_types
  }

  async requestApi(nametag) {
    const res = await this.extension.fetch('https://www.camsoda.com/api/v1/chat/react/' + nametag)
    return await res.json()
  }

  getStatus(res) {
    return res.stream?.stream_name && res.stream?.edge_servers?.length
      ? this.status_types.ONLINE
      : res.stream?.stream_name && res.stream?.private_servers && res.stream?.private_servers?.length
        ? this.status_types.PRIVATE
        : res.stream?.message == 'No broadcaster found'
          ? this.status_types.NOT_EXIST
          : this.status_types.OFFLINE
  }

  async getInfo(nametag) {
    const res = await this.requestApi(nametag)
    const status = this.getStatus(res)
    return { status, thumb: this.getThumb(res, status), res }
  }

  getThumb(res, status) {
    return status == this.status_types.ONLINE || status == this.status_types.PRIVATE ? res.user.profilePictureUrl : res.user.offlinePictureUrl
  }

  async extract(nametag, cachedData = null) {
    const { res, status, thumb } = cachedData || (await this.getInfo(nametag))

    if (status === this.status_types.OFFLINE || status === this.status_types.NOT_EXIST) {
      return this.extension.createResponse({ nametag, status, thumb })
    }

    const url =
      res.stream.stream_name && res.stream.edge_servers.length
        ? `https://${res.stream.edge_servers[0]}/${res.stream.stream_name}_v1/index.m3u8?token=${res.stream.token}`
        : ''

    const resolutions =
      status == this.status_types.ONLINE && url ? await this.extension.getResolutions(url, url.slice(0, url.indexOf('index.m3u8'))) : ''

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
