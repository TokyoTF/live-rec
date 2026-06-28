import WarpClass from './tools.class.js'
import { install, Agent,ProxyAgent } from 'undici'

const tool = new WarpClass()
install()
export const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0'
}

/**
 * Fetch with default User-Agent and optional proxy
 */
export async function fetchWithAgent(url, options = {}) {
  const proxy = options.proxy || tool.getProxy()
  if (proxy) {
    try {
      const proxyUrl = proxy.includes('://') ? proxy : `http://${proxy}`
      const dispatcher = new ProxyAgent(proxyUrl)
      return await fetch(url, { ...options, dispatcher })
    } catch (proxyErr) {
      console.warn(`Proxy ${proxy} failed, retrying without proxy:`, proxyErr.message)
    }
  }
  const dispatcher = new Agent({
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10
  })
  return fetch(url, { ...options, dispatcher })
}

/**
 * Common resolution parsing
 * @param {string} url - The m3u8 URL
 * @param {string|object} prefixUrl - Prefix for sub-playlists
 * @param {boolean} getData - Get raw data
 */
export async function getResolutions(url, prefixUrl, getData) {
  try {
    const res = await fetchWithAgent(url)
    if (!res.ok) return getData ? { resolutions: [], streamdata: '' } : []
    const data = await res.text()
    return getData ? {
      resolutions: tool.resolutions({
        active: true,
        data: data,
        prefixUrl: prefixUrl || (url.includes('playlist.m3u8') ? url.replace('playlist.m3u8', '') : { directurl: url })
      }),
      streamdata: data
    } : tool.resolutions({
      active: true,
      data: data,
      prefixUrl: prefixUrl || (url.includes('playlist.m3u8') ? url.replace('playlist.m3u8', '') : { directurl: url })
    })
  } catch (err) {
    console.error('getResolutions error:', err.message)
    return getData ? { resolutions: [], streamdata: '' } : []
  }
}

/**
 * Standard response formatter for Extract
 */
export function formatExtract({ nametag, status, url, resolutions, thumb }) {
  return {
    nametag,
    status,
    url: url || '',
    recUrl: url || '',
    statusRec: false,
    timeRec: 0,
    resolutions: resolutions || '',
    thumb: thumb || ''
  }
}

/**
 * Standard response formatter for Update
 */
export function formatUpdate({ status, thumb, url }) {
  return {
    status,
    thumb: thumb || '',
    url: url || ''
  }
}

export default class BaseScraper {
  constructor() {
    this.tool = tool
  }

  async fetch(url, options) { return fetchWithAgent(url, options) }
  async fetchJson(url, options) {
    const res = await this.fetch(url, options)
    return res.json()
  }

  async getResolutions(url, prefix) { return getResolutions(url, prefix) }

  formatExtract(data) { return formatExtract(data) }
  formatUpdate(data) { return formatUpdate(data) }
}
