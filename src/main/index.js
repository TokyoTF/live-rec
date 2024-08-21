import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
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
let ffmpegselect = ''
let savefolder = ''
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('rec:add', async (event, args) => {
    console.log('add:', args.name, args.provider)
    const url = await ListSites[args.provider].extract(args.name, args.provider)

    tool.recInit({ nametag: args.name, provider: args.provider, savefolder, ffmpegselect })
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

  ipcMain.on('Select:Folder', (event, args) => {
    try {
      const typeOpen = dialog.showOpenDialogSync({
        properties: [
          args.type == 'file' ? 'openFile' : args.type == 'folder' ? 'openDirectory' : 'openFile'
        ],
        filters: [
          {
            name: '.exe',
            extensions: ['exe']
          }
        ]
      })
      if (typeOpen) {
        console.log(typeOpen)
        if (args.type == 'file') {
          ffmpegselect = typeOpen[0].replace(/\\/g, '/')
        } else if (args.type == 'folder') {
          savefolder = typeOpen[0].replace(/\\/g, '/')
        }
        event.reply("Select:Folder",{ffmpeg:ffmpegselect,svfolder:savefolder})
      } else {
        console.log('select canceled')
      }
    } catch (error) {
      console.log(error)
    }
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
