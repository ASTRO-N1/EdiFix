import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'

interface NodeData {
  id: string
  label: string
  color: string
  position: [number, number, number]
  size: number
  children: string[]
}

const NODES: NodeData[] = [
  { id: 'root', label: '837P', color: '#FF6B6B', position: [0, 0, 0], size: 0.55, children: ['provider', 'subscriber', 'payer'] },
  { id: 'provider', label: 'Provider', color: '#4ECDC4', position: [-2.2, 1.2, 0.5], size: 0.38, children: ['claim1', 'service1'] },
  { id: 'subscriber', label: 'Subscriber', color: '#FFE66D', position: [2.2, 1.2, -0.3], size: 0.38, children: ['claim2', 'service2'] },
  { id: 'payer', label: 'Payer', color: '#95E1D3', position: [0, -2, 0.8], size: 0.38, children: ['service3'] },
  { id: 'claim1', label: 'Claim', color: '#FF6B6B', position: [-3.5, 0, 1], size: 0.26, children: [] },
  { id: 'claim2', label: 'Claim', color: '#FF6B6B', position: [3.5, 0, -1], size: 0.26, children: [] },
  { id: 'service1', label: 'Service', color: '#4ECDC4', position: [-2.8, -1.5, -0.4], size: 0.22, children: [] },
  { id: 'service2', label: 'Service', color: '#4ECDC4', position: [2.8, -1.5, 0.6], size: 0.22, children: [] },
  { id: 'service3', label: 'Service', color: '#4ECDC4', position: [0.8, -3.2, 0.2], size: 0.22, children: [] },
]

function NetworkNode({ node, time }: { node: NodeData; time: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = React.useState(false)

  const bobOffset = useMemo(() => Math.random() * Math.PI * 2, [])

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.y = node.position[1] + Math.sin(time * 0.8 + bobOffset) * 0.12
      const targetScale = hovered ? 1.35 : 1
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1)
    }
  })

  return (
    <group position={node.position}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[node.size, 16, 16]} />
        <meshToonMaterial color={node.color} />
      </mesh>
      {hovered && (
        <Html center distanceFactor={6}>
          <div
            style={{
              background: '#1A1A2E',
              color: '#FDFAF4',
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              border: '2px solid #FFE66D',
              pointerEvents: 'none',
            }}
          >
            {node.label}
          </div>
        </Html>
      )}
    </group>
  )
}

function Edge({ from, to }: { from: [number, number, number]; to: [number, number, number] }) {
  const points = useMemo(() => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const mid = start.clone().lerp(end, 0.5)
    // Slight wobble offset for hand-drawn feel
    mid.x += (Math.random() - 0.5) * 0.3
    mid.y += (Math.random() - 0.5) * 0.3
    mid.z += (Math.random() - 0.5) * 0.2
    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    return curve.getPoints(20)
  }, [from, to])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints(points)
    return geo
  }, [points])

  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <line geometry={geometry} {...({} as any)}>
      <lineBasicMaterial color="#1A1A2E" opacity={0.35} transparent linewidth={1} />
    </line>
  )
}

function Graph() {
  const groupRef = useRef<THREE.Group>(null)
  const timeRef = useRef(0)
  const { mouse } = useThree()

  useFrame((_state, delta) => {
    timeRef.current += delta
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.003
      // Tilt toward mouse
      groupRef.current.rotation.x += (mouse.y * 0.15 - groupRef.current.rotation.x) * 0.05
    }
  })

  const nodeMap = useMemo(() => Object.fromEntries(NODES.map((n) => [n.id, n])), [])

  const edges = useMemo(() => {
    const result: Array<{ from: [number, number, number]; to: [number, number, number]; key: string }> = []
    NODES.forEach((node) => {
      node.children.forEach((childId) => {
        const child = nodeMap[childId]
        if (child) {
          result.push({ from: node.position, to: child.position, key: `${node.id}-${childId}` })
        }
      })
    })
    return result
  }, [nodeMap])

  return (
    <group ref={groupRef}>
      {edges.map((edge) => (
        <Edge key={edge.key} from={edge.from} to={edge.to} />
      ))}
      {NODES.map((node) => (
        <NetworkNode key={node.id} node={node} time={timeRef.current} />
      ))}
    </group>
  )
}

export default function ThreeScene() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 55 }}
        style={{ background: 'transparent' }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} />
        <Graph />
      </Canvas>
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          fontFamily: 'Nunito, sans-serif',
          fontSize: 12,
          color: '#1A1A2E',
          opacity: 0.5,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        Hover the nodes to explore the structure →
      </div>
    </div>
  )
}
