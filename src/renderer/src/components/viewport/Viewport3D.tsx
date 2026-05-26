import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import URDFLoader from 'urdf-loader'
import { useRobotStore } from '../../store/robotStore'
import { useSceneStore } from '../../store/sceneStore'
import { solveIK } from '../../engine/robot/ikSolver'
import { ShieldAlert, HelpCircle } from 'lucide-react'
import { WorkflowStep } from '../../types/robot.types'

const SELF_COLLISION_PAIRS = [
  { a: 'shoulder_link', b: 'forearm_link' },
  { a: 'shoulder_link', b: 'wrist1_link' },
  { a: 'shoulder_link', b: 'wrist2_link' },
  { a: 'shoulder_link', b: 'wrist3_link' },
  { a: 'upperarm_link', b: 'wrist1_link' },
  { a: 'upperarm_link', b: 'wrist2_link' },
  { a: 'upperarm_link', b: 'wrist3_link' },
  { a: 'forearm_link', b: 'wrist3_link' }
]

export default function Viewport3D() {
  const containerRef = useRef<HTMLDivElement>(null)
  const robotRef = useRef<any>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const transformControlsRef = useRef<any>(null)
  const dummyTargetRef = useRef<THREE.Object3D | null>(null)
  const boxHelperRef = useRef<THREE.BoxHelper | null>(null)
  const measureLineRef = useRef<THREE.Line | null>(null)
  const selfMeasureLineRef = useRef<THREE.Line | null>(null)
  const hitboxHelpersRef = useRef<THREE.Box3Helper[]>([])
  const keysPressedRef = useRef<Set<string>>(new Set())
  const [isRobotLoaded, setIsRobotLoaded] = useState(false)
  
  // Track loaded 3D models: map objectId -> THREE.Object3D
  const loadedObjectsRef = useRef<Map<string, THREE.Object3D>>(new Map())
  
  // Cache the last user config JSON to block infinite store update loop
  const lastUserConfigRef = useRef<string>('')

  const jointAngles = useRobotStore((state) => state.jointAngles)
  const setJointAngles = useRobotStore((state) => state.setJointAngles)
  const setTCPPose = useRobotStore((state) => state.setTCPPose)
  const isIKMode = useRobotStore((state) => state.isIKMode)
  const isPlaying = useRobotStore((state) => state.isPlaying)
  const selectedJointName = useRobotStore((state) => state.selectedJointName)
  const steps = useRobotStore((state) => state.steps)

  const objects = useSceneStore((state) => state.objects)
  const selectedObjectId = useSceneStore((state) => state.selectedObjectId)
  const collisionWarning = useSceneStore((state) => state.collisionWarning)
  const setCollisionWarning = useSceneStore((state) => state.setCollisionWarning)

  // Helper to compute Forward Kinematics (FK)
  const computeFK = (angles: number[], robot: any) => {
    const jointNames = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6']
    const originalAngles = jointNames.map(name => robot.joints[name].rotation.z)
    
    jointNames.forEach((name, idx) => {
      robot.joints[name].setJointValue(angles[idx] * Math.PI / 180)
    })
    robot.updateMatrixWorld(true)
    
    const baseLink = robot.links['base_link']
    const wristLink = robot.links['wrist3_link']
    const pos = new THREE.Vector3()
    const q = new THREE.Quaternion()
    
    if (baseLink && wristLink) {
      const baseMatInv = new THREE.Matrix4().copy(baseLink.matrixWorld).invert()
      const relativeMat = new THREE.Matrix4().multiplyMatrices(baseMatInv, wristLink.matrixWorld)
      relativeMat.decompose(pos, q, new THREE.Vector3())
    }
    
    jointNames.forEach((name, idx) => {
      robot.joints[name].setJointValue(originalAngles[idx])
    })
    robot.updateMatrixWorld(true)
    
    const euler = new THREE.Euler().setFromQuaternion(q, 'XYZ')
    return {
      x: Math.round(pos.x * 1000 * 10) / 10,
      y: Math.round(pos.y * 1000 * 10) / 10,
      z: Math.round(pos.z * 1000 * 10) / 10,
      rx: Math.round((euler.x * 180) / Math.PI * 10) / 10,
      ry: Math.round((euler.y * 180) / Math.PI * 10) / 10,
      rz: Math.round((euler.z * 180) / Math.PI * 10) / 10
    }
  }

  // Helper to compute Inverse Kinematics (IK)
  const computeIK = (tcp: any, currentAngles: number[], robot: any): number[] | null => {
    const targetPos = new THREE.Vector3(tcp.x / 1000, tcp.y / 1000, tcp.z / 1000)
    const euler = new THREE.Euler(
      (tcp.rx * Math.PI) / 180,
      (tcp.ry * Math.PI) / 180,
      (tcp.rz * Math.PI) / 180,
      'XYZ'
    )
    const targetQuat = new THREE.Quaternion().setFromEuler(euler)
    return solveIK(targetPos, targetQuat, currentAngles as any, robot)
  }

  // Helper to calculate closest points and distance between two Box3 bounding boxes
  const getBoxDistance = (boxA: THREE.Box3, boxB: THREE.Box3) => {
    const centerA = new THREE.Vector3()
    boxA.getCenter(centerA)
    
    const pointB = new THREE.Vector3()
    boxB.clampPoint(centerA, pointB)
    
    const pointA = new THREE.Vector3()
    boxA.clampPoint(pointB, pointA)
    
    return {
      distance: pointA.distanceTo(pointB),
      pointA,
      pointB
    }
  }

  // Automatically calculate jointAngles and tcpPose for all steps in the store (State Accumulator)
  useEffect(() => {
    const robot = robotRef.current
    if (!robot || isPlaying || steps.length === 0) return

    // Extract the raw structural config values chosen by the user
    const userConfig = steps.map(s => ({
      type: s.type,
      jointIndex: s.jointIndex,
      rotateMode: s.rotateMode,
      angle: s.angle,
      tcpAxis: s.tcpAxis,
      moveMode: s.moveMode,
      distance: s.distance,
      doIndex: s.doIndex,
      doValue: s.doValue,
      delayMs: s.delayMs,
      speed: s.speed,
      acc: s.acc,
      ...(s.type === 'MoveJ' ? { jointAngles: s.jointAngles } : {}),
      ...(s.type === 'MoveL' ? { tcpPose: s.tcpPose } : {})
    }))
    const userConfigStr = JSON.stringify(userConfig)

    // CRITICAL PREVENT LOOP: If user configurations have not changed, block update recalculations!
    if (lastUserConfigRef.current === userConfigStr) {
      return
    }
    lastUserConfigRef.current = userConfigStr

    let tempJoints = [0, -30, 90, 0, 60, 0] // standard start joints
    let changesMade = false

    const updatedSteps = steps.map((step) => {
      let nextJoints = [...tempJoints]
      let nextTCP = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0 }
      let stepChanged = false
      let updatedFields: Partial<WorkflowStep> = {}

      if (step.type === 'MoveJ') {
        if (step.jointAngles) {
          nextJoints = [...step.jointAngles]
          if (!step.tcpPose) {
            nextTCP = computeFK(nextJoints, robot)
            updatedFields.tcpPose = nextTCP
            stepChanged = true
          }
        }
      } else if (step.type === 'MoveL') {
        if (step.tcpPose) {
          nextTCP = { ...step.tcpPose }
          const solved = computeIK(nextTCP, tempJoints, robot)
          if (solved) {
            nextJoints = solved
            if (!step.jointAngles || step.jointAngles.some((val, i) => Math.abs(val - solved[i]) > 0.1)) {
              updatedFields.jointAngles = solved as any
              stepChanged = true
            }
          }
        }
      } else if (step.type === 'RotateJoint') {
        const jIdx = (step.jointIndex || 1) - 1
        const angleVal = step.angle || 0
        if (step.rotateMode === 'absolute') {
          nextJoints[jIdx] = angleVal
        } else {
          nextJoints[jIdx] = tempJoints[jIdx] + angleVal
        }
        
        if (!step.jointAngles || step.jointAngles.some((val, i) => Math.abs(val - nextJoints[i]) > 0.1)) {
          updatedFields.jointAngles = nextJoints as any
          stepChanged = true
        }

        const fkTCP = computeFK(nextJoints, robot)
        if (!step.tcpPose || Math.abs(step.tcpPose.x - fkTCP.x) > 0.5 || Math.abs(step.tcpPose.z - fkTCP.z) > 0.5) {
          updatedFields.tcpPose = fkTCP
          stepChanged = true
        }
      } else if (step.type === 'MoveTCP') {
        const curTCP = computeFK(tempJoints, robot)
        const axis = step.tcpAxis || 'Z'
        const dist = step.distance || 0
        
        nextTCP = { ...curTCP }
        const key = axis.toLowerCase() as 'x' | 'y' | 'z'
        if (step.moveMode === 'absolute') {
          nextTCP[key] = dist
        } else {
          nextTCP[key] = curTCP[key] + dist
        }

        const solved = computeIK(nextTCP, tempJoints, robot)
        if (solved) {
          nextJoints = solved
          if (!step.jointAngles || step.jointAngles.some((val, i) => Math.abs(val - solved[i]) > 0.1)) {
            updatedFields.jointAngles = solved as any
            stepChanged = true
          }
          if (!step.tcpPose || Math.abs(step.tcpPose.x - nextTCP.x) > 0.5 || Math.abs(step.tcpPose.z - nextTCP.z) > 0.5) {
            updatedFields.tcpPose = nextTCP
            stepChanged = true
          }
        }
      } else {
        // Non-moving commands (DO / Wait / Gripper)
        if (!step.jointAngles || step.jointAngles.some((val, i) => Math.abs(val - tempJoints[i]) > 0.1)) {
          updatedFields.jointAngles = tempJoints as any
          stepChanged = true
        }
        const fkTCP = computeFK(tempJoints, robot)
        if (!step.tcpPose || Math.abs(step.tcpPose.x - fkTCP.x) > 0.5 || Math.abs(step.tcpPose.z - fkTCP.z) > 0.5) {
          updatedFields.tcpPose = fkTCP
          stepChanged = true
        }
      }

      tempJoints = [...nextJoints]

      if (stepChanged) {
        changesMade = true
        return { ...step, ...updatedFields }
      }
      return step
    })

    if (changesMade) {
      useRobotStore.getState().reorderSteps(updatedSteps)
    }
  }, [steps, isRobotLoaded, isPlaying])

  // Initialize Scene, Camera, Renderer, Controls, Gizmos
  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    const width = container.clientWidth
    const height = container.clientHeight

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#141417') // Dark industrial bg
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
    camera.position.set(1.5, 1.5, 1.5)

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.maxPolarAngle = Math.PI / 2 - 0.05 // Don't go below ground
    controlsRef.current = controls

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
    scene.add(ambientLight)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(2, 4, 3)
    dirLight.castShadow = true
    dirLight.shadow.mapSize.width = 1024
    dirLight.shadow.mapSize.height = 1024
    scene.add(dirLight)

    const dirLight2 = new THREE.DirectionalLight(0xaaccff, 0.3)
    dirLight2.position.set(-2, 2, -3)
    scene.add(dirLight2)

    // Helpers (Grid, Floor)
    const gridHelper = new THREE.GridHelper(10, 50, 0x3a3a45, 0x222226)
    gridHelper.position.y = 0
    scene.add(gridHelper)

    const axesHelper = new THREE.AxesHelper(0.5)
    scene.add(axesHelper)

    // Box Helper for selection visualization
    const boxHelper = new THREE.BoxHelper(new THREE.Object3D(), 0x3b82f6)
    boxHelper.visible = false
    scene.add(boxHelper)
    boxHelperRef.current = boxHelper

    // Create dummy target for IK Gizmo
    const dummyTarget = new THREE.Object3D()
    const indicatorGeom = new THREE.SphereGeometry(0.025, 16, 16)
    const indicatorMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      transparent: true,
      opacity: 0.7,
      depthTest: false
    })
    const indicatorMesh = new THREE.Mesh(indicatorGeom, indicatorMat)
    indicatorMesh.name = 'ik_target_indicator'
    dummyTarget.add(indicatorMesh)

    const cageGeom = new THREE.SphereGeometry(0.035, 8, 8)
    const cageMat = new THREE.MeshBasicMaterial({
      color: 0x00ffcc,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
      depthTest: false
    })
    const cageMesh = new THREE.Mesh(cageGeom, cageMat)
    dummyTarget.add(cageMesh)

    dummyTarget.visible = false
    scene.add(dummyTarget)
    dummyTargetRef.current = dummyTarget

    // Measurement Line
    const lineGeom = new THREE.BufferGeometry()
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x3b82f6,
      dashSize: 0.04,
      gapSize: 0.02,
      depthTest: false,
      transparent: true,
      opacity: 0.8
    })
    const measureLine = new THREE.Line(lineGeom, lineMat)
    measureLine.visible = false
    scene.add(measureLine)
    measureLineRef.current = measureLine

    // Self Measurement Line
    const selfLineGeom = new THREE.BufferGeometry()
    const selfLineMat = new THREE.LineDashedMaterial({
      color: 0xf59e0b, // amber/orange for self collision
      dashSize: 0.04,
      gapSize: 0.02,
      depthTest: false,
      transparent: true,
      opacity: 0.8
    })
    const selfMeasureLine = new THREE.Line(selfLineGeom, selfLineMat)
    selfMeasureLine.visible = false
    scene.add(selfMeasureLine)
    selfMeasureLineRef.current = selfMeasureLine

    // Transform Controls (IK, FK and Objects Gizmo)
    const transformControls = new TransformControls(camera, renderer.domElement)
    transformControls.size = 0.8
    transformControls.space = 'local'
    scene.add(transformControls.getHelper())
    transformControlsRef.current = transformControls

    // Disable OrbitControls when dragging gizmo
    transformControls.addEventListener('dragging-changed', (event) => {
      controls.enabled = !event.value
    })

    // Listen to changes on Gizmo dragging
    transformControls.addEventListener('objectChange', () => {
      const playing = useRobotStore.getState().isPlaying
      if (playing) return

      const robot = robotRef.current
      if (!robot) return

      const activeObject = transformControls.object
      if (!activeObject) return

      // A. Check if currently manipulating an imported auxiliary 3D object
      const selectedObjId = useSceneStore.getState().selectedObjectId
      if (selectedObjId) {
        const threeObj = loadedObjectsRef.current.get(selectedObjId)
        if (threeObj && activeObject === threeObj) {
          const x = Math.round(threeObj.position.x * 1000)
          const y = Math.round(threeObj.position.y * 1000)
          const z = Math.round(threeObj.position.z * 1000)
          
          const rx = Math.round((threeObj.rotation.x * 180) / Math.PI)
          const ry = Math.round((threeObj.rotation.y * 180) / Math.PI)
          const rz = Math.round((threeObj.rotation.z * 180) / Math.PI)
          
          const sx = Math.round(threeObj.scale.x * 10) / 10
          const sy = Math.round(threeObj.scale.y * 10) / 10
          const sz = Math.round(threeObj.scale.z * 10) / 10

          useSceneStore.getState().updateObjectTransform(selectedObjId, { x, y, z, rx, ry, rz, sx, sy, sz })
          return
        }
      }

      // B. Check if currently manipulating robot IK dummy target
      if (dummyTargetRef.current && activeObject === dummyTargetRef.current) {
        const dummy = dummyTargetRef.current
        const wristLink = robot.links['wrist3_link']
        const baseLink = robot.links['base_link']
        if (wristLink && baseLink) {
          dummy.updateMatrixWorld(true)

          const baseMatInv = new THREE.Matrix4().copy(baseLink.matrixWorld).invert()
          const relativeMat = new THREE.Matrix4().multiplyMatrices(baseMatInv, dummy.matrixWorld)

          const targetPos = new THREE.Vector3()
          const targetQuat = new THREE.Quaternion()
          const scale = new THREE.Vector3()
          relativeMat.decompose(targetPos, targetQuat, scale)

          const wristWorldPos = new THREE.Vector3()
          wristLink.getWorldPosition(wristWorldPos)
          const wristLocalPos = wristWorldPos.applyMatrix4(baseMatInv)
          
          const dist = targetPos.distanceTo(wristLocalPos)
          const maxDistance = 0.08 // 8cm
          const clampedTargetPos = targetPos.clone()
          if (dist > maxDistance) {
            const dir = new THREE.Vector3().subVectors(targetPos, wristLocalPos).normalize()
            clampedTargetPos.copy(wristLocalPos).addScaledVector(dir, maxDistance)
          }

          const currentAngles = useRobotStore.getState().jointAngles
          const newAngles = solveIK(clampedTargetPos, targetQuat, currentAngles as any, robot)
          
          if (newAngles) {
            setJointAngles(newAngles)
          }
        }
        return
      }

      // C. Check if currently manipulating a robot joint directly (FK)
      const selectedJoint = useRobotStore.getState().selectedJointName
      if (selectedJoint) {
        const jointObj = robot.joints[selectedJoint]
        if (jointObj && activeObject === jointObj) {
          let rad = jointObj.rotation.z
          const jointIdx = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'].indexOf(selectedJoint)
          if (jointIdx !== -1) {
            const JOINT_LIMITS = [
              { min: -175, max: 175 },
              { min: -265, max: 85 },
              { min: -160, max: 160 },
              { min: -265, max: 85 },
              { min: -175, max: 175 },
              { min: -175, max: 175 }
            ]
            const limit = JOINT_LIMITS[jointIdx]
            let deg = (rad * 180) / Math.PI

            if (deg > 180) deg -= 360
            if (deg < -180) deg += 360

            const clampedDeg = Math.max(limit.min, Math.min(limit.max, deg))
            
            const currentAngles = [...useRobotStore.getState().jointAngles]
            currentAngles[jointIdx] = Math.round(clampedDeg * 10) / 10
            setJointAngles(currentAngles as any)
          }
        }
      }
    })

    // Keyboard shortcuts listener for WASD movement and Gizmo transform modes
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore when typing in input fields
      const activeTag = document.activeElement?.tagName
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') {
        return
      }

      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd'].includes(key)) {
        keysPressedRef.current.add(key)
      }

      const selectedObjId = useSceneStore.getState().selectedObjectId
      if (selectedObjId && transformControls) {
        if (key === '1') {
          transformControls.setMode('translate')
        } else if (key === '2') {
          transformControls.setMode('rotate')
        } else if (key === '3') {
          transformControls.setMode('scale')
        }
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if (['w', 'a', 's', 'd'].includes(key)) {
        keysPressedRef.current.delete(key)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Load URDF Robot
    const loader = new URDFLoader()
    loader.packages = {
      fairino_description: './fairino_description'
    }

    loader.load(
      './fairino_description/urdf/fairino5_v6.urdf',
      (robot) => {
        robot.rotation.x = -Math.PI / 2
        robot.position.y = 0
        
        robot.traverse((child: any) => {
          if (child.isMesh) {
            child.castShadow = true
            child.receiveShadow = true
            if (child.material) {
              child.material.roughness = 0.4
              child.material.metalness = 0.6
            }
          }
        })

        scene.add(robot)
        robotRef.current = robot
        setIsRobotLoaded(true)

        updateRobotJoints(useRobotStore.getState().jointAngles)
      },
      undefined,
      (error) => {
        console.error('An error occurred loading URDF:', error)
      }
    )

    // Click to select joints or imported 3D objects (Raycasting)
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onPointerDown = (event: PointerEvent) => {
      if (
        event.button !== 0 ||
        transformControls.dragging ||
        useRobotStore.getState().isIKMode ||
        useRobotStore.getState().isPlaying
      ) {
        return
      }

      const rect = renderer.domElement.getBoundingClientRect()
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

      raycaster.setFromCamera(mouse, camera)

      // 1. Raycast imported auxiliary objects first
      const loadedMeshes = Array.from(loadedObjectsRef.current.values())
      const objectIntersects = raycaster.intersectObjects(loadedMeshes, true)
      
      if (objectIntersects.length > 0) {
        let hitObject: THREE.Object3D | null = objectIntersects[0].object
        let matchedId: string | null = null
        
        while (hitObject && hitObject !== scene) {
          for (const [id, threeObj] of loadedObjectsRef.current.entries()) {
            if (threeObj === hitObject) {
              matchedId = id
              break
            }
          }
          if (matchedId) break
          hitObject = hitObject.parent
        }

        if (matchedId) {
          useSceneStore.getState().setSelectedObjectId(matchedId)
          useRobotStore.getState().setSelectedJointName(null)
          return
        }
      }

      // 2. Raycast robot links
      const robot = robotRef.current
      if (robot) {
        const intersects = raycaster.intersectObject(robot, true)
        if (intersects.length > 0) {
          let obj: THREE.Object3D | null = intersects[0].object
          let jointName: string | null = null
          
          while (obj && obj !== robot) {
            if (obj.name) {
              const nameLower = obj.name.toLowerCase()
              if (nameLower.includes('shoulder_link') || nameLower.includes('link1')) { jointName = 'j1'; break; }
              if (nameLower.includes('upperarm_link') || nameLower.includes('link2')) { jointName = 'j2'; break; }
              if (nameLower.includes('forearm_link') || nameLower.includes('link3')) { jointName = 'j3'; break; }
              if (nameLower.includes('wrist1_link') || nameLower.includes('link4')) { jointName = 'j4'; break; }
              if (nameLower.includes('wrist2_link') || nameLower.includes('link5')) { jointName = 'j5'; break; }
              if (nameLower.includes('wrist3_link') || nameLower.includes('link6')) { jointName = 'j6'; break; }
            }
            obj = obj.parent
          }

          if (jointName) {
            useRobotStore.getState().setSelectedJointName(jointName)
            useSceneStore.getState().setSelectedObjectId(null) // clear selected object
            return
          }
        }
      }
      
      // Click empty space clears selection
      useRobotStore.getState().setSelectedJointName(null)
      useSceneStore.getState().setSelectedObjectId(null)
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)

    // Measurement and Hitbox update function in animation loop
    const updateMeasurementAndHitboxes = () => {
      const robot = robotRef.current
      const scene = sceneRef.current
      const measureLine = measureLineRef.current
      const selfMeasureLine = selfMeasureLineRef.current
      if (!robot || !scene || !measureLine || !selfMeasureLine) return

      const labelEl = document.getElementById('measure-label')
      const textEl = document.getElementById('measure-text')
      const selfLabelEl = document.getElementById('self-measure-label')
      const selfTextEl = document.getElementById('self-measure-text')

      // Get latest state directly from stores
      const unit = useRobotStore.getState().lengthUnit
      const isDebug = useSceneStore.getState().isDebugHitbox
      const currentLanguage = useRobotStore.getState().language

      // 1. Gather all active visible auxiliary objects
      const activeObjects: { id: string; name: string; box: THREE.Box3 }[] = []
      for (const [id, threeObj] of loadedObjectsRef.current.entries()) {
        const storeObj = useSceneStore.getState().objects.find(o => o.id === id)
        if (storeObj && storeObj.visible) {
          const box = new THREE.Box3().setFromObject(threeObj)
          activeObjects.push({ id, name: storeObj.name, box })
        }
      }

      // 2. Gather all link boxes of the robot arm
      const getMeshLinkName = (mesh: THREE.Object3D): string | null => {
        let obj: THREE.Object3D | null = mesh
        while (obj) {
          if (obj.name && (obj.name.toLowerCase().includes('link') || obj.name.toLowerCase().includes('base'))) {
            return obj.name
          }
          obj = obj.parent
        }
        return null
      }

      const linkBoxesMap = new Map<string, THREE.Box3>()
      robot.traverse((child: any) => {
        if (child.isMesh) {
          const linkName = getMeshLinkName(child)
          if (linkName) {
            child.geometry.computeBoundingBox()
            if (child.geometry.boundingBox) {
              const meshBox = new THREE.Box3().copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld)
              if (linkBoxesMap.has(linkName)) {
                linkBoxesMap.get(linkName)!.union(meshBox)
              } else {
                linkBoxesMap.set(linkName, meshBox)
              }
            }
          }
        }
      })

      // 3. Clear previous hitbox helpers
      hitboxHelpersRef.current.forEach(h => {
        scene.remove(h)
        if (h.geometry) h.geometry.dispose()
        if (Array.isArray(h.material)) h.material.forEach(m => m.dispose())
        else if (h.material) h.material.dispose()
      })
      hitboxHelpersRef.current = []

      // 4. Render hitboxes if debug is active
      if (isDebug) {
        // Robot links
        for (const [linkName, box] of linkBoxesMap.entries()) {
          // Check if this link intersects any active object box
          let isColliding = false
          for (const obj of activeObjects) {
            if (box.intersectsBox(obj.box)) {
              isColliding = true
              break
            }
          }

          // Check if this link intersects another link in self collision pairs
          if (!isColliding) {
            for (const pair of SELF_COLLISION_PAIRS) {
              const nameLower = linkName.toLowerCase()
              if (nameLower.includes(pair.a) || nameLower.includes(pair.b)) {
                const otherKey = nameLower.includes(pair.a) ? pair.b : pair.a
                let otherBox: THREE.Box3 | undefined
                for (const [k, b] of linkBoxesMap.entries()) {
                  if (k.toLowerCase().includes(otherKey)) {
                    otherBox = b
                    break
                  }
                }
                if (otherBox && box.intersectsBox(otherBox)) {
                  isColliding = true
                  break
                }
              }
            }
          }

          const helperColor = isColliding ? 0xf43f5e : 0xeab308 // red vs yellow
          const helper = new THREE.Box3Helper(box, new THREE.Color(helperColor))
          scene.add(helper)
          hitboxHelpersRef.current.push(helper)
        }

        // Auxiliary objects
        for (const obj of activeObjects) {
          let isColliding = false
          for (const linkBox of linkBoxesMap.values()) {
            if (obj.box.intersectsBox(linkBox)) {
              isColliding = true
              break
            }
          }
          const helperColor = isColliding ? 0xf43f5e : 0x10b981 // red vs green
          const helper = new THREE.Box3Helper(obj.box, new THREE.Color(helperColor))
          scene.add(helper)
          hitboxHelpersRef.current.push(helper)
        }
      }

      // 5. Find target object for distance measurement
      let targetObj: { id: string; name: string; box: THREE.Box3 } | null = null
      const selectedId = useSceneStore.getState().selectedObjectId
      if (selectedId) {
        targetObj = activeObjects.find(o => o.id === selectedId) || null
      }
      
      // If no selected object, pick the one closest to the robot base
      if (!targetObj && activeObjects.length > 0) {
        const baseBox = linkBoxesMap.get('base_link') || Array.from(linkBoxesMap.values())[0]
        if (baseBox) {
          const baseCenter = new THREE.Vector3()
          baseBox.getCenter(baseCenter)
          let minD = Infinity
          activeObjects.forEach(obj => {
            const objCenter = new THREE.Vector3()
            obj.box.getCenter(objCenter)
            const d = baseCenter.distanceTo(objCenter)
            if (d < minD) {
              minD = d
              targetObj = obj
            }
          })
        } else {
          targetObj = activeObjects[0]
        }
      }

      // 6. Compute distance and draw line from closest link to target object
      if (targetObj && linkBoxesMap.size > 0) {
        let minDistance = Infinity
        let bestPoints: { pointA: THREE.Vector3; pointB: THREE.Vector3 } | null = null
        let closestLinkName = ''

        for (const [linkName, box] of linkBoxesMap.entries()) {
          // ignore base/shoulder for segment-to-object measurement to look cleaner
          const nameLower = linkName.toLowerCase()
          if (nameLower.includes('base_link') || nameLower.includes('shoulder_link') || nameLower.includes('link1')) {
            continue
          }
          const res = getBoxDistance(box, targetObj.box)
          if (res.distance < minDistance) {
            minDistance = res.distance
            bestPoints = res
            closestLinkName = linkName
          }
        }

        if (bestPoints) {
          const { pointA, pointB } = bestPoints
          
          // Update measure line position
          measureLine.geometry.setFromPoints([pointA, pointB])
          measureLine.computeLineDistances()
          measureLine.visible = true

          // Calculate distance in mm
          const distanceMm = Math.round(minDistance * 1000)

          // Display label at midpoint
          if (labelEl && textEl && containerRef.current) {
            const midPoint = new THREE.Vector3().addVectors(pointA, pointB).multiplyScalar(0.5)
            midPoint.project(camera)

            const w = containerRef.current.clientWidth
            const h = containerRef.current.clientHeight
            const x = (midPoint.x * 0.5 + 0.5) * w
            const y = (-midPoint.y * 0.5 + 0.5) * h

            // Friendly link name mapping
            const linkViNames: Record<string, string> = {
              'upperarm_link': 'Bắp tay',
              'forearm_link': 'Khuỷu tay',
              'wrist1_link': 'Cổ tay 1',
              'wrist2_link': 'Cổ tay 2',
              'wrist3_link': 'Cổ tay 3'
            }
            const linkEnNames: Record<string, string> = {
              'upperarm_link': 'Upper Arm',
              'forearm_link': 'Forearm',
              'wrist1_link': 'Wrist 1',
              'wrist2_link': 'Wrist 2',
              'wrist3_link': 'Wrist 3'
            }
            const cleanLinkName = currentLanguage === 'vi' 
              ? (Object.keys(linkViNames).find(k => closestLinkName.toLowerCase().includes(k)) ? linkViNames[Object.keys(linkViNames).find(k => closestLinkName.toLowerCase().includes(k))!] : closestLinkName)
              : (Object.keys(linkEnNames).find(k => closestLinkName.toLowerCase().includes(k)) ? linkEnNames[Object.keys(linkEnNames).find(k => closestLinkName.toLowerCase().includes(k))!] : closestLinkName)

            labelEl.style.left = `${x}px`
            labelEl.style.top = `${y}px`
            labelEl.style.display = 'flex'

            const valStr = unit === 'm' ? `${(distanceMm / 1000).toFixed(3)} m` : `${distanceMm} mm`
            textEl.innerHTML = `${cleanLinkName} ↔ ${targetObj.name}: ${valStr}`
          }
        }
      } else {
        measureLine.visible = false
        if (labelEl) labelEl.style.display = 'none'
      }

      // 7. Compute self-collision distance measurement (Self-Distance)
      if (linkBoxesMap.size > 0) {
        let minSelfDistance = Infinity
        let bestSelfPoints: { pointA: THREE.Vector3; pointB: THREE.Vector3 } | null = null
        let selfLinkA = ''
        let selfLinkB = ''

        for (const pair of SELF_COLLISION_PAIRS) {
          let boxA: THREE.Box3 | undefined
          let boxB: THREE.Box3 | undefined
          let keyA = ''
          let keyB = ''

          for (const [key, box] of linkBoxesMap.entries()) {
            const keyLower = key.toLowerCase()
            if (keyLower.includes(pair.a)) { boxA = box; keyA = key; }
            if (keyLower.includes(pair.b)) { boxB = box; keyB = key; }
          }

          if (boxA && boxB) {
            const res = getBoxDistance(boxA, boxB)
            if (res.distance < minSelfDistance) {
              minSelfDistance = res.distance
              bestSelfPoints = res
              selfLinkA = keyA
              selfLinkB = keyB
            }
          }
        }

        if (bestSelfPoints && minSelfDistance < Infinity) {
          const { pointA, pointB } = bestSelfPoints
          
          selfMeasureLine.geometry.setFromPoints([pointA, pointB])
          selfMeasureLine.computeLineDistances()
          selfMeasureLine.visible = true

          const selfDistanceMm = Math.round(minSelfDistance * 1000)

          if (selfLabelEl && selfTextEl && containerRef.current) {
            const midPoint = new THREE.Vector3().addVectors(pointA, pointB).multiplyScalar(0.5)
            midPoint.project(camera)

            const w = containerRef.current.clientWidth
            const h = containerRef.current.clientHeight
            const x = (midPoint.x * 0.5 + 0.5) * w
            const y = (-midPoint.y * 0.5 + 0.5) * h

            const linkViNames: Record<string, string> = {
              'shoulder_link': 'Khớp vai',
              'upperarm_link': 'Bắp tay',
              'forearm_link': 'Khuỷu tay',
              'wrist1_link': 'Cổ tay 1',
              'wrist2_link': 'Cổ tay 2',
              'wrist3_link': 'Cổ tay 3'
            }
            const linkEnNames: Record<string, string> = {
              'shoulder_link': 'Shoulder',
              'upperarm_link': 'Upper Arm',
              'forearm_link': 'Forearm',
              'wrist1_link': 'Wrist 1',
              'wrist2_link': 'Wrist 2',
              'wrist3_link': 'Wrist 3'
            }

            const cleanLinkA = currentLanguage === 'vi'
              ? (Object.keys(linkViNames).find(k => selfLinkA.toLowerCase().includes(k)) ? linkViNames[Object.keys(linkViNames).find(k => selfLinkA.toLowerCase().includes(k))!] : selfLinkA)
              : (Object.keys(linkEnNames).find(k => selfLinkA.toLowerCase().includes(k)) ? linkEnNames[Object.keys(linkEnNames).find(k => selfLinkA.toLowerCase().includes(k))!] : selfLinkA)

            const cleanLinkB = currentLanguage === 'vi'
              ? (Object.keys(linkViNames).find(k => selfLinkB.toLowerCase().includes(k)) ? linkViNames[Object.keys(linkViNames).find(k => selfLinkB.toLowerCase().includes(k))!] : selfLinkB)
              : (Object.keys(linkEnNames).find(k => selfLinkB.toLowerCase().includes(k)) ? linkEnNames[Object.keys(linkEnNames).find(k => selfLinkB.toLowerCase().includes(k))!] : selfLinkB)

            selfLabelEl.style.left = `${x}px`
            selfLabelEl.style.top = `${y}px`
            selfLabelEl.style.display = 'flex'

            const valStr = unit === 'm' ? `${(selfDistanceMm / 1000).toFixed(3)} m` : `${selfDistanceMm} mm`
            selfTextEl.innerHTML = `${cleanLinkA} ↔ ${cleanLinkB}: ${valStr}`
          }
        } else {
          selfMeasureLine.visible = false
          if (selfLabelEl) selfLabelEl.style.display = 'none'
        }
      } else {
        selfMeasureLine.visible = false
        if (selfLabelEl) selfLabelEl.style.display = 'none'
      }
    }

    // Animation Loop
    let animationFrameId: number
    // Real-time camera navigation via WASD keys on horizontal plane
    const updateWASDNavigation = () => {
      const keys = keysPressedRef.current
      if (keys.size === 0) return

      const moveSpeed = 0.015 // move speed per frame
      const tempDir = new THREE.Vector3()
      const tempRight = new THREE.Vector3()

      // Horizontal camera forward direction
      camera.getWorldDirection(tempDir)
      tempDir.y = 0
      tempDir.normalize()

      // Horizontal camera right direction
      tempRight.crossVectors(tempDir, camera.up).normalize()

      const delta = new THREE.Vector3()
      if (keys.has('w')) delta.addScaledVector(tempDir, moveSpeed)
      if (keys.has('s')) delta.addScaledVector(tempDir, -moveSpeed)
      if (keys.has('d')) delta.addScaledVector(tempRight, moveSpeed)
      if (keys.has('a')) delta.addScaledVector(tempRight, -moveSpeed)

      camera.position.add(delta)
      controls.target.add(delta)
      controls.update()
    }

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)
      controls.update()
      
      // Update outline helper for selected objects
      if (boxHelperRef.current && boxHelperRef.current.visible) {
        boxHelperRef.current.update()
      }

      // Perform WASD Camera Navigation
      updateWASDNavigation()

      // Perform collision detection
      checkCollisions()

      // Update measurement line and debug hitboxes
      updateMeasurementAndHitboxes()

      renderer.render(scene, camera)
    }
    animate()

    // Resize Handler
    const handleResize = () => {
      if (!container) return
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.dispose()
      transformControls.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  // Bounding box collision detection (Ground, Self, and Object collision)
  const checkCollisions = () => {
    const robot = robotRef.current
    if (!robot) return

    // Helper to find the link name of a mesh
    const getMeshLinkName = (mesh: THREE.Object3D): string | null => {
      let obj: THREE.Object3D | null = mesh
      while (obj) {
        if (obj.name && (obj.name.toLowerCase().includes('link') || obj.name.toLowerCase().includes('base'))) {
          return obj.name
        }
        obj = obj.parent
      }
      return null
    }

    const linkBoxesMap = new Map<string, THREE.Box3>()
    
    // Group all mesh bounding boxes by their respective URDF link names
    robot.traverse((child: any) => {
      if (child.isMesh) {
        const linkName = getMeshLinkName(child)
        if (linkName) {
          child.geometry.computeBoundingBox()
          if (child.geometry.boundingBox) {
            const meshBox = new THREE.Box3().copy(child.geometry.boundingBox).applyMatrix4(child.matrixWorld)
            if (linkBoxesMap.has(linkName)) {
              linkBoxesMap.get(linkName)!.union(meshBox)
            } else {
              linkBoxesMap.set(linkName, meshBox)
            }
          }
        }
      }
    })

    // 1. Ground Collision Detection (y < 0.005 meters, i.e., 5mm, ignoring base_link and shoulder_link)
    let groundCollide = false
    const groundY = 0.005
    for (const [linkName, box] of linkBoxesMap.entries()) {
      const nameLower = linkName.toLowerCase()
      if (nameLower.includes('base_link') || nameLower.includes('shoulder_link') || nameLower.includes('link1')) {
        continue
      }
      if (box.min.y < groundY) {
        groundCollide = true
        break
      }
    }

    // 2. Self Collision Detection (ignoring adjacent links and close wrist couples to avoid false positives)
    let selfCollide = false

    for (const pair of SELF_COLLISION_PAIRS) {
      let boxA: THREE.Box3 | undefined
      let boxB: THREE.Box3 | undefined

      for (const [key, box] of linkBoxesMap.entries()) {
        const keyLower = key.toLowerCase()
        if (keyLower.includes(pair.a)) boxA = box
        if (keyLower.includes(pair.b)) boxB = box
      }

      if (boxA && boxB && boxA.intersectsBox(boxB)) {
        selfCollide = true
        break
      }
    }

    // 3. Object Collision Detection (with imported auxiliary 3D objects)
    let objectCollide = false
    if (loadedObjectsRef.current.size > 0) {
      for (const [id, threeObj] of loadedObjectsRef.current.entries()) {
        const storeObj = useSceneStore.getState().objects.find(o => o.id === id)
        if (!storeObj || !storeObj.visible) continue

        const objBox = new THREE.Box3().setFromObject(threeObj)

        for (const linkBox of linkBoxesMap.values()) {
          if (linkBox.intersectsBox(objBox)) {
            objectCollide = true
            break
          }
        }
        if (objectCollide) break
      }
    }

    const isColliding = groundCollide || selfCollide || objectCollide

    if (useSceneStore.getState().collisionWarning !== isColliding) {
      setCollisionWarning(isColliding)
    }
  }

  // Synchronize 3D models in store with Three.js scene
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    const loadedMap = loadedObjectsRef.current

    // 1. Load newly added objects
    objects.forEach((obj) => {
      if (!loadedMap.has(obj.id)) {
        if (obj.fileType === 'stl') {
          const stlLoader = new STLLoader()
          stlLoader.load(obj.url, (geometry) => {
            const material = new THREE.MeshStandardMaterial({
              color: 0x90caf9,
              roughness: 0.5,
              metalness: 0.2
            })
            const mesh = new THREE.Mesh(geometry, material)
            mesh.castShadow = true
            mesh.receiveShadow = true
            
            updateThreeObjTransform(mesh, obj.transform)
            mesh.visible = obj.visible

            scene.add(mesh)
            loadedMap.set(obj.id, mesh)
            
            updateSelection()
          })
        } else {
          const gltfLoader = new GLTFLoader()
          gltfLoader.load(obj.url, (gltf) => {
            const model = gltf.scene
            model.traverse((child: any) => {
              if (child.isMesh) {
                child.castShadow = true
                child.receiveShadow = true
              }
            })

            updateThreeObjTransform(model, obj.transform)
            model.visible = obj.visible

            scene.add(model)
            loadedMap.set(obj.id, model)
            
            updateSelection()
          })
        }
      } else {
        // 2. Update existing object transform & visibility
        const threeObj = loadedMap.get(obj.id)
        if (threeObj) {
          const transformControls = transformControlsRef.current
          const isDraggingThis = transformControls && transformControls.dragging && transformControls.object === threeObj
          
          if (!isDraggingThis) {
            updateThreeObjTransform(threeObj, obj.transform)
          }
          threeObj.visible = obj.visible
        }
      }
    })

    // 3. Remove deleted objects
    for (const id of loadedMap.keys()) {
      if (!objects.some((o) => o.id === id)) {
        const threeObj = loadedMap.get(id)
        if (threeObj) {
          scene.remove(threeObj)
          loadedMap.delete(id)
        }
      }
    }

    updateSelection()
  }, [objects])

  // Update selection outline
  const updateSelection = () => {
    const boxHelper = boxHelperRef.current
    if (!boxHelper) return

    if (selectedObjectId) {
      const threeObj = loadedObjectsRef.current.get(selectedObjectId)
      if (threeObj) {
        boxHelper.setFromObject(threeObj)
        boxHelper.visible = true
        return
      }
    }
    boxHelper.visible = false
  }

  // Update selection outline when selection changes
  useEffect(() => {
    updateSelection()
  }, [selectedObjectId, objects])

  // Sync transform helper values (mm/degrees to meters/radians)
  const updateThreeObjTransform = (threeObj: THREE.Object3D, t: any) => {
    threeObj.position.set(t.x / 1000, t.y / 1000, t.z / 1000)
    threeObj.rotation.set(
      (t.rx * Math.PI) / 180,
      (t.ry * Math.PI) / 180,
      (t.rz * Math.PI) / 180
    )
    threeObj.scale.set(t.sx, t.sy, t.sz)
  }

  // Highlight joint links
  const highlightJointLink = (selectedJoint: string | null) => {
    const robot = robotRef.current
    if (!robot) return

    const jointToLinkMap: Record<string, string> = {
      'j1': 'shoulder_link',
      'j2': 'upperarm_link',
      'j3': 'forearm_link',
      'j4': 'wrist1_link',
      'j5': 'wrist2_link',
      'j6': 'wrist3_link'
    }

    const JOINT_LIMITS = [
      { min: -175, max: 175 },
      { min: -265, max: 85 },
      { min: -150, max: 150 },
      { min: -265, max: 85 },
      { min: -175, max: 175 },
      { min: -175, max: 175 }
    ]

    const currentAngles = useRobotStore.getState().jointAngles

    robot.traverse((child: any) => {
      if (child.isMesh) {
        let matchedJoint: string | null = null
        for (const [jName, lName] of Object.entries(jointToLinkMap)) {
          if (child.name && child.name.toLowerCase().includes(lName.toLowerCase())) {
            matchedJoint = jName
            break
          }
        }

        if (matchedJoint && child.material) {
          const jointIdx = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6'].indexOf(matchedJoint)
          const limit = JOINT_LIMITS[jointIdx]
          const angleVal = currentAngles[jointIdx]

          const isAtLimit = Math.abs(angleVal - limit.min) <= 0.5 || Math.abs(angleVal - limit.max) <= 0.5

          if (isAtLimit) {
            child.material.emissive = new THREE.Color(0xf43f5e)
            child.material.emissiveIntensity = 0.8
          } else if (matchedJoint === selectedJoint) {
            child.material.emissive = new THREE.Color(0x0284c7)
            child.material.emissiveIntensity = 0.5
          } else {
            child.material.emissive = new THREE.Color(0x000000)
            child.material.emissiveIntensity = 0
          }
        }
      }
    })
  }

  // Sync TransformControls visibility and attachments based on isIKMode and isPlaying
  useEffect(() => {
    const transformControls = transformControlsRef.current
    const dummyTarget = dummyTargetRef.current
    const robot = robotRef.current

    if (!transformControls || !dummyTarget) return

    if (!robot || isPlaying) {
      transformControls.detach()
      transformControls.getHelper().visible = false
      dummyTarget.visible = false
      highlightJointLink(null)
      return
    }

    if (isIKMode) {
      highlightJointLink(null)
      
      // Only copy the wristLink position to the dummyTarget if we are not actively dragging it
      if (!transformControls.dragging) {
        const wristLink = robot.links['wrist3_link']
        if (wristLink) {
          const wristWorldPos = new THREE.Vector3()
          const wristWorldQuat = new THREE.Quaternion()
          wristLink.getWorldPosition(wristWorldPos)
          wristLink.getWorldQuaternion(wristWorldQuat)

          dummyTarget.position.copy(wristWorldPos)
          dummyTarget.quaternion.copy(wristWorldQuat)
          dummyTarget.updateMatrixWorld(true)
        }
      }
      
      transformControls.setMode('translate')
      transformControls.showX = true
      transformControls.showY = true
      transformControls.showZ = true
      
      // Only attach if it's not already attached to prevent resetting the dragging state offset
      if (transformControls.object !== dummyTarget) {
        transformControls.attach(dummyTarget)
      }
      transformControls.getHelper().visible = true
      dummyTarget.visible = true
    } else if (selectedJointName) {
      dummyTarget.visible = false
      highlightJointLink(selectedJointName)
      
      const jointObj = robot.joints[selectedJointName]
      if (jointObj) {
        transformControls.setMode('rotate')
        transformControls.showX = false
        transformControls.showY = false
        transformControls.showZ = true
        
        // Only attach if it's not already attached to prevent resetting the dragging state offset
        if (transformControls.object !== jointObj) {
          transformControls.attach(jointObj)
        }
        transformControls.getHelper().visible = true
      } else {
        transformControls.detach()
        transformControls.getHelper().visible = false
      }
    } else if (selectedObjectId) {
      dummyTarget.visible = false
      highlightJointLink(null)

      const threeObj = loadedObjectsRef.current.get(selectedObjectId)
      if (threeObj) {
        transformControls.showX = true
        transformControls.showY = true
        transformControls.showZ = true
        
        // Only attach if it's not already attached to prevent resetting the dragging state offset
        if (transformControls.object !== threeObj) {
          transformControls.attach(threeObj)
        }
        transformControls.getHelper().visible = true
      } else {
        transformControls.detach()
        transformControls.getHelper().visible = false
      }
    } else {
      highlightJointLink(null)
      transformControls.detach()
      transformControls.getHelper().visible = false
    }
  }, [isIKMode, isRobotLoaded, isPlaying, selectedJointName, selectedObjectId])

  // Update robot joints when jointAngles state changes
  useEffect(() => {
    updateRobotJoints(jointAngles)
  }, [jointAngles])

  // Helper function to update joint angles, calculate TCP Pose and snap Gizmo Target
  const updateRobotJoints = (angles: number[]) => {
    const robot = robotRef.current
    const dummyTarget = dummyTargetRef.current
    if (!robot) return

    const jointNames = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6']
    jointNames.forEach((name, idx) => {
      const joint = robot.joints[name]
      if (joint) {
        const angleVal = isNaN(angles[idx]) ? 0 : angles[idx]
        const rad = (angleVal * Math.PI) / 180
        joint.setJointValue(rad)
      }
    })

    robot.updateMatrixWorld(true)

    const baseLink = robot.links['base_link']
    const wristLink = robot.links['wrist3_link']

    if (baseLink && wristLink) {
      const baseMatInv = new THREE.Matrix4().copy(baseLink.matrixWorld).invert()
      const relativeMat = new THREE.Matrix4().multiplyMatrices(baseMatInv, wristLink.matrixWorld)

      const pos = new THREE.Vector3()
      const q = new THREE.Quaternion()
      const scale = new THREE.Vector3()
      relativeMat.decompose(pos, q, scale)

      const x = isNaN(pos.x) ? 0 : Math.round(pos.x * 1000 * 10) / 10
      const y = isNaN(pos.y) ? 0 : Math.round(pos.y * 1000 * 10) / 10
      const z = isNaN(pos.z) ? 0 : Math.round(pos.z * 1000 * 10) / 10

      const euler = new THREE.Euler().setFromQuaternion(q, 'XYZ')
      const rx = isNaN(euler.x) ? 0 : Math.round((euler.x * 180) / Math.PI * 10) / 10
      const ry = isNaN(euler.y) ? 0 : Math.round((euler.y * 180) / Math.PI * 10) / 10
      const rz = isNaN(euler.z) ? 0 : Math.round((euler.z * 180) / Math.PI * 10) / 10

      setTCPPose({ x, y, z, rx, ry, rz })

      if (dummyTarget && !transformControlsRef.current?.dragging) {
        const wristWorldPos = new THREE.Vector3()
        const wristWorldQuat = new THREE.Quaternion()
        wristLink.getWorldPosition(wristWorldPos)
        wristLink.getWorldQuaternion(wristWorldQuat)

        dummyTarget.position.copy(wristWorldPos)
        dummyTarget.quaternion.copy(wristWorldQuat)
        dummyTarget.updateMatrixWorld(true)
      }
    }
  }

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      {/* Dynamic measurement label */}
      <div
        id="measure-label"
        className="absolute bg-[#1e1e24]/95 border border-blue-500/50 text-[10px] text-white px-2 py-1 rounded shadow-md pointer-events-none font-mono font-bold z-20 flex items-center gap-1.5"
        style={{ display: 'none', transform: 'translate(-50%, -50%)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping"></span>
        <span id="measure-text">0 mm</span>
      </div>

      {/* Dynamic self-measurement label */}
      <div
        id="self-measure-label"
        className="absolute bg-[#1e1e24]/95 border border-amber-500/50 text-[10px] text-white px-2 py-1 rounded shadow-md pointer-events-none font-mono font-bold z-20 flex items-center gap-1.5"
        style={{ display: 'none', transform: 'translate(-50%, -50%)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
        <span id="self-measure-text">0 mm</span>
      </div>

      {/* Collision Warning Overlay */}
      {collisionWarning && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-rose-600/95 text-white px-4 py-2.5 rounded-lg shadow-lg border border-rose-500 animate-pulse">
          <ShieldAlert size={18} />
          <span className="text-xs font-bold uppercase tracking-wider">Cảnh báo: Phát hiện va chạm!</span>
        </div>
      )}

      {/* Helper floating shortcuts hint */}
      <div className="absolute top-4 right-4 z-10 bg-[#1e1e24]/90 border border-blue-500/30 text-slate-300 px-3.5 py-2.5 rounded-lg shadow-xl backdrop-blur-sm max-w-[240px] pointer-events-none flex items-start gap-2">
        <HelpCircle size={14} className="text-blue-400 shrink-0 mt-0.5" />
        <div className="text-[10px] space-y-1.5">
          <span className="font-bold text-white block">Phím tắt điều hướng:</span>
          <div><kbd className="px-1.5 py-0.5 bg-black/40 rounded text-slate-200">W</kbd> <kbd className="px-1.5 py-0.5 bg-black/40 rounded text-slate-200">A</kbd> <kbd className="px-1.5 py-0.5 bg-black/40 rounded text-slate-200">S</kbd> <kbd className="px-1.5 py-0.5 bg-black/40 rounded text-slate-200">D</kbd> - Di chuyển Camera</div>
          {selectedObjectId && (
            <>
              <div className="border-t border-white/10 my-1"></div>
              <span className="font-bold text-white block">Thiết lập vật thể:</span>
              <div><kbd className="px-1.5 py-0.5 bg-black/40 rounded text-slate-200">1</kbd> - Dịch chuyển (Translate)</div>
              <div><kbd className="px-1.5 py-0.5 bg-black/40 rounded text-slate-200">2</kbd> - Xoay (Rotate)</div>
              <div><kbd className="px-1.5 py-0.5 bg-black/40 rounded text-slate-200">3</kbd> - Co giãn (Scale)</div>
            </>
          )}
        </div>
      </div>

      {/* IK Mode Instructions */}
      {isIKMode && (
        <div className="absolute bottom-4 left-4 z-10 bg-[#1e1e24]/90 border border-emerald-500/30 text-slate-200 px-4 py-3 rounded-lg shadow-xl backdrop-blur-sm max-w-sm pointer-events-none">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            CHẾ ĐỘ CARTESIAN (IK) HOẠT ĐỘNG
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Kéo các mũi tên 3D (Gizmo) hoặc quả cầu phát sáng màu xanh cyan ở đầu gắp robot để điều khiển vị trí của cánh tay.
          </p>
        </div>
      )}
    </div>
  )
}
