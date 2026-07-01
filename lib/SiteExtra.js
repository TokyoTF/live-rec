import { fetchWithAgent, getResolutions, formatExtract, formatUpdate } from './scraperUtils.js'
import WarpClass from './tools.class.js'
import { BrowserWindow } from 'electron'
import CBProxy from './cbProxy.class.js'

const tool = new WarpClass()

let cfWindow = null
let cfReady = false

async function getCfWindow() {
  if (cfWindow && !cfWindow.isDestroyed() && cfReady) return cfWindow

  if (cfWindow && !cfWindow.isDestroyed()) {
    try { await cfWindow.loadURL('https://www.camsoda.com/') } catch {}
    await new Promise(r => setTimeout(r, 3000))
    cfReady = true
    return cfWindow
  }

  cfReady = false
  cfWindow = new BrowserWindow({
    show: false,
    width: 1,
    height: 1,
    webPreferences: {
      webSecurity: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  cfWindow.on('closed', () => { cfWindow = null; cfReady = false })

  try {
    await cfWindow.loadURL('https://www.camsoda.com/')
  } catch {}
  await new Promise(r => setTimeout(r, 5000))
  cfReady = true
  return cfWindow
}

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

  getCBProxy() {
    return CBProxy
  }

  async fetch(url, options) {
    if (this.config.use_net) {
      return this.#cfFetch(url, options)
    }
    return fetchWithAgent(url, options)
  }

  async #cfFetch(url, options = {}) {
    const win = await getCfWindow()
    if (!win || win.isDestroyed()) throw new Error('CF window not available')

    const res = await win.webContents.session.fetch(url, {
      method: options.method || 'GET',
      headers: options.headers || {},
    })
    const body = await res.text()
    return {
      ok: res.status >= 200 && res.status < 400,
      status: res.status,
      headers: res.headers,
      text: () => Promise.resolve(body),
      json: () => Promise.resolve(JSON.parse(body))
    }
  }

  async getResolutions(url, prefix, getData) {
    if (this.config.use_net) {
      try {
        const res = await this.fetch(url)
        if (!res.ok) return getData ? { resolutions: [], streamdata: '' } : []
        const data = await res.text()
        return getData ? {
          resolutions: tool.resolutions({
            active: true, data,
            prefixUrl: prefix || (url.includes('playlist.m3u8') ? url.replace('playlist.m3u8', '') : { directurl: url })
          }),
          streamdata: data
        } : tool.resolutions({
          active: true, data,
          prefixUrl: prefix || (url.includes('playlist.m3u8') ? url.replace('playlist.m3u8', '') : { directurl: url })
        })
      } catch (err) {
        console.error('getResolutions (use_net) error:', err.message)
        return getData ? { resolutions: [], streamdata: '' } : []
      }
    }
    return getResolutions(url, prefix, getData)
  }

  async getCookies(domain) {
    if (!this.config.use_net) return ''
    const win = await getCfWindow()
    if (!win || win.isDestroyed()) return ''
    const filter = domain ? { domain } : {}
    const cookies = await win.webContents.session.cookies.get(filter)
    return cookies.map(c => `${c.name}=${c.value}`).join('; ')
  }

  async getStreamUrl(url) {
    if (!this.config.use_net) return url
    const win = await getCfWindow()
    if (!win || win.isDestroyed()) return url
    try {
      const content = await win.webContents.session.fetch(url).then(r => r.text())
      return content
    } catch {
      return url
    }
  }

  createResponse(data) {
    return formatExtract({
      nametag: data.nametag,
      status: data.status,
      url: data.url,
      resolutions: data.resolutions,
      thumb: data.thumb
    })
  }

  createUpdate(data) {
    return formatUpdate({
      status: data.status,
      thumb: data.thumb,
      url: data.url
    })
  }
}
