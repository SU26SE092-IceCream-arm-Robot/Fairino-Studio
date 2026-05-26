import React, { useState } from 'react'
import { useRobotStore } from '../../store/robotStore'
import { WorkflowStep, StepType } from '../../types/robot.types'
import { Trash2, GripVertical, Plus, RotateCw, Move, Radio, Clock, ToggleLeft, HelpCircle } from 'lucide-react'
import { translations } from '../../i18n/translations'

// Helper component for descriptive tooltips on technical terms
const InfoTooltip = ({ text }: { text: string }) => (
  <div className="relative group inline-block align-middle select-none shrink-0" onClick={e => e.stopPropagation()}>
    <HelpCircle size={11} className="text-white/50 hover:text-white cursor-help transition" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 bg-[#121214]/95 border border-white/10 text-[10px] text-slate-300 p-2.5 rounded-lg shadow-2xl backdrop-blur-md z-[100] pointer-events-none font-normal leading-relaxed normal-case">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#121214]" />
    </div>
  </div>
)

interface BlockTemplate {
  type: StepType
  labelKey: keyof typeof translations.vi
  colorClass: string
  icon: React.ReactNode
}

export default function BlockWorkspace() {
  const steps = useRobotStore((state) => state.steps)
  const addStep = useRobotStore((state) => state.addStep)
  const removeStep = useRobotStore((state) => state.removeStep)
  const updateStep = useRobotStore((state) => state.updateStep)
  const reorderSteps = useRobotStore((state) => state.reorderSteps)
  const selectedStepId = useRobotStore((state) => state.selectedStepId)
  const setSelectedStepId = useRobotStore((state) => state.setSelectedStepId)
  const isPlaying = useRobotStore((state) => state.isPlaying)
  const currentStepIndex = useRobotStore((state) => state.currentStepIndex)

  const lengthUnit = useRobotStore((state) => state.lengthUnit)
  const angleUnit = useRobotStore((state) => state.angleUnit)

  // Language translation helper
  const language = useRobotStore((state) => state.language)
  const t = (key: keyof typeof translations.vi) => translations[language][key]

  // Drag & drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const blockTemplates: BlockTemplate[] = [
    {
      type: 'RotateJoint',
      labelKey: 'rotateJointBlock',
      colorClass: 'bg-indigo-650 border-indigo-400 hover:bg-indigo-600 text-indigo-100',
      icon: <RotateCw size={12} />
    },
    {
      type: 'MoveTCP',
      labelKey: 'moveTCPBlock',
      colorClass: 'bg-blue-650 border-blue-400 hover:bg-blue-600 text-blue-100',
      icon: <Move size={12} />
    },
    {
      type: 'SetDO',
      labelKey: 'setDOBlock',
      colorClass: 'bg-amber-650 border-amber-400 hover:bg-amber-600 text-amber-100',
      icon: <Radio size={12} />
    },
    {
      type: 'WaitMs',
      labelKey: 'waitMsBlock',
      colorClass: 'bg-emerald-650 border-emerald-400 hover:bg-emerald-600 text-emerald-100',
      icon: <Clock size={12} />
    },
    {
      type: 'GripperClose',
      labelKey: 'gripperCloseBlock',
      colorClass: 'bg-rose-650 border-rose-400 hover:bg-rose-600 text-rose-100',
      icon: <ToggleLeft size={12} />
    }
  ]

  // Add default parameters when adding a new step
  const handleAddBlock = (type: StepType) => {
    let newStepParams: Omit<WorkflowStep, 'id'> = {
      type,
      label: '',
      speed: 30,
      acc: 30
    }

    switch (type) {
      case 'RotateJoint':
        newStepParams = {
          ...newStepParams,
          label: `${t('rotateJointBlock')} 1`,
          jointIndex: 1,
          rotateMode: 'absolute',
          angle: 0
        }
        break
      case 'MoveTCP':
        newStepParams = {
          ...newStepParams,
          label: `${t('moveTCPBlock')} Z`,
          tcpAxis: 'Z',
          moveMode: 'relative',
          distance: 20
        }
        break
      case 'SetDO':
        newStepParams = {
          ...newStepParams,
          label: `${t('setDOBlock')} 1`,
          doIndex: 1,
          doValue: 1
        }
        break
      case 'WaitMs':
        newStepParams = {
          ...newStepParams,
          label: `${t('waitMsBlock')} 1s`,
          delayMs: 1000
        }
        break
      case 'GripperOpen':
        newStepParams = {
          ...newStepParams,
          label: t('gripperOpenBlock')
        }
        break
      case 'GripperClose':
        newStepParams = {
          ...newStepParams,
          label: t('gripperCloseBlock')
        }
        break
    }

    addStep(newStepParams)
  }

  // Handle Drag Start from Template Palette
  const handleTemplateDragStart = (e: React.DragEvent, type: StepType) => {
    e.dataTransfer.setData('newBlockType', type)
  }

  // Handle Drag Start from Workspace List (Reordering)
  const handleWorkspaceDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragOverIndex !== index) {
      setDragOverIndex(index)
    }
  }

  // Handle Drop in Workspace (Insert or Reorder)
  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    const newType = e.dataTransfer.getData('newBlockType') as StepType | ''

    if (newType) {
      // 1. Insert new block from palette at targetIndex
      let newStepParams: Omit<WorkflowStep, 'id'> = {
        type: newType,
        label: '',
        speed: 30,
        acc: 30
      }

      switch (newType) {
        case 'RotateJoint':
          newStepParams = {
            ...newStepParams,
            label: `${t('rotateJointBlock')} 1`,
            jointIndex: 1,
            rotateMode: 'absolute',
            angle: 0
          }
          break
        case 'MoveTCP':
          newStepParams = {
            ...newStepParams,
            label: `${t('moveTCPBlock')} Z`,
            tcpAxis: 'Z',
            moveMode: 'relative',
            distance: 20
          }
          break
        case 'SetDO':
          newStepParams = {
            ...newStepParams,
            label: `${t('setDOBlock')} 1`,
            doIndex: 1,
            doValue: 1
          }
          break
        case 'WaitMs':
          newStepParams = {
            ...newStepParams,
            label: `${t('waitMsBlock')} 1s`,
            delayMs: 1000
          }
          break
        case 'GripperOpen':
          newStepParams = { ...newStepParams, label: t('gripperOpenBlock') }
          break
        case 'GripperClose':
          newStepParams = { ...newStepParams, label: t('gripperCloseBlock') }
          break
      }

      const newStep: WorkflowStep = {
        ...newStepParams,
        id: `step_${Date.now()}`
      }

      const updatedSteps = [...steps]
      updatedSteps.splice(targetIndex, 0, newStep)
      reorderSteps(updatedSteps)
    } else if (draggedIndex !== null) {
      // 2. Reorder existing blocks
      if (draggedIndex === targetIndex) return
      const updatedSteps = [...steps]
      const [removed] = updatedSteps.splice(draggedIndex, 1)
      updatedSteps.splice(targetIndex, 0, removed)
      reorderSteps(updatedSteps)
    }

    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // Handle Drag End cleanup
  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#16161a]">
      {/* 1. Palette: Block templates slider */}
      <div className="p-3 border-b border-[#2d2d34] bg-[#1a1a22] shrink-0">
        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2 font-mono">
          {t('dragDropHint')}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {blockTemplates.map((tpl) => (
            <div
              key={tpl.type}
              draggable={!isPlaying}
              onDragStart={(e) => handleTemplateDragStart(e, tpl.type)}
              onClick={() => !isPlaying && handleAddBlock(tpl.type)}
              className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs font-bold shadow-sm cursor-grab active:cursor-grabbing transition transform hover:scale-[1.03] select-none ${tpl.colorClass} ${
                isPlaying ? 'opacity-40 pointer-events-none' : ''
              }`}
            >
              {tpl.icon}
              <span>{t(tpl.labelKey)}</span>
              <Plus size={10} className="opacity-60 ml-0.5" />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Workspace: Drop Zone and Blocks List */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          if (steps.length === 0) {
            handleDrop(e, 0)
          }
        }}
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0 relative select-none"
      >
        {steps.length === 0 ? (
          <div className="h-full border border-dashed border-[#2d2d34] rounded-xl flex flex-col items-center justify-center text-slate-500 p-8 text-center bg-[#111114]">
            <span className="text-xs font-semibold text-slate-400">{t('emptyWorkspace')}</span>
            <span className="text-[10px] text-slate-500 mt-1 max-w-[200px] leading-relaxed">
              {t('emptyWorkspaceHint')}
            </span>
          </div>
        ) : (
          steps.map((step, idx) => {
            const isSelected = selectedStepId === step.id
            const isCurrentSim = isPlaying && currentStepIndex === idx
            const isDragged = draggedIndex === idx
            const isOver = dragOverIndex === idx

            // Define dynamic Lego coloring classes
            let blockBg = 'bg-slate-800'
            let blockBorder = 'border-[#2d2d34]'
            let blockText = 'text-white'

            if (step.type === 'RotateJoint') {
              blockBg = 'bg-indigo-650'
              blockBorder = isSelected ? 'border-indigo-400' : 'border-indigo-700'
            } else if (step.type === 'MoveTCP') {
              blockBg = 'bg-blue-650'
              blockBorder = isSelected ? 'border-blue-400' : 'border-blue-700'
            } else if (step.type === 'SetDO') {
              blockBg = 'bg-amber-650'
              blockBorder = isSelected ? 'border-amber-400' : 'border-amber-700'
            } else if (step.type === 'WaitMs') {
              blockBg = 'bg-emerald-650'
              blockBorder = isSelected ? 'border-emerald-400' : 'border-emerald-700'
            } else if (step.type === 'GripperClose' || step.type === 'GripperOpen') {
              blockBg = 'bg-rose-650'
              blockBorder = isSelected ? 'border-rose-400' : 'border-rose-700'
            }

            return (
              <div
                key={step.id}
                draggable={!isPlaying}
                onDragStart={(e) => handleWorkspaceDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => setSelectedStepId(step.id)}
                className={`relative flex items-stretch rounded-xl border transition shadow-md select-none transform ${blockBg} ${blockBorder} ${blockText} ${
                  isDragged ? 'opacity-30 scale-95' : ''
                } ${isOver && draggedIndex !== idx ? 'border-t-2 border-t-white pt-4' : ''} ${
                  isCurrentSim ? 'ring-2 ring-emerald-400 scale-[1.02] shadow-emerald-500/20' : ''
                }`}
                style={{
                  clipPath: 'polygon(0% 0%, 30% 0%, 35% 6px, 45% 6px, 50% 0%, 100% 0%, 100% 100%, 50% 100%, 45% calc(100% + 6px), 35% calc(100% + 6px), 30% 100%, 0% 100%)',
                  marginBottom: '1px'
                }}
              >
                {/* 1. Lego Drag Handle & Color indicator */}
                <div
                  className="w-8 shrink-0 flex items-center justify-center border-r border-white/10 opacity-70 cursor-grab active:cursor-grabbing hover:opacity-100 transition"
                  title="Kéo thả để sắp xếp lại"
                >
                  <GripVertical size={14} />
                </div>

                {/* 2. Block Contents */}
                <div className="flex-1 p-3 flex flex-wrap items-center gap-2">
                  {/* Block Type Label */}
                  <span className="text-[10px] font-black uppercase tracking-wider bg-black/30 px-1.5 py-0.5 rounded text-white/90 font-mono flex items-center gap-1 select-none">
                    {step.type === 'RotateJoint' && (
                      <>
                        Rotate
                        <InfoTooltip text={t('tooltipFK')} />
                      </>
                    )}
                    {step.type === 'MoveTCP' && (
                      <>
                        Move TCP
                        <InfoTooltip text={t('tooltipMoveL')} />
                      </>
                    )}
                    {step.type === 'SetDO' && (
                      <>
                        Set DO
                        <InfoTooltip text={t('tooltipDO')} />
                      </>
                    )}
                    {step.type === 'WaitMs' && (
                      <>
                        Delay
                        <InfoTooltip text={t('tooltipDelay')} />
                      </>
                    )}
                    {(step.type === 'GripperClose' || step.type === 'GripperOpen') && (
                      <>
                        Gripper
                      </>
                    )}
                  </span>

                  {/* Render parameters interface inside the block */}
                  {step.type === 'RotateJoint' && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span>{t('rotateJointBlock')}</span>
                      <select
                        value={step.jointIndex || 1}
                        onChange={(e) => {
                          const idxVal = parseInt(e.target.value)
                          updateStep(step.id, {
                            jointIndex: idxVal,
                            label: `${t('rotateJointBlock')} ${idxVal}`
                          })
                        }}
                        disabled={isPlaying}
                        className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white font-semibold outline-none cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6].map((num) => (
                          <option key={num} value={num}>{t('jointLimitTitle')} {num}</option>
                        ))}
                      </select>

                      <select
                        value={step.rotateMode || 'absolute'}
                        onChange={(e) => {
                          updateStep(step.id, { rotateMode: e.target.value as any })
                        }}
                        disabled={isPlaying}
                        className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white font-semibold outline-none cursor-pointer"
                      >
                        <option value="absolute">{t('toAngle')}</option>
                        <option value="relative">{t('byDegrees')}</option>
                      </select>

                      <input
                        type="number"
                        value={
                          angleUnit === 'rad'
                            ? Math.round(((step.angle ?? 0) * Math.PI / 180) * 1000) / 1000
                            : step.angle ?? 0
                        }
                        onChange={(e) => {
                          const inputVal = parseFloat(e.target.value) || 0
                          const degVal = angleUnit === 'rad'
                            ? Math.round((inputVal * 180 / Math.PI) * 10) / 10
                            : inputVal
                          updateStep(step.id, { angle: degVal })
                        }}
                        step={angleUnit === 'rad' ? '0.001' : '1'}
                        disabled={isPlaying}
                        className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 w-16 text-center text-xs font-mono font-bold text-white outline-none"
                      />
                      <span>{angleUnit === 'rad' ? 'rad' : t('degrees')}</span>
                    </div>
                  )}

                  {step.type === 'MoveTCP' && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span>{t('moveTCPBlock')}</span>
                      <select
                        value={step.tcpAxis || 'Z'}
                        onChange={(e) => {
                          const axisVal = e.target.value as any
                          updateStep(step.id, {
                            tcpAxis: axisVal,
                            label: `${t('moveTCPBlock')} ${axisVal}`
                          })
                        }}
                        disabled={isPlaying}
                        className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white font-semibold outline-none cursor-pointer"
                      >
                        {['X', 'Y', 'Z'].map((axis) => (
                          <option key={axis} value={axis}>{axis}</option>
                        ))}
                      </select>

                      <select
                        value={step.moveMode || 'relative'}
                        onChange={(e) => {
                          updateStep(step.id, { moveMode: e.target.value as any })
                        }}
                        disabled={isPlaying}
                        className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white font-semibold outline-none cursor-pointer"
                      >
                        <option value="relative">{t('byDegrees')}</option>
                        <option value="absolute">{t('toCoordinate')}</option>
                      </select>

                      <input
                        type="number"
                        value={
                          lengthUnit === 'm'
                            ? Math.round(((step.distance ?? 0) / 1000) * 10000) / 10000
                            : step.distance ?? 0
                        }
                        onChange={(e) => {
                          const inputVal = parseFloat(e.target.value) || 0
                          const mmVal = lengthUnit === 'm'
                            ? Math.round(inputVal * 1000 * 10) / 10
                            : inputVal
                          updateStep(step.id, { distance: mmVal })
                        }}
                        step={lengthUnit === 'm' ? '0.0001' : '1'}
                        disabled={isPlaying}
                        className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 w-16 text-center text-xs font-mono font-bold text-white outline-none"
                      />
                      <span>{lengthUnit}</span>
                    </div>
                  )}

                  {step.type === 'SetDO' && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span>{t('setDOBlock')}</span>
                      <select
                        value={step.doIndex || 1}
                        onChange={(e) => {
                          const val = parseInt(e.target.value)
                          updateStep(step.id, {
                            doIndex: val,
                            label: `${t('setDOBlock')} ${val}`
                          })
                        }}
                        disabled={isPlaying}
                        className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white font-semibold outline-none cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                          <option key={num} value={num}>DO {num}</option>
                        ))}
                      </select>
                      <span>{language === 'vi' ? 'thành' : 'to'}</span>
                      <div className="flex items-center gap-1">
                        <select
                          value={step.doValue ?? 1}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) as 0 | 1
                            updateStep(step.id, { doValue: val })
                          }}
                          disabled={isPlaying}
                          className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white font-semibold outline-none cursor-pointer font-mono"
                        >
                          <option value={1}>{t('turnOn')}</option>
                          <option value={0}>{t('turnOff')}</option>
                        </select>
                        <InfoTooltip text={t('tooltipDOVal')} />
                      </div>
                    </div>
                  )}

                  {step.type === 'WaitMs' && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span>{t('waitMsBlock')}</span>
                      <input
                        type="number"
                        value={step.delayMs || 1000}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0
                          updateStep(step.id, {
                            delayMs: val,
                            label: `${t('waitMsBlock')} ${val}ms`
                          })
                        }}
                        disabled={isPlaying}
                        className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 w-16 text-center text-xs font-mono font-bold text-white outline-none"
                      />
                      <span>ms</span>
                    </div>
                  )}

                  {step.type === 'GripperClose' && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span>{language === 'vi' ? 'Thiết lập đóng tay gắp robot' : 'Set gripper state to CLOSED'} (DO 1 = 1)</span>
                      <button
                        onClick={() => {
                          updateStep(step.id, {
                            type: 'GripperOpen',
                            label: t('gripperOpenBlock')
                          })
                        }}
                        disabled={isPlaying}
                        className="bg-black/20 hover:bg-black/40 px-1.5 py-0.5 rounded text-[10px] border border-white/10 cursor-pointer"
                      >
                        {t('changeToOpen')}
                      </button>
                    </div>
                  )}

                  {step.type === 'GripperOpen' && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold">
                      <span>{language === 'vi' ? 'Thiết lập mở tay gắp robot' : 'Set gripper state to OPEN'} (DO 1 = 0)</span>
                      <button
                        onClick={() => {
                          updateStep(step.id, {
                            type: 'GripperClose',
                            label: t('gripperCloseBlock')
                          })
                        }}
                        disabled={isPlaying}
                        className="bg-black/20 hover:bg-black/40 px-1.5 py-0.5 rounded text-[10px] border border-white/10 cursor-pointer"
                      >
                        {t('changeToClose')}
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Delete action button */}
                <div className="shrink-0 flex items-center pr-3 pl-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => removeStep(step.id)}
                    className="p-1.5 hover:bg-black/30 rounded-lg text-white/50 hover:text-rose-300 transition cursor-pointer"
                    title="Xóa khối"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
