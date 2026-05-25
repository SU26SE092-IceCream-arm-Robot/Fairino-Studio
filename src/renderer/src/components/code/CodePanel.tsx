import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { useRobotStore } from '../../store/robotStore'
import { generateLua } from '../../engine/codegen/luaCodegen'
import { Code, Copy, Check } from 'lucide-react'

export default function CodePanel() {
  const steps = useRobotStore((state) => state.steps)
  const projectName = useRobotStore((state) => state.projectName)
  const [luaCode, setLuaCode] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const code = generateLua(steps, projectName)
    setCodeText(code)
  }, [steps, projectName])

  const setCodeText = (code: string) => {
    setLuaCode(code)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(luaCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="h-full w-full bg-[#1e1e24] border-t border-[#2d2d34] flex flex-col text-slate-200">
      {/* Code Header Bar */}
      <div className="h-9 px-4 bg-[#141417] border-b border-[#2d2d34] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <Code size={14} className="text-blue-500" />
          <span>Fairino LUA Script Preview</span>
          <span className="text-[10px] text-slate-500 font-normal">(Cập nhật thời gian thực)</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#25252b] hover:bg-[#2e2e36] text-[10px] border border-[#393942] transition"
        >
          {copied ? (
            <>
              <Check size={10} className="text-emerald-500" />
              <span className="text-emerald-500">Đã sao chép</span>
            </>
          ) : (
            <>
              <Copy size={10} />
              <span>Sao chép</span>
            </>
          )}
        </button>
      </div>

      {/* Editor Container */}
      <div className="flex-1 min-h-0 w-full relative">
        <Editor
          height="100%"
          language="lua"
          theme="vs-dark"
          value={luaCode}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: "Fira Code, Monaco, Menlo, Consolas, monospace",
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 8 }
          }}
          loading={
            <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs bg-[#1e1e24]">
              Đang tải Monaco Editor...
            </div>
          }
        />
      </div>
    </div>
  )
}
