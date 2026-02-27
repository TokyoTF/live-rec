import { fetchWithAgent, getResolutions, formatExtract, formatUpdate } from './scraperUtils.js'

/**
 * Base class for all site extensions
 */
export default class SiteExtra {
  constructor(config) {
    this.config = config
  }
  
  status_types = {
    ONLINE: 'online',
    OFFLINE: 'offline',
    PRIVATE: 'private',
    NOT_EXIST: 'not exist',
    ERROR: 'error'
  }

  async fetch(url, options) {
    return fetchWithAgent(url, options)
  }

  async getResolutions(url, prefix, getData) {
    return getResolutions(url, prefix, getData)
  }

  createResponse(data) {
    return formatExtract({
      nametag: data.nametag,
      status: data.status,
      url: data.url,
      resolutions: data.resolutions,
      thumb: data.thumb,
      force_type: data.force_type
    })
  }

  createUpdate(data) {
    return formatUpdate({
      status: data.status,
      thumb: data.thumb
    })
  }
}
