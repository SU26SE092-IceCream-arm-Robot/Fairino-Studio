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
  // Delay parameters
  delayMs?: number;
  // Metadata
  comment?: string;
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
