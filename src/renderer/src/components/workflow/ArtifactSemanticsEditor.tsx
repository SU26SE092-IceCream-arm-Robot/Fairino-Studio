import { Braces, Plus, Trash2 } from 'lucide-react'
import type { JSX } from 'react'
import { useRobotStore } from '../../store/robotStore'
import type { IceBotDeclaredEffect, IceBotExecutionPhase } from '../../types/robot.types'

const phases: IceBotExecutionPhase[] = ['PREPARE', 'BASE', 'OPTION', 'DELIVER', 'CLEANUP']

export default function ArtifactSemanticsEditor(): JSX.Element | null {
  const selectedStepId = useRobotStore((state) => state.selectedStepId)
  const step = useRobotStore((state) => state.steps.find((item) => item.id === selectedStepId))
  const updateStep = useRobotStore((state) => state.updateStep)
  if (!step) return null

  const semantics = step.icebotSemantics ?? { phase: 'BASE' as const, effects: [] }
  const update = (next: typeof semantics): void => updateStep(step.id, { icebotSemantics: next })
  const updateEffect = (index: number, changes: Partial<IceBotDeclaredEffect>): void =>
    update({ ...semantics, effects: semantics.effects.map((effect, i) => i === index ? { ...effect, ...changes } : effect) })
  const changeEffectKind = (index: number, effect: IceBotDeclaredEffect,
    effectKind: IceBotDeclaredEffect['effectKind']): void => {
    updateEffect(index, {
      effectKind,
      ingredientCode: effectKind === 'Ingredient' || effectKind === 'Option' ? effect.ingredientCode : undefined,
      optionCode: effectKind === 'Ingredient' || effectKind === 'Option' ? effect.optionCode : undefined,
      quantityMode: effectKind === 'Ingredient' || effectKind === 'Option' ? effect.quantityMode : 'None',
      fixedQuantity: effectKind === 'Ingredient' || effectKind === 'Option' ? effect.fixedQuantity : undefined,
      unit: effectKind === 'Ingredient' || effectKind === 'Option' ? effect.unit : undefined
    })
  }

  return (
    <details className="border-b border-[#2d2d34] bg-[#17171b]" onClick={(event) => event.stopPropagation()}>
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-[11px] font-semibold text-slate-300">
        <Braces size={12} /> IceBot artifact semantics
        <span className="ml-auto text-[9px] text-slate-500">V{semantics.effects.length ? '2' : '1'}</span>
      </summary>
      <div className="max-h-72 space-y-2 overflow-y-auto px-4 pb-3">
        <div className="grid grid-cols-2 gap-2">
          <select value={semantics.phase} onChange={(event) => update({ ...semantics, phase: event.target.value as IceBotExecutionPhase })}
            className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white">
            {phases.map((phase) => <option key={phase}>{phase}</option>)}
          </select>
          <button type="button" onClick={() => update({ ...semantics, effects: [...semantics.effects, newEffect(step.type, step.id, semantics.effects.length)] })}
            className="flex items-center justify-center gap-1 rounded border border-white/10 bg-[#25252b] px-2 py-1 text-[10px] text-slate-200">
            <Plus size={10} /> Effect
          </button>
        </div>
        {semantics.effects.map((effect, index) => (
          <div key={index} className="space-y-1 border-l-2 border-blue-600/60 pl-2">
            <div className="flex gap-1">
              <input value={effect.effectCode} onChange={(event) => updateEffect(index, { effectCode: event.target.value })}
                placeholder="EFFECT_CODE" className="min-w-0 flex-1 rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" />
              <select value={effect.effectKind} onChange={(event) => changeEffectKind(index, effect, event.target.value as IceBotDeclaredEffect['effectKind'])}
                className="rounded border border-white/10 bg-black/40 px-1 text-[10px] text-white">
                {['System', 'Motion', 'Ingredient', 'Option'].map((kind) => <option key={kind}>{kind}</option>)}
              </select>
              <button type="button" onClick={() => update({ ...semantics, effects: semantics.effects.filter((_, i) => i !== index) })}
                className="p-1 text-slate-500 hover:text-rose-400"><Trash2 size={11} /></button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {(effect.effectKind === 'Ingredient' || effect.effectKind === 'Option') && <input value={effect.ingredientCode ?? ''} onChange={(event) => updateEffect(index, { ingredientCode: event.target.value || undefined })}
                placeholder="Ingredient code" className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" />}
              {(effect.effectKind === 'Ingredient' || effect.effectKind === 'Option') && <input value={effect.optionCode ?? ''} onChange={(event) => updateEffect(index, { optionCode: event.target.value || undefined })}
                placeholder="Option code" className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" />}
              {(effect.effectKind === 'Ingredient' || effect.effectKind === 'Option') && <select value={effect.quantityMode} onChange={(event) => updateEffect(index, {
                quantityMode: event.target.value as IceBotDeclaredEffect['quantityMode'],
                fixedQuantity: event.target.value === 'FixedInArtifact' ? effect.fixedQuantity : undefined,
                unit: event.target.value === 'FixedInArtifact' ? effect.unit : undefined
              })}
                className="rounded border border-white/10 bg-black/40 px-1 py-1 text-[10px] text-white">
                <option>None</option><option>FixedInArtifact</option>
              </select>}
              <input value={effect.requiredWorkcellCapabilityCode ?? ''}
                onChange={(event) => updateEffect(index, { requiredWorkcellCapabilityCode: event.target.value || undefined })}
                placeholder="Capability" className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" />
              {(effect.effectKind === 'Ingredient' || effect.effectKind === 'Option') && effect.quantityMode === 'FixedInArtifact' && <>
                <input type="number" min="0" step="any" value={effect.fixedQuantity ?? ''}
                  onChange={(event) => updateEffect(index, { fixedQuantity: event.target.value ? Number(event.target.value) : undefined })}
                  placeholder="Quantity" className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" />
                <input value={effect.unit ?? ''} onChange={(event) => updateEffect(index, { unit: event.target.value || undefined })}
                  placeholder="Unit" className="rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" />
              </>}
            </div>
          </div>
        ))}
        <input value={(semantics.beforeEffectCodes ?? []).join(', ')}
          onChange={(event) => update({ ...semantics, beforeEffectCodes: splitCodes(event.target.value) })}
          placeholder="Before effect codes" className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" />
        <input value={(semantics.afterEffectCodes ?? []).join(', ')}
          onChange={(event) => update({ ...semantics, afterEffectCodes: splitCodes(event.target.value) })}
          placeholder="After effect codes" className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white" />
      </div>
    </details>
  )
}

function newEffect(stepType: string, stepId: string, effectIndex: number): IceBotDeclaredEffect {
  return {
    effectCode: `${stepType}_${stepId.slice(-8)}_${effectIndex + 1}_EXECUTE`,
    effectKind: ['MoveJ', 'MoveL', 'RotateJoint', 'MoveTCP'].includes(stepType) ? 'Motion' : 'System',
    quantityMode: 'None'
  }
}

function splitCodes(value: string): string[] | undefined {
  const values = value.split(',').map((item) => item.trim()).filter(Boolean)
  return values.length ? values : undefined
}
