import { useEffect } from 'react'
import { useRobotStore } from '../../store/robotStore'
import { useSceneStore } from '../../store/sceneStore'
import { generateLua } from '../../engine/codegen/luaCodegen'
import { FolderOpen, Save, FilePlus, Play, AlertTriangle, Globe } from 'lucide-react'
import { electronService } from '../../services/electronService'
import { translations } from '../../i18n/translations'

export default function Header() {
  const steps = useRobotStore((state) => state.steps)
  const projectName = useRobotStore((state) => state.projectName)
  const currentFilePath = useRobotStore((state) => state.currentFilePath)
  const collisionWarning = useSceneStore((state) => state.collisionWarning)

  const setProjectName = useRobotStore((state) => state.setProjectName)
  const setCurrentFilePath = useRobotStore((state) => state.setCurrentFilePath)
  const setJointAngles = useRobotStore((state) => state.setJointAngles)
  const reorderSteps = useRobotStore((state) => state.reorderSteps)

  // Language translation helper
  const language = useRobotStore((state) => state.language)
  const setLanguage = useRobotStore((state) => state.setLanguage)
  const t = (key: keyof typeof translations.vi) => translations[language][key]

  const handleNewProject = () => {
    if (confirm(t('newProjectConfirm'))) {
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
        alert(t('projectCompatError'))
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
          let url = ''
          if (obj.filePath) {
            url = `file:///${obj.filePath.replace(/\\/g, '/')}`
          }
          
          useSceneStore.getState().addObject({
            name: obj.name,
            fileType: obj.fileType,
            filePath: obj.filePath,
            url: url || obj.url || ''
          })
          
          const lastAdded = useSceneStore.getState().objects.slice(-1)[0]
          if (lastAdded) {
            useSceneStore.getState().updateObjectTransform(lastAdded.id, obj.transform)
            useSceneStore.getState().updateObjectVisibility(lastAdded.id, obj.visible)
          }
        })
      }

      alert(t('projectOpenSuccess'))
    } catch (e: any) {
      alert(`${t('projectReadError')} ${e.message}`)
    }
  }

  const handleOpenProject = async () => {
    const result = await electronService.showOpenDialog({
      title: t('openProject'),
      filters: [{ name: 'FaiRobot Projects', extensions: ['fairobot'] }],
      properties: ['openFile']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0]
      const readRes = await electronService.readFile(filePath)
      if (readRes.success && readRes.content) {
        deserializeProject(readRes.content, filePath)
      } else {
        alert(`${t('projectReadError')} ${readRes.error}`)
      }
    }
  }

  const handleSaveProject = async () => {
    const currentPath = useRobotStore.getState().currentFilePath
    if (currentPath) {
      const content = serializeProject()
      const writeRes = await electronService.writeFile(currentPath, content)
      if (writeRes.success) {
        alert(t('projectSaveSuccess'))
      } else {
        alert(`${t('projectSaveError')} ${writeRes.error}`)
      }
    } else {
      handleSaveAsProject()
    }
  }

  const handleSaveAsProject = async () => {
    const projName = useRobotStore.getState().projectName
    const content = serializeProject()
    const result = await electronService.showSaveDialog({
      title: t('saveProject'),
      defaultPath: `${projName}.fairobot`,
      filters: [{ name: 'FaiRobot Projects', extensions: ['fairobot'] }]
    })

    if (!result.canceled && result.filePath) {
      const writeRes = await electronService.writeFile(result.filePath, content)
      if (writeRes.success) {
        setCurrentFilePath(result.filePath)
        alert(t('projectSaveSuccess'))
      } else {
        alert(`${t('projectSaveError')} ${writeRes.error}`)
      }
    }
  }

  const handleExportLua = async () => {
    const currentSteps = useRobotStore.getState().steps
    const projName = useRobotStore.getState().projectName
    const luaCode = generateLua(currentSteps, projName)
    const result = await electronService.showSaveDialog({
      title: t('exportLua'),
      defaultPath: `${projName}.lua`,
      filters: [{ name: 'Lua Script Files', extensions: ['lua'] }]
    })

    if (!result.canceled && result.filePath) {
      const writeRes = await electronService.writeFile(result.filePath, luaCode)
      if (writeRes.success) {
        alert(t('luaExportSuccess'))
      } else {
        alert(`${t('luaExportError')} ${writeRes.error}`)
      }
    }
  }

  // Subscribe to native menu actions on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'api' in window && window.api.onMenuAction) {
      const unsubscribe = window.api.onMenuAction((action) => {
        switch (action) {
          case 'new-project':
            handleNewProject()
            break
          case 'open-project':
            handleOpenProject()
            break
          case 'save-project':
            handleSaveProject()
            break
          case 'save-as-project':
            handleSaveAsProject()
            break
          case 'export-lua':
            handleExportLua()
            break
        }
      })
      return unsubscribe
    }
    return undefined
  }, [language]) // Refresh subscription if language changes so local confirm prompts get proper translations

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
          placeholder={t('projectNamePlaceholder')}
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
          <AlertTriangle size={14} /> {t('collisionWarning')}
        </div>
      )}

      {/* Action Buttons & Language Switcher */}
      <div className="flex items-center gap-4">
        {/* Language selector */}
        <div className="flex items-center gap-1.5 border border-[#2d2d34] rounded-lg px-2.5 py-1.5 bg-[#1e1e24] hover:bg-[#25252d] hover:border-slate-500 transition">
          <Globe size={13} className="text-slate-400" />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as any)}
            className="bg-transparent text-xs font-bold text-slate-300 outline-none cursor-pointer border-none p-0 pr-1"
          >
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="w-px h-5 bg-[#2d2d34]"></div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleNewProject}
            title={t('newProject')}
            className="p-1.5 rounded bg-[#1e1e24] hover:bg-[#282830] border border-[#2d2d34] text-slate-300 hover:text-white transition flex items-center gap-1"
          >
            <FilePlus size={14} />
            <span className="text-[11px] font-semibold hidden md:inline">{t('newProject')}</span>
          </button>
          <button
            onClick={handleOpenProject}
            title={t('openProject')}
            className="p-1.5 rounded bg-[#1e1e24] hover:bg-[#282830] border border-[#2d2d34] text-slate-300 hover:text-white transition flex items-center gap-1"
          >
            <FolderOpen size={14} />
            <span className="text-[11px] font-semibold hidden md:inline">{t('openProject')}</span>
          </button>
          <button
            onClick={handleSaveProject}
            title={t('saveProject')}
            className="p-1.5 rounded bg-[#1e1e24] hover:bg-[#282830] border border-[#2d2d34] text-slate-300 hover:text-white transition flex items-center gap-1"
          >
            <Save size={14} />
            <span className="text-[11px] font-semibold hidden md:inline">{t('saveProject')}</span>
          </button>
          
          <div className="w-px h-5 bg-[#2d2d34] mx-1"></div>
          
          <button
            onClick={handleExportLua}
            className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition flex items-center gap-1.5"
          >
            <Play size={12} className="fill-white" />
            {t('exportLua')} ({steps.length})
          </button>
        </div>
      </div>
    </header>
  )
}
