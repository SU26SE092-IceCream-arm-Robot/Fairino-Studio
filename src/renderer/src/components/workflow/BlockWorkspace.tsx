import { ArrowDown, ArrowUp, Clock, CopyPlus, PackagePlus, Radio, Route, Save, Trash2 } from 'lucide-react'
import { useRobotStore } from '../../store/robotStore'
import { translations } from '../../i18n/translations'
import { SimpleModuleTemplate, SimpleWorkflowTemplate, TCPPose, WorkflowStep } from '../../types/robot.types'

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
  const isPlaying = useRobotStore((state) => state.isPlaying)
  const language = useRobotStore((state) => state.language)
  const reorderSteps = useRobotStore((state) => state.reorderSteps)
  const projectModules = useRobotStore((state) => state.projectModules)
  const projectWorkflowTemplates = useRobotStore((state) => state.projectWorkflowTemplates)
  const setProjectModules = useRobotStore((state) => state.setProjectModules)
  const setProjectWorkflowTemplates = useRobotStore((state) => state.setProjectWorkflowTemplates)

  const t = (key: keyof typeof translations.vi) => translations[language][key]
  const blocks = stepsToSimpleBlocks(steps)

  const updateStepById = (stepId: string, updater: (step: WorkflowStep) => WorkflowStep) => {
    reorderSteps(steps.map((step) => (step.id === stepId ? updater(step) : step)))
  }

  const updateStepsByIds = (stepIds: string[], updater: (step: WorkflowStep) => WorkflowStep) => {
    const idSet = new Set(stepIds)
    reorderSteps(steps.map((step) => (idSet.has(step.id) ? updater(step) : step)))
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

  const saveModule = () => {
    const name = prompt(t('blocklyModuleNamePrompt'), t('blocklyPickCup'))
    if (!name) return
    const moduleTemplate: SimpleModuleTemplate = {
      id: createId('project_module'),
      name,
      blocksJson: null,
      previewSteps: steps,
      scope: 'project'
    }
    setProjectModules([...projectModules, moduleTemplate])
  }

  const saveWorkflow = () => {
    const name = prompt(t('blocklyWorkflowNamePrompt'), t('blocklyWorkflowSample'))
    if (!name) return
    const workflowTemplate: SimpleWorkflowTemplate = {
      id: createId('project_workflow'),
      name,
      workspaceJson: null,
      previewSteps: steps,
      scope: 'project'
    }
    setProjectWorkflowTemplates([...projectWorkflowTemplates, workflowTemplate])
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
    <div className="flex-1 flex flex-col min-h-0 bg-[#16161a]">
      <div className="p-3 border-b border-[#2d2d34] bg-[#1a1a22] space-y-3 shrink-0">
        <div>
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block font-mono">
            SIMPLE BLOCKS
          </span>
          <span className="text-[10px] text-slate-500">
            {language === 'vi'
              ? 'Chuột phải trực tiếp trong viewport để đặt A/B.'
              : 'Right-click directly in the viewport to place A/B.'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button onClick={() => addMoveAB()} disabled={isPlaying} className="h-11 rounded bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer disabled:opacity-40">
            Move A→B
          </button>
          <button onClick={() => addDelay()} disabled={isPlaying} className="h-11 rounded bg-emerald-700 hover:bg-emerald-600 text-xs font-bold text-white cursor-pointer disabled:opacity-40">
            Delay
          </button>
          <button onClick={addDO} disabled={isPlaying} className="h-11 rounded bg-amber-700 hover:bg-amber-600 text-xs font-bold text-white cursor-pointer disabled:opacity-40">
            Set DO
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={saveModule} disabled={isPlaying || steps.length === 0} className="h-10 flex items-center justify-center gap-1.5 rounded bg-[#25252b] hover:bg-[#30303a] border border-[#393942] text-[11px] font-bold text-slate-200 cursor-pointer disabled:opacity-40">
            <PackagePlus size={13} /> {t('blocklySaveModule')}
          </button>
          <button onClick={saveWorkflow} disabled={isPlaying || steps.length === 0} className="h-10 flex items-center justify-center gap-1.5 rounded bg-[#25252b] hover:bg-[#30303a] border border-[#393942] text-[11px] font-bold text-slate-200 cursor-pointer disabled:opacity-40">
            <Save size={13} /> {t('blocklySaveWorkflow')}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={addPickCup} disabled={isPlaying} className="min-h-10 px-2 rounded bg-[#25252b] hover:bg-[#30303a] border border-[#393942] text-left text-[11px] text-slate-200 cursor-pointer disabled:opacity-40">
            <span className="font-bold block">{t('blocklyPickCup')}</span>
            <span className="text-[9px] text-slate-500">{t('blocklyPickCupDescription')}</span>
          </button>
          {projectWorkflowTemplates.slice(-1).map((tpl) => (
            <button key={tpl.id} onClick={() => loadPreviewSteps(tpl.previewSteps)} className="min-h-10 px-2 rounded bg-[#172033] hover:bg-[#1f2d4a] border border-blue-900/60 text-left text-[11px] text-slate-200 cursor-pointer">
              <span className="font-bold block truncate">{tpl.name}</span>
              <span className="text-[9px] text-slate-500">{tpl.previewSteps.length} steps</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar p-3 space-y-2">
        {blocks.length === 0 ? (
          <div className="h-full min-h-56 rounded-lg border border-dashed border-[#2d2d34] bg-[#111114] flex items-center justify-center text-center px-8">
            <div>
              <CopyPlus size={24} className="mx-auto text-slate-600 mb-2" />
              <div className="text-xs font-bold text-slate-400">{t('emptyWorkspace')}</div>
              <div className="text-[10px] text-slate-500 mt-1">{t('emptyWorkspaceHint')}</div>
            </div>
          </div>
        ) : (
          blocks.map((block, index) => {
            const moveNumber = block.kind === 'moveAB'
              ? blocks.slice(0, index + 1).filter((item) => item.kind === 'moveAB').length
              : 0

            return (
            <div key={block.id} className="rounded-lg border border-[#2d2d34] bg-[#111114] overflow-hidden">
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
                    <button onClick={() => updateStepById(block.stepIds[0], (step) => ({ ...step, tcpPose: clonePose(tcpPose) }))} disabled={isPlaying} className="h-10 rounded bg-blue-600/90 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer disabled:opacity-40">
                      TCP → A{moveNumber}
                    </button>
                    <button onClick={() => updateStepById(block.stepIds[1], (step) => ({ ...step, tcpPose: clonePose(tcpPose) }))} disabled={isPlaying} className="h-10 rounded bg-indigo-600/90 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer disabled:opacity-40">
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
    </div>
  )
}
