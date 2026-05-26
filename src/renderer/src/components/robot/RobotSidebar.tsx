import { useState } from 'react'
import { useRobotStore } from '../../store/robotStore'
import { JointAngles } from '../../types/robot.types'
import ScenePanel from '../scene/ScenePanel'
import { Settings, Cpu, HelpCircle } from 'lucide-react'
import { translations } from '../../i18n/translations'

// Helper component for descriptive tooltips on technical terms
const InfoTooltip = ({ text }: { text: string }) => (
  <div className="relative group inline-block align-middle select-none shrink-0" onClick={e => e.stopPropagation()}>
    <HelpCircle size={11} className="text-slate-400 hover:text-slate-200 cursor-help transition" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 bg-[#121214]/95 border border-[#2d2d34] text-[10px] text-slate-300 p-2.5 rounded-lg shadow-2xl backdrop-blur-md z-[100] pointer-events-none font-normal leading-relaxed normal-case">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#121214]" />
    </div>
  </div>
)

const JOINT_BOUNDS = [
  { min: -175, max: 175 },
  { min: -265, max: 85 },
  { min: -162, max: 162 },
  { min: -265, max: 85 },
  { min: -175, max: 175 },
  { min: -175, max: 175 }
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
  
  const lengthUnit = useRobotStore((state) => state.lengthUnit)
  const setLengthUnit = useRobotStore((state) => state.setLengthUnit)
  const angleUnit = useRobotStore((state) => state.angleUnit)
  const setAngleUnit = useRobotStore((state) => state.setAngleUnit)

  // Language translation helper
  const language = useRobotStore((state) => state.language)
  const t = (key: keyof typeof translations.vi) => translations[language][key]

  const handleJointChange = (idx: number, val: number) => {
    const updated = [...jointAngles] as JointAngles
    updated[idx] = Math.round(val * 10) / 10
    setJointAngles(updated)
  }

  const handleReset = () => {
    setJointAngles([0, 0, 0, 0, 0, 0])
  }

  return (
    <div className="w-80 h-full bg-[#1b1b1f] border-r border-[#2d2d34] flex flex-col text-slate-200 select-none shrink-0">
      {/* Title & Info */}
      <div className="p-4 border-b border-[#2d2d34]">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          Fairino FR5 Controller
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          {t('payload')}: 5kg | {t('reach')}: 924mm | 6-DOF
        </p>
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
          <Settings size={14} /> {t('deviceList')}
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'robot' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Mode Control Toggle */}
          <div className="p-4 border-b border-[#2d2d34]">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('controlMode')}</span>
            <div className="grid grid-cols-2 gap-2 mt-2 bg-[#121214] p-1 rounded-lg">
              <button
                onClick={() => setIKMode(false)}
                className={`py-1.5 px-2 rounded-md text-xs font-medium transition flex items-center justify-center gap-1 ${
                  !isIKMode
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Joint (FK)
                <InfoTooltip text={t('tooltipFK')} />
              </button>
              <button
                onClick={() => setIKMode(true)}
                className={`py-1.5 px-2 rounded-md text-xs font-medium transition flex items-center justify-center gap-1 ${
                  isIKMode
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Cartesian (IK)
                <InfoTooltip text={t('tooltipIK')} />
              </button>
            </div>
          </div>

          {/* Measurement System Select */}
          <div className="px-4 py-3 border-b border-[#2d2d34] bg-[#141417]/50 flex justify-between items-center shrink-0">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Đơn vị đo / Units</span>
            <div className="flex gap-2">
              <div className="flex bg-[#121214] p-0.5 rounded border border-[#2d2d34]">
                <button
                  onClick={() => setLengthUnit('mm')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    lengthUnit === 'mm' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Milimet"
                >
                  mm
                </button>
                <button
                  onClick={() => setLengthUnit('m')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    lengthUnit === 'm' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Mét"
                >
                  m
                </button>
              </div>
              <div className="flex bg-[#121214] p-0.5 rounded border border-[#2d2d34]">
                <button
                  onClick={() => setAngleUnit('deg')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    angleUnit === 'deg' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Độ"
                >
                  °
                </button>
                <button
                  onClick={() => setAngleUnit('rad')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                    angleUnit === 'rad' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Radian"
                >
                  rad
                </button>
              </div>
            </div>
          </div>

          {/* Joint Sliders */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('jointSpace')}</span>
              <button
                onClick={handleReset}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium transition"
              >
                {t('reset')}
              </button>
            </div>
            
            {JOINT_BOUNDS.map((bound, idx) => {
              const jointName = `j${idx + 1}`
              const isSelected = selectedJointName === jointName && !isIKMode
              const displayName = `${t('jointLimitTitle')} ${idx + 1} (${jointName})`
              
              const jointValDisp = angleUnit === 'rad' 
                ? `${(jointAngles[idx] * Math.PI / 180).toFixed(3)} rad` 
                : `${jointAngles[idx].toFixed(1)}°`
              
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
                      {displayName}
                    </span>
                    <span className="text-blue-400 font-mono">{jointValDisp}</span>
                  </div>
                  <input
                    type="range"
                    min={bound.min}
                    max={bound.max}
                    step="0.1"
                    value={jointAngles[idx]}
                    disabled={isIKMode}
                    onChange={(e) => handleJointChange(idx, parseFloat(e.target.value))}
                    className="w-full h-1 bg-[#2d2d34] rounded-lg appearance-none cursor-pointer accent-blue-500 disabled:opacity-50"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>{angleUnit === 'rad' ? `${(bound.min * Math.PI / 180).toFixed(2)} rad` : `${bound.min}°`}</span>
                    <span>{angleUnit === 'rad' ? `${(bound.max * Math.PI / 180).toFixed(2)} rad` : `${bound.max}°`}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* TCP Cartesian Coordinates Display */}
          <div className="p-4 border-t border-[#2d2d34] bg-[#141417] shrink-0">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-3">
              {t('toolCenterPoint')}
              <InfoTooltip text={t('tooltipTCP')} />
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
                <span className="text-[10px] text-red-400 block font-bold">X ({lengthUnit})</span>
                <span className="text-sm font-mono font-semibold">
                  {lengthUnit === 'm' ? (tcpPose.x / 1000).toFixed(4) : tcpPose.x.toFixed(1)}
                </span>
              </div>
              <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
                <span className="text-[10px] text-emerald-400 block font-bold">Y ({lengthUnit})</span>
                <span className="text-sm font-mono font-semibold">
                  {lengthUnit === 'm' ? (tcpPose.y / 1000).toFixed(4) : tcpPose.y.toFixed(1)}
                </span>
              </div>
              <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
                <span className="text-[10px] text-blue-400 block font-bold">Z ({lengthUnit})</span>
                <span className="text-sm font-mono font-semibold">
                  {lengthUnit === 'm' ? (tcpPose.z / 1000).toFixed(4) : tcpPose.z.toFixed(1)}
                </span>
              </div>
              <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
                <span className="text-[10px] text-red-300 block font-bold">Rx ({angleUnit === 'rad' ? 'rad' : '°'})</span>
                <span className="text-sm font-mono font-semibold">
                  {angleUnit === 'rad' ? (tcpPose.rx * Math.PI / 180).toFixed(3) : tcpPose.rx.toFixed(1)}
                </span>
              </div>
              <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
                <span className="text-[10px] text-emerald-300 block font-bold">Ry ({angleUnit === 'rad' ? 'rad' : '°'})</span>
                <span className="text-sm font-mono font-semibold">
                  {angleUnit === 'rad' ? (tcpPose.ry * Math.PI / 180).toFixed(3) : tcpPose.ry.toFixed(1)}
                </span>
              </div>
              <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
                <span className="text-[10px] text-blue-300 block font-bold">Rz ({angleUnit === 'rad' ? 'rad' : '°'})</span>
                <span className="text-sm font-mono font-semibold">
                  {angleUnit === 'rad' ? (tcpPose.rz * Math.PI / 180).toFixed(3) : tcpPose.rz.toFixed(1)}
                </span>
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
