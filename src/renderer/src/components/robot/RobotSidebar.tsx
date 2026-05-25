import { useState } from 'react'
import { useRobotStore } from '../../store/robotStore'
import { JointAngles } from '../../types/robot.types'
import ScenePanel from '../scene/ScenePanel'
import { Settings, Cpu } from 'lucide-react'

const JOINT_LIMITS = [
  { name: 'Khớp 1 (j1)', min: -175, max: 175 },
  { name: 'Khớp 2 (j2)', min: -265, max: 85 },
  { name: 'Khớp 3 (j3)', min: -162, max: 162 },
  { name: 'Khớp 4 (j4)', min: -265, max: 85 },
  { name: 'Khớp 5 (j5)', min: -175, max: 175 },
  { name: 'Khớp 6 (j6)', min: -175, max: 175 }
]

export default function RobotSidebar() {
  const [activeTab, setActiveTab] = useState<'robot' | 'scene'>('robot')
  
  const jointAngles = useRobotStore((state) => state.jointAngles)
  const setJointAngles = useRobotStore((state) => state.setJointAngles)
  const tcpPose = useRobotStore((state) => state.tcpPose)
  const isIKMode = useRobotStore((state) => state.isIKMode)
  const setIKMode = useRobotStore((state) => state.setIKMode)
  const selectedJointName = useRobotStore((state) => state.selectedJointName)
  const setSelectedJointName = useRobotStore((state) => state.setSelectedJointName)

  const handleJointChange = (idx: number, val: number) => {
    const updated = [...jointAngles] as JointAngles
    updated[idx] = Math.round(val * 10) / 10
    setJointAngles(updated)
  }

  const handleReset = () => {
    setJointAngles([0, 0, 0, 0, 0, 0])
  }

  return (
    <div className="w-80 h-full bg-[#1b1b1f] border-r border-[#2d2d34] flex flex-col text-slate-200 select-none">
      {/* Title & Info */}
      <div className="p-4 border-b border-[#2d2d34]">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          Fairino FR5 Controller
        </h2>
        <p className="text-xs text-slate-400 mt-1">Payload: 5kg | Reach: 924mm | 6-DOF</p>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-[#2d2d34] bg-[#141417]">
        <button
          onClick={() => setActiveTab('robot')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold border-b-2 transition ${
            activeTab === 'robot'
              ? 'border-blue-500 text-white bg-[#1b1b1f]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Cpu size={14} /> Robot
        </button>
        <button
          onClick={() => setActiveTab('scene')}
          className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold border-b-2 transition ${
            activeTab === 'scene'
              ? 'border-blue-500 text-white bg-[#1b1b1f]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings size={14} /> Thiết bị 3D
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'robot' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Mode Control Toggle */}
          <div className="p-4 border-b border-[#2d2d34]">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Control Mode</span>
            <div className="grid grid-cols-2 gap-2 mt-2 bg-[#121214] p-1 rounded-lg">
              <button
                onClick={() => setIKMode(false)}
                className={`py-1.5 px-3 rounded-md text-xs font-medium transition ${
                  !isIKMode
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Joint (FK)
              </button>
              <button
                onClick={() => setIKMode(true)}
                className={`py-1.5 px-3 rounded-md text-xs font-medium transition ${
                  isIKMode
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Điều khiển đầu gắp robot bằng kéo thả Gizmo (Động học ngược)"
              >
                Cartesian (IK)
              </button>
            </div>
          </div>

          {/* Joint Sliders */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Joint Space</span>
              <button
                onClick={handleReset}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition"
              >
                Reset
              </button>
            </div>
            
            {JOINT_LIMITS.map((joint, idx) => {
              const jointName = `j${idx + 1}`
              const isSelected = selectedJointName === jointName && !isIKMode
              
              return (
                <div
                  key={idx}
                  onClick={() => !isIKMode && setSelectedJointName(jointName)}
                  className={`p-3 rounded-lg border transition cursor-pointer ${
                    isSelected
                      ? 'border-blue-500 bg-blue-950/20 shadow-md shadow-blue-500/10'
                      : 'bg-[#121214] border-[#232328] hover:border-[#2d2d35]'
                  }`}
                >
                  <div className="flex justify-between text-xs font-medium mb-1.5">
                    <span className="flex items-center gap-1.5">
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>}
                      {joint.name}
                    </span>
                    <span className="text-blue-400 font-mono">{jointAngles[idx].toFixed(1)}°</span>
                  </div>
                  <input
                    type="range"
                    min={joint.min}
                    max={joint.max}
                    step="0.1"
                    value={jointAngles[idx]}
                    disabled={isIKMode}
                    onChange={(e) => handleJointChange(idx, parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#2d2d34] rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>{joint.min}°</span>
                    <span>{joint.max}°</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* TCP Cartesian Coordinates Display */}
          <div className="p-4 border-t border-[#2d2d34] bg-[#141417] shrink-0">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
              Tool Center Point (TCP)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
                <span className="text-[10px] text-red-400 block font-bold">X (mm)</span>
                <span className="text-sm font-mono font-semibold">{tcpPose.x.toFixed(1)}</span>
              </div>
              <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
                <span className="text-[10px] text-emerald-400 block font-bold">Y (mm)</span>
                <span className="text-sm font-mono font-semibold">{tcpPose.y.toFixed(1)}</span>
              </div>
              <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
                <span className="text-[10px] text-blue-400 block font-bold">Z (mm)</span>
                <span className="text-sm font-mono font-semibold">{tcpPose.z.toFixed(1)}</span>
              </div>
              <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
                <span className="text-[10px] text-red-300 block font-bold">Rx (°)</span>
                <span className="text-sm font-mono font-semibold">{tcpPose.rx.toFixed(1)}</span>
              </div>
              <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
                <span className="text-[10px] text-emerald-300 block font-bold">Ry (°)</span>
                <span className="text-sm font-mono font-semibold">{tcpPose.ry.toFixed(1)}</span>
              </div>
              <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
                <span className="text-[10px] text-blue-300 block font-bold">Rz (°)</span>
                <span className="text-sm font-mono font-semibold">{tcpPose.rz.toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <ScenePanel />
      )}
    </div>
  )
}
