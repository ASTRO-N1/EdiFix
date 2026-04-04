import * as THREE from 'three'
import { useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { GLTF } from 'three-stdlib'

type GLTFResult = GLTF & {
  nodes: {
    ['default']: THREE.SkinnedMesh
    RL_BoneRoot: THREE.Bone
    CC_Base_Hip: THREE.Bone
    CC_Base_Head: THREE.Bone
    CC_Base_NeckTwist01: THREE.Bone
    CC_Base_Spine01: THREE.Bone
    CC_Base_Spine02: THREE.Bone
    CC_Base_L_Upperarm: THREE.Bone
    CC_Base_L_Forearm: THREE.Bone
    CC_Base_L_Hand: THREE.Bone
    CC_Base_R_Upperarm: THREE.Bone
    CC_Base_R_Forearm: THREE.Bone
    CC_Base_R_Hand: THREE.Bone
    CC_Base_L_Thigh: THREE.Bone
    CC_Base_L_Calf: THREE.Bone
    CC_Base_R_Thigh: THREE.Bone
    CC_Base_R_Calf: THREE.Bone
    CC_Base_L_Eye: THREE.Bone
    CC_Base_R_Eye: THREE.Bone
  }
  materials: {
    ['Material.001']: THREE.MeshPhysicalMaterial
  }
}

interface RobotModelProps {
  isJumping?: boolean
  onJumpComplete?: () => void
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: number
}

export function RobotModel({
  isJumping = false,
  onJumpComplete,
  position = [0, -1, 0],
  rotation = [0, 0, 0],
  scale = 1.4,
}: RobotModelProps) {
  const group = useRef<THREE.Group>(null!)
  const { nodes, materials } = useGLTF('/models/edimascot.glb') as unknown as GLTFResult



  // ─── Material patch ───────────────────────────────────────────────
  useEffect(() => {
    const mat = materials['Material.001']
    if (mat) {
      mat.envMapIntensity = 0.5
      mat.needsUpdate = true
    }
  }, [materials])

  // ─── Mouse tracking ───────────────────────────────────────────────
  // null = user hasn't moved mouse yet → head stays forward, no snap on load
  const mouse = useRef<{ x: number; y: number } | null>(null)
  const targetHead = useRef({ x: 0, y: 0 })
  const targetEyes = useRef({ x: 0, y: 0 })

  // ─── Jump state ───────────────────────────────────────────────────
  const jumpState = useRef({
    active: false,
    time: 0,
    baseY: 0,
    completed: false,
  })

  // ─── Initial bone rotations ───────────────────────────────────────
  const initRot = useRef<Record<string, THREE.Euler>>({})

  useEffect(() => {
    const bonesToStore = [
      'CC_Base_Head',
      'CC_Base_NeckTwist01',
      'CC_Base_Spine01',
      'CC_Base_Spine02',
      'CC_Base_L_Upperarm',
      'CC_Base_L_Forearm',
      'CC_Base_R_Upperarm',
      'CC_Base_R_Forearm',
      'CC_Base_Hip',
      'CC_Base_L_Thigh',
      'CC_Base_L_Calf',
      'CC_Base_R_Thigh',
      'CC_Base_R_Calf',
      'CC_Base_L_Eye',
      'CC_Base_R_Eye',
    ]
    bonesToStore.forEach((name) => {
      const bone = nodes[name as keyof typeof nodes] as THREE.Bone
      if (bone) {
        initRot.current[name] = bone.rotation.clone()
      }
    })
  }, [nodes])

  // ─── Mouse listener ───────────────────────────────────────────────
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1
      const y = -((e.clientY / window.innerHeight) * 2 - 1)

      if (mouse.current === null) {
        // First ever movement — seed targets instantly so there is no
        // snap from center to actual cursor position
        targetHead.current.x = x * 0.35
        targetHead.current.y = y * 0.2
        targetEyes.current.x = x * 0.15
        targetEyes.current.y = y * 0.1
      }

      mouse.current = { x, y }
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  // ─── Jump trigger ─────────────────────────────────────────────────
  useEffect(() => {
    if (isJumping) {
      jumpState.current.active = true
      jumpState.current.time = 0
      jumpState.current.baseY = group.current?.position.y ?? (position[1] ?? -1)
      jumpState.current.completed = false
    }
  }, [isJumping, position])

  // ─── Animation loop ───────────────────────────────────────────────
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // ── 1. Smooth mouse lerp (only after first real mouse move) ──────
    if (mouse.current !== null) {
      targetHead.current.x +=
        (mouse.current.x * 0.35 - targetHead.current.x) * 0.08
      targetHead.current.y +=
        (mouse.current.y * 0.2 - targetHead.current.y) * 0.08
      targetEyes.current.x +=
        (mouse.current.x * 0.15 - targetEyes.current.x) * 0.1
      targetEyes.current.y +=
        (mouse.current.y * 0.1 - targetEyes.current.y) * 0.1
    }

    // ── 2. Whole body gentle float ───────────────────────────────────
    if (group.current && !jumpState.current.active) {
      group.current.position.y = position[1] + Math.sin(t * 1.2) * 0.04
    }

    // ── 3. Spine breathing sway ──────────────────────────────────────
    const spine1 = nodes.CC_Base_Spine01 as THREE.Bone
    const spine2 = nodes.CC_Base_Spine02 as THREE.Bone
    if (spine1 && initRot.current['CC_Base_Spine01']) {
      spine1.rotation.x =
        initRot.current['CC_Base_Spine01'].x + Math.sin(t * 1.2) * 0.015
      spine1.rotation.z =
        initRot.current['CC_Base_Spine01'].z + Math.sin(t * 0.7) * 0.01
    }
    if (spine2 && initRot.current['CC_Base_Spine02']) {
      spine2.rotation.x =
        initRot.current['CC_Base_Spine02'].x + Math.sin(t * 1.2) * 0.012
    }

    // ── 4. Head follows cursor ───────────────────────────────────────
    const head = nodes.CC_Base_Head as THREE.Bone
    const neck = nodes.CC_Base_NeckTwist01 as THREE.Bone

    if (head && initRot.current['CC_Base_Head']) {
      head.rotation.y =
        initRot.current['CC_Base_Head'].y + targetHead.current.x * 0.5
      // FIX: + not - (screen Y already flipped in mouse handler)
      head.rotation.x =
        initRot.current['CC_Base_Head'].x - targetHead.current.y * 0.3
      // Subtle idle tilt
      head.rotation.z =
        initRot.current['CC_Base_Head'].z + Math.sin(t * 0.5) * 0.02
    }
    if (neck && initRot.current['CC_Base_NeckTwist01']) {
      neck.rotation.y =
        initRot.current['CC_Base_NeckTwist01'].y + targetHead.current.x * 0.2
      // FIX: + not -
      neck.rotation.x =
        initRot.current['CC_Base_NeckTwist01'].x - targetHead.current.y * 0.15
    }

    // ── 5. Eyes follow cursor ────────────────────────────────────────
    const leftEye = nodes.CC_Base_L_Eye as THREE.Bone
    const rightEye = nodes.CC_Base_R_Eye as THREE.Bone

    if (leftEye && initRot.current['CC_Base_L_Eye']) {
      leftEye.rotation.y =
        initRot.current['CC_Base_L_Eye'].y + targetEyes.current.x * 0.3
      // FIX: + not -
      leftEye.rotation.x =
        initRot.current['CC_Base_L_Eye'].x + targetEyes.current.y * 0.2
    }
    if (rightEye && initRot.current['CC_Base_R_Eye']) {
      rightEye.rotation.y =
        initRot.current['CC_Base_R_Eye'].y + targetEyes.current.x * 0.3
      // FIX: + not -
      rightEye.rotation.x =
        initRot.current['CC_Base_R_Eye'].x + targetEyes.current.y * 0.2
    }

    // ── 6. Left arm — friendly wave ──────────────────────────────────
    const lUpperarm = nodes.CC_Base_L_Upperarm as THREE.Bone
    const lForearm = nodes.CC_Base_L_Forearm as THREE.Bone
    const lHand = nodes.CC_Base_L_Hand as THREE.Bone

    if (lUpperarm && initRot.current['CC_Base_L_Upperarm']) {
      lUpperarm.rotation.x = initRot.current['CC_Base_L_Upperarm'].x - 1.1
      lUpperarm.rotation.z = initRot.current['CC_Base_L_Upperarm'].z - 0.3
      if (lForearm && initRot.current['CC_Base_L_Forearm']) {
        lForearm.rotation.y = initRot.current['CC_Base_L_Forearm'].y - 0.8
      }
      if (lHand) {
        lHand.rotation.z = Math.sin(t * 4) * 0.4
        lHand.rotation.x = Math.sin(t * 4 + 0.5) * 0.15
      }
    }

    // ── 7. Right arm — subtle idle swing ────────────────────────────
    const rUpperarm = nodes.CC_Base_R_Upperarm as THREE.Bone
    const rForearm = nodes.CC_Base_R_Forearm as THREE.Bone

    if (rUpperarm && initRot.current['CC_Base_R_Upperarm']) {
      rUpperarm.rotation.x =
        initRot.current['CC_Base_R_Upperarm'].x + Math.sin(t * 1.2) * 0.08
      rUpperarm.rotation.z =
        initRot.current['CC_Base_R_Upperarm'].z + Math.sin(t * 0.9) * 0.05
    }
    if (rForearm && initRot.current['CC_Base_R_Forearm']) {
      rForearm.rotation.y =
        initRot.current['CC_Base_R_Forearm'].y + Math.sin(t * 1.1) * 0.06
    }

    // ── 8. Legs — subtle idle shift ──────────────────────────────────
    const lThigh = nodes.CC_Base_L_Thigh as THREE.Bone
    const rThigh = nodes.CC_Base_R_Thigh as THREE.Bone
    const lCalf = nodes.CC_Base_L_Calf as THREE.Bone
    const rCalf = nodes.CC_Base_R_Calf as THREE.Bone

    if (!jumpState.current.active) {
      if (lThigh && initRot.current['CC_Base_L_Thigh']) {
        lThigh.rotation.x =
          initRot.current['CC_Base_L_Thigh'].x + Math.sin(t * 1.2) * 0.02
      }
      if (rThigh && initRot.current['CC_Base_R_Thigh']) {
        rThigh.rotation.x =
          initRot.current['CC_Base_R_Thigh'].x - Math.sin(t * 1.2) * 0.02
      }
      if (lCalf && initRot.current['CC_Base_L_Calf']) {
        lCalf.rotation.x =
          initRot.current['CC_Base_L_Calf'].x + Math.sin(t * 1.2) * 0.015
      }
      if (rCalf && initRot.current['CC_Base_R_Calf']) {
        rCalf.rotation.x =
          initRot.current['CC_Base_R_Calf'].x - Math.sin(t * 1.2) * 0.015
      }
    }

    // ── 9. Jump animation ─────────────────────────────────────────────
    if (jumpState.current.active) {
      jumpState.current.time += delta
      const jt = jumpState.current.time
      const jumpDuration = 0.7

      if (jt < jumpDuration) {
        const progress = jt / jumpDuration
        const arc = Math.sin(progress * Math.PI)

        // Body arc
        if (group.current) {
          group.current.position.y = jumpState.current.baseY + arc * 0.25
        }

        // Legs tuck
        if (lThigh && initRot.current['CC_Base_L_Thigh']) {
          lThigh.rotation.x =
            initRot.current['CC_Base_L_Thigh'].x - arc * 0.3
        }
        if (rThigh && initRot.current['CC_Base_R_Thigh']) {
          rThigh.rotation.x =
            initRot.current['CC_Base_R_Thigh'].x - arc * 0.3
        }
        if (lCalf && initRot.current['CC_Base_L_Calf']) {
          lCalf.rotation.x =
            initRot.current['CC_Base_L_Calf'].x + arc * 0.4
        }
        if (rCalf && initRot.current['CC_Base_R_Calf']) {
          rCalf.rotation.x =
            initRot.current['CC_Base_R_Calf'].x + arc * 0.4
        }

        // Right arm raises during jump
        if (rUpperarm && initRot.current['CC_Base_R_Upperarm']) {
          rUpperarm.rotation.x =
            initRot.current['CC_Base_R_Upperarm'].x - arc * 0.5
        }

        // Spine leans back slightly
        if (spine1 && initRot.current['CC_Base_Spine01']) {
          spine1.rotation.x =
            initRot.current['CC_Base_Spine01'].x - arc * 0.1
        }
      } else {
        // Jump complete — reset
        jumpState.current.active = false
        if (!jumpState.current.completed) {
          jumpState.current.completed = true
          onJumpComplete?.()
        }
      }
    }
  })

  return (
    <group
      ref={group}
      dispose={null}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <group name="Scene">
        <group name="Armature">
          <skinnedMesh
            name="default"
            geometry={nodes['default'].geometry}
            material={materials['Material.001']}
            skeleton={nodes['default'].skeleton}
            morphTargetDictionary={
              nodes['default'].morphTargetDictionary ?? undefined
            }
            morphTargetInfluences={
              nodes['default'].morphTargetInfluences ?? undefined
            }
          />
          <primitive object={nodes.RL_BoneRoot} />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/edimascot.glb')