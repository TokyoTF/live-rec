import WarpClass from './tools.class.js'
import { install, Agent, ProxyAgent } from 'undici'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const tool = new WarpClass()
install()

// impit impersonates a real browser TLS/HTTP fingerprint. Some sites
// (Cloudflare-protected ones like bongacams) return an empty 200 or a
// "Just a moment..." challenge to undici because of its TLS fingerprint,
// even when the request headers look like a browser.
const require = createRequire(import.meta.url)
let ImpitCtor = null
try {
  ;({ Impit: ImpitCtor } = require('impit'))
} catch (err) {
  console.warn('impit unavailable, falling back to undici:', err.message)
}

const impitClients = new Map()

function getImpitClient(browser = 'firefox', proxyUrl) {
  const key = `${browser}|${proxyUrl || ''}`
  if (!impitClients.has(key)) {
    impitClients.set(key, new ImpitCtor({ browser, proxyUrl, timeout: 20_000 }))
  }
  return impitClients.get(key)
}

function toImpitInit(options, signal) {
  const init = {}
  if (options.method) init.method = options.method
  if (options.headers) init.headers = options.headers
  if (options.body !== undefined) init.body = options.body
  if (options.redirect) init.redirect = options.redirect
  init.signal = signal
  return init
}

// Shared connection pool for all scraper requests. Creating a new Agent per
// request leaks TCP sockets (one per call, never closed); after a while the
// app holds hundreds of ESTABLISHED connections and every new fetch fails.
const sharedAgent = new Agent({
  connections: 32,
  keepAliveTimeout: 10_000,
  keepAliveMaxTimeout: 60_000,
  keepAliveTimeoutThreshold: 2_000,
  connect: { timeout: 10_000 }
})

const proxyAgents = new Map()
function getProxyAgent(proxyUrl) {
  if (!proxyAgents.has(proxyUrl)) {
    proxyAgents.set(proxyUrl, new ProxyAgent(proxyUrl, { connect: { timeout: 10_000 } }))
  }
  return proxyAgents.get(proxyUrl)
}

// Always drain or cancel the body so the socket can return to the pool /
// be released; skipping this on error responses leaks the connection.
async function drain(res) {
  try {
    if (res.body) {
      if (res.body.locked) return
      await res.body.cancel()
    }
  } catch { /* ignore */ }
}

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
  const { impit, browser, ...fetchOptions } = options
  const signal = fetchOptions.signal || AbortSignal.timeout(20_000)

  if (impit && ImpitCtor) {
    try {
      const rawProxy = fetchOptions.proxy
      const proxyUrl = rawProxy
        ? rawProxy.includes('://')
          ? rawProxy
          : `http://${rawProxy}`
        : undefined
      const client = getImpitClient(browser || 'firefox', proxyUrl)
      return await client.fetch(url, toImpitInit(fetchOptions, signal))
    } catch (err) {
      console.warn(`impit fetch failed (${url}):`, err.message)
      // fall through to the regular fetch path below
    }
  }

  if (fetchOptions.proxy !== undefined) {
    if (fetchOptions.proxy) {
      try {
        const proxyUrl = fetchOptions.proxy.includes('://') ? fetchOptions.proxy : `http://${fetchOptions.proxy}`
        return await fetch(url, { ...fetchOptions, signal, dispatcher: getProxyAgent(proxyUrl) })
      } catch (proxyErr) {
        console.warn(`Proxy ${fetchOptions.proxy} failed:`, proxyErr.message)
      }
    }
    return await fetch(url, { ...fetchOptions, signal, dispatcher: sharedAgent })
  }

  const proxyList = loadProxyList()
  const maxTry = getMaxProxyTry()

  if (proxyList.length > 0 && maxTry > 0) {
    const tryCount = Math.min(proxyList.length, maxTry)
    for (let i = 0; i < tryCount; i++) {
      const proxy = proxyList[i]
      try {
        const proxyUrl = proxy.includes('://') ? proxy : `http://${proxy}`
        return await fetch(url, { ...fetchOptions, signal, dispatcher: getProxyAgent(proxyUrl) })
      } catch (proxyErr) {
        console.warn(`Proxy ${proxy} (${i + 1}/${tryCount}) failed:`, proxyErr.message)
      }
    }
    console.warn(`All ${tryCount} proxies failed, trying direct connection`)
  }

  return await fetch(url, { ...fetchOptions, signal, dispatcher: sharedAgent })
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
    if (!res.ok) {
      await drain(res)
      return getData ? { resolutions: [], streamdata: '' } : []
    }
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
