import { useState, useEffect } from 'react'
import Header from './components/layout/Header'
import RobotSidebar from './components/robot/RobotSidebar'
import Viewport3D from './components/viewport/Viewport3D'
import WorkflowPanel from './components/workflow/WorkflowPanel'
import CodePanel from './components/code/CodePanel'
import { Code, ChevronDown, ChevronUp } from 'lucide-react'

function App(): React.JSX.Element {
  const [showCode, setShowCode] = useState(true)
  const [updateStatus, setUpdateStatus] = useState<
    'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  >('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string } | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [updateError, setUpdateError] = useState('')

  useEffect(() => {
    const unsubscribeMenu = window.api.onMenuAction((action) => {
      if (action === 'check-for-updates') {
        setUpdateStatus('checking')
        setUpdateError('')
        window.api.checkForUpdates()
      }
    })

    const unsubscribeAvailable = window.api.onUpdateAvailable((info) => {
      setUpdateStatus('available')
      setUpdateInfo(info)
    })

    const unsubscribeNotAvailable = window.api.onUpdateNotAvailable(() => {
      setUpdateStatus('not-available')
    })

    const unsubscribeProgress = window.api.onDownloadProgress((progress) => {
      setUpdateStatus('downloading')
      setDownloadProgress(Math.round(progress.percent))
    })

    const unsubscribeDownloaded = window.api.onUpdateDownloaded(() => {
      setUpdateStatus('downloaded')
    })

    const unsubscribeError = window.api.onUpdateError((err) => {
      setUpdateStatus('error')
      setUpdateError(err)
    })

    return () => {
      unsubscribeMenu()
      unsubscribeAvailable()
      unsubscribeNotAvailable()
      unsubscribeProgress()
      unsubscribeDownloaded()
      unsubscribeError()
    }
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen bg-[#1e1e24] overflow-hidden text-slate-100 font-sans">
      {/* Top Header */}
      <Header />

      {/* Main Workspace Layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Side: Robot Controls & Scene Settings */}
        <RobotSidebar />

        {/* Center: 3D Scene Viewport & LUA Preview */}
        <div className="flex-1 h-full flex flex-col min-w-0 relative">
          {/* 3D Viewport */}
          <div className="flex-1 min-h-0 relative">
            <Viewport3D />

            {/* Floating Toggle Button for LUA Code Preview */}
            <button
              onClick={() => setShowCode(!showCode)}
              className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 px-3 py-2 bg-[#141417]/90 hover:bg-[#1e1e24] border border-[#2d2d34] hover:border-blue-500 rounded-lg text-xs font-semibold text-slate-300 hover:text-white transition shadow-lg backdrop-blur-sm"
              title={showCode ? 'Ẩn Code Preview' : 'Hiện Code Preview'}
            >
              <Code size={14} className="text-blue-500" />
              <span>LUA Preview</span>
              {showCode ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>

          {/* Bottom Code Panel */}
          {showCode && (
            <div className="h-60 shrink-0">
              <CodePanel />
            </div>
          )}
        </div>

        {/* Right Side: Workflow Editor */}
        <WorkflowPanel />
      </div>

      {/* Auto Update Modal */}
      {updateStatus !== 'idle' && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-xl border border-[#34343e] bg-[#17171c] p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-white/5 pb-3">
              <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-100 font-mono">
                Cập nhật ứng dụng
              </h3>
            </div>

            {/* Content body based on status */}
            <div className="text-xs leading-relaxed text-slate-300">
              {updateStatus === 'checking' && (
                <div className="flex flex-col items-center py-4 space-y-3">
                  <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
                  <p className="font-semibold text-slate-400">Đang tìm kiếm bản cập nhật mới...</p>
                </div>
              )}

              {updateStatus === 'not-available' && (
                <div className="space-y-4 py-2 text-center">
                  <p className="font-semibold text-emerald-400">Bạn đang sử dụng phiên bản mới nhất!</p>
                  <p className="text-[11px] text-slate-500">FaiRobot Studio hiện không có bản cập nhật nào mới hơn.</p>
                  <button
                    onClick={() => setUpdateStatus('idle')}
                    className="h-8 px-4 rounded bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              )}

              {updateStatus === 'available' && updateInfo && (
                <div className="space-y-3">
                  <p className="font-bold text-slate-200">
                    Phát hiện phiên bản mới: <span className="text-blue-400 font-mono">{updateInfo.version}</span>
                  </p>
                  {updateInfo.releaseNotes && (
                    <div className="bg-black/30 border border-white/5 p-3 rounded max-h-36 overflow-y-auto thin-scrollbar font-mono text-[11px] text-slate-400 font-sans">
                      <p className="font-semibold text-slate-300 mb-1">Nhật ký thay đổi:</p>
                      <div dangerouslySetInnerHTML={{ __html: updateInfo.releaseNotes }} />
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500">Bạn có muốn tải về bản cập nhật này ngay bây giờ không?</p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setUpdateStatus('idle')}
                      className="h-8 px-4 rounded border border-[#34343e] bg-[#202027] text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                    >
                      Để sau
                    </button>
                    <button
                      onClick={() => {
                        setUpdateStatus('downloading')
                        window.api.downloadUpdate()
                      }}
                      className="h-8 px-4 rounded bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-blue-500/20"
                    >
                      Tải về ngay
                    </button>
                  </div>
                </div>
              )}

              {updateStatus === 'downloading' && (
                <div className="space-y-4 py-2">
                  <div className="flex justify-between font-bold text-slate-300">
                    <span>Đang tải bản cập nhật...</span>
                    <span className="font-mono text-blue-400">{downloadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden border border-white/5">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-300 rounded-full shadow-lg shadow-blue-500/50" 
                      style={{ width: `${downloadProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 text-center">Vui lòng không đóng ứng dụng khi quá trình tải đang diễn ra.</p>
                </div>
              )}

              {updateStatus === 'downloaded' && (
                <div className="space-y-4 py-2 text-center">
                  <p className="font-bold text-slate-200">Đã tải xong bản cập nhật!</p>
                  <p className="text-[11px] text-slate-400">Ứng dụng cần khởi động lại để hoàn tất việc cài đặt phiên bản mới.</p>
                  <div className="flex justify-center gap-2 pt-2">
                    <button
                      onClick={() => setUpdateStatus('idle')}
                      className="h-8 px-4 rounded border border-[#34343e] bg-[#202027] text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
                    >
                      Lần sau
                    </button>
                    <button
                      onClick={() => window.api.quitAndInstall()}
                      className="h-8 px-4 rounded bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-emerald-500/20"
                    >
                      Cài đặt & Khởi động lại
                    </button>
                  </div>
                </div>
              )}

              {updateStatus === 'error' && (
                <div className="space-y-3">
                  <p className="font-bold text-rose-400">Lỗi khi cập nhật</p>
                  <p className="text-[11px] text-slate-400 bg-rose-950/20 border border-rose-500/10 p-2.5 rounded font-mono text-rose-300 max-h-24 overflow-y-auto thin-scrollbar">
                    {updateError || 'Không thể kết nối tới máy chủ cập nhật.'}
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setUpdateStatus('idle')}
                      className="h-8 px-4 rounded bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white transition cursor-pointer"
                    >
                      Đóng
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
