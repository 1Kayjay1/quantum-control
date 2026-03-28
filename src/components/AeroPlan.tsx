// AeroPlan — PERFECT.html UI wired to real physics store
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { useAuth } from '../hooks/useAuth'
import { useProjectStore } from '../store/projectStore'
import { WORLD_SCALE, PLAYBACK_TICK_MS } from '../core/constants'
import { workspaceService } from '../services/workspaceService'
import type { Mission } from '../types/mission'

// ─── constants ────────────────────────────────────────────────────────────────
const PX_PER_SEC = 80
const USE_REFERENCE_VIEWPORT = false

const KIND_COLOR: Record<string, string> = {
  takeoff: '#805ad5', land: '#805ad5',
  hover: '#319795', wait: '#319795',
  moveForward: '#3182ce', moveBackward: '#3182ce',
  strafeLeft: '#3182ce', strafeRight: '#3182ce',
  moveUp: '#2b6cb0', moveDown: '#2b6cb0',
  rotateCW: '#dd6b20', rotateCCW: '#dd6b20',
}

// ─── inline styles ────────────────────────────────────────────────────────────
const S = {
  panel:       { background:'#151922', borderRight:'1px solid #2d3748', display:'flex' as const, flexDirection:'column' as const, overflow:'hidden' },
  panelHdr:    { padding:'10px 12px', background:'rgba(0,0,0,0.25)', fontWeight:700, textTransform:'uppercase' as const, fontSize:11, color:'#718096', borderBottom:'1px solid #2d3748', display:'flex' as const, justifyContent:'space-between' as const },
  lbl:         { fontSize:10, textTransform:'uppercase' as const, color:'#718096', marginBottom:8, display:'block' as const },
  grid2:       { display:'grid' as const, gridTemplateColumns:'1fr 1fr', gap:6 },
  toolBtn:     { background:'#0f1115', border:'1px solid #2d3748', color:'#e2e8f0', padding:'8px', textAlign:'left' as const, cursor:'pointer', borderRadius:4, fontSize:11, fontFamily:'inherit', transition:'border-color 0.15s' },
  sel:         { background:'#0f1115', color:'#e2e8f0', border:'1px solid #2d3748', padding:'4px 8px', borderRadius:4, fontFamily:'inherit', cursor:'pointer', fontSize:12 },
  btnPrimary:  { background:'#d97706', color:'#000', border:'none', padding:'6px 18px', fontWeight:700, borderRadius:2, cursor:'pointer', textTransform:'uppercase' as const, fontFamily:'inherit', fontSize:12 },
  btnSec:      { background:'#0f1115', color:'#e2e8f0', border:'1px solid #2d3748', padding:'4px 10px', borderRadius:2, cursor:'pointer', fontFamily:'inherit', fontSize:11 },
}

// ─── Three.js helpers ─────────────────────────────────────────────────────────
function initThree(container: HTMLDivElement) {
  console.log('[initThree] Called with container', { w: container.clientWidth, h: container.clientHeight })
  const w = container.clientWidth || 800
  const h = container.clientHeight || 500

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h)
  renderer.shadowMap.enabled = true
  renderer.setClearColor(0x0b0e14, 1)
  
  // Ensure canvas is visible
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  
  container.appendChild(renderer.domElement)
  console.log('[initThree] Canvas appended', { canvas: renderer.domElement, w, h, parent: container })

  const scene = new THREE.Scene()
  scene.fog = new THREE.FogExp2(0x0b0e14, 0.02)

  const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000)
  camera.position.set(8, 5, 8)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.maxPolarAngle = Math.PI / 2 - 0.05
  controls.target.set(0, 0, 0)

  // lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.4))
  const sun = new THREE.DirectionalLight(0xffffff, 0.8)
  sun.position.set(10, 20, 10)
  sun.castShadow = true
  sun.shadow.mapSize.width = 2048
  sun.shadow.mapSize.height = 2048
  scene.add(sun)

  // grid + floor
  const grid = new THREE.GridHelper(50, 50, 0x4a5568, 0x1a202c)
  scene.add(grid)
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 1 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.01
  floor.receiveShadow = true
  scene.add(floor)

  console.log('[initThree] Scene setup complete', { sceneChildren: scene.children.length })
  return { renderer, scene, camera, controls }
}

async function makeDrone() {
  const group = new THREE.Group()

  try {
    // Try to load the GLB model
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
    const loader = new GLTFLoader()
    
    const gltf = await new Promise<any>((resolve, reject) => {
      loader.load('/models/temp.glb', resolve, undefined, reject)
    })
    
    const model = gltf.scene
    
    // Scale and center the model
    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    
    // Scale to approximately 0.4 units (40cm drone)
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = 0.4 / maxDim
    model.scale.setScalar(scale)
    
    // Center the model
    model.position.sub(center.multiplyScalar(scale))
    
    // Enable shadows
    model.traverse((child: any) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    
    group.add(model)
    console.log('[makeDrone] GLB model loaded successfully')
    
  } catch (error) {
    console.warn('[makeDrone] Failed to load GLB, using fallback geometry', error)
    
    // Fallback: procedural drone
    const bodyGeo = new THREE.BoxGeometry(0.4, 0.1, 0.6)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2d3748 })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.castShadow = true
    group.add(body)

    const armGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.8)
    const armMat = new THREE.MeshStandardMaterial({ color: 0x718096 })

    const arm1 = new THREE.Mesh(armGeo, armMat)
    arm1.rotation.z = Math.PI / 2
    arm1.rotation.y = Math.PI / 4
    group.add(arm1)

    const arm2 = new THREE.Mesh(armGeo, armMat)
    arm2.rotation.z = Math.PI / 2
    arm2.rotation.y = -Math.PI / 4
    group.add(arm2)

    const rotorGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.01, 16)
    const rotorMat = new THREE.MeshBasicMaterial({ color: 0xd97706, transparent: true, opacity: 0.8 })
    const positions = [
      { x: 0.28, z: 0.28 },
      { x: -0.28, z: -0.28 },
      { x: 0.28, z: -0.28 },
      { x: -0.28, z: 0.28 },
    ]

    positions.forEach((position) => {
      const rotor = new THREE.Mesh(rotorGeo, rotorMat)
      rotor.position.set(position.x, 0.06, position.z)
      rotor.userData.isRotor = true
      group.add(rotor)
    })
  }

  // Add point light regardless of model type
  const light = new THREE.PointLight(0xe2e8f0, 1, 5)
  light.position.set(0, 0.2, 0)
  group.add(light)

  return group
}

// ─── PropRow ──────────────────────────────────────────────────────────────────
function PropRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
      <span style={{ color:'#718096', fontSize:11 }}>{label}</span>
      <input
        type="number" key={value} defaultValue={value}
        onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v) }}
        style={{ background:'#0f1115', border:'1px solid #2d3748', color:'#d97706', padding:'3px 6px', width:76, textAlign:'right', fontFamily:'inherit', borderRadius:2, fontSize:11 }}
      />
    </div>
  )
}

// ─── Timeline ─────────────────────────────────────────────────────────────────
// Assigns each instruction to a lane, allowing stacking via stackNextBy property
function buildLanes(instructions: Array<{ id: string; kind: string; label: string; duration: number; delayAfter: number; stackNextBy: number; enabled: boolean; timelineLane?: number }>) {
  const laneEnds: number[] = []
  let cursor = 0
  return instructions.filter(i => i.enabled).map(inst => {
    const start = cursor
    const end = start + inst.duration
    
    // Stack next instruction by moving cursor back
    cursor += inst.duration + inst.delayAfter - inst.stackNextBy

    // find first lane that's free at `start`
    let lane = typeof inst.timelineLane === 'number' && inst.timelineLane >= 0
      ? inst.timelineLane
      : laneEnds.findIndex(e => e <= start)
    if (lane === -1) { lane = laneEnds.length }
    laneEnds[lane] = end

    return { inst, start, end, lane }
  })
}

const LANE_H = 36
const LANE_GAP = 4
const TIMELINE_PAD_TOP = 24 // space for playhead handle

// ─── Main component ───────────────────────────────────────────────────────────
export function AeroPlan() {
  const { missionId } = useParams<{ missionId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  // refs for Three.js — never cause re-renders
  const mountRef   = useRef<HTMLDivElement>(null)
  const threeRef   = useRef<ReturnType<typeof initThree> | null>(null)
  const droneRef   = useRef<THREE.Group | null>(null)
  const planRef    = useRef<THREE.Line | null>(null)
  const actualRef  = useRef<THREE.Line | null>(null)
  const objMeshes  = useRef<Map<string, THREE.Object3D>>(new Map())
  const rafRef     = useRef(0)
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseRef   = useRef(new THREE.Vector2())
  const dragStateRef = useRef<{ objectId: string; startPos: THREE.Vector3; plane: THREE.Plane; mode: 'translate' | 'rotate'; startRotation?: number; startMouseAngle?: number } | null>(null)
  const followModeRef = useRef<string | null>(null) // objectId in follow mode
  const hoveredObjectRef = useRef<string | null>(null)
  const rotationModeRef = useRef(false) // R key held for rotation
  const spawnPlacementModeRef = useRef(false)
  const measurementModeRef = useRef(false)
  const measurementTargetRef = useRef<string | null>(null) // Object being measured from
  const measurementLineRef = useRef<THREE.Line | null>(null)
  const transformControlsRef = useRef<TransformControls | null>(null)
  const missionLoadedRef = useRef(false)
  const saveTimerRef = useRef<number | null>(null)
  const [, forceUpdate] = useState({})
  const [missionLoading, setMissionLoading] = useState(Boolean(missionId))
  const [missionTitle, setMissionTitle] = useState<string>('Flight Sim')
  const [missionLoadError, setMissionLoadError] = useState<string | null>(null)
  const [currentMission, setCurrentMission] = useState<Mission | null>(null)
  const [duplicatingMission, setDuplicatingMission] = useState(false)

  // store slice
  const store = useProjectStore(useShallow(s => ({
    project:             s.project,
    activeLayoutId:      s.activeLayoutId,
    activeRouteId:       s.activeRouteId,
    run:                 s.run,
    isSolving:           s.isSolving,
    playbackTime:        s.playbackTime,
    playbackState:       s.playbackState,
    playbackSpeed:       s.playbackSpeed,
    selectedInstructionId: s.selectedInstructionId,
    selectedObjectId:    s.selectedObjectId,
    snapToGrid:          s.snapToGrid,
    past:                s.past,
    future:              s.future,
    setPlaybackState:    s.setPlaybackState,
    setPlaybackTime:     s.setPlaybackTime,
    setPlaybackSpeed:    s.setPlaybackSpeed,
    resetPlayback:       s.resetPlayback,
    runQuickSimulation:  s.runQuickSimulation,
    addInstruction:      s.addInstruction,
    addFieldObject:      s.addFieldObject,
    selectInstruction:   s.selectInstruction,
    selectObject:        s.selectObject,
    updateInstruction:   s.updateInstruction,
    updateFieldObject:   s.updateFieldObject,
    updateSpawn:         s.updateSpawn,
    deleteInstruction:   s.deleteInstruction,
    deleteFieldObject:   s.deleteFieldObject,
    moveInstruction:     s.moveInstruction,
    setActiveRoute:      s.setActiveRoute,
    setActiveLayout:     s.setActiveLayout,
    setSnapToGrid:       s.setSnapToGrid,
    undo:                s.undo,
    redo:                s.redo,
    importProjectFromJson: s.importProjectFromJson,
  })))

  const layout = store.project.fieldLayouts.find(l => l.id === store.activeLayoutId) ?? store.project.fieldLayouts[0]
  const route  = store.project.routeVersions.find(r => r.id === store.activeRouteId)  ?? store.project.routeVersions[0]

  // ── boot Three.js once ────────────────────────────────────────────────────
  useEffect(() => {
    console.log('[AeroPlan] useEffect STARTED', { USE_REFERENCE_VIEWPORT })
    if (USE_REFERENCE_VIEWPORT) return

    // Wait for the ref to be attached
    let mounted = true
    let rafId = 0

    const initWhenReady = () => {
      if (!mounted) return

      const el = mountRef.current
      if (!el) {
        console.warn('[AeroPlan] mountRef.current is null, retrying...')
        rafId = requestAnimationFrame(initWhenReady)
        return
      }

      const w = el.clientWidth
      const h = el.clientHeight
      
      if (w === 0 || h === 0) {
        console.warn('[AeroPlan] Element has zero dimensions, retrying...', { w, h })
        rafId = requestAnimationFrame(initWhenReady)
        return
      }

      console.log('[AeroPlan] Initializing Three.js', { w, h })

      const three = initThree(el)
      threeRef.current = three

      // Add TransformControls for 3D gizmo
      const transformControls = new TransformControls(three.camera, three.renderer.domElement)
      transformControls.setMode('translate')
      transformControls.setSize(0.8)
      transformControls.enabled = true
      three.scene.add(transformControls as any)
      transformControlsRef.current = transformControls

      // Disable orbit controls when using transform controls
      transformControls.addEventListener('dragging-changed', (event) => {
        three.controls.enabled = !event.value
      })

      // Update object position when transform controls change
      const selectedObjectIdRef = { current: '' }
      transformControls.addEventListener('objectChange', () => {
        const attached = transformControls.object
        if (attached && selectedObjectIdRef.current) {
          const s = WORLD_SCALE
          const newPos = {
            x: attached.position.x / s,
            y: attached.position.y / s,
            z: attached.position.z / s,
          }
          // Find the object ID from the mesh
          const objectId = Array.from(objMeshes.current.entries()).find(([_, m]) => m === attached)?.[0]
          if (objectId) {
            store.updateFieldObject(objectId, { position: newPos })
          }
        }
      })
      
      // Store ref updater for transform controls
      ;(transformControls as any)._selectedIdRef = selectedObjectIdRef

      makeDrone().then(drone => {
        three.scene.add(drone)
        // Position drone at spawn point
        const s = WORLD_SCALE
        const spawn = layout.spawn.position
        drone.position.set(spawn.x * s, spawn.y * s, spawn.z * s)
        droneRef.current = drone
      })

      const onResize = () => {
        if (!el) return
        const w = el.clientWidth, h = el.clientHeight
        three.camera.aspect = w / h
        three.camera.updateProjectionMatrix()
        three.renderer.setSize(w, h)
      }
      window.addEventListener('resize', onResize)
      const resizeObserver = new ResizeObserver(() => onResize())
      resizeObserver.observe(el)

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick)
        if (droneRef.current) {
          droneRef.current.children.forEach((child, index) => {
            if (child.userData.isRotor) {
              child.rotation.y += 0.45 + index * 0.02
            }
          })
        }
        three.controls.update()
        three.renderer.render(three.scene, three.camera)
      }
      console.log('[AeroPlan] Starting animation loop')
      tick()
    }

    // Start checking for element
    rafId = requestAnimationFrame(initWhenReady)

    return () => {
      mounted = false
      if (rafId) cancelAnimationFrame(rafId)
      cancelAnimationFrame(rafRef.current)
      
      const three = threeRef.current
      if (three) {
        const el = mountRef.current
        window.removeEventListener('resize', () => {})
        three.renderer.dispose()
        if (transformControlsRef.current) {
          transformControlsRef.current.dispose()
        }
        if (el && el.contains(three.renderer.domElement)) {
          el.removeChild(three.renderer.domElement)
        }
      }
    }
  }, [])

  // ── keyboard controls for object manipulation ─────────────────────────────
  useEffect(() => {
    const GRID_SIZE = 0.4 // 40cm in world units
    const MOVE_STEP = 0.1 // 10cm per arrow key press
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // R key - enable rotation mode
      if (e.key === 'r' || e.key === 'R') {
        rotationModeRef.current = true
        e.preventDefault()
        return
      }
      
      // Ctrl+Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        store.undo()
        e.preventDefault()
        return
      }
      
      // Ctrl+Y or Ctrl+Shift+Z - Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        store.redo()
        e.preventDefault()
        return
      }
      
      // Delete key - remove hovered or selected object
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const targetId = hoveredObjectRef.current || store.selectedObjectId
        if (targetId) {
          const obj = layout.objects.find(o => o.id === targetId)
          if (obj) {
            store.deleteFieldObject(targetId)
            hoveredObjectRef.current = null
            store.selectObject(null)
          }
        }
        e.preventDefault()
        return
      }
      
      // C key - focus camera on drone
      if (e.key === 'c' || e.key === 'C') {
        const three = threeRef.current
        const drone = droneRef.current
        if (three && drone) {
          const targetPos = drone.position.clone()
          const offset = new THREE.Vector3(4, 3, 4)
          three.camera.position.copy(targetPos.clone().add(offset))
          three.controls.target.copy(targetPos)
        }
        e.preventDefault()
        return
      }
      
      // F key - toggle measurement mode
      if (e.key === 'f' || e.key === 'F') {
        if (!measurementModeRef.current) {
          // Entering measurement mode - set target to selected object
          if (store.selectedObjectId) {
            measurementModeRef.current = true
            measurementTargetRef.current = store.selectedObjectId
            forceUpdate({})
          }
        } else {
          // Exiting measurement mode
          measurementModeRef.current = false
          measurementTargetRef.current = null
          if (measurementLineRef.current && threeRef.current) {
            threeRef.current.scene.remove(measurementLineRef.current)
            measurementLineRef.current = null
          }
          forceUpdate({})
        }
        e.preventDefault()
        return
      }
      
      // ESC - clear measurement or exit modes
      if (e.key === 'Escape') {
        measurementModeRef.current = false
        measurementTargetRef.current = null
        spawnPlacementModeRef.current = false
        if (measurementLineRef.current && threeRef.current) {
          threeRef.current.scene.remove(measurementLineRef.current)
          measurementLineRef.current = null
        }
        forceUpdate({})
        e.preventDefault()
        return
      }
      
      // G key - switch to translate mode
      if (e.key === 'g' || e.key === 'G') {
        if (transformControlsRef.current) {
          transformControlsRef.current.setMode('translate')
        }
        e.preventDefault()
        return
      }
      
      // R key - switch to rotate mode
      if (e.key === 'r' || e.key === 'R') {
        if (transformControlsRef.current) {
          transformControlsRef.current.setMode('rotate')
        }
        e.preventDefault()
        return
      }
      
      // S key - switch to scale mode
      if (e.key === 's' || e.key === 'S') {
        if (transformControlsRef.current) {
          transformControlsRef.current.setMode('scale')
        }
        e.preventDefault()
        return
      }
      
      if (!store.selectedObjectId) return
      
      const obj = layout.objects.find(o => o.id === store.selectedObjectId)
      if (!obj) return
      
      let dx = 0, dy = 0, dz = 0
      
      switch(e.key) {
        case 'ArrowUp':
          if (e.shiftKey) {
            dy = GRID_SIZE
          } else {
            dy = MOVE_STEP
          }
          e.preventDefault()
          break
        case 'ArrowDown':
          if (e.shiftKey) {
            dy = -GRID_SIZE
          } else {
            dy = -MOVE_STEP
          }
          e.preventDefault()
          break
        case 'Shift':
          // Toggle snap to grid
          store.setSnapToGrid(!store.snapToGrid)
          return
      }
      
      if (dx !== 0 || dy !== 0 || dz !== 0) {
        const newPos = {
          x: obj.position.x + dx,
          y: Math.max(0, obj.position.y + dy),
          z: obj.position.z + dz,
        }
        
        if (store.snapToGrid) {
          newPos.x = Math.round(newPos.x / GRID_SIZE) * GRID_SIZE
          newPos.z = Math.round(newPos.z / GRID_SIZE) * GRID_SIZE
        }
        
        store.updateFieldObject(store.selectedObjectId, { position: newPos })
      }
    }
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // R key released - disable rotation mode
      if (e.key === 'r' || e.key === 'R') {
        rotationModeRef.current = false
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [store.selectedObjectId, layout.objects, store.snapToGrid])

  // ── mouse interaction for object selection and dragging ───────────────────
  useEffect(() => {
    const el = mountRef.current
    const three = threeRef.current
    if (!el || !three) return
    
    const GRID_SIZE = 0.4
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!three) return
      
      const rect = el.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      
      raycasterRef.current.setFromCamera(mouseRef.current, three.camera)
      
      // Update hover state
      const meshes = Array.from(objMeshes.current.values())
      const intersects = raycasterRef.current.intersectObjects(meshes, true)
      
      if (intersects.length > 0) {
        let clickedMesh = intersects[0].object as THREE.Mesh
        while (clickedMesh.parent && !meshes.includes(clickedMesh as THREE.Mesh)) {
          clickedMesh = clickedMesh.parent as THREE.Mesh
        }
        const objectId = Array.from(objMeshes.current.entries()).find(([_, m]) => m === clickedMesh)?.[0]
        hoveredObjectRef.current = objectId ?? null
      } else {
        hoveredObjectRef.current = null
      }
      
      // Spawn placement mode - drone follows cursor
      if (spawnPlacementModeRef.current && droneRef.current) {
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
        const intersection = new THREE.Vector3()
        if (raycasterRef.current.ray.intersectPlane(groundPlane, intersection)) {
          droneRef.current.position.copy(intersection)
          droneRef.current.position.y = 0.05 // Slight hover above ground
        }
      }
      
      // Measurement mode - draw line from target to hovered object
      if (measurementModeRef.current && measurementTargetRef.current && hoveredObjectRef.current) {
        const targetObj = layout.objects.find(o => o.id === measurementTargetRef.current)
        const hoveredObj = layout.objects.find(o => o.id === hoveredObjectRef.current)
        
        if (targetObj && hoveredObj && measurementTargetRef.current !== hoveredObjectRef.current) {
          const s = WORLD_SCALE
          const p1 = new THREE.Vector3(targetObj.position.x * s, targetObj.position.y * s, targetObj.position.z * s)
          const p2 = new THREE.Vector3(hoveredObj.position.x * s, hoveredObj.position.y * s, hoveredObj.position.z * s)
          
          if (measurementLineRef.current) {
            three.scene.remove(measurementLineRef.current)
          }
          
          const geometry = new THREE.BufferGeometry().setFromPoints([p1, p2])
          const material = new THREE.LineBasicMaterial({ color: 0xeab308, linewidth: 3 })
          const line = new THREE.Line(geometry, material)
          three.scene.add(line)
          measurementLineRef.current = line
          forceUpdate({})
        }
      } else if (measurementLineRef.current && !measurementModeRef.current) {
        three.scene.remove(measurementLineRef.current)
        measurementLineRef.current = null
      }
      
      // Follow mode
      if (followModeRef.current) {
        const obj = layout.objects.find(o => o.id === followModeRef.current)
        if (obj) {
          const s = WORLD_SCALE
          const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -obj.position.y * s)
          const intersection = new THREE.Vector3()
          if (raycasterRef.current.ray.intersectPlane(plane, intersection)) {
            let newX = intersection.x / s
            let newZ = intersection.z / s
            
            if (store.snapToGrid) {
              newX = Math.round(newX / GRID_SIZE) * GRID_SIZE
              newZ = Math.round(newZ / GRID_SIZE) * GRID_SIZE
            }
            
            store.updateFieldObject(followModeRef.current, {
              position: { x: newX, y: obj.position.y, z: newZ }
            })
          }
        }
        return
      }
      
      // Drag mode
      if (dragStateRef.current) {
        if (dragStateRef.current.mode === 'rotate') {
          // Rotation mode - calculate angle from object center
          const obj = layout.objects.find(o => o.id === dragStateRef.current?.objectId)
          if (obj) {
            const s = WORLD_SCALE
            const objPos = new THREE.Vector3(obj.position.x * s, obj.position.y * s, obj.position.z * s)
            
            // Project mouse ray onto ground plane
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -objPos.y)
            const intersection = new THREE.Vector3()
            if (raycasterRef.current.ray.intersectPlane(groundPlane, intersection)) {
              // Calculate angle from object center to mouse
              const dx = intersection.x - objPos.x
              const dz = intersection.z - objPos.z
              const mouseAngle = Math.atan2(dx, dz)
              
              // Calculate rotation delta
              const angleDelta = mouseAngle - (dragStateRef.current.startMouseAngle ?? 0)
              const newRotation = (dragStateRef.current.startRotation ?? 0) + (angleDelta * 180 / Math.PI)
              
              store.updateFieldObject(dragStateRef.current.objectId, {
                rotation: { ...obj.rotation, y: newRotation }
              })
            }
          }
        } else {
          // Translation mode
          const intersection = new THREE.Vector3()
          if (raycasterRef.current.ray.intersectPlane(dragStateRef.current.plane, intersection)) {
            const s = WORLD_SCALE
            let newX = intersection.x / s
            let newZ = intersection.z / s
            
            if (store.snapToGrid) {
              newX = Math.round(newX / GRID_SIZE) * GRID_SIZE
              newZ = Math.round(newZ / GRID_SIZE) * GRID_SIZE
            }
            
            const obj = layout.objects.find(o => o.id === dragStateRef.current?.objectId)
            if (obj) {
              store.updateFieldObject(dragStateRef.current.objectId, {
                position: { x: newX, y: obj.position.y, z: newZ }
              })
            }
          }
        }
      }
    }
    
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return // left click only
      
      const rect = el.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      
      raycasterRef.current.setFromCamera(mouseRef.current, three.camera)
      
      // Ctrl+Click for spawn placement
      if (e.ctrlKey || e.metaKey) {
        // If already in spawn placement mode, place the spawn point
        if (spawnPlacementModeRef.current) {
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
          const intersection = new THREE.Vector3()
          if (raycasterRef.current.ray.intersectPlane(groundPlane, intersection)) {
            const s = WORLD_SCALE
            let newX = intersection.x / s
            let newZ = intersection.z / s
            
            if (store.snapToGrid) {
              newX = Math.round(newX / GRID_SIZE) * GRID_SIZE
              newZ = Math.round(newZ / GRID_SIZE) * GRID_SIZE
            }
            
            store.updateSpawn({ position: { x: newX, y: 0, z: newZ } })
            spawnPlacementModeRef.current = false
            forceUpdate({})
          }
          return
        }
        
        // Enter spawn placement mode on Ctrl+Click
        spawnPlacementModeRef.current = true
        forceUpdate({})
        return
      }
      
      const meshes = Array.from(objMeshes.current.values())
      const intersects = raycasterRef.current.intersectObjects(meshes, true)
      
      if (intersects.length > 0) {
        // Find which object was clicked
        let clickedMesh = intersects[0].object as THREE.Mesh
        while (clickedMesh.parent && !meshes.includes(clickedMesh as THREE.Mesh)) {
          clickedMesh = clickedMesh.parent as THREE.Mesh
        }
        
        const objectId = Array.from(objMeshes.current.entries()).find(([_, m]) => m === clickedMesh)?.[0]
        if (objectId) {
          store.selectObject(objectId)
          
          // Check for double-click (follow mode)
          const now = Date.now()
          const lastClick = (clickedMesh as any)._lastClick || 0
          if (now - lastClick < 300) {
            // Double click - enter follow mode
            followModeRef.current = objectId
            three.controls.enabled = false
          } else {
            // Single click - start drag or rotate
            const obj = layout.objects.find(o => o.id === objectId)
            if (obj) {
              const s = WORLD_SCALE
              const worldPos = new THREE.Vector3(obj.position.x * s, obj.position.y * s, obj.position.z * s)
              const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -worldPos.y)
              
              if (rotationModeRef.current) {
                // Rotation mode - calculate initial angle
                const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -worldPos.y)
                const intersection = new THREE.Vector3()
                if (raycasterRef.current.ray.intersectPlane(groundPlane, intersection)) {
                  const dx = intersection.x - worldPos.x
                  const dz = intersection.z - worldPos.z
                  const startMouseAngle = Math.atan2(dx, dz)
                  
                  dragStateRef.current = {
                    objectId,
                    startPos: worldPos.clone(),
                    plane,
                    mode: 'rotate',
                    startRotation: obj.rotation.y,
                    startMouseAngle
                  }
                }
              } else {
                // Translation mode
                dragStateRef.current = { objectId, startPos: worldPos.clone(), plane, mode: 'translate' }
              }
              
              three.controls.enabled = false
            }
          }
          (clickedMesh as any)._lastClick = now
        }
      } else {
        // Clicked empty space - deselect
        store.selectObject(null)
        followModeRef.current = null
      }
    }
    
    const handleMouseUp = () => {
      if (dragStateRef.current || followModeRef.current) {
        if (three) three.controls.enabled = true
        dragStateRef.current = null
        // Don't clear follow mode on mouse up - requires another click
      }
    }
    
    const handleClick = (e: MouseEvent) => {
      // Exit follow mode on any click
      if (followModeRef.current) {
        followModeRef.current = null
        if (three) three.controls.enabled = true
        e.stopPropagation()
      }
    }
    
    // Middle mouse button for vertical camera movement
    const handleWheel = (e: WheelEvent) => {
      if (e.buttons === 4 || e.button === 1) { // Middle mouse
        e.preventDefault()
        const delta = e.deltaY * 0.01
        three.camera.position.y -= delta
        three.controls.target.y -= delta
      }
    }
    
    el.addEventListener('mousedown', handleMouseDown)
    el.addEventListener('mousemove', handleMouseMove)
    el.addEventListener('mouseup', handleMouseUp)
    el.addEventListener('click', handleClick)
    el.addEventListener('wheel', handleWheel, { passive: false })
    
    return () => {
      el.removeEventListener('mousedown', handleMouseDown)
      el.removeEventListener('mousemove', handleMouseMove)
      el.removeEventListener('mouseup', handleMouseUp)
      el.removeEventListener('click', handleClick)
      el.removeEventListener('wheel', handleWheel)
    }
  }, [layout.objects, store.selectedObjectId, store.snapToGrid])

  // ── sync field objects ────────────────────────────────────────────────────
  useEffect(() => {
    const three = threeRef.current
    if (!three) return
    objMeshes.current.forEach(m => {
      three.scene.remove(m)
      if ((m as any)._outline) three.scene.remove((m as any)._outline)
    })
    objMeshes.current.clear()

    // No spawn marker - just use the drone position

    layout.objects.forEach(obj => {
      const s = WORLD_SCALE
      const isSelected = obj.id === store.selectedObjectId
      
      let mesh: THREE.Mesh | THREE.Group
      
      // Create accurate geometry based on object type
      switch (obj.type) {
        case 'archGate': {
          // Red/Blue arch gate with hollow center
          const group = new THREE.Group()
          const outerW = obj.size.x * s
          const outerH = obj.size.y * s
          const depth = obj.size.z * s
          const innerW = (obj.metadata?.innerWidthCm ?? 152.4) * s
          const innerH = (obj.metadata?.innerHeightCm ?? 160) * s
          const thickness = (outerW - innerW) / 2
          
          const mat = new THREE.MeshStandardMaterial({ 
            color: obj.color ?? '#ef4444', 
            roughness: 0.4, 
            metalness: 0.2,
            emissive: isSelected ? 0xd97706 : 0x000000,
            emissiveIntensity: isSelected ? 0.3 : 0,
          })
          
          // Left pillar
          const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(thickness, outerH, depth), mat)
          leftPillar.position.set(-outerW/2 + thickness/2, 0, 0)
          leftPillar.castShadow = true
          group.add(leftPillar)
          
          // Right pillar
          const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(thickness, outerH, depth), mat)
          rightPillar.position.set(outerW/2 - thickness/2, 0, 0)
          rightPillar.castShadow = true
          group.add(rightPillar)
          
          // Top beam
          const topBeam = new THREE.Mesh(new THREE.BoxGeometry(outerW, outerH - innerH, depth), mat)
          topBeam.position.set(0, outerH/2 - (outerH - innerH)/2, 0)
          topBeam.castShadow = true
          group.add(topBeam)
          
          mesh = group
          break
        }
        
        case 'keyholeGate': {
          // Yellow/Green circular gate
          const group = new THREE.Group()
          const outerD = obj.size.x * s
          const innerD = (obj.metadata?.innerDiameterCm ?? 61) * s
          const depth = obj.size.z * s
          
          const mat = new THREE.MeshStandardMaterial({ 
            color: obj.color ?? '#eab308', 
            roughness: 0.4, 
            metalness: 0.2,
            emissive: isSelected ? 0xd97706 : 0x000000,
            emissiveIntensity: isSelected ? 0.3 : 0,
          })
          
          // Outer ring
          const outerRing = new THREE.Mesh(
            new THREE.CylinderGeometry(outerD/2, outerD/2, depth, 32),
            mat
          )
          outerRing.rotation.x = Math.PI / 2
          outerRing.castShadow = true
          group.add(outerRing)
          
          // Inner hole (subtract geometry visually with darker inner ring)
          const innerRing = new THREE.Mesh(
            new THREE.CylinderGeometry(innerD/2, innerD/2, depth * 1.1, 32),
            new THREE.MeshStandardMaterial({ color: 0x0b0e14, transparent: true, opacity: 0 })
          )
          innerRing.rotation.x = Math.PI / 2
          group.add(innerRing)
          
          mesh = group
          break
        }
        
        case 'tunnel': {
          // Blue fabric tunnel
          const diameter = obj.size.y * s
          const length = obj.size.x * s
          
          const mat = new THREE.MeshStandardMaterial({ 
            color: obj.color ?? '#3b82f6', 
            roughness: 0.7, 
            metalness: 0.1,
            emissive: isSelected ? 0xd97706 : 0x000000,
            emissiveIntensity: isSelected ? 0.3 : 0,
            side: THREE.DoubleSide,
          })
          
          const cylinder = new THREE.Mesh(
            new THREE.CylinderGeometry(diameter/2, diameter/2, length, 16, 1, true),
            mat
          )
          cylinder.rotation.z = Math.PI / 2
          cylinder.castShadow = true
          mesh = cylinder
          break
        }
        
        case 'flyThroughPanel': {
          // Tri-fold panel with holes
          const group = new THREE.Group()
          const sectionW = (obj.metadata?.sectionWidthCm ?? 50.8) * s
          const height = obj.size.y * s
          const depth = obj.size.z * s
          
          const mat = new THREE.MeshStandardMaterial({ 
            color: obj.color ?? '#f59e0b', 
            roughness: 0.6, 
            metalness: 0.1,
            emissive: isSelected ? 0xd97706 : 0x000000,
            emissiveIntensity: isSelected ? 0.3 : 0,
          })
          
          // Three panels
          for (let i = 0; i < 3; i++) {
            const panel = new THREE.Mesh(
              new THREE.BoxGeometry(sectionW, height, depth),
              mat
            )
            panel.position.set((i - 1) * sectionW, 0, 0)
            panel.castShadow = true
            group.add(panel)
          }
          
          mesh = group
          break
        }
        
        case 'colorMat': {
          // Flat colored mat on ground
          const mat = new THREE.MeshStandardMaterial({ 
            color: obj.colorTag === 'red' ? '#ef4444' : obj.colorTag === 'green' ? '#22c55e' : '#3b82f6',
            roughness: 0.8, 
            metalness: 0.1,
            emissive: isSelected ? 0xd97706 : 0x000000,
            emissiveIntensity: isSelected ? 0.3 : 0,
          })
          
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(obj.size.x * s, obj.size.y * s, obj.size.z * s),
            mat
          )
          mesh.receiveShadow = true
          break
        }
        
        case 'programmingMat': {
          // Large patterned mat
          const mat = new THREE.MeshStandardMaterial({ 
            color: obj.color ?? '#64748b',
            roughness: 0.9, 
            metalness: 0.05,
            emissive: isSelected ? 0xd97706 : 0x000000,
            emissiveIntensity: isSelected ? 0.3 : 0,
          })
          
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(obj.size.x * s, obj.size.y * s, obj.size.z * s),
            mat
          )
          mesh.receiveShadow = true
          break
        }
        
        case 'landingPad': {
          // Circular landing pad with bullseye
          const group = new THREE.Group()
          const outerD = obj.size.x * s
          const bullseyeD = (obj.metadata?.bullseyeDiameterCm ?? 25.4) * s
          const thickness = obj.size.y * s
          
          // Outer circle
          const outer = new THREE.Mesh(
            new THREE.CylinderGeometry(outerD/2, outerD/2, thickness, 32),
            new THREE.MeshStandardMaterial({ 
              color: obj.color ?? '#84cc16', 
              roughness: 0.7,
              emissive: isSelected ? 0xd97706 : 0x000000,
              emissiveIntensity: isSelected ? 0.3 : 0,
            })
          )
          outer.receiveShadow = true
          group.add(outer)
          
          // Bullseye
          const bullseye = new THREE.Mesh(
            new THREE.CylinderGeometry(bullseyeD/2, bullseyeD/2, thickness * 1.1, 32),
            new THREE.MeshStandardMaterial({ color: '#fbbf24', roughness: 0.7 })
          )
          bullseye.position.y = thickness * 0.05
          group.add(bullseye)
          
          mesh = group
          break
        }
        
        case 'miniArchGate': {
          // Black mini arch
          const group = new THREE.Group()
          const outerW = obj.size.x * s
          const outerH = obj.size.y * s
          const depth = obj.size.z * s
          const innerW = (obj.metadata?.innerWidthCm ?? 71.1) * s
          const innerH = (obj.metadata?.innerHeightCm ?? 71.1) * s
          const thickness = (outerW - innerW) / 2
          
          const mat = new THREE.MeshStandardMaterial({ 
            color: '#1f2937', 
            roughness: 0.6,
            emissive: isSelected ? 0xd97706 : 0x000000,
            emissiveIntensity: isSelected ? 0.3 : 0,
          })
          
          // Left pillar
          const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(thickness, outerH, depth), mat)
          leftPillar.position.set(-outerW/2 + thickness/2, 0, 0)
          leftPillar.castShadow = true
          group.add(leftPillar)
          
          // Right pillar
          const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(thickness, outerH, depth), mat)
          rightPillar.position.set(outerW/2 - thickness/2, 0, 0)
          rightPillar.castShadow = true
          group.add(rightPillar)
          
          // Top beam
          const topBeam = new THREE.Mesh(new THREE.BoxGeometry(outerW, outerH - innerH, depth), mat)
          topBeam.position.set(0, outerH/2 - (outerH - innerH)/2, 0)
          topBeam.castShadow = true
          group.add(topBeam)
          
          mesh = group
          break
        }
        
        case 'pillar': {
          // Foam cylinder
          const mat = new THREE.MeshStandardMaterial({ 
            color: obj.color ?? '#9ca3af', 
            roughness: 0.9,
            emissive: isSelected ? 0xd97706 : 0x000000,
            emissiveIntensity: isSelected ? 0.3 : 0,
          })
          
          mesh = new THREE.Mesh(
            new THREE.CylinderGeometry(obj.size.x * s / 2, obj.size.x * s / 2, obj.size.y * s, 16),
            mat
          )
          mesh.castShadow = true
          break
        }
        
        case 'cubeLarge':
        case 'cubeSmall': {
          // Fabric cube
          const mat = new THREE.MeshStandardMaterial({ 
            color: obj.color ?? '#a855f7', 
            roughness: 0.7,
            emissive: isSelected ? 0xd97706 : 0x000000,
            emissiveIntensity: isSelected ? 0.3 : 0,
          })
          
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(obj.size.x * s, obj.size.y * s, obj.size.z * s),
            mat
          )
          mesh.castShadow = true
          break
        }
        
        default: {
          // Default box for other objects
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(obj.size.x * s, obj.size.y * s, obj.size.z * s),
            new THREE.MeshStandardMaterial({ 
              color: obj.color ?? '#4a5568', 
              roughness: 0.3, 
              metalness: 0.4,
              emissive: isSelected ? 0xd97706 : 0x000000,
              emissiveIntensity: isSelected ? 0.3 : 0,
            }),
          )
          mesh.castShadow = true
        }
      }
      
      mesh.position.set(obj.position.x * s, obj.position.y * s, obj.position.z * s)
      mesh.rotation.y = (obj.rotation.y * Math.PI) / 180
      three.scene.add(mesh)
      objMeshes.current.set(obj.id, mesh as any)
      
      // Add selection outline
      if (isSelected) {
        const box = new THREE.Box3().setFromObject(mesh)
        const size = box.getSize(new THREE.Vector3())
        const outline = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
          new THREE.LineBasicMaterial({ color: 0xd97706, linewidth: 2 })
        )
        outline.position.copy(mesh.position)
        outline.rotation.copy(mesh.rotation)
        three.scene.add(outline)
        ;(mesh as any)._outline = outline
      }
    })
    
    return () => {
      objMeshes.current.forEach(m => {
        if ((m as any)._outline) {
          three.scene.remove((m as any)._outline)
        }
      })
    }
  }, [layout.objects, layout.spawn.position, store.selectedObjectId])

  // ── sync drone position with spawn point ─────────────────────────────────
  useEffect(() => {
    const drone = droneRef.current
    if (!drone || !layout.spawn) return
    
    const s = WORLD_SCALE
    const spawn = layout.spawn.position
    drone.position.set(spawn.x * s, spawn.y * s, spawn.z * s)
  }, [layout.spawn.position])

  // ── attach transform controls to selected object (runs after objects sync) ──
  useEffect(() => {
    const transformControls = transformControlsRef.current
    if (!transformControls) return

    // Update the selected ID ref for the event handler
    if ((transformControls as any)._selectedIdRef) {
      (transformControls as any)._selectedIdRef.current = store.selectedObjectId || ''
    }

    // Small delay to ensure objects are fully created
    const timeoutId = setTimeout(() => {
      if (store.selectedObjectId) {
        const mesh = objMeshes.current.get(store.selectedObjectId)
        if (mesh) {
          transformControls.attach(mesh)
          ;(transformControls as any).visible = true
        }
      } else {
        transformControls.detach()
        ;(transformControls as any).visible = false
      }
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [store.selectedObjectId, layout.objects])

  // ── draw planned path when run changes ───────────────────────────────────
  useEffect(() => {
    const three = threeRef.current
    if (!three) return
    if (planRef.current) { three.scene.remove(planRef.current); planRef.current = null }
    if (!store.run) return

    const pts = store.run.plannedSegments.flatMap(seg =>
      seg.plannedPoints.map(p => new THREE.Vector3(p.x * WORLD_SCALE, p.y * WORLD_SCALE, p.z * WORLD_SCALE))
    )
    if (pts.length < 2) return
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineDashedMaterial({ color: 0x4a5568, dashSize: 0.12, gapSize: 0.06, opacity: 0.55, transparent: true }),
    )
    line.computeLineDistances()
    three.scene.add(line)
    planRef.current = line
  }, [store.run])

  // ── move drone + draw actual path on playback tick ────────────────────────
  useEffect(() => {
    const three = threeRef.current
    if (!three || !store.run || !droneRef.current) return
    const trace = store.run.trace
    if (!trace.length) return

    // nearest trace point
    let pt = trace[0]
    for (const t of trace) {
      if (Math.abs(t.time - store.playbackTime) < Math.abs(pt.time - store.playbackTime)) pt = t
    }
    const s = WORLD_SCALE
    droneRef.current.position.set(pt.actualPosition.x * s, pt.actualPosition.y * s, pt.actualPosition.z * s)
    droneRef.current.rotation.y = -(pt.actualHeading * Math.PI) / 180

    // actual path so far
    if (actualRef.current) { three.scene.remove(actualRef.current); actualRef.current = null }
    const aPts = trace
      .filter(t => t.time <= store.playbackTime)
      .map(t => new THREE.Vector3(t.actualPosition.x * s, t.actualPosition.y * s, t.actualPosition.z * s))
    if (aPts.length >= 2) {
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(aPts),
        new THREE.LineBasicMaterial({ color: 0xd97706 }),
      )
      three.scene.add(line)
      actualRef.current = line
    }
  }, [store.run, store.playbackTime])

  // ── playback interval — uses ref to avoid stale closure ──────────────────
  const playbackTimeRef = useRef(store.playbackTime)
  playbackTimeRef.current = store.playbackTime

  useEffect(() => {
    if (store.playbackState !== 'playing' || !store.run) return
    const totalTime = store.run.metrics.totalTime
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const next = playbackTimeRef.current + ((now - last) / 1000) * store.playbackSpeed
      last = now
      if (next >= totalTime) {
        store.setPlaybackTime(totalTime)
        store.setPlaybackState('paused')
      } else {
        store.setPlaybackTime(next)
      }
    }, PLAYBACK_TICK_MS)
    return () => window.clearInterval(id)
  }, [store.playbackState, store.playbackSpeed, store.run])

  // ── derived ───────────────────────────────────────────────────────────────
  const trace = store.run?.trace ?? []
  const activePt = trace.length
    ? trace.reduce((a, b) => Math.abs(b.time - store.playbackTime) < Math.abs(a.time - store.playbackTime) ? b : a)
    : null
  const totalDuration = store.run?.metrics.totalTime ?? 0
  const lanes = buildLanes(route.instructions)
  const laneCount = Math.max(1, ...lanes.map(l => l.lane + 1))
  const timelineContentH = TIMELINE_PAD_TOP + laneCount * (LANE_H + LANE_GAP)
  const selectedInst = route.instructions.find(i => i.id === store.selectedInstructionId)
  const selectedObj = layout.objects.find(o => o.id === store.selectedObjectId)
  const readOnlyMission = Boolean(missionId && currentMission && currentMission.ownerId !== user?.uid)

  useEffect(() => {
    if (!missionId) {
      missionLoadedRef.current = false
      setMissionLoading(false)
      setMissionLoadError(null)
      setMissionTitle(store.project.name)
      setCurrentMission(null)
      return
    }

    let cancelled = false

    const loadMission = async () => {
      setMissionLoading(true)
      setMissionLoadError(null)

      try {
        const mission = await workspaceService.getMission(missionId)
        if (!mission) {
          throw new Error('Mission not found.')
        }

        if (cancelled) {
          return
        }

        setCurrentMission(mission)
        setMissionTitle(mission.title)
        await store.importProjectFromJson(JSON.stringify(mission.data))
        missionLoadedRef.current = true
      } catch (error) {
        if (!cancelled) {
          setMissionLoadError(error instanceof Error ? error.message : 'Unable to load mission.')
        }
      } finally {
        if (!cancelled) {
          setMissionLoading(false)
        }
      }
    }

    void loadMission()

    return () => {
      cancelled = true
    }
  }, [missionId])

  useEffect(() => {
    if (!missionId || !missionLoadedRef.current || missionLoading || missionLoadError || readOnlyMission) {
      return
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(() => {
      void workspaceService.updateMission(missionId, {
        title: store.project.name,
        data: store.project,
        status: 'draft',
      }).then(() => {
        setMissionTitle(store.project.name)
      }).catch((error) => {
        console.error('Failed to sync mission:', error)
      })
    }, 1000)

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [missionId, missionLoadError, missionLoading, readOnlyMission, store.project, store.project.updatedAt])

  const handleDuplicateIntoPersonalWorkspace = async () => {
    if (!missionId || duplicatingMission) {
      return
    }

    setDuplicatingMission(true)
    try {
      const duplicate = await workspaceService.duplicateMission(missionId)
      navigate(`/workspace/${duplicate.id}`)
    } catch (error) {
      console.error('Unable to duplicate mission:', error)
    } finally {
      setDuplicatingMission(false)
    }
  }

  if (missionLoading) {
    return (
      <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'#0b0e14', color:'#e2e8f0', fontFamily:"'JetBrains Mono',monospace" }}>
        <div style={{ textAlign:'center', display:'grid', gap:10 }}>
          <span style={{ color:'#d97706', fontSize:11, textTransform:'uppercase', letterSpacing:3 }}>AeroPlan</span>
          <strong style={{ fontSize:22 }}>Loading mission...</strong>
          <span style={{ color:'#718096', fontSize:13 }}>Fetching simulator data from workspace storage.</span>
        </div>
      </div>
    )
  }

  if (missionLoadError) {
    return (
      <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', background:'#0b0e14', color:'#e2e8f0', fontFamily:"'JetBrains Mono',monospace", padding:'24px' }}>
        <div style={{ maxWidth:520, textAlign:'center', display:'grid', gap:14 }}>
          <span style={{ color:'#d97706', fontSize:11, textTransform:'uppercase', letterSpacing:3 }}>AeroPlan</span>
          <strong style={{ fontSize:22 }}>Unable to open mission</strong>
          <span style={{ color:'#94a3b8', fontSize:14 }}>{missionLoadError}</span>
          <div>
            <Link to="/workspace" style={{ color:'#f59e0b', textDecoration:'none', fontSize:14 }}>Return to workspace</Link>
          </div>
        </div>
      </div>
    )
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#0b0e14', color:'#e2e8f0', fontFamily:"'JetBrains Mono',monospace", fontSize:13, overflow:'hidden' }}>

      {/* ── HEADER ── */}
      <header style={{ height:50, background:'#151922', borderBottom:'1px solid #2d3748', display:'flex', alignItems:'center', padding:'0 16px', justifyContent:'space-between', flexShrink:0 }}>
        <div style={{ fontWeight:700, color:'#d97706', letterSpacing:1, display:'flex', alignItems:'center', gap:8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/></svg>
          <Link to="/workspace" style={{ color:'#d97706', textDecoration:'none' }}>AERO-PLAN</Link> <span style={{ color:'#718096', fontWeight:300 }}>// {missionTitle}</span>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', opacity: readOnlyMission ? 0.5 : 1, pointerEvents: readOnlyMission ? 'none' : 'auto' }}>
          <button 
            style={{ ...S.btnSec, opacity: store.past.length === 0 ? 0.3 : 1, cursor: store.past.length === 0 ? 'not-allowed' : 'pointer' }} 
            disabled={store.past.length === 0}
            onClick={store.undo}
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button 
            style={{ ...S.btnSec, opacity: store.future.length === 0 ? 0.3 : 1, cursor: store.future.length === 0 ? 'not-allowed' : 'pointer' }} 
            disabled={store.future.length === 0}
            onClick={store.redo}
            title="Redo (Ctrl+Y)"
          >
            ↷ Redo
          </button>
          <div style={{ width:1, height:20, background:'#2d3748' }} />
          <select style={S.sel} value={store.activeRouteId} onChange={e => store.setActiveRoute(e.target.value)}>
            {store.project.routeVersions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <select style={S.sel} value={store.activeLayoutId} onChange={e => store.setActiveLayout(e.target.value)}>
            {store.project.fieldLayouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <div style={{ width:1, height:20, background:'#2d3748' }} />
          <button style={S.btnSec} onClick={() => {
            const t = threeRef.current
            if (t) { t.camera.position.set(4,3,4); t.controls.target.set(0,0,0) }
          }}>Reset Cam</button>
          <button
            style={{ ...S.btnPrimary, background: store.isSolving ? '#c05621' : '#d97706', opacity: store.isSolving ? 0.7 : 1 }}
            disabled={store.isSolving}
            onClick={() => { void store.runQuickSimulation() }}
          >
            {store.isSolving ? 'RUNNING…' : store.run ? 'RE-SIMULATE' : 'SIMULATE'}
          </button>
        </div>
      </header>

      {readOnlyMission ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, padding:'10px 16px', background:'rgba(217, 119, 6, 0.12)', borderBottom:'1px solid rgba(217, 119, 6, 0.35)', color:'#fbbf24', flexShrink:0 }}>
          <div style={{ fontSize:12, lineHeight:1.5 }}>
            This mission belongs to another creator. You can inspect it here, but you need your own duplicate before editing.
          </div>
          <button
            type="button"
            onClick={() => { void handleDuplicateIntoPersonalWorkspace() }}
            style={{ ...S.btnPrimary, whiteSpace:'nowrap', opacity: duplicatingMission ? 0.7 : 1 }}
            disabled={duplicatingMission}
          >
            {duplicatingMission ? 'DUPLICATING...' : 'DUPLICATE TO EDIT'}
          </button>
        </div>
      ) : null}

      {/* ── MAIN GRID ── */}
      <div style={{ flex:1, display:'grid', gridTemplateColumns:'260px 1fr 280px', gridTemplateRows:'1fr 200px', minHeight:0, opacity: readOnlyMission ? 0.72 : 1, pointerEvents: readOnlyMission ? 'none' : 'auto' }}>

        {/* LEFT */}
        <aside style={S.panel}>
          <div style={S.panelHdr}><span>Mission Builder</span><span>Tools</span></div>
          <div style={{ overflowY:'auto', padding:12, flex:1 }}>
            <div style={{ marginBottom:20 }}>
              <span style={S.lbl}>Flight Instructions</span>
              <div style={S.grid2}>
                {([
                  ['takeoff','Takeoff'],['land','Land'],['hover','Hover'],['wait','Wait'],
                  ['moveForward','Fwd'],['moveBackward','Back'],['strafeLeft','Left'],['strafeRight','Right'],
                  ['rotateCW','Rot CW'],['rotateCCW','Rot CCW'],['moveUp','Up'],['moveDown','Down'],
                ] as const).map(([kind, lbl]) => (
                  <button key={kind} style={S.toolBtn} onClick={() => store.addInstruction(kind)}>{lbl}</button>
                ))}
              </div>
            </div>
            <div>
              <span style={S.lbl}>Field Objects</span>
              <div style={S.grid2}>
                {([
                  ['programmingMat','Programming Mat'],
                  ['archGate','Arch Gate'],
                  ['keyholeGate','Keyhole Gate'],
                  ['colorMat','Color Mat'],
                  ['flyThroughPanel','Fly Panel'],
                  ['tunnel','Tunnel'],
                  ['landingPad','Landing Pad'],
                  ['miniArchGate','Mini Arch'],
                  ['pillar','Pillar'],
                  ['cubeLarge','Cube (L)'],
                  ['cubeSmall','Cube (S)'],
                  ['wall','Wall'],
                ] as const).map(([type, lbl]) => (
                  <button key={type} style={S.toolBtn} onClick={() => store.addFieldObject(type)}>{lbl}</button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* VIEWPORT — explicit height so Three.js has something to measure */}
        <section style={{ position:'relative', overflow:'hidden', background:'#0b0e14' }}>
          <div
            ref={mountRef}
            style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}
          />
          <div style={{ position:'absolute', top:10, left:10, pointerEvents:'none', color:'#d97706', fontSize:10, opacity:0.65, lineHeight:1.7 }}>
            CAM: ORBIT<br/>
            GRID: 1m<br/>
            STATUS: {store.isSolving ? 'SOLVING…' : store.run ? 'REPLAY READY' : 'READY'}<br/>
            SNAP: {store.snapToGrid ? 'ON (Shift)' : 'OFF (Shift)'}<br/>
            {spawnPlacementModeRef.current && <span style={{ color: '#22c55e' }}>MODE: PLACE SPAWN (Ctrl+Click to place)</span>}
            {measurementModeRef.current && measurementTargetRef.current && <span style={{ color: '#eab308' }}>MODE: MEASURE (Hover objects, F to exit)</span>}
            {followModeRef.current && <span style={{ color: '#ff4757' }}>MODE: FOLLOW (click to exit)</span>}
            {dragStateRef.current && <span style={{ color: '#ffa500' }}>MODE: DRAG</span>}
            {hoveredObjectRef.current && !measurementModeRef.current && <span style={{ color: '#ef4444' }}>DEL to remove</span>}
          </div>
          {measurementModeRef.current && measurementTargetRef.current && hoveredObjectRef.current && measurementTargetRef.current !== hoveredObjectRef.current && (() => {
            const targetObj = layout.objects.find(o => o.id === measurementTargetRef.current)
            const hoveredObj = layout.objects.find(o => o.id === hoveredObjectRef.current)
            if (!targetObj || !hoveredObj) return null
            
            const s = WORLD_SCALE
            const p1 = new THREE.Vector3(targetObj.position.x * s, targetObj.position.y * s, targetObj.position.z * s)
            const p2 = new THREE.Vector3(hoveredObj.position.x * s, hoveredObj.position.y * s, hoveredObj.position.z * s)
            const distanceCm = p1.distanceTo(p2) / s
            const distanceM = distanceCm / 100
            const distanceFt = distanceCm / 30.48
            const inches = (distanceFt % 1) * 12
            const feet = Math.floor(distanceFt)
            
            return (
              <div style={{ position:'absolute', top:10, right:10, background:'rgba(0,0,0,0.9)', padding:'12px 16px', borderRadius:4, border:'2px solid #eab308', pointerEvents:'none' }}>
                <div style={{ color:'#eab308', fontWeight:700, marginBottom:6, fontSize:10, textTransform:'uppercase' }}>Distance</div>
                <div style={{ color:'#fff', fontSize:16, fontWeight:700, marginBottom:2 }}>{feet}' {inches.toFixed(1)}"</div>
                <div style={{ color:'#94a3b8', fontSize:11 }}>{distanceM.toFixed(2)}m ({distanceCm.toFixed(1)}cm)</div>
                <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid rgba(234,179,8,0.3)', fontSize:9, color:'#64748b' }}>
                  <div>{targetObj.name} → {hoveredObj.name}</div>
                </div>
              </div>
            )
          })()}
        </section>

        {/* RIGHT INSPECTOR */}
        <aside style={{ ...S.panel, borderRight:'none', borderLeft:'1px solid #2d3748' }}>
          <div style={S.panelHdr}><span>Inspector</span><span>Properties</span></div>
          <div style={{ padding:14, flex:1, overflowY:'auto' }}>
            {selectedInst ? (
              <div>
                <h3 style={{ margin:'0 0 14px', fontSize:13, color: KIND_COLOR[selectedInst.kind] ?? '#fff' }}>
                  {selectedInst.label.toUpperCase()}
                </h3>
                <PropRow label="Duration (s)"     value={selectedInst.duration}   onChange={v => store.updateInstruction(selectedInst.id, { duration: v })} />
                <PropRow label="Strength (0–100)" value={selectedInst.strength}   onChange={v => store.updateInstruction(selectedInst.id, { strength: v })} />
                <PropRow label="Delay after (s)"  value={selectedInst.delayAfter} onChange={v => store.updateInstruction(selectedInst.id, { delayAfter: v })} />
                <PropRow label="Stack next by (s)" value={selectedInst.stackNextBy} onChange={v => store.updateInstruction(selectedInst.id, { stackNextBy: v })} />
                <button
                  style={{ ...S.toolBtn, width:'100%', marginTop:12, color:'#fc8181', borderColor:'#fc8181' }}
                  onClick={() => store.deleteInstruction(selectedInst.id)}
                >
                  Remove Instruction
                </button>
              </div>
            ) : selectedObj ? (
              <div>
                <h3 style={{ margin:'0 0 14px', fontSize:13, color: '#d97706' }}>
                  {selectedObj.name.toUpperCase()}
                </h3>
                <PropRow label="X Position (cm)" value={selectedObj.position.x} onChange={v => store.updateFieldObject(selectedObj.id, { position: { ...selectedObj.position, x: v } })} />
                <PropRow label="Y Position (cm)" value={selectedObj.position.y} onChange={v => store.updateFieldObject(selectedObj.id, { position: { ...selectedObj.position, y: v } })} />
                <PropRow label="Z Position (cm)" value={selectedObj.position.z} onChange={v => store.updateFieldObject(selectedObj.id, { position: { ...selectedObj.position, z: v } })} />
                <PropRow label="Rotation (deg)" value={selectedObj.rotation.y} onChange={v => store.updateFieldObject(selectedObj.id, { rotation: { ...selectedObj.rotation, y: v } })} />
                <div style={{ marginTop:16, padding:8, background:'rgba(217,119,6,0.1)', borderRadius:4, fontSize:10, color:'#d97706' }}>
                  <div style={{ marginBottom:4 }}>Controls:</div>
                  <div>• Use 3D gizmo to transform</div>
                  <div>• G/R/S: Translate/Rotate/Scale</div>
                  <div>• Click & drag to move</div>
                  <div>• Double-click for follow mode</div>
                  <div>• Arrow Up/Down: adjust height</div>
                  <div>• Shift: toggle grid snap</div>
                </div>
              </div>
            ) : (
              <div style={{ color:'#4a5568', fontSize:11, marginTop:20 }}>
                <p style={{ fontStyle:'italic', textAlign:'center', marginBottom:16 }}>
                  Select an instruction or object to edit.
                </p>
                <div style={{ background:'rgba(217,119,6,0.05)', padding:12, borderRadius:4, marginTop:16 }}>
                  <div style={{ color:'#d97706', fontWeight:700, marginBottom:8, fontSize:10, textTransform:'uppercase' }}>Keyboard Shortcuts</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    <div><span style={{ color:'#d97706' }}>Ctrl+Z</span> - Undo</div>
                    <div><span style={{ color:'#d97706' }}>Ctrl+Y</span> - Redo</div>
                    <div><span style={{ color:'#d97706' }}>C</span> - Focus camera on drone</div>
                    <div><span style={{ color:'#d97706' }}>F</span> - Measure (select object first)</div>
                    <div><span style={{ color:'#d97706' }}>Del</span> - Delete hovered/selected object</div>
                    <div><span style={{ color:'#d97706' }}>Shift</span> - Toggle grid snap</div>
                    <div><span style={{ color:'#d97706' }}>↑/↓</span> - Adjust object height</div>
                    <div><span style={{ color:'#d97706' }}>G/R/S</span> - Translate/Rotate/Scale gizmo</div>
                    <div><span style={{ color:'#d97706' }}>Ctrl+Click</span> - Set spawn point</div>
                    <div><span style={{ color:'#d97706' }}>Double-Click</span> - Follow mode</div>
                    <div><span style={{ color:'#d97706' }}>ESC</span> - Exit modes</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* BOTTOM — telemetry + timeline */}
        <section style={{ gridColumn:'1 / span 3', background:'#151922', borderTop:'1px solid #2d3748', display:'flex', flexDirection:'column', minHeight:0 }}>

          {/* Telemetry bar */}
          <div style={{ height:36, background:'#0f1115', display:'flex', borderBottom:'1px solid #2d3748', flexShrink:0 }}>
            {([
              ['Speed',   activePt ? `${activePt.actualSpeed.toFixed(1)} cm/s` : '0.0 cm/s'],
              ['Alt',     activePt ? `${activePt.actualPosition.y.toFixed(1)} cm` : '0.0 cm'],
              ['Heading', activePt ? `${Math.round(activePt.actualHeading)}°` : '0°'],
              ['Drift',   activePt ? `${Math.hypot(activePt.actualPosition.x - activePt.plannedPosition.x, activePt.actualPosition.z - activePt.plannedPosition.z).toFixed(1)} cm` : '0.0'],
              ['Time',    `${store.playbackTime.toFixed(2)}s`],
            ] as [string,string][]).map(([lbl, val]) => (
              <div key={lbl} style={{ flex:1, display:'flex', alignItems:'center', padding:'0 12px', borderRight:'1px solid #2d3748', fontSize:11 }}>
                <span style={{ color:'#718096', marginRight:8, textTransform:'uppercase' }}>{lbl}</span>
                <span style={{ color:'#d97706', fontWeight:700 }}>{val}</span>
              </div>
            ))}
            {/* playback controls */}
            <div style={{ flex:2, display:'flex', alignItems:'center', padding:'0 12px', gap:6, justifyContent:'flex-end' }}>
              <span style={{ color:'#718096', fontSize:10, textTransform:'uppercase', marginRight:4 }}>Speed:</span>
              {([0.5,1,2] as const).map(sp => (
                <button key={sp} style={{ ...S.btnSec, padding:'2px 7px', fontSize:10, borderColor: store.playbackSpeed === sp ? '#d97706' : '#2d3748', color: store.playbackSpeed === sp ? '#d97706' : '#e2e8f0' }}
                  onClick={() => store.setPlaybackSpeed(sp)}>{sp}×</button>
              ))}
              <div style={{ width:1, height:16, background:'#2d3748', margin:'0 4px' }} />
              <button 
                style={{ 
                  ...S.btnSec, 
                  opacity: !store.run ? 0.5 : 1,
                  cursor: !store.run ? 'not-allowed' : 'pointer'
                }} 
                disabled={!store.run}
                onClick={() => {
                  if (store.playbackState === 'playing') {
                    store.setPlaybackState('paused')
                  } else {
                    // If at end, reset to beginning
                    if (store.playbackTime >= totalDuration) {
                      store.setPlaybackTime(0)
                    }
                    store.setPlaybackState('playing')
                  }
                }}
              >
                {store.playbackState === 'playing' ? '⏸ Pause' : '▶ Play'}
              </button>
              <button style={S.btnSec} onClick={store.resetPlayback}>↺ Reset</button>
            </div>
          </div>

          {/* Timeline scroll area */}
          <div 
            style={{ flex:1, overflowX:'auto', overflowY:'auto', position:'relative', minHeight:0 }}
            onClick={(e) => {
              // Click timeline to jump playhead
              if (!store.run || e.target !== e.currentTarget) return
              const rect = e.currentTarget.getBoundingClientRect()
              const scrollLeft = e.currentTarget.scrollLeft
              const clickX = e.clientX - rect.left + scrollLeft
              const newTime = Math.max(0, Math.min(clickX / PX_PER_SEC, totalDuration))
              store.setPlaybackTime(newTime)
            }}
          >
            <div style={{
              position:'relative',
              height: Math.max(timelineContentH, 120),
              minWidth: Math.max(800, totalDuration * PX_PER_SEC + 120),
              width: Math.max(800, totalDuration * PX_PER_SEC + 120),
            }}>
              {/* Playhead */}
              <div 
                style={{ position:'absolute', top:0, bottom:0, left: store.playbackTime * PX_PER_SEC, width:2, background:'#ff4757', zIndex:20, cursor: store.run ? 'ew-resize' : 'default' }}
                onMouseDown={(e) => {
                  if (!store.run) return
                  e.preventDefault()
                  const startX = e.clientX
                  const startTime = store.playbackTime
                  const wasPlaying = store.playbackState === 'playing'
                  if (wasPlaying) store.setPlaybackState('paused')

                  const onMove = (moveE: MouseEvent) => {
                    const dx = moveE.clientX - startX
                    const dt = dx / PX_PER_SEC
                    const newTime = Math.max(0, Math.min(startTime + dt, totalDuration))
                    store.setPlaybackTime(newTime)
                  }
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove)
                    window.removeEventListener('mouseup', onUp)
                    if (wasPlaying) store.setPlaybackState('playing')
                  }
                  window.addEventListener('mousemove', onMove)
                  window.addEventListener('mouseup', onUp)
                }}
              >
                <div style={{ position:'absolute', top:0, left:-5, borderLeft:'6px solid transparent', borderRight:'6px solid transparent', borderTop:'8px solid #ff4757', cursor: store.run ? 'ew-resize' : 'default' }} />
              </div>

              {/* Lane labels on left */}
              {Array.from({ length: laneCount }, (_, i) => (
                <div key={i} style={{
                  position:'absolute',
                  top: TIMELINE_PAD_TOP + i * (LANE_H + LANE_GAP),
                  left:0, width:'100%', height: LANE_H,
                  borderBottom:'1px solid #1e2530',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                }} />
              ))}

              {/* Instruction blocks */}
              {lanes.map(({ inst, start, lane }) => {
                const selected = inst.id === store.selectedInstructionId
                const top = TIMELINE_PAD_TOP + lane * (LANE_H + LANE_GAP) + 4
                const width = Math.max(inst.duration * PX_PER_SEC, 28)
                return (
                  <div
                    key={inst.id}
                    onClick={() => store.selectInstruction(inst.id)}
                    onMouseDown={(e) => {
                      // Dragging to reorder instructions or change lanes
                      if (e.button !== 0) return
                      e.stopPropagation()
                      store.selectInstruction(inst.id)
                      
                      const startX = e.clientX
                      const startY = e.clientY
                      const startLeft = start * PX_PER_SEC
                      const startLane = lane
                      let hasMoved = false
                      let dragPreview: HTMLDivElement | null = null

                      const onMove = (moveE: MouseEvent) => {
                        const dx = moveE.clientX - startX
                        const dy = moveE.clientY - startY
                        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true
                        
                        // Create drag preview if not exists
                        if (!dragPreview && hasMoved) {
                          dragPreview = document.createElement('div')
                          dragPreview.style.cssText = `
                            position: fixed;
                            left: ${moveE.clientX - 50}px;
                            top: ${moveE.clientY - 15}px;
                            width: ${width}px;
                            height: ${LANE_H - 8}px;
                            background: ${KIND_COLOR[inst.kind] ?? '#4a5568'};
                            border-radius: 4px;
                            border: 2px solid #fff;
                            opacity: 0.7;
                            pointer-events: none;
                            z-index: 9999;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: #fff;
                            font-size: 10px;
                          `
                          dragPreview.textContent = `${inst.label} (${inst.duration.toFixed(1)}s)`
                          document.body.appendChild(dragPreview)
                        }
                        
                        // Update drag preview position
                        if (dragPreview) {
                          dragPreview.style.left = `${moveE.clientX - 50}px`
                          dragPreview.style.top = `${moveE.clientY - 15}px`
                        }
                      }
                      
                      const onUp = (upE: MouseEvent) => {
                        window.removeEventListener('mousemove', onMove)
                        window.removeEventListener('mouseup', onUp)
                        
                        // Remove drag preview
                        if (dragPreview) {
                          document.body.removeChild(dragPreview)
                        }
                        
                        if (!hasMoved) return
                        
                        const dx = upE.clientX - startX
                        const dy = upE.clientY - startY
                        const newLeft = startLeft + dx
                        const newStartTime = newLeft / PX_PER_SEC
                        
                        // Calculate which lane was dropped on
                        const newLane = Math.max(0, Math.floor(dy / (LANE_H + LANE_GAP)))
                        
                        // Find where this instruction should be inserted based on time
                        const instructions = route.instructions.filter(i => i.enabled)
                        const currentIndex = instructions.findIndex(i => i.id === inst.id)
                        if (currentIndex === -1) return
                        
                        // Calculate cumulative times to find new position
                        let cumTime = 0
                        let newIndex = 0
                        for (let i = 0; i < instructions.length; i++) {
                          if (i === currentIndex) continue
                          const nextCumTime = cumTime + instructions[i].duration + instructions[i].delayAfter
                          if (newStartTime < cumTime + instructions[i].duration / 2) {
                            break
                          }
                          cumTime = nextCumTime
                          newIndex++
                        }
                        
                        // If lane changed, adjust stackNextBy to create overlap
                        if (newLane !== startLane && newIndex > 0) {
                          // Calculate how much to stack based on lane difference
                          const prevInst = instructions[newIndex - 1]
                          if (prevInst) {
                            // Stack this instruction to overlap with previous
                            const overlapAmount = Math.min(prevInst.duration * 0.8, inst.duration * 0.5)
                            store.updateInstruction(prevInst.id, { 
                              stackNextBy: overlapAmount 
                            })
                          }
                        }

                        store.updateInstruction(inst.id, { timelineLane: newLane })
                        
                        // Reorder in the actual route
                        const allInstructions = route.instructions
                        const actualCurrentIndex = allInstructions.findIndex(i => i.id === inst.id)
                        const actualNewIndex = allInstructions.findIndex(i => i.id === instructions[newIndex]?.id) ?? allInstructions.length
                        
                        if (actualCurrentIndex !== -1 && actualCurrentIndex !== actualNewIndex) {
                          const direction = actualNewIndex > actualCurrentIndex ? 1 : -1
                          const steps = Math.abs(actualNewIndex - actualCurrentIndex)
                          for (let i = 0; i < steps; i++) {
                            store.moveInstruction(inst.id, direction)
                          }
                        }
                      }
                      
                      window.addEventListener('mousemove', onMove)
                      window.addEventListener('mouseup', onUp)
                    }}
                    style={{
                      position:'absolute',
                      left: start * PX_PER_SEC,
                      top,
                      width,
                      height: LANE_H - 8,
                      background: KIND_COLOR[inst.kind] ?? '#4a5568',
                      borderRadius:4,
                      border: selected ? '2px solid #fff' : '1px solid rgba(255,255,255,0.12)',
                      boxShadow: selected ? '0 0 0 2px #0b0e14, 0 0 0 4px #d97706' : '0 2px 6px rgba(0,0,0,0.4)',
                      color:'#fff', fontSize:10,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      cursor:'move', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', padding:'0 6px',
                      userSelect:'none',
                    }}
                  >
                    {inst.label} ({inst.duration.toFixed(1)}s)
                    {/* Resize handle on right edge */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        const startX = e.clientX
                        const startDuration = inst.duration

                        const onMove = (moveE: MouseEvent) => {
                          const dx = moveE.clientX - startX
                          const dDuration = dx / PX_PER_SEC
                          const newDuration = Math.max(0.1, startDuration + dDuration)
                          store.updateInstruction(inst.id, { duration: parseFloat(newDuration.toFixed(2)) })
                        }

                        const onUp = () => {
                          window.removeEventListener('mousemove', onMove)
                          window.removeEventListener('mouseup', onUp)
                        }

                        window.addEventListener('mousemove', onMove)
                        window.addEventListener('mouseup', onUp)
                      }}
                      style={{
                        position:'absolute',
                        right:-2,
                        top:0,
                        bottom:0,
                        width:6,
                        cursor:'ew-resize',
                        background: selected ? 'rgba(255,255,255,0.3)' : 'transparent',
                        borderRadius:'0 4px 4px 0',
                      }}
                    />
                  </div>
                )
              })}
            </div>
          </div>

        </section>
      </div>
    </div>
  )
}
