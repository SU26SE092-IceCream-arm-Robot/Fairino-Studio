import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  showSaveDialog: (options: any) => ipcRenderer.invoke('show-save-dialog', options),
  showOpenDialog: (options: any) => ipcRenderer.invoke('show-open-dialog', options),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', filePath, content),
  writeBinaryFile: (filePath: string, base64Content: string) => ipcRenderer.invoke('write-binary-file', filePath, base64Content),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  readBlockLibrary: () => ipcRenderer.invoke('read-block-library'),
  writeBlockLibrary: (content: string) => ipcRenderer.invoke('write-block-library', content),
  onMenuAction: (callback: (action: string, ...args: any[]) => void) => {
    const listener = (_event: any, action: string, ...args: any[]) => callback(action, ...args)
    ipcRenderer.on('menu-action', listener)
    return () => {
      ipcRenderer.removeListener('menu-action', listener)
    }
  },
  updateMenuState: (state: { language: 'vi' | 'en'; showQuickAccessToolbar: boolean; isDebugHitbox: boolean }) =>
    ipcRenderer.send('update-menu-state', state),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  downloadUpdate: () => ipcRenderer.send('download-update'),
  quitAndInstall: () => ipcRenderer.send('quit-and-install'),
  onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => {
    const listener = (_event: any, info: any) => callback(info)
    ipcRenderer.on('update-available', listener)
    return () => {
      ipcRenderer.removeListener('update-available', listener)
    }
  },
  onUpdateNotAvailable: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('update-not-available', listener)
    return () => {
      ipcRenderer.removeListener('update-not-available', listener)
    }
  },
  onDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond?: number }) => void) => {
    const listener = (_event: any, progress: any) => callback(progress)
    ipcRenderer.on('download-progress', listener)
    return () => {
      ipcRenderer.removeListener('download-progress', listener)
    }
  },
  onUpdateDownloaded: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('update-downloaded', listener)
    return () => {
      ipcRenderer.removeListener('update-downloaded', listener)
    }
  },
  onUpdateError: (callback: (err: string) => void) => {
    const listener = (_event: any, err: any) => callback(err)
    ipcRenderer.on('update-error', listener)
    return () => {
      ipcRenderer.removeListener('update-error', listener)
    }
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
