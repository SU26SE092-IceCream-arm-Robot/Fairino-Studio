// Types for FaiRobot Studio

export type JointAngles = [number, number, number, number, number, number]; // in degrees

export interface TCPPose {
  x: number;   // mm
  y: number;   // mm
  z: number;   // mm
  rx: number;  // degrees
  ry: number;  // degrees
  rz: number;  // degrees
}

export type StepType =
  | 'MoveJ'
  | 'MoveL'
  | 'GripperOpen'
  | 'GripperClose'
  | 'SetDO'
  | 'WaitMs'
  | 'RotateJoint'
  | 'MoveTCP'
  | 'Comment'
  | 'TriggerDevice';

export type IceBotEffectKind = 'System' | 'Motion' | 'Ingredient' | 'Option'
export type IceBotQuantityMode = 'None' | 'FixedInArtifact'
export type IceBotExecutionPhase = 'PREPARE' | 'BASE' | 'OPTION' | 'DELIVER' | 'CLEANUP'

export interface IceBotDeclaredEffect {
  effectCode: string
  effectKind: IceBotEffectKind
  ingredientCode?: string
  optionCode?: string
  quantityMode: IceBotQuantityMode
  fixedQuantity?: number
  unit?: string
  requiredWorkcellCapabilityCode?: string
}

export interface IceBotStepSemantics {
  phase: IceBotExecutionPhase
  effects: IceBotDeclaredEffect[]
  beforeEffectCodes?: string[]
  afterEffectCodes?: string[]
}

export interface WorkflowStep {
  id: string;
  type: StepType;
  label: string;
  // Motion parameters
  jointAngles?: JointAngles;
  tcpPose?: TCPPose;
  speed: number; // 1-100%
  acc: number;   // 1-100%
  // IO parameters
  doIndex?: number;
  doValue?: 0 | 1;
  doType?: 'cabinet' | 'tool';
  // External Device Trigger parameters
  targetObjectId?: string;
  targetObjectName?: string;
  deviceCommand?: 'ON' | 'OFF';
  deviceValue?: number | string;
  // Delay parameters
  delayMs?: number;
  // Low-code Scratch parameters
  jointIndex?: number;              // 1-6
  rotateMode?: 'absolute' | 'relative';
  angle?: number;                   // degrees
  tcpAxis?: 'X' | 'Y' | 'Z';
  moveMode?: 'absolute' | 'relative';
  distance?: number;                // mm
  // Metadata
  comment?: string;
  simpleBlockId?: string;
  simpleBlockRole?: 'moveA' | 'moveB' | 'loopA' | 'loopB';
  loopType?: 'cycles' | 'seconds';
  loopValue?: number;
  // Explicit IceBot production semantics. Never inferred from the display label.
  icebotSemantics?: IceBotStepSemantics;
}

export type SimpleLibraryScope = 'project' | 'app' | 'builtin';

export interface SimpleModuleTemplate {
  id: string;
  name: string;
  description?: string;
  blocksJson: unknown;
  previewSteps: WorkflowStep[];
  scope: SimpleLibraryScope;
}

export interface SimpleWorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  workspaceJson: unknown;
  previewSteps: WorkflowStep[];
  scope: SimpleLibraryScope;
}

export interface SimpleBlockLibrary {
  modules: SimpleModuleTemplate[];
  workflows: SimpleWorkflowTemplate[];
}

export interface RobotModelConfig {
  name: string;
  payload: number; // kg
  reach: number;   // mm
  jointLimits: {
    min: JointAngles;
    max: JointAngles;
  };
}
