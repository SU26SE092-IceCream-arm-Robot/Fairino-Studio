import { Menu, MenuItemConstructorOptions, BrowserWindow, dialog, app } from 'electron'

// Language translation dictionary for Native Menu
const labels = {
  vi: {
    file: 'Tệp',
    newProject: 'Dự án Mới',
    openProject: 'Mở Dự án...',
    save: 'Lưu',
    saveAs: 'Lưu Dưới Dạng...',
    export: 'Xuất',
    exportLarge: 'Xuất Workflow Lớn (.lua)...',
    exportSteps: 'Xuất Workflow Theo Step (.zip)...',
    import: 'Nạp LUA...',
    quit: 'Thoát',
    edit: 'Chỉnh sửa',
    undo: 'Hoàn tác',
    redo: 'Làm lại',
    cut: 'Cắt',
    copy: 'Sao chép',
    paste: 'Dán',
    selectAll: 'Chọn tất cả',
    view: 'Hiển thị',
    reload: 'Tải lại',
    forceReload: 'Tải lại toàn bộ',
    toggleDevTools: 'Bật/Tắt DevTools',
    resetZoom: 'Đặt lại cỡ chữ',
    zoomIn: 'Phóng to',
    zoomOut: 'Thu nhỏ',
    toggleFullscreen: 'Toàn màn hình',
    quickAccess: 'Thanh công cụ nhanh',
    hitbox: 'Hiện hộp va chạm (Hitbox)',
    preferences: 'Cài đặt',
    language: 'Ngôn ngữ',
    help: 'Trợ giúp',
    learnMore: 'Tìm hiểu thêm',
    updates: 'Kiểm tra Cập nhật...',
    about: 'Về FaiRobot Studio'
  },
  en: {
    file: 'File',
    newProject: 'New Project',
    openProject: 'Open Project...',
    save: 'Save',
    saveAs: 'Save As...',
    export: 'Export',
    exportLarge: 'Export Large Workflow (.lua)...',
    exportSteps: 'Export Steps Workflow (.zip)...',
    import: 'Import LUA...',
    quit: 'Quit',
    edit: 'Edit',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    view: 'View',
    reload: 'Reload',
    forceReload: 'Force Reload',
    toggleDevTools: 'Toggle Developer Tools',
    resetZoom: 'Actual Size',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    toggleFullscreen: 'Toggle Full Screen',
    quickAccess: 'Quick Access Toolbar',
    hitbox: 'Show Hitboxes (Collision)',
    preferences: 'Preferences',
    language: 'Language',
    help: 'Help',
    learnMore: 'Learn More',
    updates: 'Check for Updates...',
    about: 'About FaiRobot Studio'
  }
}

export function setupMenu(
  mainWindow: BrowserWindow,
  state: { language: 'vi' | 'en'; showQuickAccessToolbar: boolean; isDebugHitbox: boolean } = {
    language: 'vi',
    showQuickAccessToolbar: false,
    isDebugHitbox: false
  }
): void {
  const isMac = process.platform === 'darwin'
  const lang = state.language || 'vi'
  const t = labels[lang]

  const template: MenuItemConstructorOptions[] = [
    // File Menu
    {
      label: t.file,
      submenu: [
        {
          label: t.newProject,
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-action', 'new-project')
          }
        },
        {
          label: t.openProject,
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-action', 'open-project')
          }
        },
        { type: 'separator' },
        {
          label: t.save,
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('menu-action', 'save-project')
          }
        },
        {
          label: t.saveAs,
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('menu-action', 'save-as-project')
          }
        },
        { type: 'separator' },
        {
          label: t.export,
          submenu: [
            {
              label: lang === 'vi' ? 'Xuất gói để đưa vào IceBot...' : 'Export package for IceBot...',
              click: () => {
                mainWindow.webContents.send('menu-action', 'export-icebot-authoring-bundle')
              }
            },
            {
              label: lang === 'vi'
                ? 'Xuất toàn bộ thành một file Lua...'
                : 'Export all steps as one Lua file...',
              accelerator: 'CmdOrCtrl+E',
              click: () => {
                mainWindow.webContents.send('menu-action', 'export-workflow-large')
              }
            },
            {
              label: lang === 'vi'
                ? 'Xuất các file Lua theo bước...'
                : 'Export Lua files by step...',
              accelerator: 'CmdOrCtrl+Shift+E',
              click: () => {
                mainWindow.webContents.send('menu-action', 'export-workflow-steps')
              }
            }
          ]
        },
        {
          label: t.import,
          click: () => {
            mainWindow.webContents.send('menu-action', 'import-lua')
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit', label: t.quit }
      ]
    },
    // Edit Menu
    {
      label: t.edit,
      submenu: [
        { role: 'undo', label: t.undo },
        { role: 'redo', label: t.redo },
        { type: 'separator' },
        { role: 'cut', label: t.cut },
        { role: 'copy', label: t.copy },
        { role: 'paste', label: t.paste },
        { role: 'selectAll', label: t.selectAll }
      ]
    },
    // View Menu
    {
      label: t.view,
      submenu: [
        {
          label: t.quickAccess,
          type: 'checkbox',
          checked: state.showQuickAccessToolbar,
          click: (menuItem) => {
            mainWindow.webContents.send('menu-action', 'toggle-quick-access', menuItem.checked)
          }
        },
        {
          label: t.hitbox,
          type: 'checkbox',
          checked: state.isDebugHitbox,
          click: (menuItem) => {
            mainWindow.webContents.send('menu-action', 'toggle-hitbox', menuItem.checked)
          }
        },
        { type: 'separator' },
        { role: 'reload', label: t.reload },
        { role: 'forceReload', label: t.forceReload },
        { role: 'toggleDevTools', label: t.toggleDevTools },
        { type: 'separator' },
        { role: 'resetZoom', label: t.resetZoom },
        { role: 'zoomIn', label: t.zoomIn },
        { role: 'zoomOut', label: t.zoomOut },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t.toggleFullscreen }
      ]
    },
    // Preferences Menu
    {
      label: t.preferences,
      submenu: [
        {
          label: t.language,
          submenu: [
            {
              label: 'Tiếng Việt',
              type: 'radio',
              checked: lang === 'vi',
              click: () => {
                mainWindow.webContents.send('menu-action', 'change-language', 'vi')
              }
            },
            {
              label: 'English',
              type: 'radio',
              checked: lang === 'en',
              click: () => {
                mainWindow.webContents.send('menu-action', 'change-language', 'en')
              }
            }
          ]
        }
      ]
    },
    // Help Menu
    {
      label: t.help,
      submenu: [
        {
          label: t.learnMore,
          click: async () => {
            const { shell } = require('electron')
            await shell.openExternal('https://electronjs.org')
          }
        },
        {
          label: t.updates,
          click: () => {
            mainWindow.webContents.send('menu-action', 'check-for-updates')
          }
        },
        { type: 'separator' },
        {
          label: t.about,
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: t.about,
              message: 'FaiRobot Studio v1.0.4',
              detail: lang === 'vi' 
                ? 'Ứng dụng mô phỏng và lập trình kéo thả trực quan cho robot Fairino FR5.'
                : 'Simulation and visual block programming studio for the Fairino FR5 robot.'
            })
          }
        }
      ]
    }
  ]

  // macOS specific menu setup
  if (isMac) {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about', label: `${t.about}` },
        { type: 'separator' },
        { role: 'services', label: lang === 'vi' ? 'Dịch vụ' : 'Services' },
        { type: 'separator' },
        { role: 'hide', label: lang === 'vi' ? `Ẩn ${app.name}` : `Hide ${app.name}` },
        { role: 'hideOthers', label: lang === 'vi' ? 'Ẩn các cửa sổ khác' : 'Hide Others' },
        { role: 'unhide', label: lang === 'vi' ? 'Hiện tất cả' : 'Show All' },
        { type: 'separator' },
        { role: 'quit', label: lang === 'vi' ? `Thoát ${app.name}` : `Quit ${app.name}` }
      ]
    })
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
