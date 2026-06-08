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
  | 'Comment';

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
  simpleBlockRole?: 'moveA' | 'moveB';
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
