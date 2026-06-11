import { useState } from 'react'
import type { ReactNode } from 'react'
import { useRobotStore } from '../../store/robotStore'
import { JointAngles } from '../../types/robot.types'
import ScenePanel from '../scene/ScenePanel'
import {
  Box,
  ChevronDown,
  Cpu,
  Eye,
  EyeOff,
  HelpCircle,
  Search,
  Settings,
  Wrench
} from 'lucide-react'
import { translations } from '../../i18n/translations'
import { useSceneStore } from '../../store/sceneStore'

const InfoTooltip = ({ text }: { text: string }) => (
  <div className="relative group inline-block align-middle select-none shrink-0" onClick={(e) => e.stopPropagation()}>
    <HelpCircle size={11} className="text-slate-400 hover:text-slate-200 cursor-help transition" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-56 bg-[#121214]/95 border border-[#2d2d34] text-[10px] text-slate-300 p-2.5 rounded shadow-2xl backdrop-blur-md z-[100] pointer-events-none font-normal leading-relaxed normal-case">
      {text}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#121214]" />
    </div>
  </div>
)

const JOINT_BOUNDS = [
  { min: -175, max: 175 },
  { min: -265, max: 85 },
  { min: -160, max: 160 },
  { min: -265, max: 85 },
  { min: -175, max: 175 },
  { min: -175, max: 175 }
]

const formatLength = (valueMm: number, unit: 'mm' | 'cm' | 'm') => {
  if (unit === 'm') return (valueMm / 1000).toFixed(4)
  if (unit === 'cm') return (valueMm / 10).toFixed(2)
  return valueMm.toFixed(1)
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function SceneHierarchyPanel() {
  const [query, setQuery] = useState('')
  const objects = useSceneStore((state) => state.objects)
  const selectedObjectId = useSceneStore((state) => state.selectedObjectId)
  const setSelectedObjectId = useSceneStore((state) => state.setSelectedObjectId)
  const updateObjectVisibility = useSceneStore((state) => state.updateObjectVisibility)
  const language = useRobotStore((state) => state.language)
  const t = (key: keyof typeof translations.vi) => translations[language][key]
  const normalizedQuery = query.trim().toLowerCase()
  const filteredObjects = normalizedQuery
    ? objects.filter((obj) => obj.name.toLowerCase().includes(normalizedQuery))
    : objects

  const StaticTreeRow = ({
    label,
    depth = 0,
    disabled = false,
    icon
  }: {
    label: string
    depth?: number
    disabled?: boolean
    icon?: ReactNode
  }) => (
    <div
      className={`flex h-6 items-center justify-between rounded px-1.5 text-[11px] ${
        disabled ? 'text-slate-600' : 'text-slate-300'
      }`}
      style={{ paddingLeft: `${8 + depth * 14}px` }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {icon || <Box size={12} className={disabled ? 'text-slate-600' : 'text-slate-500'} />}
        <span className="truncate">{label}</span>
      </div>
      <Eye size={12} className={disabled ? 'text-slate-700' : 'text-slate-500'} />
    </div>
  )

  return (
      <div className="flex h-full min-h-0 flex-col">
      <div className="p-2 border-b border-[#2d2d34]">
        <label className="relative block">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="h-8 w-full rounded border border-[#2d2d34] bg-[#121214] pl-8 pr-2 text-xs text-slate-200 outline-none transition focus:border-blue-500"
          />
        </label>
      </div>

      <div className="thin-scrollbar flex-1 overflow-y-auto p-2 text-xs">
        <div className="space-y-0.5">
          <div className="flex h-6 items-center gap-1.5 rounded px-1.5 text-[11px] font-semibold text-slate-300">
            <ChevronDown size={12} className="text-slate-500" />
            <span>{t('scene')}</span>
          </div>

          <div className="flex h-6 items-center gap-1.5 rounded px-1.5 pl-5 text-[11px] font-semibold text-slate-400">
            <ChevronDown size={12} className="text-slate-500" />
            <span>{t('environment')}</span>
          </div>
          <StaticTreeRow label={t('floorGrid')} depth={2} />
          <StaticTreeRow label={t('light')} depth={2} />

          <div className="flex h-6 items-center justify-between rounded px-1.5 pl-5 text-[11px] font-semibold text-slate-400">
            <div className="flex items-center gap-1.5">
              <ChevronDown size={12} className="text-slate-500" />
              <span>{t('models')}</span>
            </div>
            <Eye size={12} className="text-slate-500" />
          </div>
          {filteredObjects.length === 0 ? (
            <div className="px-1.5 py-2 pl-10 text-[11px] text-slate-600">
              {objects.length === 0 ? t('noDevices') : language === 'vi' ? 'Không có kết quả.' : 'No matches.'}
            </div>
          ) : (
            filteredObjects.map((obj) => {
              const isSelected = selectedObjectId === obj.id
              return (
                <div
                  key={obj.id}
                  onClick={() => setSelectedObjectId(obj.id)}
                  className={`flex h-6 cursor-pointer items-center justify-between rounded px-1.5 text-[11px] transition ${
                    isSelected
                      ? 'bg-blue-600/25 text-white'
                      : 'text-slate-300 hover:bg-[#25252b] hover:text-white'
                  }`}
                  style={{ paddingLeft: 36 }}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Box size={12} className={isSelected ? 'text-blue-300' : 'text-slate-500'} />
                    <span className="truncate">{obj.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      updateObjectVisibility(obj.id, !obj.visible)
                    }}
                    aria-label={obj.visible ? 'Hide model' : 'Show model'}
                    className="rounded p-1 text-slate-500 transition hover:bg-[#2d2d34] hover:text-slate-200 cursor-pointer"
                  >
                    {obj.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                </div>
              )
            })
          )}

          <div className="flex h-6 items-center justify-between rounded px-1.5 pl-5 text-[11px] font-semibold text-slate-400">
            <div className="flex items-center gap-1.5">
              <ChevronDown size={12} className="text-slate-500" />
              <span>{t('robot')}</span>
            </div>
            <Eye size={12} className="text-slate-500" />
          </div>
          <StaticTreeRow label="Fairino FR5" depth={2} icon={<Cpu size={12} className="text-blue-400" />} />
          <StaticTreeRow label="Base" depth={3} />
          <StaticTreeRow label="Tool: Gripper" depth={3} disabled icon={<Wrench size={12} className="text-slate-600" />} />
          <StaticTreeRow label="TCP: TCP_Gripper" depth={3} disabled />
        </div>
      </div>
    </div>
  )
}

export default function RobotSidebar() {
  const [activeTab, setActiveTab] = useState<'scene' | 'resources'>('scene')

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

  const isDebugHitbox = useSceneStore((state) => state.isDebugHitbox)
  const setDebugHitbox = useSceneStore((state) => state.setDebugHitbox)

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
      <div className="h-[390px] shrink-0 overflow-hidden border-b border-[#2d2d34] flex flex-col">
        <div className="flex h-11 shrink-0 border-b border-[#2d2d34] bg-[#141417]">
          <button
            onClick={() => setActiveTab('scene')}
            className={`flex-1 border-b-2 text-xs font-bold uppercase tracking-wide transition cursor-pointer ${
              activeTab === 'scene'
                ? 'border-blue-500 bg-[#1b1b1f] text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t('scene')}
          </button>
          <button
            onClick={() => setActiveTab('resources')}
            className={`flex-1 border-b-2 text-xs font-bold uppercase tracking-wide transition cursor-pointer ${
              activeTab === 'resources'
                ? 'border-blue-500 bg-[#1b1b1f] text-white'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t('resources')}
          </button>
        </div>
        <div className="flex-1 min-h-0">
          {activeTab === 'scene' ? <SceneHierarchyPanel /> : <ScenePanel compact />}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-[#2d2d34] bg-[#141417] px-3">
          <ChevronDown size={13} className="text-slate-500" />
          <span className="text-xs font-bold uppercase tracking-wide text-slate-300">{t('robotControl')}</span>
        </div>

        <div className="p-2 border-b border-[#2d2d34]">
          <div className="grid grid-cols-2 gap-1.5 bg-[#121214] p-1 rounded">
            <button
              onClick={() => setIKMode(false)}
              className={`py-1.5 px-2 rounded text-xs font-medium transition flex items-center justify-center gap-1 cursor-pointer ${
                !isIKMode ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Joint (FK)
              <InfoTooltip text={t('tooltipFK')} />
            </button>
            <button
              onClick={() => setIKMode(true)}
              className={`py-1.5 px-2 rounded text-xs font-medium transition flex items-center justify-center gap-1 cursor-pointer ${
                isIKMode ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              Cartesian (IK)
              <InfoTooltip text={t('tooltipIK')} />
            </button>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-[#2d2d34] bg-[#141417]/50 space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Đơn vị</span>
            <div className="flex gap-2">
              <div className="flex bg-[#121214] p-0.5 rounded border border-[#2d2d34]">
                {(['mm', 'cm', 'm'] as const).map((unit) => (
                  <button
                    key={unit}
                    onClick={() => setLengthUnit(unit)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                      lengthUnit === unit ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
              <div className="flex bg-[#121214] p-0.5 rounded border border-[#2d2d34]">
                <button
                  onClick={() => setAngleUnit('deg')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    angleUnit === 'deg' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  deg
                </button>
                <button
                  onClick={() => setAngleUnit('rad')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    angleUnit === 'rad' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  rad
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 opacity-55">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{t('tool')}</span>
            <div className="flex items-center gap-1.5">
              <select
                value="Gripper"
                disabled
                className="h-7 w-32 rounded border border-[#2d2d34] bg-[#121214] px-2 text-xs font-semibold text-slate-500 outline-none disabled:cursor-not-allowed"
              >
                <option>Gripper</option>
              </select>
              <Settings size={13} className="text-slate-600" />
            </div>
          </div>
        </div>

        <div className="hidden px-3 py-2 border-b border-[#2d2d34] bg-[#141417]/30 justify-between items-center shrink-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('debugHitbox')}</span>
          <label className="relative inline-flex items-center cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isDebugHitbox}
              onChange={(e) => setDebugHitbox(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-[#25252b] rounded-full peer peer-checked:bg-blue-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:bg-white border border-[#393942] relative transition"></div>
          </label>
        </div>

        <div className="thin-scrollbar flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-0">
          <div className="flex justify-between items-center pb-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t('jointSpace')}</span>
            <button onClick={handleReset} className="text-xs text-blue-400 hover:text-blue-300 font-medium transition cursor-pointer">
              {t('reset')}
            </button>
          </div>

          {JOINT_BOUNDS.map((bound, idx) => {
            const jointName = `j${idx + 1}`
            const isSelected = selectedJointName === jointName && !isIKMode

            return (
              <div
                key={idx}
                onClick={() => !isIKMode && setSelectedJointName(jointName)}
                className={`grid h-7 grid-cols-[26px_1fr_58px] items-center gap-2 rounded px-1.5 transition cursor-pointer ${
                  isSelected ? 'bg-blue-950/20' : 'hover:bg-[#202027]'
                }`}
              >
                <span className="text-xs font-bold text-slate-300">{`J${idx + 1}`}</span>
                <input
                  type="range"
                  min={bound.min}
                  max={bound.max}
                  step="0.1"
                  value={jointAngles[idx]}
                  disabled={isIKMode}
                  onChange={(e) => handleJointChange(idx, parseFloat(e.target.value))}
                  className="h-1 w-full accent-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={
                    angleUnit === 'rad'
                      ? Math.round((jointAngles[idx] * Math.PI / 180) * 1000) / 1000
                      : jointAngles[idx]
                  }
                  disabled={isIKMode}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const inputVal = parseFloat(e.target.value) || 0
                    const degVal = angleUnit === 'rad' ? inputVal * 180 / Math.PI : inputVal
                    handleJointChange(idx, clamp(degVal, bound.min, bound.max))
                  }}
                  className="h-6 rounded border border-[#2d2d34] bg-[#151519] px-1.5 text-right text-[11px] font-mono font-semibold text-slate-300 outline-none focus:border-blue-500 disabled:opacity-50"
                />
              </div>
            )
          })}
        </div>

        <div className="p-3 border-t border-[#2d2d34] bg-[#141417] shrink-0">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-2">
            {t('toolCenterPoint')}
            <InfoTooltip text={t('tooltipTCP')} />
          </span>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
              <span className="text-[10px] text-red-400 block font-bold">X ({lengthUnit})</span>
              <span className="text-sm font-mono font-semibold">{formatLength(tcpPose.x, lengthUnit)}</span>
            </div>
            <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
              <span className="text-[10px] text-emerald-400 block font-bold">Y ({lengthUnit})</span>
              <span className="text-sm font-mono font-semibold">{formatLength(tcpPose.y, lengthUnit)}</span>
            </div>
            <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
              <span className="text-[10px] text-blue-400 block font-bold">Z ({lengthUnit})</span>
              <span className="text-sm font-mono font-semibold">{formatLength(tcpPose.z, lengthUnit)}</span>
            </div>
            <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
              <span className="text-[10px] text-red-300 block font-bold">Rx ({angleUnit})</span>
              <span className="text-sm font-mono font-semibold">{angleUnit === 'rad' ? (tcpPose.rx * Math.PI / 180).toFixed(3) : tcpPose.rx.toFixed(1)}</span>
            </div>
            <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
              <span className="text-[10px] text-emerald-300 block font-bold">Ry ({angleUnit})</span>
              <span className="text-sm font-mono font-semibold">{angleUnit === 'rad' ? (tcpPose.ry * Math.PI / 180).toFixed(3) : tcpPose.ry.toFixed(1)}</span>
            </div>
            <div className="bg-[#1e1e24] p-2 rounded border border-[#2d2d34]">
              <span className="text-[10px] text-blue-300 block font-bold">Rz ({angleUnit})</span>
              <span className="text-sm font-mono font-semibold">{angleUnit === 'rad' ? (tcpPose.rz * Math.PI / 180).toFixed(3) : tcpPose.rz.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
