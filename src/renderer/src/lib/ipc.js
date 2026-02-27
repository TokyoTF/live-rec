/**
 * Unified communication layer for Live Rec renderer.
 * Auto-detects Electron IPC vs WebSocket (web/CLI mode).
 */

const isElectron = typeof window !== 'undefined' && window.electron?.ipcRenderer

let ws = null
const wsListeners = new Map()
let wsReady = false
const wsQueue = []

// ── Electron IPC adapter ──
const electronAdapter = isElectron ? {
  send(channel, data) {
    window.electron.ipcRenderer.send(channel, data)
  },
  on(channel, callback) {
    window.electron.ipcRenderer.on(channel, callback)
    return () => window.electron.ipcRenderer.removeListener(channel, callback)
  },
  once(channel, callback) {
    window.electron.ipcRenderer.once(channel, callback)
  }
} : null

// ── WebSocket adapter ──
function initWebSocket() {
  if (ws) return

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(`${protocol}//${location.host}`)

  ws.addEventListener('open', () => {
    wsReady = true
    // Flush queued messages
    wsQueue.forEach((msg) => ws.send(msg))
    wsQueue.length = 0
  })

  ws.addEventListener('message', (event) => {
    let msg
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }

    const listeners = wsListeners.get(msg.channel)
    if (listeners) {
      listeners.forEach((cb) => cb(null, msg.data))
    }
  })

  ws.addEventListener('close', () => {
    wsReady = false
    // Auto-reconnect after 2s
    setTimeout(() => {
      ws = null
      initWebSocket()
    }, 2000)
  })
}

const wsAdapter = {
  send(channel, data) {
    const msg = JSON.stringify({ channel, data })
    if (wsReady && ws?.readyState === WebSocket.OPEN) {
      ws.send(msg)
    } else {
      wsQueue.push(msg)
      initWebSocket()
    }
  },
  on(channel, callback) {
    if (!wsListeners.has(channel)) {
      wsListeners.set(channel, new Set())
    }
    wsListeners.get(channel).add(callback)
    initWebSocket()
    return () => {
      const set = wsListeners.get(channel)
      if (set) set.delete(callback)
    }
  },
  once(channel, callback) {
    const unsub = wsAdapter.on(channel, (...args) => {
      unsub()
      callback(...args)
    })
  }
}

// ── Exported API — picks the right adapter ──
const adapter = electronAdapter || wsAdapter

export function send(channel, data) {
  adapter.send(channel, data)
}

export function on(channel, callback) {
  return adapter.on(channel, callback)
}

export function once(channel, callback) {
  adapter.once(channel, callback)
}
