import { create } from 'zustand'
import {
  JointAngles,
  SimpleModuleTemplate,
  SimpleWorkflowTemplate,
  TCPPose,
  WorkflowStep
} from '../types/robot.types'

interface RobotState {
  // Robot Hardware Config & Current values
  robotModel: string
  jointAngles: JointAngles
  tcpPose: TCPPose
  isIKMode: boolean
  
  // Project properties
  projectName: string
  currentFilePath: string | null
  
  // Workflow Steps
  steps: WorkflowStep[]
  selectedStepId: string | null
  simpleBlocklyWorkspace: unknown | null
  projectModules: SimpleModuleTemplate[]
  projectWorkflowTemplates: SimpleWorkflowTemplate[]
  simpleWorkspaceDirtyFromSteps: boolean
  simplePointPickTarget: { stepId: string; label: string } | null
  
  // Simulation State
  isPlaying: boolean
  selectedJointName: string | null
  playbackSpeed: number // multiplier (1 = 1x, 2 = 2x, etc.)
  currentStepIndex: number
  mode: 'normal' | 'advanced'
  language: 'vi' | 'en'
  lengthUnit: 'mm' | 'cm' | 'm'
  angleUnit: 'deg' | 'rad'
  
  // Actions
  setJointAngles: (angles: JointAngles) => void
  setTCPPose: (pose: TCPPose) => void
  setIKMode: (enabled: boolean) => void
  setProjectName: (name: string) => void
  setCurrentFilePath: (path: string | null) => void
  setMode: (mode: 'normal' | 'advanced') => void
  setLanguage: (lang: 'vi' | 'en') => void
  setLengthUnit: (unit: 'mm' | 'cm' | 'm') => void
  setAngleUnit: (unit: 'deg' | 'rad') => void
  
  // Workflow actions
  addStep: (step: Omit<WorkflowStep, 'id'>) => void
  removeStep: (id: string) => void
  updateStep: (id: string, updated: Partial<WorkflowStep>) => void
  reorderSteps: (newSteps: WorkflowStep[]) => void
  syncStepsFromBlockly: (steps: WorkflowStep[], workspaceJson: unknown) => void
  setSimpleBlocklyWorkspace: (json: unknown | null) => void
  setProjectModules: (modules: SimpleModuleTemplate[]) => void
  setProjectWorkflowTemplates: (templates: SimpleWorkflowTemplate[]) => void
  setSimplePointPickTarget: (target: { stepId: string; label: string } | null) => void
  markSimpleWorkspaceClean: () => void
  setSelectedStepId: (id: string | null) => void
  
  // Simulation actions
  setPlaying: (playing: boolean) => void
  setPlaybackSpeed: (speed: number) => void
  setCurrentStepIndex: (index: number) => void
  resetSimulation: () => void
  setSelectedJointName: (name: string | null) => void
}

export const useRobotStore = create<RobotState>((set) => ({
  robotModel: 'FR5',
  jointAngles: [0, -30, 90, 0, 60, 0],
  tcpPose: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
  isIKMode: false,
  
  projectName: 'coffee_machine_workflow',
  currentFilePath: null,
  
  steps: [],
  selectedStepId: null,
  simpleBlocklyWorkspace: null,
  projectModules: [],
  projectWorkflowTemplates: [],
  simpleWorkspaceDirtyFromSteps: false,
  simplePointPickTarget: null,
  
  isPlaying: false,
  playbackSpeed: 1,
  currentStepIndex: 0,
  selectedJointName: null,
  mode: 'normal',
  language: 'vi',
  lengthUnit: 'mm',
  angleUnit: 'deg',
  
  setJointAngles: (angles) => set({ jointAngles: angles }),
  setTCPPose: (pose) => set({ tcpPose: pose }),
  setIKMode: (enabled) => set({ isIKMode: enabled }),
  setProjectName: (name) => set({ projectName: name }),
  setCurrentFilePath: (path) => set({ currentFilePath: path }),
  setMode: (mode) => set({ mode }),
  setLanguage: (lang) => set({ language: lang }),
  setLengthUnit: (unit) => set({ lengthUnit: unit }),
  setAngleUnit: (unit) => set({ angleUnit: unit }),
  
  addStep: (step) =>
    set((state) => {
      const newStep: WorkflowStep = {
        ...step,
        id: `step_${Date.now()}`
      }
      return {
        steps: [...state.steps, newStep],
        selectedStepId: newStep.id,
        simpleWorkspaceDirtyFromSteps: true
      }
    }),
    
  removeStep: (id) =>
    set((state) => {
      const filtered = state.steps.filter((s) => s.id !== id)
      return {
        steps: filtered,
        selectedStepId: state.selectedStepId === id ? null : state.selectedStepId,
        simpleWorkspaceDirtyFromSteps: true
      }
    }),
    
  updateStep: (id, updated) =>
    set((state) => ({
      steps: state.steps.map((s) => (s.id === id ? { ...s, ...updated } : s)),
      simpleWorkspaceDirtyFromSteps: true
    })),
    
  reorderSteps: (newSteps) => set({ steps: newSteps, simpleWorkspaceDirtyFromSteps: true }),

  syncStepsFromBlockly: (steps, workspaceJson) =>
    set({
      steps,
      simpleBlocklyWorkspace: workspaceJson,
      simpleWorkspaceDirtyFromSteps: false
    }),

  setSimpleBlocklyWorkspace: (json) => set({ simpleBlocklyWorkspace: json }),
  setProjectModules: (modules) => set({ projectModules: modules }),
  setProjectWorkflowTemplates: (templates) => set({ projectWorkflowTemplates: templates }),
  setSimplePointPickTarget: (target) => set({ simplePointPickTarget: target }),
  markSimpleWorkspaceClean: () => set({ simpleWorkspaceDirtyFromSteps: false }),
  
  setSelectedStepId: (id) => set({ selectedStepId: id }),
  
  setPlaying: (playing) => set({ isPlaying: playing }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
  
  resetSimulation: () => set({ currentStepIndex: 0, isPlaying: false }),
  setSelectedJointName: (name) => set({ selectedJointName: name })
}))
