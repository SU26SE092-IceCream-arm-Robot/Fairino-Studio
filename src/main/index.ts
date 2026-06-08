import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { tmpdir } from 'os'
import icon from '../../resources/icon.png?asset'
import fs from 'fs/promises'
import { setupMenu } from './menu'

const cacheDir = join(tmpdir(), 'fairobot-studio-electron-cache')
app.commandLine.appendSwitch('disk-cache-dir', cacheDir)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-gpu-program-cache')
app.commandLine.appendSwitch('disk-cache-size', '0')
app.commandLine.appendSwitch('media-cache-size', '0')

let mainWindow: BrowserWindow | null = null
const gotSingleInstanceLock = app.requestSingleInstanceLock()

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1024, // Wider by default for better 3D simulation space
    height: 768,
    show: false,
    autoHideMenuBar: false,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Initialize the native application menu bar
  setupMenu(mainWindow)

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
if (gotSingleInstanceLock) app.whenReady().then(() => {
  // Set app user model id for windows
  app.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    window.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' && input.type === 'keyDown') {
        window.webContents.toggleDevTools()
      }
      if (app.isPackaged && input.control && input.key.toLowerCase() === 'r') {
        event.preventDefault()
      }
    })
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // IPC handlers for File Operations
  ipcMain.handle('show-save-dialog', async (_, options) => {
    return await dialog.showSaveDialog(options)
  })

  ipcMain.handle('show-open-dialog', async (_, options) => {
    return await dialog.showOpenDialog(options)
  })

  ipcMain.handle('write-file', async (_, filePath, content) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8')
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('read-file', async (_, filePath) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return { success: true, content }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('read-block-library', async () => {
    try {
      const libraryPath = join(app.getPath('userData'), 'block-library.json')
      const content = await fs.readFile(libraryPath, 'utf-8')
      return { success: true, content }
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return { success: true, content: JSON.stringify({ modules: [], workflows: [] }) }
      }
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('write-block-library', async (_, content) => {
    try {
      const libraryPath = join(app.getPath('userData'), 'block-library.json')
      await fs.writeFile(libraryPath, content, 'utf-8')
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
