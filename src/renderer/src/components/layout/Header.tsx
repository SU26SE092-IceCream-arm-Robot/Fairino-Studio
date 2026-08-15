import { useEffect, useState, useRef } from 'react'
import { useRobotStore } from '../../store/robotStore'
import { useSceneStore } from '../../store/sceneStore'
import { generateSingleStepLua, generateLua } from '../../engine/codegen/luaCodegen'
import { parseLua } from '../../engine/codegen/luaParser'
import { createIceBotExportBundle, type IceBotExportArtifact } from '../../engine/codegen/icebotExportBundle'
import { createIceBotArtifactSidecar } from '../../engine/codegen/icebotArtifactSidecar'
import { FolderOpen, Save, FilePlus, Play, Upload, ChevronDown } from 'lucide-react'
import { electronService } from '../../services/electronService'
import { translations } from '../../i18n/translations'
import { strToU8, strFromU8, zipSync, unzipSync } from 'fflate'
import logoImg from '../../assets/logo.png'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function Header() {
  const steps = useRobotStore((state) => state.steps)
  const projectName = useRobotStore((state) => state.projectName)
  const currentFilePath = useRobotStore((state) => state.currentFilePath)

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

  const isDebugHitbox = useSceneStore((state) => state.isDebugHitbox)
  const setDebugHitbox = useSceneStore((state) => state.setDebugHitbox)
  const showQuickAccessToolbar = useRobotStore((state) => state.showQuickAccessToolbar)
  const setShowQuickAccessToolbar = useRobotStore((state) => state.setShowQuickAccessToolbar)

  const [exportDropdownOpen, setExportDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [isEditingName, setIsEditingName] = useState(false)
  const [tempName, setTempName] = useState(projectName)

  useEffect(() => {
    setTempName(projectName)
  }, [projectName])

  const handleSaveName = () => {
    const cleanName = tempName.replace(/[^a-zA-Z0-9_-]/g, '').trim() || 'untitled'
    setProjectName(cleanName)
    setIsEditingName(false)
  }

  // Sync state to Electron native menu
  useEffect(() => {
    electronService.updateMenuState({
      language,
      showQuickAccessToolbar,
      isDebugHitbox
    })
  }, [language, showQuickAccessToolbar, isDebugHitbox])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setExportDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

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

  // Helper to determine MIME type for Blob creation
  const getMimeType = (fileType: string) => {
    switch (fileType) {
      case 'stl': return 'model/stl'
      case 'obj': return 'text/plain'
      case 'gltf': return 'model/gltf+json'
      case 'glb': return 'model/gltf-binary'
      default: return 'application/octet-stream'
    }
  }

  // Serialize current workspace state to ZIP bundle with embedded 3D assets
  const serializeProjectBundle = async (): Promise<Uint8Array> => {
    const robotState = useRobotStore.getState()
    const sceneState = useSceneStore.getState()

    const files: Record<string, Uint8Array> = {}

    // Prepare scene objects array with embedded asset paths
    const sceneObjects = await Promise.all(
      sceneState.objects.map(async (obj) => {
        const assetName = `${obj.id}.${obj.fileType}`
        const assetPath = `assets/${assetName}`

        let fileData = obj.fileData
        // If fileData is not in memory (e.g. legacy load), try reading from filePath via Electron
        if (!fileData && obj.filePath) {
          try {
            const readRes = await electronService.readBinaryFile(obj.filePath)
            if (readRes.success && readRes.data) {
              fileData = readRes.data
            }
          } catch (e) {
            console.warn(`Could not read binary data for ${obj.name}:`, e)
          }
        }

        if (fileData) {
          files[assetPath] = fileData
        }

        return {
          id: obj.id,
          name: obj.name,
          fileType: obj.fileType,
          assetPath: fileData ? assetPath : undefined,
          filePath: obj.filePath,
          transform: obj.transform,
          visible: obj.visible,
          isTool: obj.isTool,
          modelUnit: obj.modelUnit,
          toolMountAxis: obj.toolMountAxis,
          collisionMode: obj.collisionMode
        }
      })
    )

    const projectData = {
      version: '1.2',
      projectName: robotState.projectName,
      robotModel: robotState.robotModel,
      jointAngles: robotState.jointAngles,
      steps: robotState.steps,
      simpleBlocklyWorkspace: robotState.simpleBlocklyWorkspace,
      projectModules: robotState.projectModules,
      projectWorkflowTemplates: robotState.projectWorkflowTemplates,
      sceneObjects
    }

    files['project.json'] = strToU8(JSON.stringify(projectData, null, 2))

    return zipSync(files, { level: 6 })
  }

  // Deserialize and load workspace state from binary buffer or legacy JSON text
  const deserializeProjectBundle = (data: Uint8Array | string, filePath: string) => {
    try {
      let projectData: any = null
      let unzippedFiles: Record<string, Uint8Array> | null = null

      // Check if data is a binary ZIP (starts with PK / 0x50 0x4B 0x03 0x04)
      if (data instanceof Uint8Array && data.length > 4 && data[0] === 0x50 && data[1] === 0x4b) {
        try {
          unzippedFiles = unzipSync(data)
          if (unzippedFiles['project.json']) {
            const jsonText = strFromU8(unzippedFiles['project.json'])
            projectData = JSON.parse(jsonText)
          }
        } catch (zipErr) {
          console.warn('Failed to unzip project bundle, trying fallback as JSON text:', zipErr)
        }
      }

      // Fallback for legacy JSON text (v1.0 / v1.1)
      if (!projectData) {
        const textContent = typeof data === 'string' ? data : strFromU8(data)
        projectData = JSON.parse(textContent)
      }

      if (!projectData || (projectData.version !== '1.0' && projectData.version !== '1.1' && projectData.version !== '1.2')) {
        alert(t('projectCompatError'))
        return
      }

      // 1. Populate Robot Store
      setProjectName(projectData.projectName || 'loaded_project')
      setCurrentFilePath(filePath)
      setJointAngles(projectData.jointAngles || [0, 0, 0, 0, 0, 0])
      reorderSteps(projectData.steps || [])
      setSimpleBlocklyWorkspace(projectData.simpleBlocklyWorkspace || null)
      setProjectModules(Array.isArray(projectData.projectModules) ? projectData.projectModules : [])
      setProjectWorkflowTemplates(Array.isArray(projectData.projectWorkflowTemplates) ? projectData.projectWorkflowTemplates : [])
      if (projectData.simpleBlocklyWorkspace) {
        markSimpleWorkspaceClean()
      }

      // 2. Populate Scene Store
      useSceneStore.getState().clearScene()
      if (projectData.sceneObjects && Array.isArray(projectData.sceneObjects)) {
        projectData.sceneObjects.forEach((obj: any) => {
          let url = ''
          let fileData: Uint8Array | undefined = undefined

          // If extracted from ZIP bundle
          if (unzippedFiles && obj.assetPath && unzippedFiles[obj.assetPath]) {
            fileData = unzippedFiles[obj.assetPath]
            const blob = new Blob([fileData as BlobPart], { type: getMimeType(obj.fileType) })
            url = URL.createObjectURL(blob)
          } else if (obj.filePath) {
            url = `file:///${obj.filePath.replace(/\\/g, '/')}`
          }

          useSceneStore.getState().addObject({
            name: obj.name,
            fileType: obj.fileType,
            filePath: obj.filePath,
            url: url || obj.url || '',
            fileData,
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
                : 'auto',
            collisionMode: obj.collisionMode || 'strict'
          })

          const lastAdded = useSceneStore.getState().objects.slice(-1)[0]
          if (lastAdded) {
            useSceneStore.getState().updateObjectTransform(lastAdded.id, obj.transform)
            useSceneStore.getState().updateObjectVisibility(lastAdded.id, obj.visible)
            if (obj.collisionMode) {
              useSceneStore.getState().updateObjectCollisionMode(lastAdded.id, obj.collisionMode)
            }
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
      const readRes = await electronService.readBinaryFile(filePath)
      if (readRes.success && readRes.data) {
        deserializeProjectBundle(readRes.data, filePath)
      } else {
        // Fallback for plain text read
        const textReadRes = await electronService.readFile(filePath)
        if (textReadRes.success && textReadRes.content) {
          deserializeProjectBundle(textReadRes.content, filePath)
        } else {
          alert(`${t('projectReadError')} ${readRes.error || textReadRes.error}`)
        }
      }
    }
  }

  const handleSaveProject = async () => {
    const currentPath = useRobotStore.getState().currentFilePath
    if (currentPath) {
      try {
        const bundle = await serializeProjectBundle()
        const writeRes = await electronService.writeBinaryFile(currentPath, bundle)
        if (writeRes.success) {
          alert(t('projectSaveSuccess'))
        } else {
          alert(`${t('projectSaveError')} ${writeRes.error}`)
        }
      } catch (e: any) {
        alert(`${t('projectSaveError')} ${e.message}`)
      }
    } else {
      handleSaveAsProject()
    }
  }

  const handleSaveAsProject = async () => {
    const projName = useRobotStore.getState().projectName
    const result = await electronService.showSaveDialog({
      title: t('saveProject'),
      defaultPath: `${projName}.fairobot`,
      filters: [{ name: 'FaiRobot Projects', extensions: ['fairobot'] }]
    })

    if (!result.canceled && result.filePath) {
      try {
        const bundle = await serializeProjectBundle()
        const writeRes = await electronService.writeBinaryFile(result.filePath, bundle)
        if (writeRes.success) {
          setCurrentFilePath(result.filePath)
          alert(t('projectSaveSuccess'))
        } else {
          alert(`${t('projectSaveError')} ${writeRes.error}`)
        }
      } catch (e: any) {
        alert(`${t('projectSaveError')} ${e.message}`)
      }
    }
  }

const handleExportLargeLua = async () => {
    const projName = useRobotStore.getState().projectName || 'Unnamed Project'
    const activeTool = useSceneStore.getState().objects.find(o => o.isTool && o.visible)
    const toolName = activeTool ? activeTool.name : 'None'
    const currentSteps = useRobotStore.getState().steps

    const defaultName = `${projName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'project'}.lua`
    const result = await electronService.showSaveDialog({
      title: language === 'vi' ? 'Xuất Workflow Lớn (.lua)' : 'Export Large Workflow (.lua)',
      defaultPath: defaultName,
      filters: [{ name: 'Lua Script File', extensions: ['lua'] }]
    })
    if (result.canceled || !result.filePath) return

    try {
      const luaContent = generateLua(currentSteps, projName, toolName)
      const writeResult = await electronService.writeFile(result.filePath, luaContent)
      if (!writeResult.success) throw new Error(writeResult.error || 'Unknown write error')
      alert(language === 'vi'
        ? `Xuất Workflow lớn thành công:\n${result.filePath}`
        : `Large workflow exported successfully:\n${result.filePath}`)
    } catch (error: unknown) {
      const message = errorMessage(error)
      alert(language === 'vi'
        ? `Lỗi khi xuất Workflow lớn:\n${message}`
        : `Error exporting large workflow:\n${message}`)
    }
  }

  const handleExportStepsZip = async () => {
    const projName = useRobotStore.getState().projectName || 'Unnamed Project'
    const activeTool = useSceneStore.getState().objects.find(o => o.isTool && o.visible)
    const toolName = activeTool ? activeTool.name : 'None'
    const currentSteps = useRobotStore.getState().steps

    const defaultName = `${projName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'project'}.zip`
    const result = await electronService.showSaveDialog({
      title: language === 'vi' ? 'Xuất Workflow Theo Step (.zip)' : 'Export Steps Workflow (.zip)',
      defaultPath: defaultName,
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
    })
    if (result.canceled || !result.filePath) return

    try {
      const files: Record<string, Uint8Array> = {}
      let stepIndex = 1
      let idx = 0
      while (idx < currentSteps.length) {
        const step = currentSteps[idx]
        const nextStep = currentSteps[idx + 1]
        const isLoop = step.simpleBlockRole === 'loopA' && nextStep?.simpleBlockRole === 'loopB'
        const stepCode = generateSingleStepLua(step, isLoop ? nextStep : null, projName, toolName, stepIndex)
        
        // Naming convention: project_name_step<stepIndex>.lua
        const fileName = `${projName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'project'}_step${stepIndex}.lua`
        files[fileName] = strToU8(stepCode)
        
        idx += isLoop ? 2 : 1
        stepIndex++
      }

      const bundle = zipSync(files, { level: 6 })
      const writeResult = await electronService.writeBinaryFile(result.filePath, bundle)
      if (!writeResult.success) throw new Error(writeResult.error || 'Unknown write error')
      alert(language === 'vi'
        ? `Xuất Workflow theo step thành công:\n${result.filePath}`
        : `Steps workflow exported successfully:\n${result.filePath}`)
    } catch (error: unknown) {
      const message = errorMessage(error)
      alert(language === 'vi'
        ? `Lỗi khi xuất Workflow theo step:\n${message}`
        : `Error exporting steps workflow:\n${message}`)
    }
  }

  const handleExportIceBotAuthoringBundle = async (): Promise<void> => {
    const projName = useRobotStore.getState().projectName || 'Unnamed Project'
    const activeTool = useSceneStore.getState().objects.find(o => o.isTool && o.visible)
    const toolName = activeTool ? activeTool.name : 'None'
    const currentSteps = useRobotStore.getState().steps
    const safeProjectName = projName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'project'
    const result = await electronService.showSaveDialog({
      title: language === 'vi' ? 'Xuất IceBot Authoring Bundle (.zip)' : 'Export IceBot Authoring Bundle (.zip)',
      defaultPath: `${safeProjectName}-icebot-authoring.zip`,
      filters: [{ name: 'IceBot Authoring Bundle', extensions: ['zip'] }]
    })
    if (result.canceled || !result.filePath) return

    try {
      const artifacts: IceBotExportArtifact[] = []
      let stepIndex = 1
      let index = 0
      while (index < currentSteps.length) {
        const step = currentSteps[index]
        const nextStep = currentSteps[index + 1]
        const isLoop = step.simpleBlockRole === 'loopA' && nextStep?.simpleBlockRole === 'loopB'
        const artifactSteps = isLoop ? [step, nextStep] : [step]
        const fileName = `${safeProjectName}_step${stepIndex}.lua`
        artifacts.push({
          fileName,
          lua: generateSingleStepLua(step, isLoop ? nextStep : null, projName, toolName, stepIndex),
          sidecarFileName: `${fileName.replace(/\.lua$/i, '')}.icebot.json`,
          sidecar: createIceBotArtifactSidecar(artifactSteps, fileName, stepIndex),
          runOrder: stepIndex
        })
        index += isLoop ? 2 : 1
        stepIndex++
      }

      const bundle = createIceBotExportBundle(projName, artifacts)
      const writeResult = await electronService.writeBinaryFile(result.filePath, bundle)
      if (!writeResult.success) throw new Error(writeResult.error || 'Unknown write error')
      alert(language === 'vi'
        ? `Xuất IceBot Authoring Bundle thành công:\n${result.filePath}`
        : `IceBot Authoring Bundle exported successfully:\n${result.filePath}`)
    } catch (error: unknown) {
      const message = errorMessage(error)
      alert(language === 'vi'
        ? `Không thể xuất IceBot Authoring Bundle:\n${message}`
        : `Cannot export IceBot Authoring Bundle:\n${message}`)
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
      const unsubscribe = window.api.onMenuAction((action, ...args: any[]) => {
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
          case 'export-workflow-large':
            handleExportLargeLua()
            break
          case 'export-workflow-steps':
            handleExportStepsZip()
            break
          case 'export-icebot-authoring-bundle':
            handleExportIceBotAuthoringBundle()
            break
          case 'import-lua':
            handleImportLua()
            break
          case 'toggle-quick-access':
            setShowQuickAccessToolbar(args[0] as boolean)
            break
          case 'toggle-hitbox':
            setDebugHitbox(args[0] as boolean)
            break
          case 'change-language':
            setLanguage(args[0] as 'vi' | 'en')
            break
        }
      })
      return unsubscribe
    }
    return undefined
  }, [language]) // Refresh subscription if language changes so local confirm prompts get proper translations

  return (
    <header className="h-14 bg-[#141417] border-b border-[#2d2d34] flex items-center justify-between px-6 text-slate-200 select-none shrink-0">
      {/* Brand / Logo & Project Name */}
      <div className="flex items-center gap-3">
        <img src={logoImg} alt="FaiRobot Studio Logo" className="w-8 h-8 rounded-lg object-contain shadow-md" />
        <div>
          <h1 className="text-sm font-bold text-white leading-tight">FaiRobot Studio</h1>
          <span className="text-[10px] text-slate-500">v1.0.6</span>
        </div>

        {/* Project Name Click-to-Edit */}
        <div className="flex items-center gap-2 border-l border-[#2d2d34] pl-4 ml-1">
          {isEditingName ? (
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveName()
                if (e.key === 'Escape') {
                  setTempName(projectName)
                  setIsEditingName(false)
                }
              }}
              autoFocus
              className="bg-[#1e1e24] border border-blue-500/50 rounded px-2.5 py-0.5 text-xs font-semibold text-white outline-none w-36 transition"
            />
          ) : (
            <div
              onClick={() => setIsEditingName(true)}
              className="flex items-center gap-1.5 cursor-pointer group hover:bg-white/5 px-2.5 py-0.5 rounded transition"
              title={language === 'vi' ? 'Click để đổi tên dự án' : 'Click to rename project'}
            >
              <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition">
                {projectName}
              </span>
              <span className="text-[10px] text-slate-500 group-hover:text-slate-300 transition">✎</span>
            </div>
          )}
          {currentFilePath && (
            <span className="text-[9px] text-slate-500 truncate max-w-[100px]" title={currentFilePath}>
              ({currentFilePath.split('\\').pop()})
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons & Settings */}
      <div className="flex items-center gap-4">
        {/* Quick Access Toolbar Buttons (if enabled) */}
        {showQuickAccessToolbar && (
          <>
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
            </div>
            <div className="w-px h-5 bg-[#2d2d34]"></div>
          </>
        )}

        {/* Fixed Export Button */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
            className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            <Play size={12} className="fill-white" />
            {t('exportLua')} ({steps.length})
            <ChevronDown size={12} />
          </button>
          {exportDropdownOpen && (
            <div className="absolute right-0 mt-1.5 w-72 rounded-md bg-[#1c1c24] border border-[#2d2d38] shadow-lg z-50 overflow-hidden py-1">
              <button
                onClick={() => {
                  setExportDropdownOpen(false)
                  handleExportIceBotAuthoringBundle()
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-blue-600 hover:text-white transition flex flex-col gap-0.5 cursor-pointer"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold">{language === 'vi' ? 'Xuất gói để đưa vào IceBot' : 'Export package for IceBot'}</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-blue-200">{language === 'vi' ? 'Dùng khi muốn thêm chương trình robot vào hệ thống IceBot' : 'Use this to add the robot program to IceBot'}</span>
                </div>
              </button>
              <div className="border-t border-[#2d2d38] my-1"></div>
              <button
                onClick={() => {
                  setExportDropdownOpen(false)
                  handleExportLargeLua()
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-blue-600 hover:text-white transition flex flex-col gap-0.5 cursor-pointer"
              >
                <span className="font-bold">{language === 'vi' ? 'Xuất toàn bộ thành một file Lua' : 'Export all steps as one Lua file'}</span>
                <span className="text-[10px] text-slate-400 group-hover:text-blue-200">{language === 'vi' ? 'Dùng khi cần một file chương trình robot duy nhất' : 'Use this when one robot program file is needed'}</span>
              </button>
              <div className="border-t border-[#2d2d38] my-1"></div>
              <button
                onClick={() => {
                  setExportDropdownOpen(false)
                  handleExportStepsZip()
                }}
                className="w-full text-left px-4 py-2 text-xs text-slate-200 hover:bg-blue-600 hover:text-white transition flex flex-col gap-0.5 cursor-pointer"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold">{language === 'vi' ? 'Xuất các file Lua theo bước' : 'Export Lua files by step'}</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-blue-200">{language === 'vi' ? 'Dùng để kiểm tra hoặc chỉnh từng bước riêng lẻ' : 'Use this to inspect or edit individual steps'}</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
