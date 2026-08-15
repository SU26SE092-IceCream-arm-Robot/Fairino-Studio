import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      showSaveDialog: (options: any) => Promise<any>
      showOpenDialog: (options: any) => Promise<any>
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
      writeBinaryFile: (filePath: string, base64Content: string) => Promise<{ success: boolean; error?: string }>
      readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
      readBinaryFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>
      readBlockLibrary: () => Promise<{ success: boolean; content?: string; error?: string }>
      writeBlockLibrary: (content: string) => Promise<{ success: boolean; error?: string }>
      onMenuAction: (callback: (action: string) => void) => () => void
      checkForUpdates: () => void
      downloadUpdate: () => void
      quitAndInstall: () => void
      onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => () => void
      onUpdateNotAvailable: (callback: () => void) => () => void
      onDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond?: number }) => void) => () => void
      onUpdateDownloaded: (callback: () => void) => () => void
      onUpdateError: (callback: (err: string) => void) => () => void
    }
  }
}
