export interface Transform3D {
  x: number;  // position x (mm)
  y: number;  // position y (mm)
  z: number;  // position z (mm)
  rx: number; // rotation x (degrees)
  ry: number; // rotation y (degrees)
  rz: number; // rotation z (degrees)
  sx: number; // scale x
  sy: number; // scale y
  sz: number; // scale z
}

export type ModelUnit = 'mm' | 'cm' | 'm';
export type ToolMountAxis = 'auto' | '+x' | '-x' | '+y' | '-y' | '+z' | '-z';
export type CollisionMode = 'strict' | 'allow_tool' | 'ignore';

export interface SceneObject {
  id: string;
  name: string;
  fileType: 'gltf' | 'glb' | 'stl' | 'obj';
  filePath?: string; // absolute path in Electron
  url: string;       // ObjectURL for active rendering
  transform: Transform3D;
  visible: boolean;
  baseSize?: { x: number; y: number; z: number };
  isTool?: boolean;  // true if it is an end-effector tool
  modelUnit: ModelUnit;
  toolMountAxis: ToolMountAxis;
  collisionMode?: CollisionMode;
}
