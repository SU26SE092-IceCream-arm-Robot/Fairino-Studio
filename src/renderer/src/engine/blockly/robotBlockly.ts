import * as Blockly from 'blockly/core'
import { TCPPose, WorkflowStep, SimpleModuleTemplate, SimpleWorkflowTemplate } from '../../types/robot.types'

export interface RobotBlocklyLabels {
  moveAB: string
  fromA: string
  toB: string
  unset: string
  speed: string
  acc: string
  delay: string
  seconds: string
  setDO: string
  cabinetDO: string
  toolDO: string
  turnOn: string
  turnOff: string
  pickCup: string
  pickCupDescription: string
  workflowSample: string
}

interface MoveBlockData {
  pointA?: TCPPose
  pointB?: TCPPose
}

const DEFAULT_POSE: TCPPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }
const DEFAULT_SPEED = 30
const DEFAULT_ACC = 30

const clonePose = (pose: TCPPose): TCPPose => ({ ...pose })

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const formatPoseSummary = (pose?: TCPPose) => {
  if (!pose) return '--'
  return `${Math.round(pose.x)}, ${Math.round(pose.y)}, ${Math.round(pose.z)}`
}

const parseMoveData = (block: Blockly.Block): MoveBlockData => {
  if (!block.data) return {}
  try {
    return JSON.parse(block.data) as MoveBlockData
  } catch {
    return {}
  }
}

export const writeMovePointToBlock = (block: Blockly.Block, point: 'A' | 'B', pose: TCPPose) => {
  const data = parseMoveData(block)
  if (point === 'A') data.pointA = clonePose(pose)
  if (point === 'B') data.pointB = clonePose(pose)
  block.data = JSON.stringify(data)
  block.getField(`${point}_LABEL`)?.setValue(formatPoseSummary(pose))
}

const readOptionalNumber = (block: Blockly.Block, fieldName: string, fallback: number) => {
  const raw = String(block.getFieldValue(fieldName) ?? '').trim()
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const createMoveBlockState = (
  pointA: TCPPose = DEFAULT_POSE,
  pointB: TCPPose = DEFAULT_POSE,
  labelA = formatPoseSummary(pointA),
  labelB = formatPoseSummary(pointB)
): Blockly.serialization.blocks.State => ({
  type: 'robot_move_ab',
  data: JSON.stringify({ pointA, pointB }),
  fields: {
    A_LABEL: labelA,
    B_LABEL: labelB,
    SPEED: String(DEFAULT_SPEED),
    ACC: String(DEFAULT_ACC)
  }
})

export const createDelayBlockState = (seconds = 1): Blockly.serialization.blocks.State => ({
  type: 'robot_delay',
  fields: { SECONDS: seconds }
})

export const createDoBlockState = (doType: 'cabinet' | 'tool' = 'cabinet', doIndex = 1, doValue: 0 | 1 = 1): Blockly.serialization.blocks.State => ({
  type: 'robot_set_do',
  fields: {
    DO_TYPE: doType,
    DO_INDEX: String(doIndex),
    DO_VALUE: String(doValue)
  }
})

const chainBlocks = (blocks: Blockly.serialization.blocks.State[]) => {
  for (let index = 0; index < blocks.length - 1; index++) {
    blocks[index].next = { block: blocks[index + 1] }
  }
  return blocks[0]
}

export const createPickCupBlockState = () =>
  chainBlocks([
    createMoveBlockState(),
    createDelayBlockState(1),
    createMoveBlockState(DEFAULT_POSE, DEFAULT_POSE, formatPoseSummary(DEFAULT_POSE), formatPoseSummary(DEFAULT_POSE))
  ])

export const createEmptyWorkspaceJson = () => ({
  blocks: {
    languageVersion: 0,
    blocks: []
  }
})

export const createWorkspaceJsonFromBlock = (blockState: Blockly.serialization.blocks.State) => ({
  blocks: {
    languageVersion: 0,
    blocks: [blockState]
  }
})

export const getBuiltinModules = (labels: RobotBlocklyLabels): SimpleModuleTemplate[] => [
  {
    id: 'builtin_pick_cup',
    name: labels.pickCup,
    description: labels.pickCupDescription,
    blocksJson: createPickCupBlockState(),
    previewSteps: [],
    scope: 'builtin'
  }
]

export const getBuiltinWorkflows = (labels: RobotBlocklyLabels): SimpleWorkflowTemplate[] => [
  {
    id: 'builtin_pick_cup_workflow',
    name: labels.workflowSample,
    description: labels.pickCupDescription,
    workspaceJson: createWorkspaceJsonFromBlock(createPickCupBlockState()),
    previewSteps: [],
    scope: 'builtin'
  }
]

export const getRobotToolbox = (labels: RobotBlocklyLabels) => ({
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: labels.workflowSample,
      colour: '#2563eb',
      contents: [
        { kind: 'block', type: 'robot_move_ab' },
        { kind: 'block', type: 'robot_delay' },
        { kind: 'block', type: 'robot_set_do' }
      ]
    }
  ]
})

export const registerRobotBlocks = (labels: RobotBlocklyLabels) => {
  Blockly.Blocks.robot_move_ab = {
    init: function () {
      this.appendDummyInput()
        .appendField('Move A → B')
      this.appendDummyInput()
        .appendField('v')
        .appendField(new Blockly.FieldTextInput(String(DEFAULT_SPEED)), 'SPEED')
        .appendField('a')
        .appendField(new Blockly.FieldTextInput(String(DEFAULT_ACC)), 'ACC')
      this.appendDummyInput()
        .appendField('A')
        .appendField(new Blockly.FieldLabelSerializable(labels.unset), 'A_LABEL')
      this.appendDummyInput()
        .appendField('B')
        .appendField(new Blockly.FieldLabelSerializable(labels.unset), 'B_LABEL')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(210)
      this.setTooltip(labels.pickCupDescription)
    }
  }

  Blockly.Blocks.robot_delay = {
    init: function () {
      this.appendDummyInput()
        .appendField('Delay')
        .appendField(new Blockly.FieldNumber(1, 0, 9999, 0.1), 'SECONDS')
        .appendField('s')
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(145)
    }
  }

  Blockly.Blocks.robot_set_do = {
    init: function () {
      this.appendDummyInput()
        .appendField('DO')
        .appendField(
          new Blockly.FieldDropdown([
            [labels.cabinetDO, 'cabinet'],
            [labels.toolDO, 'tool']
          ]),
          'DO_TYPE'
        )
        .appendField(
          new Blockly.FieldDropdown([
            ['0', '0'],
            ['1', '1'],
            ['2', '2'],
            ['3', '3'],
            ['4', '4'],
            ['5', '5'],
            ['6', '6'],
            ['7', '7'],
            ['8', '8']
          ]),
          'DO_INDEX'
        )
        .appendField(
          new Blockly.FieldDropdown([
            [labels.turnOn, '1'],
            [labels.turnOff, '0']
          ]),
          'DO_VALUE'
        )
      this.setPreviousStatement(true)
      this.setNextStatement(true)
      this.setColour(38)
    }
  }
}

const appendBlockSteps = (block: Blockly.Block | null, steps: WorkflowStep[]) => {
  let current = block
  while (current) {
    const base = {
      id: createId('step_blockly'),
      speed: DEFAULT_SPEED,
      acc: DEFAULT_ACC
    }

    if (current.type === 'robot_move_ab') {
      const data = parseMoveData(current)
      const pointA = data.pointA ?? DEFAULT_POSE
      const pointB = data.pointB ?? DEFAULT_POSE
      const speed = readOptionalNumber(current, 'SPEED', DEFAULT_SPEED)
      const acc = readOptionalNumber(current, 'ACC', DEFAULT_ACC)
      steps.push({
        ...base,
        type: 'MoveL',
        label: 'Move A',
        tcpPose: clonePose(pointA),
        speed,
        acc
      })
      steps.push({
        ...base,
        id: createId('step_blockly'),
        type: 'MoveL',
        label: 'Move B',
        tcpPose: clonePose(pointB),
        speed,
        acc
      })
    }

    if (current.type === 'robot_delay') {
      const seconds = readOptionalNumber(current, 'SECONDS', 1)
      steps.push({
        ...base,
        type: 'WaitMs',
        label: `Wait ${seconds}s`,
        delayMs: Math.round(seconds * 1000),
        speed: 0,
        acc: 0
      })
    }

    if (current.type === 'robot_set_do') {
      const doType = current.getFieldValue('DO_TYPE') === 'tool' ? 'tool' : 'cabinet'
      const rawIndex = Number(current.getFieldValue('DO_INDEX') ?? 1)
      const doIndex = doType === 'tool'
        ? Math.min(1, Math.max(0, rawIndex))
        : Math.min(8, Math.max(1, rawIndex))
      const doValue = Number(current.getFieldValue('DO_VALUE') ?? 1) === 0 ? 0 : 1
      steps.push({
        ...base,
        type: 'SetDO',
        label: `${doType === 'tool' ? 'Tool DO' : 'DO'} ${doIndex} ${doValue === 1 ? 'ON' : 'OFF'}`,
        doType,
        doIndex,
        doValue,
        speed: 0,
        acc: 0
      })
    }

    current = current.nextConnection?.targetBlock() ?? null
  }
}

export const workspaceToWorkflowSteps = (workspace: Blockly.WorkspaceSvg): WorkflowStep[] => {
  const steps: WorkflowStep[] = []
  workspace.getTopBlocks(true).forEach((block) => appendBlockSteps(block, steps))
  return steps
}

export const blockStateToWorkflowSteps = (blockState: Blockly.serialization.blocks.State): WorkflowStep[] => {
  const tempWorkspace = new Blockly.Workspace()
  const block = Blockly.serialization.blocks.append(blockState, tempWorkspace)
  const steps: WorkflowStep[] = []
  appendBlockSteps(block, steps)
  tempWorkspace.dispose()
  return steps
}

export const stepsToWorkspaceJson = (steps: WorkflowStep[]) => {
  const blocks: Blockly.serialization.blocks.State[] = []

  for (let index = 0; index < steps.length; index++) {
    const step = steps[index]
    if (step.type === 'MoveL' && step.tcpPose) {
      const next = steps[index + 1]
      if (next?.type === 'MoveL' && next.tcpPose) {
        blocks.push(createMoveBlockState(step.tcpPose, next.tcpPose))
        index++
      } else {
        blocks.push(createMoveBlockState(step.tcpPose, step.tcpPose))
      }
      continue
    }

    if (step.type === 'WaitMs') {
      blocks.push(createDelayBlockState((step.delayMs ?? 1000) / 1000))
      continue
    }

    if (step.type === 'SetDO') {
      blocks.push(createDoBlockState(step.doType ?? 'cabinet', step.doIndex ?? 1, step.doValue ?? 1))
    }
  }

  return {
    blocks: {
      languageVersion: 0,
      blocks
    }
  }
}
