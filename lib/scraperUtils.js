import WarpClass from './tools.class.js'

const tool = new WarpClass()

export const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0'
}

import { HttpsProxyAgent } from 'https-proxy-agent'
import { SocksProxyAgent } from 'socks-proxy-agent'

/**
 * Fetch with default User-Agent and optional proxy
 */
export async function fetchWithAgent(url, options = {}) {
  const proxy = tool.getProxy()
  
  let agent = null
  if (proxy) {
    if (proxy.startsWith('http')) {
      agent = new HttpsProxyAgent(proxy)
    } else if (proxy.startsWith('socks')) {
      agent = new SocksProxyAgent(proxy)
    }
  }

  return fetch(url, {
    ...options,
    agent: agent || options.agent,
    headers: { ...DEFAULT_HEADERS, ...options.headers }
  })
}

/**
 * Common resolution parsing
 * @param {string} url - The m3u8 URL
 * @param {string|object} prefixUrl - Prefix for sub-
 * @param {boolean} getData - Get raw data
 */
export async function getResolutions(url, prefixUrl,getData) {
  const res = await fetchWithAgent(url)
  if (!res.ok) return ''
  const data = await res.text()
  return getData ? {resolutions:tool.resolutions({
    active: true,
    data: data,
    prefixUrl: prefixUrl || (url.includes('playlist.m3u8') ? url.replace('playlist.m3u8', '') : { directurl: url })
  }),streamdata:data} : tool.resolutions({
    active: true,
    data: data,
    prefixUrl: prefixUrl || (url.includes('playlist.m3u8') ? url.replace('playlist.m3u8', '') : { directurl: url })
  })
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
    thumb: thumb || '',
    force_type: arguments[0].force_type || ''
  }
}

/**
 * Standard response formatter for Update
 */
export function formatUpdate({ status, thumb }) {
  return {
    status,
    thumb: thumb || ''
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
