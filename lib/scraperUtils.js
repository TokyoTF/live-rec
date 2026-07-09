import WarpClass from './tools.class.js'
import { install, Agent, ProxyAgent } from 'undici'
import { readFileSync, existsSync } from 'node:fs'

const tool = new WarpClass()
install()

function loadProxyList() {
  const config = tool.loadjson()
  if (config.proxylist && existsSync(config.proxylist)) {
    try {
      return readFileSync(config.proxylist, 'utf8')
        .split('\n')
        .map(p => p.trim())
        .filter(p => p && !p.startsWith('#'))
    } catch { return [] }
  }
  return []
}

function getMaxProxyTry() {
  const config = tool.loadjson()
  return config.maxproxytry ?? 3
}

export const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0'
}

/**
 * Fetch with proxy support.
 * Tries up to maxproxytry proxies from the list before falling back to direct.
 */
export async function fetchWithAgent(url, options = {}) {
  if (options.proxy !== undefined) {
    if (options.proxy) {
      try {
        const proxyUrl = options.proxy.includes('://') ? options.proxy : `http://${options.proxy}`
        const dispatcher = new ProxyAgent(proxyUrl)
        return await fetch(url, { ...options, dispatcher })
      } catch (proxyErr) {
        console.warn(`Proxy ${options.proxy} failed:`, proxyErr.message)
      }
    }
    const dispatcher = new Agent({ keepAliveTimeout: 10, keepAliveMaxTimeout: 10 })
    return await fetch(url, { ...options, dispatcher })
  }

  const proxyList = loadProxyList()
  const maxTry = getMaxProxyTry()

  if (proxyList.length > 0 && maxTry > 0) {
    const tryCount = Math.min(proxyList.length, maxTry)
    for (let i = 0; i < tryCount; i++) {
      const proxy = proxyList[i]
      try {
        const proxyUrl = proxy.includes('://') ? proxy : `http://${proxy}`
        const dispatcher = new ProxyAgent(proxyUrl)
        return await fetch(url, { ...options, dispatcher })
      } catch (proxyErr) {
        console.warn(`Proxy ${proxy} (${i + 1}/${tryCount}) failed:`, proxyErr.message)
      }
    }
    console.warn(`All ${tryCount} proxies failed, trying direct connection`)
  }

  const dispatcher = new Agent({ keepAliveTimeout: 10, keepAliveMaxTimeout: 10 })
  return await fetch(url, { ...options, dispatcher })
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
