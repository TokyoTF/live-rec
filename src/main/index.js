import { app, shell, BrowserWindow, ipcMain, dialog, Tray, session, Notification, screen } from 'electron'
import { autoUpdater } from 'electron-updater'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import WarpClass from '../../lib/tools.class.js'
import { existsSync, writeFileSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'path'
import { pathToFileURL } from 'url'
import SiteExtra from '../../lib/SiteExtra.js'
import Logger from '../../lib/logger.class.js'

const FolderMain = path.resolve(process.env.USERPROFILE, 'Documents', 'live-rec')
const UserExtensionsDir = path.join(FolderMain, 'extensions')
const tool = new WarpClass()

// Auto-discover and load site extensions
const sitesDir = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..', '..', 'extensions')
const ListSites = {}

const loadExtensions = async () => {
  const config = tool.loadjson()
  const useUserExtensions = !is.dev || config.devmode


  for (const key of Object.keys(ListSites)) delete ListSites[key]

  const loadFromDir = async (dir, isUser = false) => {
    if (!existsSync(dir)) return
    const extensionFiles = readdirSync(dir).filter((f) => f.endsWith('Extension.js'))
    for (const file of extensionFiles) {
      try {
        const filePath = path.join(dir, file)
        const mod = await import(pathToFileURL(filePath).href + '?t=' + Date.now())
        const instance = new mod.default(SiteExtra)
        ListSites[instance.config.name] = instance
        if (isUser) Logger.info(`Loaded user extension: ${instance.config.name}`)
      } catch (err) {
        Logger.error(`Error loading extension ${file} from ${dir}: ${err.message}`)
      }
    }
  }

  await loadFromDir(sitesDir)
  if (useUserExtensions) {
    if (!existsSync(UserExtensionsDir)) {
      mkdirSync(UserExtensionsDir, { recursive: true })
    }
    await loadFromDir(UserExtensionsDir, true)
  }
}

const setupRequestRules = () => {
  const patternsToSite = []
  Object.values(ListSites).forEach((instance) => {
    if (instance.config.patterns && instance.config.referer === true) {
      instance.config.patterns.forEach((p) => {
        patternsToSite.push({
          pattern: p,
          regex: new RegExp(
            p
              .split('*')
              .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
              .join('.*')
          ),
          site: instance
        })
      })
    }
  })

  const allUrls = patternsToSite.map((p) => p.pattern)
  if (allUrls.length === 0) return

  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: allUrls }, (details, callback) => {
    const config = tool.loadjson()
    const ua =
      config.useragent ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0'

    if (details && details.requestHeaders) {
      details.requestHeaders['Access-Control-Allow-Origin'] = '*'
      details.requestHeaders['Origin'] = ''
      details.requestHeaders['User-Agent'] = ua

      const matchedRule = patternsToSite.find((p) => p.regex.test(details.url))
      if (matchedRule) {
        details.requestHeaders['Referer'] = `https://${matchedRule.site.config.domain}/`
        details.requestHeaders['Origin'] = `https://${matchedRule.site.config.domain}`
      }

      callback({ requestHeaders: details.requestHeaders })
    } else {
      callback({ cancel: false })
    }
  })
}


let tray = null
let trayWindow = null

function createTrayWindow() {
  trayWindow = new BrowserWindow({
    width: 200,
    height: 240,
    show: false,
    frame: false,
    fullscreenable: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Hide the window when it loses focus
  trayWindow.on('blur', () => {
    if (!trayWindow.webContents.isDevToolsOpened()) {
      trayWindow.hide()
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    trayWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#tray')
  } else {
    trayWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'tray' })
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    frame: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('minimize', () => {
    mainWindow.webContents.send('window:minimized')
  })

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      const config = tool.loadjson()
      if (config.minimizetotray) {
        event.preventDefault()
        mainWindow.hide()
        mainWindow.webContents.send('window:minimized')
        if (Notification.isSupported()) {
          new Notification({
            title: 'Live Rec',
            body: 'App is in background and in tray',
            icon: icon
          }).show()
        }
      } else {
        app.quit()
      }
    }
  })


  


  if (!existsSync(FolderMain)) {
    mkdirSync(FolderMain, { recursive: true })
  }

  if (!existsSync(FolderMain + '/config.json')) {
    const data = {
      savefolder: '',
      ffmpegselect: '',
      naspath: '',
      autorec: false,
      autocreatefolder: false,
      autocreatefolderby: 'nametag',
      orderby: 'status',
      dateformat: 'model-site-dd-MM-yyyy_hh-mm-ss',
      updatetime: 25,
      reclist: [],
      extbranch: 'main'
    }
    writeFileSync(FolderMain + '/config.json', JSON.stringify(data, null, ' '))
  }

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  if (!existsSync(UserExtensionsDir)) {
    mkdirSync(UserExtensionsDir, { recursive: true })
  }
}

app.whenReady().then(async () => {
  await loadExtensions()
  setupRequestRules()
  electronApp.setAppUserModelId('com.electron')

  tray = new Tray(icon)
  tray.setToolTip('Live Rec')

  createTrayWindow()

  // Toggle main window on left click
  tray.on('click', () => {
    const windows = BrowserWindow.getAllWindows()
    const mainWindow = windows.find(w => w !== trayWindow)
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
        mainWindow.webContents.send('window:minimized')
      } else {
        mainWindow.show()
      }
    } else {
      createWindow()
    }
  })

  // Show custom context menu on right click
  tray.on('right-click', () => {
    const trayBounds = tray.getBounds()
    const { width: menuWidth, height: menuHeight } = trayWindow.getBounds()

    // Get the display where the tray icon lives
    const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y })
    const workArea = display.workArea

    // Center the menu horizontally over the tray icon
    let xPos = Math.round(trayBounds.x + trayBounds.width / 2 - menuWidth / 2)
    // Position above the tray icon (taskbar at bottom) or below (taskbar at top)
    let yPos
    if (trayBounds.y > workArea.y + workArea.height / 2) {
      // Tray is in the bottom half → show menu above
      yPos = Math.round(trayBounds.y - menuHeight - 4)
    } else {
      // Tray is in the top half → show menu below
      yPos = Math.round(trayBounds.y + trayBounds.height + 4)
    }

    // Clamp to work area so the menu never goes off-screen
    xPos = Math.max(workArea.x, Math.min(xPos, workArea.x + workArea.width - menuWidth))
    yPos = Math.max(workArea.y, Math.min(yPos, workArea.y + workArea.height - menuHeight))

    trayWindow.setPosition(xPos, yPos, false)
    trayWindow.show()
    trayWindow.focus()
  })

  let dateformat = ''

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('before-quit', () => {
    app.isQuitting = true
  })

  ipcMain.on('rec:add', async (event, args) => {
    Logger.success(`Add Model ${args.name} - ${args.provider}`)
    const instance = ListSites[args.provider]
    const info = await instance.getInfo(args.name)

    let url
    if (info.status !== instance.status_types.OFFLINE && info.status !== instance.status_types.NOT_EXIST) {
      url = await instance.extract(args.name, info)
    } else {
      url = instance.extension.createResponse({
        nametag: args.name,
        status: info.status,
        thumb: info.thumb
      })
    }

    if (url.status == 'online' || url.status == 'offline' || url.status == 'private') {
      await tool.recInit({ nametag: args.name, provider: args.provider, dateformat })
      setTimeout(() => {
        const recStatus = tool.getRecording(args.name, args.provider)
        if (recStatus) {
          url.statusRec = recStatus.statusRec
          url.paused = recStatus.paused
          url.timeRec = recStatus.statusRec ? recStatus.timeRec : 0
          url.realtime = recStatus.realtime
          url.codec = recStatus.codec
          url.stats = recStatus.stats
        }

        event.reply('rec:add', { data: url, provider: args.provider })
      }, 500)
    } else {
      event.reply('rec:add', { data: url, provider: args.provider })
    }
  })

  ipcMain.on('rec:recovery', async (event, args) => {
    Logger.info(`Recovery Model ${args.name} - ${args.provider}`)

    const instance = ListSites[args.provider]
    const info = await instance.getInfo(args.name)

    let url
    if (info.status !== instance.status_types.OFFLINE && info.status !== instance.status_types.NOT_EXIST) {
      url = await instance.extract(args.name, info)
    } else {
      url = instance.extension.createResponse({
        nametag: args.name,
        status: info.status,
        thumb: info.thumb
      })
    }

    if (url.status == 'online' || url.status == 'offline' || url.status == 'private') {
      await tool.recInit({ nametag: args.name, provider: args.provider, dateformat })
      setTimeout(() => {
        const recStatus = tool.getRecording(args.name, args.provider)
        if (recStatus) {
          url.statusRec = recStatus.statusRec
          url.paused = recStatus.paused
          url.timeRec = recStatus.statusRec ? recStatus.timeRec : 0
          url.realtime = recStatus.realtime
          url.codec = recStatus.codec
          url.stats = recStatus.stats
        }
        event.reply('rec:recovery', { data: url, provider: args.provider })
      }, 500)
    } else {
      event.reply('rec:recovery', { data: url, provider: args.provider })
    }
  })

  ipcMain.on('rec:live:remove', async (event, args) => {
    Logger.remove(`Remove Model ${args.nametag}`)
    tool.removeRec(args.nametag, args.provider)
  })

  ipcMain.on('res:status', async (event, args) => {
    const statusData = await ListSites[args.provider].update(args.nametag)
    
    // Auto-pause/stop logic in main process for better reliability
    const rec = await tool.rec(
      args.nametag,
      'checkRec',
      '',
      statusData.status,
      args.provider,
      dateformat
    )
    
    if (rec) {
      event.reply('rec:live:status', {
        nametag: args.nametag,
        provider: args.provider,
        status: rec.recording || rec.paused || false,
        paused: rec.paused || false,
        realtime: rec.realtime || false,
        codec: rec.codec || null,
        stats: rec.stats || null,
        timeRec: tool.getRecTime(rec)
      })
    }

    event.reply('res:status', {
      nametag: args.nametag,
      provider: args.provider,
      data: statusData
    })
  })

  ipcMain.on('rec:live:status', async (event, args) => {
    const rec = await tool.rec(
      args.nametag,
      args.type,
      args.url ? args.url : '',
      args.status,
      args.provider,
      dateformat
    )
    event.reply('rec:live:status', {
      nametag: args.nametag,
      provider: args.provider,
      status: rec?.recording || rec?.paused || false,
      paused: rec?.paused || false,
      realtime: rec?.realtime || false,
      codec: rec?.codec || null,
      stats: rec?.stats || null,
      timeRec: rec ? tool.getRecTime(rec) : 0
    })
  })

  ipcMain.on('rec:auto', (event) => {
    event.reply('rec:auto')
  })

  ipcMain.on('window:minimize', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) window.minimize()
  })

  ipcMain.on('window:maximize', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) {
      if (window.isMaximized()) window.unmaximize()
      else window.maximize()
    }
  })

  ipcMain.on('window:close', () => {
    const window = BrowserWindow.getFocusedWindow()
    if (window) window.close()
  })

  ipcMain.on('window:reload', (event) => {
    event.sender.reload()
  })

  ipcMain.on('Load:config', (event) => {
    const load = tool.loadjson()
    dateformat = load.dateformat
    load.providers = Object.values(ListSites).map((ext) => ext.config)
    load.isDev = is.dev
    event.reply('Load:config', load)
  })


  ipcMain.on('Modify:config', (event, args) => {
    if (args.name == 'dateformat') dateformat = args.value

    if (args.name == 'raw') {
      args.value.map((n) => {
        tool.modifyjson({ raw: { name: n.name, value: n.value } })
      })
    } else {
      tool.modifyjson({ raw: { name: args.name, value: args.value } })
    }
  })

  ipcMain.on('tray:show-app', () => {
    const windows = BrowserWindow.getAllWindows()
    const mainWindow = windows.find(w => w !== trayWindow)
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
      if (trayWindow) trayWindow.hide()
    } else {
      createWindow()
    }
  })

  ipcMain.on('tray:quit-app', () => {
    app.isQuitting = true
    app.quit()
  })

  // Bridge stats from main window to tray window
  ipcMain.on('tray:get-stats', () => {
    const windows = BrowserWindow.getAllWindows()
    const mainWindow = windows.find(w => w !== trayWindow)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tray:get-stats')
    }
  })

  ipcMain.on('tray:stats-reply', (_event, data) => {
    if (trayWindow && !trayWindow.isDestroyed()) {
      trayWindow.webContents.send('tray:stats-reply', data)
    }
  })

  ipcMain.on('Select:Folder', (event, args) => {
    let localselffmpeg = ''
    let localsavefolder = ''
    let localselproxylist = ''
    try {
      const typeOpen = dialog.showOpenDialogSync({
        properties: [
          args.type == 'file' || args.type == 'proxylist' ? 'openFile' : args.type == 'folder' ? 'openDirectory' : 'openFile'
        ],
        filters: [
          args.type == 'proxylist' 
            ? { name: 'Text Files', extensions: ['txt'] }
            : { name: 'Executable', extensions: ['exe'] }
        ]
      })
      if (typeOpen) {
        const selectedPath = typeOpen[0].replace(/\\/g, '/')
        if (args.type == 'file') {
          localselffmpeg = selectedPath
          tool.modifyjson({ raw: { name: 'ffmpegselect', value: selectedPath } })
        } else if (args.type == 'folder') {
          localsavefolder = selectedPath
          tool.modifyjson({ raw: { name: 'savefolder', value: selectedPath } })
        } else if (args.type == 'proxylist') {
          localselproxylist = selectedPath
          tool.modifyjson({ raw: { name: 'proxylist', value: selectedPath } })
        }
        event.reply('Select:Folder', { 
          ffmpeg: localselffmpeg, 
          svfolder: localsavefolder,
          proxylist: localselproxylist
        })
      } else {
        console.log('select canceled')
      }
    } catch (error) {
      console.log(error)
    }
  })

  ipcMain.on('Folder:open', (event, args) => {
    if (args.path) shell.openPath(args.path)
  })

  ipcMain.on('Config:export', (event) => {
    try {
      const config = tool.loadjson()
      const dest = dialog.showSaveDialogSync({
        title: 'Export Config',
        defaultPath: path.resolve('live-rec-config.json'),
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (dest) writeFileSync(dest, JSON.stringify(config, null, 2))
    } catch (e) {
      console.error(e)
    }
  })

  ipcMain.on('Config:import', (event) => {
    try {
      const src = dialog.showOpenDialogSync({
        title: 'Import Config',
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (src && src.length) {
        const config = JSON.parse(readFileSync(src[0], 'utf8'))
        writeFileSync(path.join(FolderMain, 'config.json'), JSON.stringify(config, null, 2))
        event.reply('Load:config', config)
      }
    } catch (e) {
      console.error(e)
    }
  })

  ipcMain.on('Models:importFile', (event) => {
    try {
      const src = dialog.showOpenDialogSync({
        title: 'Import Models List',
        properties: ['openFile'],
        filters: [{ name: 'Text file', extensions: ['txt'] }]
      })
      if (src && src.length) {
        const text = readFileSync(src[0], 'utf8')
        const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
        event.reply('Models:imported', lines)
      }
    } catch (e) {
      console.error(e)
    }
  })

  // Auto Updater
  autoUpdater.autoDownload = false
  
  ipcMain.on('updater:check', () => {
    autoUpdater.checkForUpdates().catch(err => {
      const window = BrowserWindow.getFocusedWindow()
      if (window) window.webContents.send('updater:error', err.message || 'Error checking for updates')
    })
  })

  ipcMain.on('updater:download', () => {
    autoUpdater.downloadUpdate()
  })

  ipcMain.on('updater:install', () => {
    autoUpdater.quitAndInstall()
  })

  autoUpdater.on('update-available', (info) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window) window.webContents.send('updater:available', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window) window.webContents.send('updater:not-available', info)
  })

  autoUpdater.on('error', (err) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window) window.webContents.send('updater:error', err.message)
  })

  autoUpdater.on('download-progress', (progressObj) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window) window.webContents.send('updater:progress', progressObj)
  })

  autoUpdater.on('update-downloaded', (info) => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window) window.webContents.send('updater:downloaded', info)
  })
  
  ipcMain.on('extensions:list', (event) => {
    const extensions = Object.entries(ListSites).map(([key, ext]) => ({
      name: ext.config.name,
      version: ext.config.version || '1.0.0'
    }))
    event.reply('extensions:list', extensions)
  })

  // ── Extension Update System ──
  function compareVersions(v1, v2) {
    const v1Parts = v1.split('.').map(Number)
    const v2Parts = v2.split('.').map(Number)
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const p1 = v1Parts[i] || 0
      const p2 = v2Parts[i] || 0
      if (p1 > p2) return 1
      if (p1 < p2) return -1
    }
    return 0
  }

  ipcMain.on('extensions:check-updates', async (event) => {
    try {
      const config = tool.loadjson()
      const branch = config.extbranch || 'main'
      const updates = []
      for (const [name, ext] of Object.entries(ListSites)) {
        try {
          const className = name.charAt(0).toUpperCase() + name.slice(1)
          const url = `https://raw.githubusercontent.com/TokyoTF/live-rec/${branch}/extensions/${className}Extension.js`
          const response = await fetch(url)
          if (!response.ok) continue

          const remoteCode = await response.text()
          const versionMatch = remoteCode.match(/version:\s*'([^']+)'/)
          if (versionMatch) {
            const remoteVersion = versionMatch[1]
            const currentVersion = ext.config.version || '0.0.0'
            if (compareVersions(remoteVersion, currentVersion) > 0) {
              updates.push({ name, currentVersion, newVersion: remoteVersion })
            }
          }
        } catch (error) {
          console.error(`Error checking update for ${name}:`, error)
        }
      }
      event.reply('extensions:check-updates', { updates })
    } catch (error) {
      event.reply('extensions:check-updates', { updates: [], error: error.message })
    }
  })

  ipcMain.on('extensions:update', async (event, args) => {
    try {
      const config = tool.loadjson()
      const branch = config.extbranch || 'main'
      const className = args.name.charAt(0).toUpperCase() + args.name.slice(1)
      const url = `https://raw.githubusercontent.com/TokyoTF/live-rec/${branch}/extensions/${className}Extension.js`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to download extension')

      const code = await response.text()
      
      const useUserExtensions = !is.dev || config.devmode
      const targetDir = useUserExtensions ? UserExtensionsDir : sitesDir
      
      if (!existsSync(targetDir)) mkdirSync(targetDir, { recursive: true })

      const filePath = path.join(targetDir, `${className}Extension.js`)
      writeFileSync(filePath, code)

      await loadExtensions()
      setupRequestRules()

      const extensions = Object.entries(ListSites).map(([key, ext]) => ({
        name: ext.config.name,
        version: ext.config.version || '1.0.0'
      }))
      event.reply('extensions:update', { success: true, name: args.name, extensions })
    } catch (error) {
      Logger.error(`Failed to update extension ${args.name}: ${error.message}`)
      event.reply('extensions:update', { success: false, name: args.name, error: error.message })
    }
  })
  
  ipcMain.on('extensions:sync-dev', async (event) => {
    try {
      if (!is.dev) throw new Error('Sync only available in dev mode')
      if (!existsSync(UserExtensionsDir)) mkdirSync(UserExtensionsDir, { recursive: true })
      
      const files = readdirSync(sitesDir).filter(f => f.endsWith('Extension.js'))
      for (const file of files) {
        const src = path.join(sitesDir, file)
        const dest = path.join(UserExtensionsDir, file)
        writeFileSync(dest, readFileSync(src))
      }
      
      for (const key of Object.keys(ListSites)) delete ListSites[key]
      await loadExtensions()
      setupRequestRules()
      
      const extensions = Object.entries(ListSites).map(([key, ext]) => ({
        name: ext.config.name,
        version: ext.config.version || '1.0.0'
      }))
      event.reply('extensions:sync-dev', { success: true, extensions })
    } catch (error) {
      event.reply('extensions:sync-dev', { success: false, error: error.message })
    }
  })

  ipcMain.on('extensions:get-github-list', async (event) => {
    try {
      const config = tool.loadjson()
      const branch = config.extbranch || 'main'
      const url = `https://api.github.com/repos/TokyoTF/live-rec/contents/extensions?ref=${branch}`
      const response = await fetch(url)
      if (!response.ok) throw new Error('Failed to fetch extensions from GitHub')
      
      const files = await response.json()
      const extFiles = files
        .filter(f => f.name.endsWith('Extension.js'))
        .map(f => ({
          name: f.name.replace('Extension.js', '').toLowerCase(),
          fileName: f.name,
          downloadUrl: f.download_url
        }))
        
      event.reply('extensions:get-github-list', { success: true, extensions: extFiles })
    } catch (error) {
      event.reply('extensions:get-github-list', { success: false, error: error.message })
    }
  })

  ipcMain.on('app:version', (event) => {
    event.returnValue = app.getVersion()
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
