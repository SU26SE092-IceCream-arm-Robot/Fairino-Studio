import type { WorkflowStep } from '../../types/robot.types'

export interface IceBotArtifactSidecar {
  schemaVersion: 1
  artifactCode: string
  artifactFileName: string
  runtimeTargetCode: 'FAIRINO_LUA_V1'
  machineModelCode: 'FR5'
  effects: IceBotArtifactEffect[]
  orderingConstraints: IceBotArtifactOrderingConstraint[]
}

export interface IceBotArtifactEffect {
  effectCode: string
  effectKind: 'System' | 'Motion'
  quantityMode: 'None'
}

export interface IceBotArtifactOrderingConstraint {
  constraintType: 'Phase'
  value: string
  sortHint: number
}

export function createIceBotArtifactSidecar(
  step: WorkflowStep,
  fileName: string,
  runOrder: number
): IceBotArtifactSidecar {
  const artifactCode = sanitizeCode(fileName.replace(/\.lua$/i, ''))
  return {
    schemaVersion: 1,
    artifactCode,
    artifactFileName: fileName,
    runtimeTargetCode: 'FAIRINO_LUA_V1',
    machineModelCode: 'FR5',
    effects: [
      {
        effectCode: `${artifactCode}_EXECUTE`,
        effectKind: isMotion(step) ? 'Motion' : 'System',
        quantityMode: 'None'
      }
    ],
    orderingConstraints: [
      {
        constraintType: 'Phase',
        value: inferPhase(step),
        sortHint: runOrder
      }
    ]
  }
}

function isMotion(step: WorkflowStep): boolean {
  return ['MoveJ', 'MoveL', 'RotateJoint', 'MoveTCP'].includes(step.type)
}

function inferPhase(step: WorkflowStep): string {
  const text = `${step.type} ${step.label}`.toUpperCase()
  if (text.includes('HOME') || text.includes('PREPARE')) return 'PREPARE'
  if (text.includes('DELIVER') || text.includes('RETURN')) return 'DELIVER'
  if (text.includes('CLEAN')) return 'CLEANUP'
  if (text.includes('TOPPING') || text.includes('OPTION')) return 'OPTION'
  return 'BASE'
}

function sanitizeCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase()
}
