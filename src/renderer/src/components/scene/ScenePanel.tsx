import React, { useRef } from 'react'
import { useSceneStore } from '../../store/sceneStore'
import { Trash2, Eye, EyeOff, Upload, Settings } from 'lucide-react'
import { Transform3D } from '../../types/scene.types'

export default function ScenePanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const objects = useSceneStore((state) => state.objects)
  const addObject = useSceneStore((state) => state.addObject)
  const removeObject = useSceneStore((state) => state.removeObject)
  const updateObjectTransform = useSceneStore((state) => state.updateObjectTransform)
  const updateObjectVisibility = useSceneStore((state) => state.updateObjectVisibility)
  const selectedObjectId = useSceneStore((state) => state.selectedObjectId)
  const setSelectedObjectId = useSceneStore((state) => state.setSelectedObjectId)

  const selectedObject = objects.find((o) => o.id === selectedObjectId)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const name = file.name.split('.').slice(0, -1).join('.')
    const extension = file.name.split('.').pop()?.toLowerCase()
    
    if (extension !== 'gltf' && extension !== 'glb' && extension !== 'stl') {
      alert('Chỉ hỗ trợ import file .gltf, .glb hoặc .stl!')
      return
    }

    // Create Object URL for loading in Three.js
    const url = URL.createObjectURL(file)
    const filePath = (file as any).path // Electron absolute path if available

    addObject({
      name: name || 'Unnamed Object',
      fileType: extension as 'gltf' | 'glb' | 'stl',
      filePath,
      url
    })

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const handleTransformChange = (key: keyof Transform3D, val: number) => {
    if (!selectedObjectId) return
    updateObjectTransform(selectedObjectId, { [key]: val })
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 text-slate-200">
      {/* Import Button / Dropzone */}
      <div className="p-4 border-b border-[#2d2d34]">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".gltf,.glb,.stl"
          className="hidden"
        />
        <button
          onClick={triggerFileInput}
          className="w-full py-4 border border-dashed border-[#3a3a45] hover:border-blue-500 rounded-lg flex flex-col items-center justify-center gap-2 bg-[#121214] hover:bg-[#15151a] transition text-xs font-semibold text-slate-300 hover:text-white"
        >
          <Upload size={20} className="text-blue-500" />
          Tải lên Thiết bị 3D
          <span className="text-[10px] text-slate-500 font-normal">Hỗ trợ GLTF, GLB, STL</span>
        </button>
      </div>

      {/* Objects List */}
      <div className="p-4 flex-1 overflow-y-auto space-y-3 min-h-0">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
          Danh sách thiết bị ({objects.length})
        </span>

        {objects.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            Chưa có thiết bị phụ trợ nào được thêm vào.
          </div>
        ) : (
          <div className="space-y-1.5">
            {objects.map((obj) => {
              const isSelected = selectedObjectId === obj.id
              return (
                <div
                  key={obj.id}
                  onClick={() => setSelectedObjectId(obj.id)}
                  className={`p-2.5 rounded-lg border text-left cursor-pointer transition flex justify-between items-center ${
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
                      className="p-1 hover:bg-[#2d2d34] rounded text-slate-500 hover:text-slate-300"
                    >
                      {obj.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                    <button
                      onClick={() => removeObject(obj.id)}
                      className="p-1 hover:bg-rose-950/30 rounded text-slate-500 hover:text-rose-400"
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
        <div className="p-4 border-t border-[#2d2d34] bg-[#141417] space-y-4 max-h-[400px] overflow-y-auto">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
              Biến đổi (Transform)
            </span>
            <span className="text-[10px] text-blue-400 font-bold truncate max-w-[150px]">
              {selectedObject.name}
            </span>
          </div>

          {/* Position (x, y, z) */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 block">Vị trí (XYZ - mm)</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[9px] text-red-400 block font-mono">X (mm)</span>
                <input
                  type="number"
                  value={selectedObject.transform.x}
                  onChange={(e) => handleTransformChange('x', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1e1e24] border border-[#2d2d34] rounded p-1 text-xs font-mono font-bold text-white text-center"
                />
              </div>
              <div>
                <span className="text-[9px] text-emerald-400 block font-mono">Y (mm)</span>
                <input
                  type="number"
                  value={selectedObject.transform.y}
                  onChange={(e) => handleTransformChange('y', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1e1e24] border border-[#2d2d34] rounded p-1 text-xs font-mono font-bold text-white text-center"
                />
              </div>
              <div>
                <span className="text-[9px] text-blue-400 block font-mono">Z (mm)</span>
                <input
                  type="number"
                  value={selectedObject.transform.z}
                  onChange={(e) => handleTransformChange('z', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1e1e24] border border-[#2d2d34] rounded p-1 text-xs font-mono font-bold text-white text-center"
                />
              </div>
            </div>
          </div>

          {/* Rotation (rx, ry, rz) */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 block">Góc xoay (RxRyRz - độ)</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[9px] text-red-300 block font-mono">Rx (°)</span>
                <input
                  type="number"
                  value={selectedObject.transform.rx}
                  onChange={(e) => handleTransformChange('rx', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1e1e24] border border-[#2d2d34] rounded p-1 text-xs font-mono font-bold text-white text-center"
                />
              </div>
              <div>
                <span className="text-[9px] text-emerald-300 block font-mono">Ry (°)</span>
                <input
                  type="number"
                  value={selectedObject.transform.ry}
                  onChange={(e) => handleTransformChange('ry', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1e1e24] border border-[#2d2d34] rounded p-1 text-xs font-mono font-bold text-white text-center"
                />
              </div>
              <div>
                <span className="text-[9px] text-blue-300 block font-mono">Rz (°)</span>
                <input
                  type="number"
                  value={selectedObject.transform.rz}
                  onChange={(e) => handleTransformChange('rz', parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#1e1e24] border border-[#2d2d34] rounded p-1 text-xs font-mono font-bold text-white text-center"
                />
              </div>
            </div>
          </div>

          {/* Scale (sx, sy, sz) */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-slate-400 block">Tỉ lệ (Scale)</span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <span className="text-[9px] text-slate-500 block font-mono">Sx</span>
                <input
                  type="number"
                  value={selectedObject.transform.sx}
                  step="0.1"
                  onChange={(e) => handleTransformChange('sx', parseFloat(e.target.value) || 1)}
                  className="w-full bg-[#1e1e24] border border-[#2d2d34] rounded p-1 text-xs font-mono font-bold text-white text-center"
                />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block font-mono">Sy</span>
                <input
                  type="number"
                  value={selectedObject.transform.sy}
                  step="0.1"
                  onChange={(e) => handleTransformChange('sy', parseFloat(e.target.value) || 1)}
                  className="w-full bg-[#1e1e24] border border-[#2d2d34] rounded p-1 text-xs font-mono font-bold text-white text-center"
                />
              </div>
              <div>
                <span className="text-[9px] text-slate-500 block font-mono">Sz</span>
                <input
                  type="number"
                  value={selectedObject.transform.sz}
                  step="0.1"
                  onChange={(e) => handleTransformChange('sz', parseFloat(e.target.value) || 1)}
                  className="w-full bg-[#1e1e24] border border-[#2d2d34] rounded p-1 text-xs font-mono font-bold text-white text-center"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
