import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Clock, CopyPlus, PackagePlus, Radio, Route, Save, Trash2 } from 'lucide-react'
import { useRobotStore } from '../../store/robotStore'
import { translations } from '../../i18n/translations'
import { JointAngles, SimpleModuleTemplate, SimpleWorkflowTemplate, TCPPose, WorkflowStep } from '../../types/robot.types'
import { electronService } from '../../services/electronService'

type SimpleBlock =
  | { kind: 'moveAB'; id: string; stepIds: string[]; pointA: TCPPose; pointB: TCPPose; speed: number; acc: number }
  | { kind: 'delay'; id: string; stepIds: string[]; seconds: number }
  | { kind: 'do'; id: string; stepIds: string[]; doType: 'cabinet' | 'tool'; doIndex: number; doValue: 0 | 1 }
  | { kind: 'unknown'; id: string; stepIds: string[]; step: WorkflowStep }

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const clonePose = (pose: TCPPose): TCPPose => ({ ...pose })

const formatPose = (pose: TCPPose) =>
  `${Math.round(pose.x)}, ${Math.round(pose.y)}, ${Math.round(pose.z)}`

const stepsToSimpleBlocks = (steps: WorkflowStep[]): SimpleBlock[] => {
  const blocks: SimpleBlock[] = []
  let index = 0

  while (index < steps.length) {
    const step = steps[index]
    const next = steps[index + 1]

    if (
      step.type === 'MoveL' &&
      next?.type === 'MoveL' &&
      step.simpleBlockId &&
      step.simpleBlockId === next.simpleBlockId &&
      step.simpleBlockRole === 'moveA' &&
      next.simpleBlockRole === 'moveB' &&
      step.tcpPose &&
      next.tcpPose
    ) {
      blocks.push({
        kind: 'moveAB',
        id: step.simpleBlockId,
        stepIds: [step.id, next.id],
        pointA: step.tcpPose,
        pointB: next.tcpPose,
        speed: step.speed || 30,
        acc: step.acc || 30
      })
      index += 2
      continue
    }

    if (step.type === 'WaitMs') {
      blocks.push({
        kind: 'delay',
        id: step.simpleBlockId || step.id,
        stepIds: [step.id],
        seconds: (step.delayMs ?? 1000) / 1000
      })
      index++
      continue
    }

    if (step.type === 'SetDO') {
      blocks.push({
        kind: 'do',
        id: step.simpleBlockId || step.id,
        stepIds: [step.id],
        doType: step.doType || 'cabinet',
        doIndex: step.doIndex ?? 1,
        doValue: step.doValue ?? 1
      })
      index++
      continue
    }

    blocks.push({ kind: 'unknown', id: step.id, stepIds: [step.id], step })
    index++
  }

  return blocks
}

export default function BlockWorkspace() {
  const steps = useRobotStore((state) => state.steps)
  const tcpPose = useRobotStore((state) => state.tcpPose)
  const jointAngles = useRobotStore((state) => state.jointAngles)
  const isPlaying = useRobotStore((state) => state.isPlaying)
  const selectedStepId = useRobotStore((state) => state.selectedStepId)
  const currentStepIndex = useRobotStore((state) => state.currentStepIndex)
  const language = useRobotStore((state) => state.language)
  const reorderSteps = useRobotStore((state) => state.reorderSteps)
  const setSelectedStepId = useRobotStore((state) => state.setSelectedStepId)
  const projectModules = useRobotStore((state) => state.projectModules)
  const projectWorkflowTemplates = useRobotStore((state) => state.projectWorkflowTemplates)
  const setProjectModules = useRobotStore((state) => state.setProjectModules)
  const setProjectWorkflowTemplates = useRobotStore((state) => state.setProjectWorkflowTemplates)

  const t = (key: keyof typeof translations.vi) => translations[language][key]
  const blocks = stepsToSimpleBlocks(steps)
  const [saveDialog, setSaveDialog] = useState<{ type: 'module' | 'workflow'; name: string } | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadBlockLibrary = async () => {
      const result = await electronService.readBlockLibrary()
      if (!result.success || !result.content || cancelled) return

      try {
        const data = JSON.parse(result.content)
        if (Array.isArray(data.modules)) setProjectModules(data.modules)
        if (Array.isArray(data.workflows)) setProjectWorkflowTemplates(data.workflows)
      } catch {
        // Ignore malformed personal library files so project editing remains usable.
      }
    }

    void loadBlockLibrary()

    return () => {
      cancelled = true
    }
  }, [setProjectModules, setProjectWorkflowTemplates])

  const updateStepById = (stepId: string, updater: (step: WorkflowStep) => WorkflowStep) => {
    reorderSteps(steps.map((step) => (step.id === stepId ? updater(step) : step)))
  }

  const updateStepsByIds = (stepIds: string[], updater: (step: WorkflowStep) => WorkflowStep) => {
    const idSet = new Set(stepIds)
    reorderSteps(steps.map((step) => (idSet.has(step.id) ? updater(step) : step)))
  }

  const selectBlock = (block: SimpleBlock) => {
    setSelectedStepId(block.stepIds[0] || null)
  }

  const addMoveAB = (pointA: TCPPose = tcpPose, pointB: TCPPose = tcpPose) => {
    const blockId = createId('simple_move_ab')
    const nextSteps: WorkflowStep[] = [
      ...steps,
      {
        id: createId('step'),
        type: 'MoveL',
        label: 'Move A',
        tcpPose: clonePose(pointA),
        speed: 30,
        acc: 30,
        simpleBlockId: blockId,
        simpleBlockRole: 'moveA'
      },
      {
        id: createId('step'),
        type: 'MoveL',
        label: 'Move B',
        tcpPose: clonePose(pointB),
        speed: 30,
        acc: 30,
        simpleBlockId: blockId,
        simpleBlockRole: 'moveB'
      }
    ]
    reorderSteps(nextSteps)
  }

  const addDelay = (seconds = 1) => {
    const blockId = createId('simple_delay')
    reorderSteps([
      ...steps,
      {
        id: createId('step'),
        type: 'WaitMs',
        label: `Delay ${seconds}s`,
        delayMs: Math.round(seconds * 1000),
        speed: 0,
        acc: 0,
        simpleBlockId: blockId
      }
    ])
  }

  const addDO = () => {
    const blockId = createId('simple_do')
    reorderSteps([
      ...steps,
      {
        id: createId('step'),
        type: 'SetDO',
        label: 'Set DO 1 ON',
        doType: 'cabinet',
        doIndex: 1,
        doValue: 1,
        speed: 0,
        acc: 0,
        simpleBlockId: blockId
      }
    ])
  }

  const addPickCup = () => {
    const start = clonePose(tcpPose)
    const target = { ...tcpPose, z: tcpPose.z - 80 }
    addMoveAB(start, target)
    setTimeout(() => {
      const latest = useRobotStore.getState().steps
      const delayId = createId('simple_delay')
      const returnId = createId('simple_move_ab')
      reorderSteps([
        ...latest,
        {
          id: createId('step'),
          type: 'WaitMs',
          label: 'Delay 1s',
          delayMs: 1000,
          speed: 0,
          acc: 0,
          simpleBlockId: delayId
        },
        {
          id: createId('step'),
          type: 'MoveL',
          label: 'Move B',
          tcpPose: target,
          speed: 30,
          acc: 30,
          simpleBlockId: returnId,
          simpleBlockRole: 'moveA'
        },
        {
          id: createId('step'),
          type: 'MoveL',
          label: 'Move A',
          tcpPose: start,
          speed: 30,
          acc: 30,
          simpleBlockId: returnId,
          simpleBlockRole: 'moveB'
        }
      ])
    }, 0)
  }

  const removeBlock = (block: SimpleBlock) => {
    reorderSteps(steps.filter((step) => !block.stepIds.includes(step.id)))
  }

  const moveBlock = (blockIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1
    if (targetIndex < 0 || targetIndex >= blocks.length) return

    const nextBlocks = [...blocks]
    const [moved] = nextBlocks.splice(blockIndex, 1)
    nextBlocks.splice(targetIndex, 0, moved)
    const byId = new Map(steps.map((step) => [step.id, step]))
    reorderSteps(nextBlocks.flatMap((block) => block.stepIds.map((id) => byId.get(id)).filter(Boolean) as WorkflowStep[]))
  }

  const persistBlockLibrary = async (modules: SimpleModuleTemplate[], workflows: SimpleWorkflowTemplate[]) => {
    const result = await electronService.writeBlockLibrary(JSON.stringify({ modules, workflows }, null, 2))
    if (!result.success) {
      alert(`${language === 'vi' ? 'Lỗi lưu thư viện block:' : 'Block library save error:'} ${result.error}`)
      return false
    }
    return true
  }

  const openSaveDialog = (type: 'module' | 'workflow') => {
    setSaveDialog({
      type,
      name: type === 'module' ? t('blocklyPickCup') : t('blocklyWorkflowSample')
    })
  }

  const confirmSaveDialog = async () => {
    if (!saveDialog) return
    const name = saveDialog.name.trim()
    if (!name) return

    if (saveDialog.type === 'module') {
    const moduleTemplate: SimpleModuleTemplate = {
      id: createId('project_module'),
      name,
      blocksJson: null,
      previewSteps: steps,
      scope: 'project'
    }
    const nextModules = [...projectModules, moduleTemplate]
    setProjectModules(nextModules)
    const saved = await persistBlockLibrary(nextModules, projectWorkflowTemplates)
    if (saved) alert(language === 'vi' ? 'Đã lưu module vào Mẫu nhanh.' : 'Module saved to Quick Templates.')
    } else {
    const workflowTemplate: SimpleWorkflowTemplate = {
      id: createId('project_workflow'),
      name,
      workspaceJson: null,
      previewSteps: steps,
      scope: 'project'
    }
    const nextWorkflows = [...projectWorkflowTemplates, workflowTemplate]
    setProjectWorkflowTemplates(nextWorkflows)
    const saved = await persistBlockLibrary(projectModules, nextWorkflows)
    if (saved) alert(language === 'vi' ? 'Đã lưu workflow vào Mẫu nhanh.' : 'Workflow saved to Quick Templates.')
    }

    setSaveDialog(null)
  }

  const deleteSavedTemplate = async (type: 'module' | 'workflow', id: string) => {
    const ok = confirm(language === 'vi' ? 'Xóa mẫu đã lưu này?' : 'Delete this saved template?')
    if (!ok) return

    const nextModules = type === 'module'
      ? projectModules.filter((tpl) => tpl.id !== id)
      : projectModules
    const nextWorkflows = type === 'workflow'
      ? projectWorkflowTemplates.filter((tpl) => tpl.id !== id)
      : projectWorkflowTemplates

    if (type === 'module') setProjectModules(nextModules)
    if (type === 'workflow') setProjectWorkflowTemplates(nextWorkflows)
    await persistBlockLibrary(nextModules, nextWorkflows)
  }

  const loadPreviewSteps = (previewSteps: WorkflowStep[]) => {
    const blockIdMap = new Map<string, string>()
    reorderSteps(previewSteps.map((step) => {
      const nextBlockId = step.simpleBlockId
        ? blockIdMap.get(step.simpleBlockId) || createId(step.simpleBlockId)
        : undefined
      if (step.simpleBlockId && nextBlockId) {
        blockIdMap.set(step.simpleBlockId, nextBlockId)
      }
      return { ...step, id: createId('step'), simpleBlockId: nextBlockId }
    }))
  }

  return (
    <div className="relative flex-1 flex flex-col min-h-0 bg-[#16161a]">
      <div className="p-3 border-b border-[#2d2d34] bg-[#17171c] space-y-3 shrink-0">
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
            {language === 'vi' ? 'THÊM LỆNH' : 'ADD COMMAND'}
          </span>
          <span className="text-[10px] text-slate-500">
            {language === 'vi'
              ? 'Thêm lệnh trước, sau đó chuột phải trong viewport để đặt A/B.'
              : 'Add a command first, then right-click in the viewport to place A/B.'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => addMoveAB()} disabled={isPlaying} className="group relative min-h-14 rounded-md border border-[#30303a] bg-[#202027] px-2 py-2 text-left transition hover:border-blue-500/70 hover:bg-[#252532] cursor-pointer disabled:opacity-40">
            <span className="absolute inset-x-0 top-0 h-0.5 rounded-t-md bg-blue-500" />
            <Route size={15} className="mb-1 text-blue-400" />
            <span className="block text-[11px] font-bold text-slate-100 leading-tight">Move A→B</span>
          </button>
          <button onClick={() => addDelay()} disabled={isPlaying} className="group relative min-h-14 rounded-md border border-[#30303a] bg-[#202027] px-2 py-2 text-left transition hover:border-emerald-500/70 hover:bg-[#252532] cursor-pointer disabled:opacity-40">
            <span className="absolute inset-x-0 top-0 h-0.5 rounded-t-md bg-emerald-500" />
            <Clock size={15} className="mb-1 text-emerald-400" />
            <span className="block text-[11px] font-bold text-slate-100 leading-tight">Delay</span>
          </button>
          <button onClick={addDO} disabled={isPlaying} className="group relative min-h-14 rounded-md border border-[#30303a] bg-[#202027] px-2 py-2 text-left transition hover:border-amber-500/70 hover:bg-[#252532] cursor-pointer disabled:opacity-40">
            <span className="absolute inset-x-0 top-0 h-0.5 rounded-t-md bg-amber-500" />
            <Radio size={15} className="mb-1 text-amber-400" />
            <span className="block text-[11px] font-bold text-slate-100 leading-tight">Set DO</span>
          </button>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
              {language === 'vi' ? 'MẪU NHANH' : 'QUICK TEMPLATES'}
            </span>
          </div>
          <button onClick={addPickCup} disabled={isPlaying} className="w-full min-h-10 px-2.5 py-2 rounded-md bg-[#202027] hover:bg-[#252532] border border-[#34343e] text-left text-[11px] text-slate-200 cursor-pointer disabled:opacity-40">
            <span className="font-bold block text-slate-100">{t('blocklyPickCup')}</span>
            <span className="text-[9px] text-slate-500 leading-relaxed">{t('blocklyPickCupDescription')}</span>
          </button>
          {(projectModules.length > 0 || projectWorkflowTemplates.length > 0) && (
            <div className="grid grid-cols-2 gap-1.5">
              {projectModules.slice(-2).map((tpl) => (
                <div key={tpl.id} className="relative group min-h-10 rounded-md bg-[#17251f] border border-emerald-900/60 text-slate-200 overflow-hidden">
                  <button onClick={() => loadPreviewSteps(tpl.previewSteps)} className="w-full px-2 py-1.5 text-left text-[11px] hover:bg-[#1e3329] cursor-pointer">
                    <span className="font-bold block truncate pr-6">{tpl.name}</span>
                    <span className="text-[9px] text-slate-500">Module · {tpl.previewSteps.length} steps</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); void deleteSavedTemplate('module', tpl.id) }}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-rose-950/50 hover:text-rose-300 cursor-pointer"
                    title={language === 'vi' ? 'Xóa module' : 'Delete module'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              {projectWorkflowTemplates.slice(-2).map((tpl) => (
                <div key={tpl.id} className="relative group min-h-10 rounded-md bg-[#172033] border border-blue-900/60 text-slate-200 overflow-hidden">
                  <button onClick={() => loadPreviewSteps(tpl.previewSteps)} className="w-full px-2 py-1.5 text-left text-[11px] hover:bg-[#1f2d4a] cursor-pointer">
                    <span className="font-bold block truncate pr-6">{tpl.name}</span>
                    <span className="text-[9px] text-slate-500">Workflow · {tpl.previewSteps.length} steps</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); void deleteSavedTemplate('workflow', tpl.id) }}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-rose-950/50 hover:text-rose-300 cursor-pointer"
                    title={language === 'vi' ? 'Xóa workflow' : 'Delete workflow'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider font-mono">
            {language === 'vi' ? 'CHƯƠNG TRÌNH' : 'PROGRAM'}
          </span>
          <div className="flex items-center gap-1">
            {steps.length > 0 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); openSaveDialog('module') }} disabled={isPlaying} className="h-7 px-2 inline-flex items-center gap-1 rounded border border-[#34343e] bg-[#202027] text-[10px] font-semibold text-slate-300 hover:border-blue-500/50 hover:text-white cursor-pointer disabled:opacity-40" title={t('blocklySaveModule')}>
                  <PackagePlus size={11} /> Module
                </button>
                <button onClick={(e) => { e.stopPropagation(); openSaveDialog('workflow') }} disabled={isPlaying} className="h-7 px-2 inline-flex items-center gap-1 rounded border border-[#34343e] bg-[#202027] text-[10px] font-semibold text-slate-300 hover:border-blue-500/50 hover:text-white cursor-pointer disabled:opacity-40" title={t('blocklySaveWorkflow')}>
                  <Save size={11} /> Workflow
                </button>
              </>
            )}
            <span className="rounded border border-[#30303a] bg-[#202027] px-1.5 py-0.5 text-[10px] text-slate-500">
              {blocks.length}
            </span>
          </div>
        </div>
        {blocks.length === 0 ? (
          <div className="min-h-44 rounded-md border border-dashed border-[#2d2d34] bg-[#111114] flex items-center justify-center text-center px-8">
            <div>
              <CopyPlus size={22} className="mx-auto text-slate-600 mb-2" />
              <div className="text-xs font-bold text-slate-400">
                {language === 'vi' ? 'Chưa có lệnh nào' : 'No commands yet'}
              </div>
              <div className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                {language === 'vi'
                  ? 'Bấm Move A→B, Delay hoặc Set DO ở trên để bắt đầu.'
                  : 'Click Move A→B, Delay, or Set DO above to begin.'}
              </div>
            </div>
          </div>
        ) : (
          blocks.map((block, index) => {
            const moveNumber = block.kind === 'moveAB'
              ? blocks.slice(0, index + 1).filter((item) => item.kind === 'moveAB').length
              : 0
            const firstStepIndex = steps.findIndex((step) => step.id === block.stepIds[0])
            const isSelected = block.stepIds.includes(selectedStepId || '')
            const isCurrentSim = isPlaying && block.stepIds.some((stepId) => steps.findIndex((step) => step.id === stepId) === currentStepIndex)

            return (
            <div
              key={block.id}
              onClick={() => selectBlock(block)}
              className={`rounded-lg border bg-[#111114] overflow-hidden cursor-pointer transition ${
                isCurrentSim
                  ? 'border-emerald-500 bg-emerald-950/15'
                  : isSelected
                  ? 'border-blue-500 bg-blue-950/10'
                  : 'border-[#2d2d34] hover:border-[#3a3a45]'
              }`}
            >
              <div className="min-h-11 px-3 py-2 flex items-center justify-between gap-2 border-b border-white/5">
                <div className="flex items-center gap-2 min-w-0">
                  {block.kind === 'moveAB' && <Route size={15} className="text-blue-400 shrink-0" />}
                  {block.kind === 'delay' && <Clock size={15} className="text-emerald-400 shrink-0" />}
                  {block.kind === 'do' && <Radio size={15} className="text-amber-400 shrink-0" />}
                  <span className="text-xs font-bold text-white truncate">
                    {block.kind === 'moveAB' && `Move A${moveNumber} → B${moveNumber}`}
                    {block.kind === 'delay' && 'Delay'}
                    {block.kind === 'do' && 'Set DO'}
                    {block.kind === 'unknown' && block.step.type}
                  </span>
                  {isSelected && firstStepIndex >= 0 && (
                    <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold text-blue-300">
                      Start #{firstStepIndex + 1}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => moveBlock(index, 'up')} disabled={index === 0 || isPlaying} className="p-1.5 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30 cursor-pointer"><ArrowUp size={12} /></button>
                  <button onClick={() => moveBlock(index, 'down')} disabled={index === blocks.length - 1 || isPlaying} className="p-1.5 rounded hover:bg-white/10 text-slate-400 disabled:opacity-30 cursor-pointer"><ArrowDown size={12} /></button>
                  <button onClick={() => removeBlock(block)} disabled={isPlaying} className="p-1.5 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 disabled:opacity-30 cursor-pointer"><Trash2 size={12} /></button>
                </div>
              </div>

              {block.kind === 'moveAB' && (
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => updateStepById(block.stepIds[0], (step) => ({ ...step, tcpPose: clonePose(tcpPose), jointAngles: [...jointAngles] as JointAngles }))} disabled={isPlaying} className="h-10 rounded bg-blue-600/90 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer disabled:opacity-40">
                      TCP → A{moveNumber}
                    </button>
                    <button onClick={() => updateStepById(block.stepIds[1], (step) => ({ ...step, tcpPose: clonePose(tcpPose), jointAngles: [...jointAngles] as JointAngles }))} disabled={isPlaying} className="h-10 rounded bg-indigo-600/90 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer disabled:opacity-40">
                      TCP → B{moveNumber}
                    </button>
                  </div>
                  <div className="rounded border border-blue-500/20 bg-blue-950/20 px-2 py-1.5 text-[10px] text-blue-100">
                    {language === 'vi'
                      ? `Right-click vào sàn hoặc vật thể trong viewport, rồi chọn Set A${moveNumber} hoặc Set B${moveNumber}.`
                      : `Viewport shows blue A${moveNumber}, purple B${moveNumber}, and the motion path between them.`}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div className="rounded bg-black/25 border border-blue-400/20 px-2 py-1.5">A{moveNumber}: <span className="font-mono text-white">{formatPose(block.pointA)}</span></div>
                    <div className="rounded bg-black/25 border border-violet-400/20 px-2 py-1.5">B{moveNumber}: <span className="font-mono text-white">{formatPose(block.pointB)}</span></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-slate-500">
                      Speed
                      <input value={block.speed} onChange={(e) => updateStepsByIds(block.stepIds, (step) => ({ ...step, speed: Number(e.target.value) || 30 }))} className="mt-1 w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none" />
                    </label>
                    <label className="text-[10px] text-slate-500">
                      Acc
                      <input value={block.acc} onChange={(e) => updateStepsByIds(block.stepIds, (step) => ({ ...step, acc: Number(e.target.value) || 30 }))} className="mt-1 w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none" />
                    </label>
                  </div>
                </div>
              )}

              {block.kind === 'delay' && (
                <div className="p-3">
                  <label className="text-[10px] text-slate-500">
                    Seconds
                    <input value={block.seconds} onChange={(e) => updateStepById(block.stepIds[0], (step) => ({ ...step, delayMs: Math.round((Number(e.target.value) || 0) * 1000), label: `Delay ${e.target.value}s` }))} className="mt-1 w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none" />
                  </label>
                </div>
              )}

              {block.kind === 'do' && (
                <div className="p-3 grid grid-cols-3 gap-2">
                  <select value={block.doType} onChange={(e) => updateStepById(block.stepIds[0], (step) => ({ ...step, doType: e.target.value as 'cabinet' | 'tool', doIndex: e.target.value === 'tool' ? 0 : 1 }))} className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none">
                    <option value="cabinet">{t('cabinetDO')}</option>
                    <option value="tool">{t('toolDO')}</option>
                  </select>
                  <select value={block.doIndex} onChange={(e) => updateStepById(block.stepIds[0], (step) => ({ ...step, doIndex: Number(e.target.value) }))} className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none">
                    {(block.doType === 'tool' ? [0, 1] : [1, 2, 3, 4, 5, 6, 7, 8]).map((num) => <option key={num} value={num}>DO {num}</option>)}
                  </select>
                  <select value={block.doValue} onChange={(e) => updateStepById(block.stepIds[0], (step) => ({ ...step, doValue: Number(e.target.value) as 0 | 1 }))} className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white outline-none">
                    <option value={1}>{t('turnOn')}</option>
                    <option value={0}>{t('turnOff')}</option>
                  </select>
                </div>
              )}
            </div>
            )
          })
        )}
      </div>

      {saveDialog && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm" onClick={() => setSaveDialog(null)}>
          <div className="w-full max-w-sm rounded-lg border border-[#34343e] bg-[#17171c] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-slate-100">
              {saveDialog.type === 'module' ? <PackagePlus size={16} className="text-emerald-400" /> : <Save size={16} className="text-blue-400" />}
              <div className="text-xs font-black uppercase tracking-wider">
                {saveDialog.type === 'module'
                  ? (language === 'vi' ? 'Lưu Module' : 'Save Module')
                  : (language === 'vi' ? 'Lưu Workflow' : 'Save Workflow')}
              </div>
            </div>
            <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {language === 'vi' ? 'Tên' : 'Name'}
              <input
                autoFocus
                value={saveDialog.name}
                onChange={(e) => setSaveDialog({ ...saveDialog, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void confirmSaveDialog()
                  if (e.key === 'Escape') setSaveDialog(null)
                }}
                className="mt-1.5 h-9 w-full rounded border border-[#34343e] bg-[#101014] px-3 text-xs font-semibold text-white outline-none focus:border-blue-500"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setSaveDialog(null)}
                className="h-8 rounded border border-[#34343e] bg-[#202027] px-3 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
              >
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
              <button
                onClick={() => void confirmSaveDialog()}
                disabled={saveDialog.name.trim().length === 0}
                className="h-8 rounded bg-blue-600 px-3 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-40 cursor-pointer"
              >
                {language === 'vi' ? 'Lưu' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
