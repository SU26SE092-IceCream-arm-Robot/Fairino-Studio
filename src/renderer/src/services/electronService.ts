/**
 * Service representing Electron API calls via IPC.
 * Provides fallback mock methods for web/browser environment testing.
 */
export interface ElectronService {
  isElectron: boolean
  showSaveDialog: (options: any) => Promise<{ canceled: boolean; filePath?: string }>
  showOpenDialog: (options: any) => Promise<{ canceled: boolean; filePaths: string[] }>
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>
  writeBinaryFile: (filePath: string, content: Uint8Array) => Promise<{ success: boolean; error?: string }>
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>
  readBlockLibrary: () => Promise<{ success: boolean; content?: string; error?: string }>
  writeBlockLibrary: (content: string) => Promise<{ success: boolean; error?: string }>
  updateMenuState: (state: { language: 'vi' | 'en'; showQuickAccessToolbar: boolean; isDebugHitbox: boolean }) => void
}

const isElectronEnv = typeof window !== 'undefined' && 'api' in window

export const electronService: ElectronService = {
  isElectron: isElectronEnv,

  showSaveDialog: async (options) => {
    if (isElectronEnv) {
      return window.api.showSaveDialog(options)
    }
    console.warn('showSaveDialog called outside Electron env.')
    const fileName = prompt('Nhập tên file để lưu (giả lập):', options.defaultPath || 'project.fairobot')
    if (fileName) {
      return { canceled: false, filePath: fileName }
    }
    return { canceled: true }
  },

  showOpenDialog: async (options) => {
    if (isElectronEnv) {
      return window.api.showOpenDialog(options)
    }
    console.warn('showOpenDialog called outside Electron env.')
    alert('Vui lòng sử dụng tính năng import trên giao diện web.')
    return { canceled: true, filePaths: [] }
  },

  writeFile: async (filePath, content) => {
    if (isElectronEnv) {
      return window.api.writeFile(filePath, content)
    }
    console.warn('writeFile called outside Electron env.')
    // In Web, we simulate saving by triggering a file download
    try {
      const blob = new Blob([content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filePath.split(/[\\/]/).pop() || 'project.fairobot'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return { success: true }
    } catch (e: any) {
      return { success: false, error: e.message }
    }
  },

  writeBinaryFile: async (filePath, content) => {
    if (isElectronEnv) {
      let binary = ''
      const chunkSize = 0x8000
      for (let offset = 0; offset < content.length; offset += chunkSize) {
        binary += String.fromCharCode(...content.subarray(offset, offset + chunkSize))
      }
      return window.api.writeBinaryFile(filePath, btoa(binary))
    }
    try {
      const blob = new Blob([content as BlobPart], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filePath.split(/[\\/]/).pop() || 'icebot-export.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  },

  readFile: async (filePath) => {
    if (isElectronEnv) {
      return window.api.readFile(filePath)
    }
    console.warn('readFile called outside Electron env.')
    return { success: false, error: 'Không hỗ trợ đọc file trực tiếp ngoài Electron.' }
  },

  readBlockLibrary: async () => {
    if (isElectronEnv) {
      return window.api.readBlockLibrary()
    }
    const content = window.localStorage.getItem('fairobot-block-library') || JSON.stringify({ modules: [], workflows: [] })
    return { success: true, content }
  },

  writeBlockLibrary: async (content) => {
    if (isElectronEnv) {
      return window.api.writeBlockLibrary(content)
    }
    window.localStorage.setItem('fairobot-block-library', content)
    return { success: true }
  },

  updateMenuState: (state) => {
    if (isElectronEnv && 'updateMenuState' in window.api) {
      (window.api as any).updateMenuState(state)
    } else {
      console.warn('updateMenuState called outside Electron or not exposed.')
    }
  }
}
