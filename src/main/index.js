import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { ListSites } from '../../lib/warp'
import WarpClass from '../../lib/tools.class.js'
import { existsSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'path'

const FolderMain = path.resolve(process.env.USERPROFILE, 'Documents', 'live-rec')
const tool = new WarpClass()
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1000,
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

  if (!existsSync(FolderMain)) {
    mkdirSync(FolderMain, { recursive: true })
  }

  if (!existsSync(FolderMain + '/config.json')) {
    const data = {
      savefolder: '',
      ffmpegselect: '',
      autorec: false,
      autocreatefolder: false,
      autocreatefolderby: 'nametag',
      dateformat: 'model-site-dd-MM-yyyy_hh-mm-ss',
      updatetime: 25,
      reclist: []
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
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  let dateformat = ''

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('rec:add', async (event, args) => {
    console.log('add:', args.name, args.provider)

    const url = await ListSites[args.provider].extract(args.name, args.provider)
    if (url.status == 'online' || url.status == 'offline' || url.status == 'private') {
      await tool.recInit({ nametag: args.name, provider: args.provider, dateformat })
      setTimeout(() => {
        event.reply('rec:add', { data: url, provider: args.provider })
      }, 500)
    }
  })

  ipcMain.on('rec:live:remove', async (event, args) => {
    console.log('remove:', args.nametag)
    tool.removeRec(args.nametag, args.provider)
  })

  ipcMain.on('res:status', async (event, args) => {
    event.reply('res:status', {
      nametag: args.nametag,
      provider: args.provider,
      data: await ListSites[args.provider].update(args.nametag)
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
    event.reply('rec:live:status', { nametag: args.nametag, provider: args.provider, status: rec })
  })

  ipcMain.on('Load:config', (event) => {
    const load = tool.loadjson()
    dateformat = load.dateformat
    event.reply('Load:config', load)
  })

  ipcMain.on('Modify:config', (event, args) => {
    if (args.name == 'dateformat') dateformat = args.value

    tool.modifyjson({ raw: { name: args.name, value: args.value } })
  })

  ipcMain.on('Select:Folder', (event, args) => {
    let localselffmpeg = ''
    let localsavefolder = ''
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
        if (args.type == 'file') {
          localselffmpeg = typeOpen[0].replace(/\\/g, '/')
          tool.modifyjson({ raw: { name: 'ffmpegselect', value: typeOpen[0].replace(/\\/g, '/') } })
        } else if (args.type == 'folder') {
          localsavefolder = typeOpen[0].replace(/\\/g, '/')
          tool.modifyjson({ raw: { name: 'savefolder', value: typeOpen[0].replace(/\\/g, '/') } })
        }
        event.reply('Select:Folder', { ffmpeg: localselffmpeg, svfolder: localsavefolder })
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
