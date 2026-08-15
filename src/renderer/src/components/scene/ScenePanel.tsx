import React, { useRef } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { useRobotStore } from '../../store/robotStore'
import { Trash2, Eye, EyeOff, Upload, Settings, Plus } from 'lucide-react'
import type { CollisionMode, ModelUnit, ToolMountAxis, Transform3D } from '../../types/scene.types'
import { translations } from '../../i18n/translations'

export default function ScenePanel({ compact = false }: { compact?: boolean }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importFile, setImportFile] = React.useState<{
    file: File
    name: string
    extension: string
    modelUnit: ModelUnit
    toolMountAxis: ToolMountAxis
  } | null>(null)
  const objects = useSceneStore((state) => state.objects)
  const addObject = useSceneStore((state) => state.addObject)
  const removeObject = useSceneStore((state) => state.removeObject)
  const updateObjectTransform = useSceneStore((state) => state.updateObjectTransform)
  const updateObjectVisibility = useSceneStore((state) => state.updateObjectVisibility)
  const updateObjectCollisionMode = useSceneStore((state) => state.updateObjectCollisionMode)
  const selectedObjectId = useSceneStore((state) => state.selectedObjectId)
  const setSelectedObjectId = useSceneStore((state) => state.setSelectedObjectId)

  // Language translation helper
  const language = useRobotStore((state) => state.language)
  const t = (key: keyof typeof translations.vi) => translations[language][key]

  const selectedObject = objects.find((o) => o.id === selectedObjectId) ?? objects[0]
  const lengthUnit = useRobotStore((state) => state.lengthUnit) || 'cm'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const name = file.name.split('.').slice(0, -1).join('.')
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    if (extension !== 'gltf' && extension !== 'glb' && extension !== 'stl' && extension !== 'obj') {
      alert(t('importFormatError'))
      return
    }

    const modelUnit: ModelUnit = extension === 'obj' || extension === 'stl' ? 'mm' : 'm'
    setImportFile({ file, name, extension, modelUnit, toolMountAxis: 'auto' })
  }

  const handleConfirmImport = async (isTool: boolean) => {
    if (!importFile) return

    const url = URL.createObjectURL(importFile.file)
    const filePath = (importFile.file as any).path
    let fileData: Uint8Array | undefined
    try {
      const buffer = await importFile.file.arrayBuffer()
      fileData = new Uint8Array(buffer)
    } catch (e) {
      console.warn('Failed to read binary arrayBuffer for 3D object:', e)
    }

    addObject({
      name: importFile.name || 'Unnamed Object',
      fileType: importFile.extension as 'gltf' | 'glb' | 'stl' | 'obj',
      filePath,
      url,
      fileData,
      isTool,
      modelUnit: importFile.modelUnit,
      toolMountAxis: importFile.toolMountAxis
    })

    setImportFile(null)

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
        accept=".gltf,.glb,.stl,.obj"
        className="hidden"
      />

      {/* Import Type Selection Dialog Modal */}
      {importFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-xl border border-[#2d2d34] bg-[#141417] p-5 shadow-2xl animate-in fade-in zoom-in duration-200 text-slate-200">
            <h3 className="text-sm font-bold text-white mb-2">
              {t('importTypeTitle')}
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              {t('importTypeDesc')}
            </p>

            <div className="mb-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('modelUnitTitle')}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(['mm', 'cm', 'm'] as ModelUnit[]).map((unit) => (
                  <button
                    key={unit}
                    type="button"
                    onClick={() => setImportFile((current) => current ? { ...current, modelUnit: unit } : current)}
                    className={`rounded border px-3 py-2 text-xs font-bold uppercase transition cursor-pointer ${
                      importFile.modelUnit === unit
                        ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                        : 'border-[#2d2d34] bg-[#1e1e24] text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}
                  >
                    {unit}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-500">{t('modelUnitDesc')}</p>
            </div>

            <div className="mb-4">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {t('toolAxisTitle')}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['auto', '+x', '-x', '+y', '-y', '+z', '-z'] as ToolMountAxis[]).map((axis) => (
                  <button
                    key={axis}
                    type="button"
                    onClick={() => setImportFile((current) => current ? { ...current, toolMountAxis: axis } : current)}
                    className={`rounded border px-2 py-1.5 text-[10px] font-bold uppercase transition cursor-pointer ${
                      importFile.toolMountAxis === axis
                        ? 'border-blue-500 bg-blue-600/20 text-blue-300'
                        : 'border-[#2d2d34] bg-[#1e1e24] text-slate-400 hover:border-slate-500 hover:text-slate-200'
                    }`}
                  >
                    {axis}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-500">{t('toolAxisDesc')}</p>
            </div>
            
            <div className="space-y-2 mb-6">
              <button
                onClick={() => handleConfirmImport(false)}
                className="w-full p-3 rounded-lg border border-[#2d2d34] bg-[#1e1e24] hover:bg-[#25252d] text-left transition hover:border-blue-500 cursor-pointer block"
              >
                <div className="text-xs font-bold text-white">
                  {t('normalObject')}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {t('normalObjectDesc')}
                </div>
              </button>
              
              <button
                onClick={() => handleConfirmImport(true)}
                className="w-full p-3 rounded-lg border border-[#2d2d34] bg-[#1e1e24] hover:bg-[#25252d] text-left transition hover:border-blue-500 cursor-pointer block"
              >
                <div className="text-xs font-bold text-blue-400">
                  {t('gripperTool')}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {t('gripperToolDesc')}
                </div>
              </button>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setImportFile(null)
                  if (fileInputRef.current) fileInputRef.current.value = ''
                }}
                className="px-4 py-2 rounded bg-transparent hover:bg-slate-800 text-xs font-semibold text-slate-400 transition cursor-pointer"
              >
                {language === 'vi' ? 'Hủy' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className={`${compact ? 'max-h-[290px] overflow-y-auto thin-scrollbar p-2 space-y-1.5' : 'p-4 space-y-4 max-h-[400px] thin-scrollbar overflow-y-auto'} border-t border-[#2d2d34] bg-[#141417]`}>
          <div className="flex justify-between items-center">
            <span className={`${compact ? 'text-[11px]' : 'text-xs'} font-semibold text-slate-400 uppercase tracking-wider block`}>
              {t('transform')}
            </span>
            <span className="text-[10px] text-blue-400 font-bold truncate max-w-[150px]">
              {selectedObject.name}
            </span>
          </div>

          {/* Collision Mode Selection */}
          <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
            <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-bold text-slate-400 block`}>
              {language === 'vi' ? 'Chế độ va chạm' : 'Collision Mode'}
            </span>
            <select
              value={selectedObject.collisionMode || 'strict'}
              onChange={(e) => updateObjectCollisionMode(selectedObject.id, e.target.value as CollisionMode)}
              className="w-full bg-[#1e1e24] border border-[#2d2d34] rounded px-2 py-1 text-xs text-white outline-none focus:border-blue-500 cursor-pointer font-medium"
            >
              <option value="strict">
                {language === 'vi' ? 'Kiểm tra đầy đủ (Strict)' : 'Strict (Full Check)'}
              </option>
              <option value="allow_tool">
                {language === 'vi' ? 'Cho phép đầu gắp vào (Allow Tool Only)' : 'Allow Tool Only'}
              </option>
              <option value="ignore">
                {language === 'vi' ? 'Bỏ qua va chạm (Ignore All)' : 'Ignore All'}
              </option>
            </select>
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

          {/* Actual Size (Length, Width, Height) */}
          {(selectedObject as any).baseSize && (
            <div className="pt-1 border-t border-[#2d2d34] mt-2">
              <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-1">
                {language === 'vi' ? 'Kích thước thực tế' : 'Actual Size'}
              </span>
              <div className="bg-[#121214] p-1.5 rounded border border-[#2d2d34] font-mono text-[11px] text-slate-300 flex justify-around">
                <div className="text-center">
                  <span className="text-slate-500 text-[9px] block uppercase font-bold">{language === 'vi' ? 'Dài' : 'Len'}</span>
                  <span className="font-bold text-blue-400">
                    {(() => {
                      const valMm = (selectedObject as any).baseSize.x * selectedObject.transform.sx
                      if (lengthUnit === 'm') return (valMm / 1000).toFixed(3) + ' m'
                      if (lengthUnit === 'cm') return (valMm / 10).toFixed(1) + ' cm'
                      return valMm.toFixed(0) + ' mm'
                    })()}
                  </span>
                </div>
                <div className="border-r border-[#2d2d34] h-7" />
                <div className="text-center">
                  <span className="text-slate-500 text-[9px] block uppercase font-bold">{language === 'vi' ? 'Rộng' : 'Wid'}</span>
                  <span className="font-bold text-emerald-400">
                    {(() => {
                      const valMm = (selectedObject as any).baseSize.y * selectedObject.transform.sy
                      if (lengthUnit === 'm') return (valMm / 1000).toFixed(3) + ' m'
                      if (lengthUnit === 'cm') return (valMm / 10).toFixed(1) + ' cm'
                      return valMm.toFixed(0) + ' mm'
                    })()}
                  </span>
                </div>
                <div className="border-r border-[#2d2d34] h-7" />
                <div className="text-center">
                  <span className="text-slate-500 text-[9px] block uppercase font-bold">{language === 'vi' ? 'Cao' : 'Hei'}</span>
                  <span className="font-bold text-amber-400">
                    {(() => {
                      const valMm = (selectedObject as any).baseSize.z * selectedObject.transform.sz
                      if (lengthUnit === 'm') return (valMm / 1000).toFixed(3) + ' m'
                      if (lengthUnit === 'cm') return (valMm / 10).toFixed(1) + ' cm'
                      return valMm.toFixed(0) + ' mm'
                    })()}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
