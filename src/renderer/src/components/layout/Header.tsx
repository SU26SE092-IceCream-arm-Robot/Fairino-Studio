import { useRobotStore } from '../../store/robotStore'
import { useSceneStore } from '../../store/sceneStore'
import { generateLua } from '../../engine/codegen/luaCodegen'
import { FolderOpen, Save, FilePlus, Play, AlertTriangle } from 'lucide-react'

export default function Header() {
  const steps = useRobotStore((state) => state.steps)
  const projectName = useRobotStore((state) => state.projectName)
  const currentFilePath = useRobotStore((state) => state.currentFilePath)
  const collisionWarning = useSceneStore((state) => state.collisionWarning)

  const setProjectName = useRobotStore((state) => state.setProjectName)
  const setCurrentFilePath = useRobotStore((state) => state.setCurrentFilePath)
  const setJointAngles = useRobotStore((state) => state.setJointAngles)
  const reorderSteps = useRobotStore((state) => state.reorderSteps)

  const handleNewProject = () => {
    if (confirm('Bạn có chắc chắn muốn tạo dự án mới? Toàn bộ các bước workflow hiện tại sẽ bị xóa.')) {
      reorderSteps([])
      setJointAngles([0, 0, 0, 0, 0, 0])
      setProjectName('coffee_machine_workflow')
      setCurrentFilePath(null)
      useSceneStore.getState().clearScene()
    }
  }

  // Serialize current workspace state to JSON string
  const serializeProject = () => {
    const robotState = useRobotStore.getState()
    const sceneState = useSceneStore.getState()

    const projectData = {
      version: '1.0',
      projectName: robotState.projectName,
      robotModel: robotState.robotModel,
      jointAngles: robotState.jointAngles,
      steps: robotState.steps,
      sceneObjects: sceneState.objects.map(obj => ({
        name: obj.name,
        fileType: obj.fileType,
        filePath: obj.filePath,
        transform: obj.transform,
        visible: obj.visible
      }))
    }

    return JSON.stringify(projectData, null, 2)
  }

  // Deserialize and load workspace state from JSON string
  const deserializeProject = (jsonStr: string, filePath: string) => {
    try {
      const data = JSON.parse(jsonStr)
      if (data.version !== '1.0') {
        alert('Phiên bản dự án không tương thích!')
        return
      }

      // 1. Populate Robot Store
      setProjectName(data.projectName || 'loaded_project')
      setCurrentFilePath(filePath)
      setJointAngles(data.jointAngles || [0, 0, 0, 0, 0, 0])
      reorderSteps(data.steps || [])

      // 2. Populate Scene Store
      useSceneStore.getState().clearScene()
      if (data.sceneObjects && Array.isArray(data.sceneObjects)) {
        data.sceneObjects.forEach((obj: any) => {
          // Re-create temporary ObjectURLs if filepath exists
          // Since it's in Electron, we can read local files, but for security
          // and active session rendering, we will create a mock url or fetch if it is local.
          // In production, we'd read the local filePath.
          // As a robust fallback, if there is no file, we load a placeholder.
          // Wait, we can load local file paths directly in Electron by using the filePath!
          // We can use a file:// URL or custom protocol.
          let url = ''
          if (obj.filePath) {
            // Convert Windows backslashes to forward slashes for URL
            url = `file:///${obj.filePath.replace(/\\/g, '/')}`
          }
          
          useSceneStore.getState().addObject({
            name: obj.name,
            fileType: obj.fileType,
            filePath: obj.filePath,
            url: url || obj.url || ''
          })
          
          // Re-apply transforms since addObject uses default transforms
          const lastAdded = useSceneStore.getState().objects.slice(-1)[0]
          if (lastAdded) {
            useSceneStore.getState().updateObjectTransform(lastAdded.id, obj.transform)
            useSceneStore.getState().updateObjectVisibility(lastAdded.id, obj.visible)
          }
        })
      }

      alert('Đã mở dự án thành công!')
    } catch (e: any) {
      alert(`Lỗi đọc file dự án: ${e.message}`)
    }
  }

  const handleOpenProject = async () => {
    const result = await window.api.showOpenDialog({
      title: 'Mở dự án FaiRobot',
      filters: [{ name: 'FaiRobot Projects', extensions: ['fairobot'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      const readRes = await window.api.readFile(filePath)
      if (readRes.success && readRes.content) {
        deserializeProject(readRes.content, filePath)
      } else {
        alert(`Lỗi đọc file: ${readRes.error}`)
      }
    }
  }

  const handleSaveProject = async () => {
    if (currentFilePath) {
      const content = serializeProject()
      const writeRes = await window.api.writeFile(currentFilePath, content)
      if (writeRes.success) {
        alert('Lưu dự án thành công!')
      } else {
        alert(`Lỗi khi lưu: ${writeRes.error}`)
      }
    } else {
      handleSaveAsProject()
    }
  }

  const handleSaveAsProject = async () => {
    const content = serializeProject()
    const result = await window.api.showSaveDialog({
      title: 'Lưu dự án FaiRobot',
      defaultPath: `${projectName}.fairobot`,
      filters: [{ name: 'FaiRobot Projects', extensions: ['fairobot'] }]
    })

    if (!result.canceled && result.filePath) {
      const writeRes = await window.api.writeFile(result.filePath, content)
      if (writeRes.success) {
        setCurrentFilePath(result.filePath)
        alert('Lưu dự án thành công!')
      } else {
        alert(`Lỗi khi lưu: ${writeRes.error}`)
      }
    }
  }

  const handleExportLua = async () => {
    const luaCode = generateLua(steps, projectName)
    const result = await window.api.showSaveDialog({
      title: 'Xuất Script Lua cho Fairino',
      defaultPath: `${projectName}.lua`,
      filters: [{ name: 'Lua Script Files', extensions: ['lua'] }]
    })

    if (!result.canceled && result.filePath) {
      const writeRes = await window.api.writeFile(result.filePath, luaCode)
      if (writeRes.success) {
        alert('Xuất mã nguồn Lua thành công!')
      } else {
        alert(`Lỗi xuất file: ${writeRes.error}`)
      }
    }
  }

  return (
    <header className="h-14 bg-[#141417] border-b border-[#2d2d34] flex items-center justify-between px-6 text-slate-200 select-none shrink-0">
      {/* Brand / Logo */}
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black px-2.5 py-1 rounded-md text-sm shadow-md">
          FAI
        </div>
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">FaiRobot Studio</h1>
          <span className="text-[10px] text-slate-500">v1.0.0 (Beta)</span>
        </div>
      </div>

      {/* Project Name Editor */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ''))}
          placeholder="Tên dự án..."
          title="Tên dự án (chỉ cho phép chữ cái, số, gạch dưới và gạch ngang)"
          className="bg-[#1e1e24] hover:bg-[#25252d] focus:bg-[#2d2d38] border border-[#2d2d34] focus:border-blue-500 rounded px-2.5 py-1 text-xs font-semibold text-white outline-none w-48 text-center transition"
        />
        {currentFilePath && (
          <span className="text-[9px] text-slate-500 truncate max-w-[150px]" title={currentFilePath}>
            ({currentFilePath.split('\\').pop()})
          </span>
        )}
      </div>

      {/* Collision Global Alert */}
      {collisionWarning && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-950/40 border border-rose-500/35 rounded-full text-rose-400 text-xs font-bold animate-pulse">
          <AlertTriangle size={14} /> Va chạm!
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleNewProject}
          title="Tạo dự án mới"
          className="p-1.5 rounded bg-[#1e1e24] hover:bg-[#282830] border border-[#2d2d34] text-slate-300 hover:text-white transition flex items-center gap-1"
        >
          <FilePlus size={14} />
          <span className="text-[11px] font-semibold hidden md:inline">Mới</span>
        </button>
        <button
          onClick={handleOpenProject}
          title="Mở dự án (.fairobot)"
          className="p-1.5 rounded bg-[#1e1e24] hover:bg-[#282830] border border-[#2d2d34] text-slate-300 hover:text-white transition flex items-center gap-1"
        >
          <FolderOpen size={14} />
          <span className="text-[11px] font-semibold hidden md:inline">Mở</span>
        </button>
        <button
          onClick={handleSaveProject}
          title="Lưu lại"
          className="p-1.5 rounded bg-[#1e1e24] hover:bg-[#282830] border border-[#2d2d34] text-slate-300 hover:text-white transition flex items-center gap-1"
        >
          <Save size={14} />
          <span className="text-[11px] font-semibold hidden md:inline">Lưu</span>
        </button>
        
        <div className="w-px h-5 bg-[#2d2d34] mx-1"></div>
        
        <button
          onClick={handleExportLua}
          className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition flex items-center gap-1.5"
        >
          <Play size={12} className="fill-white" />
          Xuất LUA ({steps.length})
        </button>
      </div>
    </header>
  )
}
