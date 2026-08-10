import type { IceBotDeclaredEffect, WorkflowStep } from '../../types/robot.types'

export interface IceBotArtifactSidecar {
  schemaVersion: 1 | 2
  artifactCode: string
  artifactFileName: string
  runtimeTargetCode: 'FAIRINO_LUA_V1'
  machineModelCode: 'FR5'
  effects: IceBotArtifactEffect[]
  orderingConstraints: IceBotArtifactOrderingConstraint[]
}

export interface IceBotArtifactEffect {
  effectCode: string
  effectKind: 'System' | 'Motion' | 'Ingredient' | 'Option'
  ingredientCode?: string
  optionCode?: string
  quantityMode: 'None' | 'FixedInArtifact'
  fixedQuantity?: number
  unit?: string
  requiredWorkcellCapabilityCode?: string
}

export interface IceBotArtifactOrderingConstraint {
  constraintType: 'Phase' | 'BeforeEffect' | 'AfterEffect'
  value: string
  sortHint: number
}

export function createIceBotArtifactSidecar(
  steps: WorkflowStep[],
  fileName: string,
  runOrder: number
): IceBotArtifactSidecar {
  if (steps.length === 0) throw new Error('An IceBot artifact must contain at least one workflow step.')

  const artifactCode = sanitizeCode(fileName.replace(/\.lua$/i, ''))
  const declaredSemantics = steps.flatMap((step) => step.icebotSemantics ? [step.icebotSemantics] : [])
  if (declaredSemantics.length > 0) {
    const phases = [...new Set(declaredSemantics.map((semantics) => semantics.phase))]
    if (phases.length > 1)
      throw new Error('Workflow steps exported into one Lua artifact must use the same IceBot phase.')

    const effects = declaredSemantics.flatMap((semantics) => semantics.effects)
    const beforeEffectCodes = declaredSemantics.flatMap((semantics) => semantics.beforeEffectCodes ?? [])
    const afterEffectCodes = declaredSemantics.flatMap((semantics) => semantics.afterEffectCodes ?? [])
    validateSemantics(effects, beforeEffectCodes, afterEffectCodes)
    return {
      schemaVersion: 2,
      artifactCode,
      artifactFileName: fileName,
      runtimeTargetCode: 'FAIRINO_LUA_V1',
      machineModelCode: 'FR5',
      effects: effects.map(normalizeEffect),
      orderingConstraints: [
        { constraintType: 'Phase', value: phases[0], sortHint: runOrder },
        ...beforeEffectCodes.map((value) => ({
          constraintType: 'BeforeEffect' as const,
          value: sanitizeCode(value),
          sortHint: runOrder
        })),
        ...afterEffectCodes.map((value) => ({
          constraintType: 'AfterEffect' as const,
          value: sanitizeCode(value),
          sortHint: runOrder
        }))
      ]
    }
  }
  return {
    schemaVersion: 1,
    artifactCode,
    artifactFileName: fileName,
    runtimeTargetCode: 'FAIRINO_LUA_V1',
    machineModelCode: 'FR5',
    effects: [],
    orderingConstraints: []
  }
}

function validateSemantics(
  effects: IceBotDeclaredEffect[],
  beforeEffectCodes?: string[],
  afterEffectCodes?: string[]
): void {
  const codes = effects.map((effect) => sanitizeCode(effect.effectCode))
  if (codes.some((code) => !code) || new Set(codes).size !== codes.length)
    throw new Error('IceBot effect codes must be non-empty and unique within one artifact.')
  for (const effect of effects) {
    if (effect.effectKind === 'Ingredient' && !sanitizeCode(effect.ingredientCode ?? ''))
      throw new Error(`Ingredient effect ${effect.effectCode} requires an ingredient code.`)
    if (effect.effectKind === 'Option' && !sanitizeCode(effect.optionCode ?? ''))
      throw new Error(`Option effect ${effect.effectCode} requires an option code.`)
    if ((effect.effectKind === 'System' || effect.effectKind === 'Motion') &&
      (effect.ingredientCode?.trim() || effect.optionCode?.trim()))
      throw new Error(`System or motion effect ${effect.effectCode} cannot declare ingredient or option codes.`)
    if ((effect.effectKind === 'System' || effect.effectKind === 'Motion') && effect.quantityMode !== 'None')
      throw new Error(`System or motion effect ${effect.effectCode} cannot declare a production quantity.`)
    if (effect.quantityMode === 'FixedInArtifact' &&
      (!(effect.fixedQuantity && effect.fixedQuantity > 0) || !effect.unit?.trim()))
      throw new Error(`Fixed quantity effect ${effect.effectCode} requires a positive quantity and unit.`)
    if (effect.quantityMode === 'None' && (effect.fixedQuantity !== undefined || effect.unit?.trim()))
      throw new Error(`Effect ${effect.effectCode} cannot declare quantity fields when quantity mode is None.`)
  }
  const orderingTargets = [...(beforeEffectCodes ?? []), ...(afterEffectCodes ?? [])]
  if (orderingTargets.some((code) => !sanitizeCode(code)))
    throw new Error('IceBot before/after effect codes must be non-empty.')
}

function normalizeEffect(effect: IceBotDeclaredEffect): IceBotArtifactEffect {
  const value: IceBotArtifactEffect = {
    effectCode: sanitizeCode(effect.effectCode),
    effectKind: effect.effectKind,
    quantityMode: effect.quantityMode
  }
  if (effect.ingredientCode?.trim()) value.ingredientCode = sanitizeCode(effect.ingredientCode)
  if (effect.optionCode?.trim()) value.optionCode = sanitizeCode(effect.optionCode)
  if (effect.quantityMode === 'FixedInArtifact') {
    value.fixedQuantity = effect.fixedQuantity
    value.unit = effect.unit?.trim().toLowerCase()
  }
  if (effect.requiredWorkcellCapabilityCode?.trim())
    value.requiredWorkcellCapabilityCode = sanitizeCode(effect.requiredWorkcellCapabilityCode)
  return value
}

function sanitizeCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()
}
