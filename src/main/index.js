import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ListSites } from '../../lib/warp'
import WarpClass from '../../lib/tools.class.js'

const tool = new WarpClass()
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('rec:add', async (event, args) => {
    console.log('add:', args.name, args.provider)
    const url = await ListSites[args.provider].extract(args.name, args.provider)

    tool.recInit({ nametag: args.name, provider: args.provider })
    event.reply('rec:add', url)
  })

  ipcMain.on('res:status', async (event, args) => {
    event.reply('res:status', {
      nametag: args.nametag,
      data: await ListSites[args.provider].update(args.nametag)
    })
  })

  ipcMain.on('rec:live:status', (event, args) => {
    const rec = tool.rec(args.nametag, args.type, args.url, args.status, args.provider)
    event.reply('rec:live:status', { nametag: args.nametag, status: rec })
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
