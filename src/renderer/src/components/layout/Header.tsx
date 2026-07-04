import { useEffect } from 'react'
import { useRobotStore } from '../../store/robotStore'
import { useSceneStore } from '../../store/sceneStore'
import { generateSingleStepLua } from '../../engine/codegen/luaCodegen'
import { parseLua } from '../../engine/codegen/luaParser'
import { FolderOpen, Save, FilePlus, Play, AlertTriangle, Globe, Upload } from 'lucide-react'
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
  const setSimpleBlocklyWorkspace = useRobotStore((state) => state.setSimpleBlocklyWorkspace)
  const setProjectModules = useRobotStore((state) => state.setProjectModules)
  const setProjectWorkflowTemplates = useRobotStore((state) => state.setProjectWorkflowTemplates)
  const markSimpleWorkspaceClean = useRobotStore((state) => state.markSimpleWorkspaceClean)

  // Language translation helper
  const language = useRobotStore((state) => state.language)
  const setLanguage = useRobotStore((state) => state.setLanguage)
  const t = (key: keyof typeof translations.vi) => translations[language][key]

  const handleNewProject = () => {
    if (confirm(t('newProjectConfirm'))) {
      reorderSteps([])
      setJointAngles([0, 0, 0, 0, 0, 0])
      setProjectName('untitled')
      setCurrentFilePath(null)
      setSimpleBlocklyWorkspace(null)
      setProjectModules([])
      setProjectWorkflowTemplates([])
      markSimpleWorkspaceClean()
      useSceneStore.getState().clearScene()
    }
  }

  // Serialize current workspace state to JSON string
  const serializeProject = () => {
    const robotState = useRobotStore.getState()
    const sceneState = useSceneStore.getState()

    const projectData = {
      version: '1.1',
      projectName: robotState.projectName,
      robotModel: robotState.robotModel,
      jointAngles: robotState.jointAngles,
      steps: robotState.steps,
      simpleBlocklyWorkspace: robotState.simpleBlocklyWorkspace,
      projectModules: robotState.projectModules,
      projectWorkflowTemplates: robotState.projectWorkflowTemplates,
      sceneObjects: sceneState.objects.map(obj => ({
        name: obj.name,
        fileType: obj.fileType,
        filePath: obj.filePath,
        transform: obj.transform,
        visible: obj.visible,
        isTool: obj.isTool,
        modelUnit: obj.modelUnit,
        toolMountAxis: obj.toolMountAxis
      }))
    }

    return JSON.stringify(projectData, null, 2)
  }

  // Deserialize and load workspace state from JSON string
  const deserializeProject = (jsonStr: string, filePath: string) => {
    try {
      const data = JSON.parse(jsonStr)
      if (data.version !== '1.0' && data.version !== '1.1') {
        alert(t('projectCompatError'))
        return
      }

      // 1. Populate Robot Store
      setProjectName(data.projectName || 'loaded_project')
      setCurrentFilePath(filePath)
      setJointAngles(data.jointAngles || [0, 0, 0, 0, 0, 0])
      reorderSteps(data.steps || [])
      setSimpleBlocklyWorkspace(data.simpleBlocklyWorkspace || null)
      setProjectModules(Array.isArray(data.projectModules) ? data.projectModules : [])
      setProjectWorkflowTemplates(Array.isArray(data.projectWorkflowTemplates) ? data.projectWorkflowTemplates : [])
      if (data.simpleBlocklyWorkspace) {
        markSimpleWorkspaceClean()
      }

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
            url: url || obj.url || '',
            isTool: obj.isTool,
            modelUnit:
              obj.modelUnit === 'mm' || obj.modelUnit === 'cm' || obj.modelUnit === 'm'
                ? obj.modelUnit
                : obj.fileType === 'obj' || obj.fileType === 'stl'
                  ? 'mm'
                  : 'm',
            toolMountAxis:
              obj.toolMountAxis === '+x' || obj.toolMountAxis === '-x' ||
              obj.toolMountAxis === '+y' || obj.toolMountAxis === '-y' ||
              obj.toolMountAxis === '+z' || obj.toolMountAxis === '-z'
                ? obj.toolMountAxis
                : 'auto'
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
    if (currentSteps.length === 0) {
      alert(language === 'vi' ? 'Không có bước workflow nào để xuất!' : 'No workflow steps to export!')
      return
    }

    const projName = useRobotStore.getState().projectName

    // Find the active tool name
    const activeTool = useSceneStore.getState().objects.find(o => o.isTool && o.visible)
    const toolName = activeTool ? activeTool.name : 'None'

    // Show directory selection dialog to export separate step files
    const result = await electronService.showOpenDialog({
      title: language === 'vi' ? 'Chọn thư mục xuất các file LUA' : 'Select Folder to Export LUA Files',
      properties: ['openDirectory', 'createDirectory']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const dirPath = result.filePaths[0]
      const fileWriteErrors: string[] = []
      let stepIndex = 1
      let idx = 0

      while (idx < currentSteps.length) {
        const step = currentSteps[idx]
        const nextStep = currentSteps[idx + 1]

        let stepCode = ''
        let fileName = ''
        let isLoop = false

        if (step.simpleBlockRole === 'loopA' && nextStep && nextStep.simpleBlockRole === 'loopB') {
          isLoop = true
          // Render loop blocks in a single LUA file to preserve cycles/duration logic
          stepCode = generateSingleStepLua(step, nextStep, projName, toolName, stepIndex)
          const cleanLabel = step.label.replace(/[^a-zA-Z0-9_-]/g, '_')
          fileName = `${String(stepIndex).padStart(2, '0')}_Loop_${cleanLabel}.lua`
        } else {
          // Render normal steps individually
          stepCode = generateSingleStepLua(step, null, projName, toolName, stepIndex)
          const cleanLabel = step.label.replace(/[^a-zA-Z0-9_-]/g, '_')
          fileName = `${String(stepIndex).padStart(2, '0')}_${step.type}_${cleanLabel}.lua`
        }

        const fullFilePath = `${dirPath}/${fileName}`
        const writeRes = await electronService.writeFile(fullFilePath, stepCode)
        if (!writeRes.success) {
          fileWriteErrors.push(`${fileName}: ${writeRes.error}`)
        }

        if (isLoop) {
          idx += 2
        } else {
          idx++
        }
        stepIndex++
      }

      if (fileWriteErrors.length === 0) {
        alert(language === 'vi'
          ? `Xuất LUA thành công! Đã lưu các bước lệnh vào thư mục:\n${dirPath}`
          : `LUA exported successfully! Saved steps to folder:\n${dirPath}`)
      } else {
        alert(language === 'vi'
          ? `Lỗi khi xuất các file:\n${fileWriteErrors.join('\n')}`
          : `Error exporting files:\n${fileWriteErrors.join('\n')}`)
      }
    }
  }

  const handleImportLua = async () => {
    const result = await electronService.showOpenDialog({
      title: t('importLua'),
      filters: [{ name: 'Lua Script Files', extensions: ['lua'] }],
      properties: ['openFile', 'multiSelections']
    })

    if (!result.canceled && result.filePaths.length > 0) {
      // Sort file paths numerically/alphabetically based on filename to ensure correct workflow step order
      const sortedPaths = [...result.filePaths].sort((a, b) => {
        const fileA = a.split(/[/\\]/).pop() || ''
        const fileB = b.split(/[/\\]/).pop() || ''
        return fileA.localeCompare(fileB, undefined, { numeric: true, sensitivity: 'base' })
      })

      const allCombinedSteps: any[] = []
      let lastProjName = ''
      const errors: string[] = []

      for (const filePath of sortedPaths) {
        const readRes = await electronService.readFile(filePath)
        if (readRes.success && readRes.content) {
          try {
            const { steps: parsedSteps, projectName: parsedProjName } = parseLua(readRes.content)
            if (parsedSteps.length > 0) {
              allCombinedSteps.push(...parsedSteps)
              if (parsedProjName && parsedProjName !== 'Imported Project' && parsedProjName !== 'Unnamed Project') {
                lastProjName = parsedProjName
              }
            }
          } catch (e: any) {
            const fileName = filePath.split(/[/\\]/).pop() || ''
            errors.push(`${fileName}: ${e.message}`)
          }
        } else {
          const fileName = filePath.split(/[/\\]/).pop() || ''
          errors.push(`${fileName}: ${readRes.error}`)
        }
      }

      if (allCombinedSteps.length === 0) {
        alert(`${t('luaImportError')} ${
          language === 'vi'
            ? 'Không tìm thấy bước lệnh hợp lệ nào trong các file LUA.'
            : 'No valid command steps found in the LUA files.'
        }${errors.length > 0 ? '\n\n' + errors.join('\n') : ''}`)
        return
      }

      // Restore visual block pairing for Simple (Scratch) mode
      let stepIdx = 0
      while (stepIdx < allCombinedSteps.length) {
        const step = allCombinedSteps[stepIdx]
        const next = allCombinedSteps[stepIdx + 1]

        if (step.simpleBlockRole === 'loopA') {
          if (!step.tcpPose) step.tcpPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }
          if (next && next.simpleBlockRole === 'loopB') {
            if (!next.tcpPose) next.tcpPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }
          }
          stepIdx += 2
          continue
        }

        if (
          (step.type === 'MoveJ' || step.type === 'MoveL') &&
          next &&
          (next.type === 'MoveJ' || next.type === 'MoveL') &&
          !step.simpleBlockRole &&
          !next.simpleBlockRole
        ) {
          const blockId = `block_imported_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
          
          step.simpleBlockId = blockId
          step.simpleBlockRole = 'moveA'
          if (!step.tcpPose) {
            step.tcpPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }
          }

          next.simpleBlockId = blockId
          next.simpleBlockRole = 'moveB'
          if (!next.tcpPose) {
            next.tcpPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }
          }

          stepIdx += 2
          continue
        }

        stepIdx++
      }

      reorderSteps(allCombinedSteps)
      if (lastProjName) {
        setProjectName(lastProjName)
      }

      if (errors.length > 0) {
        alert(
          language === 'vi'
            ? `Nhập LUA thành công một phần! Có lỗi ở một số file:\n${errors.join('\n')}`
            : `LUA imported partially! Errors in some files:\n${errors.join('\n')}`
        )
      } else {
        alert(t('luaImportSuccess'))
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
          case 'import-lua':
            handleImportLua()
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

      {/* Collision Global Alert */}
      {collisionWarning && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-950/40 border border-rose-500/35 rounded-full text-rose-400 text-xs font-bold animate-pulse">
          <AlertTriangle size={14} /> {t('collisionWarning')}
        </div>
      )}

      {/* Action Buttons & Language Switcher */}
      <div className="flex items-center gap-4">
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
            <span className="text-[9px] text-slate-500 truncate max-w-[120px]" title={currentFilePath}>
              ({currentFilePath.split('\\').pop()})
            </span>
          )}
        </div>

        <div className="w-px h-5 bg-[#2d2d34]"></div>

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
            onClick={handleImportLua}
            title={t('importLua')}
            className="p-1.5 rounded bg-[#1e1e24] hover:bg-[#282830] border border-[#2d2d34] text-slate-300 hover:text-white transition flex items-center gap-1"
          >
            <Upload size={14} />
            <span className="text-[11px] font-semibold hidden md:inline">{t('importLua')}</span>
          </button>
          
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
