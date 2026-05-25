import { useRobotStore } from '../../store/robotStore'
import { WorkflowStep } from '../../types/robot.types'
import { Play, Pause, Square, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'

export default function WorkflowPanel() {
  const steps = useRobotStore((state) => state.steps)
  const addStep = useRobotStore((state) => state.addStep)
  const removeStep = useRobotStore((state) => state.removeStep)
  const reorderSteps = useRobotStore((state) => state.reorderSteps)
  const jointAngles = useRobotStore((state) => state.jointAngles)
  const tcpPose = useRobotStore((state) => state.tcpPose)
  const selectedStepId = useRobotStore((state) => state.selectedStepId)
  const setSelectedStepId = useRobotStore((state) => state.setSelectedStepId)
  const setJointAngles = useRobotStore((state) => state.setJointAngles)

  // Simulation states
  const isPlaying = useRobotStore((state) => state.isPlaying)
  const setPlaying = useRobotStore((state) => state.setPlaying)
  const currentStepIndex = useRobotStore((state) => state.currentStepIndex)
  const setCurrentStepIndex = useRobotStore((state) => state.setCurrentStepIndex)

  const handleRecordWaypoint = (type: 'MoveJ' | 'MoveL') => {
    const label = `${type} - Point ${steps.filter(s => s.type === 'MoveJ' || s.type === 'MoveL').length + 1}`
    addStep({
      type,
      label,
      jointAngles: [...jointAngles],
      tcpPose: { ...tcpPose },
      speed: 30,
      acc: 30
    })
  }

  const handleAddDO = () => {
    addStep({
      type: 'SetDO',
      label: 'Cài đặt Digital Output',
      speed: 0,
      acc: 0,
      doIndex: 1,
      doValue: 1
    })
  }

  const handleAddDelay = () => {
    addStep({
      type: 'WaitMs',
      label: 'Đợi trễ thời gian',
      speed: 0,
      acc: 0,
      delayMs: 1000
    })
  }

  const handleStepClick = (step: WorkflowStep) => {
    setSelectedStepId(step.id)
    if (step.jointAngles) {
      setJointAngles(step.jointAngles)
    }
  }

  // Simulation execution loop with smooth joint angle interpolation
  const runSimulation = async () => {
    if (steps.length === 0) return
    setPlaying(true)
    
    let currentIndex = currentStepIndex
    if (currentIndex >= steps.length) {
      currentIndex = 0
      setCurrentStepIndex(0)
    }

    while (currentIndex < steps.length && useRobotStore.getState().isPlaying) {
      const step = steps[currentIndex]
      setSelectedStepId(step.id)
      
      if (step.jointAngles) {
        // Smoothly interpolate from current joints to target joints
        const startAngles = [...useRobotStore.getState().jointAngles]
        const targetAngles = step.jointAngles
        const duration = 1000 / useRobotStore.getState().playbackSpeed // 1 second duration adjusted by playback speed
        const stepsCount = 30 // 30 frames of animation
        const intervalTime = duration / stepsCount

        for (let i = 1; i <= stepsCount; i++) {
          if (!useRobotStore.getState().isPlaying) break
          const t = i / stepsCount
          const interpolated = startAngles.map((start, idx) => {
            const target = targetAngles[idx]
            return start + (target - start) * t
          })
          setJointAngles(interpolated as any)
          await new Promise(resolve => setTimeout(resolve, intervalTime))
        }
      } else if (step.type === 'WaitMs' && step.delayMs) {
        // Wait delay duration
        const waitTime = step.delayMs / useRobotStore.getState().playbackSpeed
        await new Promise(resolve => setTimeout(resolve, waitTime))
      } else {
        // Fast skip for other steps like SetDO
        await new Promise(resolve => setTimeout(resolve, 200 / useRobotStore.getState().playbackSpeed))
      }

      if (!useRobotStore.getState().isPlaying) break

      currentIndex++
      setCurrentStepIndex(currentIndex)
    }

    setPlaying(false)
  }

  const handlePlay = () => {
    if (isPlaying) {
      setPlaying(false)
    } else {
      setTimeout(() => runSimulation(), 10)
    }
  }

  const handleStop = () => {
    setPlaying(false)
    setCurrentStepIndex(0)
    setSelectedStepId(null)
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= steps.length) return
    
    const newSteps = [...steps]
    const temp = newSteps[index]
    newSteps[index] = newSteps[nextIndex]
    newSteps[nextIndex] = temp
    reorderSteps(newSteps)
  }

  return (
    <div className="w-96 h-full bg-[#1b1b1f] border-l border-[#2d2d34] flex flex-col text-slate-200 select-none">
      {/* Waypoint Recorder */}
      <div className="p-4 border-b border-[#2d2d34] space-y-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Record Waypoint</span>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleRecordWaypoint('MoveJ')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-bold text-white transition shadow-md"
          >
            <Plus size={14} /> Record MoveJ
          </button>
          <button
            onClick={() => handleRecordWaypoint('MoveL')}
            className="flex items-center justify-center gap-1.5 py-2 px-3 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold text-white transition shadow-md"
          >
            <Plus size={14} /> Record MoveL
          </button>
        </div>
      </div>

      {/* Add non-motion steps */}
      <div className="p-4 border-b border-[#2d2d34] flex gap-2">
        <button
          onClick={handleAddDO}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#25252b] hover:bg-[#2e2e36] text-[11px] font-semibold rounded border border-[#393942]"
        >
          + Set DO
        </button>
        <button
          onClick={handleAddDelay}
          className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-[#25252b] hover:bg-[#2e2e36] text-[11px] font-semibold rounded border border-[#393942]"
        >
          + Wait Delay
        </button>
      </div>

      {/* Simulation Controls */}
      <div className="p-4 border-b border-[#2d2d34] bg-[#121214] flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Simulation</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePlay}
            className={`p-2 rounded transition ${
              isPlaying ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title={isPlaying ? 'Tạm dừng' : 'Chạy thử'}
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            onClick={handleStop}
            className="p-2 bg-rose-600 hover:bg-rose-500 text-white rounded transition"
            title="Dừng"
          >
            <Square size={14} />
          </button>
        </div>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
          Workflow Steps ({steps.length})
        </span>

        {steps.length === 0 ? (
          <div className="h-40 border border-dashed border-[#2d2d34] rounded-lg flex flex-col items-center justify-center text-slate-500 p-4 text-center">
            <span className="text-xs">Chưa có bước workflow nào.</span>
            <span className="text-[10px] mt-1">Sử dụng nút Record Waypoint hoặc + Set DO để bắt đầu lập trình.</span>
          </div>
        ) : (
          steps.map((step, idx) => {
            const isSelected = selectedStepId === step.id
            const isCurrentSim = isPlaying && currentStepIndex === idx

            return (
              <div
                key={step.id}
                onClick={() => handleStepClick(step)}
                className={`p-3 rounded-lg border text-left cursor-pointer transition flex justify-between items-start ${
                  isCurrentSim
                    ? 'border-emerald-500 bg-emerald-950/20'
                    : isSelected
                    ? 'border-blue-500 bg-blue-950/10'
                    : 'border-[#2d2d34] bg-[#121214] hover:bg-[#1a1a1f]'
                }`}
              >
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                        step.type === 'MoveJ'
                          ? 'bg-indigo-900/60 text-indigo-300'
                          : step.type === 'MoveL'
                          ? 'bg-blue-900/60 text-blue-300'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {step.type}
                    </span>
                    <span className="text-xs font-bold truncate text-white block">{step.label}</span>
                  </div>

                  {step.jointAngles && (
                    <div className="mt-1 text-[10px] text-slate-400 font-mono truncate">
                      Q: [{step.jointAngles.map(v => Math.round(v)).join(', ')}]
                    </div>
                  )}
                  {step.delayMs && (
                    <div className="mt-1 text-[10px] text-slate-400 font-mono">
                      Thời gian trễ: {step.delayMs} ms
                    </div>
                  )}
                  {step.doIndex && (
                    <div className="mt-1 text-[10px] text-slate-400 font-mono">
                      DO {step.doIndex} = {step.doValue}
                    </div>
                  )}
                </div>

                {/* Move & Delete buttons */}
                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => moveStep(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 hover:bg-[#2d2d34] rounded text-slate-500 hover:text-slate-300 disabled:opacity-30"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    onClick={() => moveStep(idx, 'down')}
                    disabled={idx === steps.length - 1}
                    className="p-1 hover:bg-[#2d2d34] rounded text-slate-500 hover:text-slate-300 disabled:opacity-30"
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    onClick={() => removeStep(step.id)}
                    className="p-1 hover:bg-rose-950/30 rounded text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 size={12} />
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
