import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      showSaveDialog: (options: any) => Promise<any>
      showOpenDialog: (options: any) => Promise<any>
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
      readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
      readBlockLibrary: () => Promise<{ success: boolean; content?: string; error?: string }>
      writeBlockLibrary: (content: string) => Promise<{ success: boolean; error?: string }>
      onMenuAction: (callback: (action: string) => void) => () => void
    }
  }
}
