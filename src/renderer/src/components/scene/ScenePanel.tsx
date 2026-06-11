import React, { useRef } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { useRobotStore } from '../../store/robotStore'
import { Trash2, Eye, EyeOff, Upload, Settings, Plus } from 'lucide-react'
import { Transform3D } from '../../types/scene.types'
import { translations } from '../../i18n/translations'

export default function ScenePanel({ compact = false }: { compact?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objects = useSceneStore((state) => state.objects)
  const addObject = useSceneStore((state) => state.addObject)
  const removeObject = useSceneStore((state) => state.removeObject)
  const updateObjectTransform = useSceneStore((state) => state.updateObjectTransform)
  const updateObjectVisibility = useSceneStore((state) => state.updateObjectVisibility)
  const selectedObjectId = useSceneStore((state) => state.selectedObjectId)
  const setSelectedObjectId = useSceneStore((state) => state.setSelectedObjectId)

  // Language translation helper
  const language = useRobotStore((state) => state.language)
  const t = (key: keyof typeof translations.vi) => translations[language][key]

  const selectedObject = objects.find((o) => o.id === selectedObjectId) ?? objects[0]

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const name = file.name.split('.').slice(0, -1).join('.')
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    if (extension !== 'gltf' && extension !== 'glb' && extension !== 'stl') {
      alert(t('importFormatError'))
      return
    }

    const url = URL.createObjectURL(file)
    const filePath = (file as any).path

    addObject({
      name: name || 'Unnamed Object',
      fileType: extension as 'gltf' | 'glb' | 'stl',
      filePath,
      url
    })

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const handleTransformChange = (key: keyof Transform3D, val: number) => {
    if (!selectedObject) return
    updateObjectTransform(selectedObject.id, { [key]: val })
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden text-slate-200">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".gltf,.glb,.stl"
        className="hidden"
      />

      {/* Objects List */}
      <div className={`${compact ? 'h-[134px] shrink-0 p-2 space-y-1.5' : 'p-4 space-y-3 flex-1'} thin-scrollbar overflow-y-auto min-h-0`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            {t('deviceList')} ({objects.length})
          </span>
          <button
            onClick={triggerFileInput}
            title={`${t('upload3D')} - ${t('supportFormats')}`}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#2d2d34] bg-[#121214] text-blue-400 transition hover:border-blue-500 hover:bg-[#17171d] hover:text-blue-300 cursor-pointer"
          >
            {compact ? <Plus size={14} /> : <Upload size={14} />}
          </button>
        </div>

        {objects.length === 0 ? (
          <div className={`${compact ? 'py-5' : 'py-8'} text-center text-slate-500 text-xs`}>
            {t('noDevices')}
            <button
              onClick={triggerFileInput}
              className="mx-auto mt-2 block text-[11px] font-semibold text-blue-400 transition hover:text-blue-300 cursor-pointer"
            >
              {t('upload3D')}
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {objects.map((obj) => {
              const isSelected = selectedObject?.id === obj.id
              return (
                <div
                  key={obj.id}
                  onClick={() => setSelectedObjectId(obj.id)}
                  className={`${compact ? 'p-2 rounded' : 'p-2.5 rounded-lg'} border text-left cursor-pointer transition flex justify-between items-center ${
                    isSelected
                      ? 'border-blue-500 bg-blue-950/10'
                      : 'border-[#2d2d34] bg-[#121214] hover:bg-[#18181d]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Settings size={14} className="text-slate-400 shrink-0" />
                    <span className="text-xs font-bold truncate text-white block">
                      {obj.name}
                    </span>
                    <span className="text-[9px] font-bold px-1 py-0.2 bg-[#25252b] text-slate-400 rounded shrink-0">
                      {obj.fileType.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => updateObjectVisibility(obj.id, !obj.visible)}
                      className="p-1 hover:bg-[#2d2d34] rounded text-slate-500 hover:text-slate-300 cursor-pointer"
                    >
                      {obj.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button
                      onClick={() => removeObject(obj.id)}
                      className="p-1 hover:bg-rose-950/30 rounded text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Selected Object Transforms */}
      {selectedObject && (
        <div className={`${compact ? 'h-[212px] shrink-0 overflow-hidden p-2 space-y-1.5' : 'p-4 space-y-4 max-h-[400px] thin-scrollbar overflow-y-auto'} border-t border-[#2d2d34] bg-[#141417]`}>
          <div className="flex justify-between items-center">
            <span className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold text-slate-400 uppercase tracking-wider block`}>
              {t('transform')}
            </span>
            <span className="text-[10px] text-blue-400 font-bold truncate max-w-[150px]">
              {selectedObject.name}
            </span>
          </div>

          {/* Position (x, y, z) */}
          <div className={compact ? 'space-y-0.5' : 'space-y-2'}>
            <span className={`${compact ? 'text-[10px] leading-none whitespace-nowrap' : 'text-[11px]'} font-bold text-slate-400 block`}>
              {compact ? 'Vị trí (mm)' : t('position')}
            </span>
            <div className={`grid grid-cols-3 ${compact ? 'gap-1.5' : 'gap-2'}`}>
              <div>
                <span className="text-[9px] text-red-400 block font-mono">X (mm)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={selectedObject.transform.x}
                  onChange={(e) => handleTransformChange('x', parseFloat(e.target.value) || 0)}
                  className={`${compact ? 'h-7 p-0.5' : 'p-1'} w-full bg-[#1e1e24] border border-[#2d2d34] rounded text-xs font-mono font-bold text-white text-center outline-none`}
                />
              </div>
              <div>
                <span className="text-[9px] text-emerald-400 block font-mono">Y (mm)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={selectedObject.transform.y}
                  onChange={(e) => handleTransformChange('y', parseFloat(e.target.value) || 0)}
                  className={`${compact ? 'h-7 p-0.5' : 'p-1'} w-full bg-[#1e1e24] border border-[#2d2d34] rounded text-xs font-mono font-bold text-white text-center outline-none`}
                />
              </div>
              <div>
                <span className="text-[9px] text-blue-400 block font-mono">Z (mm)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={selectedObject.transform.z}
                  onChange={(e) => handleTransformChange('z', parseFloat(e.target.value) || 0)}
                  className={`${compact ? 'h-7 p-0.5' : 'p-1'} w-full bg-[#1e1e24] border border-[#2d2d34] rounded text-xs font-mono font-bold text-white text-center outline-none`}
                />
              </div>
            </div>
          </div>

          {/* Rotation (rx, ry, rz) */}
          <div className={compact ? 'space-y-0.5' : 'space-y-2'}>
            <span className={`${compact ? 'text-[10px] leading-none whitespace-nowrap' : 'text-[11px]'} font-bold text-slate-400 block`}>
              {compact ? 'Góc xoay (°)' : t('rotation')}
            </span>
            <div className={`grid grid-cols-3 ${compact ? 'gap-1.5' : 'gap-2'}`}>
              <div>
                <span className="text-[9px] text-red-300 block font-mono">Rx (°)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={selectedObject.transform.rx}
                  onChange={(e) => handleTransformChange('rx', parseFloat(e.target.value) || 0)}
                  className={`${compact ? 'h-7 p-0.5' : 'p-1'} w-full bg-[#1e1e24] border border-[#2d2d34] rounded text-xs font-mono font-bold text-white text-center outline-none`}
                />
              </div>
              <div>
                <span className="text-[9px] text-emerald-300 block font-mono">Ry (°)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={selectedObject.transform.ry}
                  onChange={(e) => handleTransformChange('ry', parseFloat(e.target.value) || 0)}
                  className={`${compact ? 'h-7 p-0.5' : 'p-1'} w-full bg-[#1e1e24] border border-[#2d2d34] rounded text-xs font-mono font-bold text-white text-center outline-none`}
                />
              </div>
              <div>
                <span className="text-[9px] text-blue-300 block font-mono">Rz (°)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={selectedObject.transform.rz}
                  onChange={(e) => handleTransformChange('rz', parseFloat(e.target.value) || 0)}
                  className={`${compact ? 'h-7 p-0.5' : 'p-1'} w-full bg-[#1e1e24] border border-[#2d2d34] rounded text-xs font-mono font-bold text-white text-center outline-none`}
                />
              </div>
            </div>
          </div>

          {/* Scale (sx, sy, sz) */}
          <div className={compact ? 'space-y-0.5' : 'space-y-2'}>
            <span className={`${compact ? 'text-[10px] leading-none whitespace-nowrap' : 'text-[11px]'} font-bold text-slate-400 block`}>
              {compact ? 'Tỉ lệ' : t('scale')}
            </span>
            <div className={`grid grid-cols-3 ${compact ? 'gap-1.5' : 'gap-2'}`}>
              <div>
                <span className="text-[9px] text-slate-500 block font-mono">Sx</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={selectedObject.transform.sx}
                  onChange={(e) => handleTransformChange('sx', parseFloat(e.target.value) || 1)}
                  className={`${compact ? 'h-7 p-0.5' : 'p-1'} w-full bg-[#1e1e24] border border-[#2d2d34] rounded text-xs font-mono font-bold text-white text-center outline-none`}
                />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block font-mono">Sy</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={selectedObject.transform.sy}
                  onChange={(e) => handleTransformChange('sy', parseFloat(e.target.value) || 1)}
                  className={`${compact ? 'h-7 p-0.5' : 'p-1'} w-full bg-[#1e1e24] border border-[#2d2d34] rounded text-xs font-mono font-bold text-white text-center outline-none`}
                />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block font-mono">Sz</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={selectedObject.transform.sz}
                  onChange={(e) => handleTransformChange('sz', parseFloat(e.target.value) || 1)}
                  className={`${compact ? 'h-7 p-0.5' : 'p-1'} w-full bg-[#1e1e24] border border-[#2d2d34] rounded text-xs font-mono font-bold text-white text-center outline-none`}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
