import * as THREE from 'three'
import React, { Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Leva, useControls, button } from 'leva'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { RobotModel } from './RobotModel'

function ModelSizer() {
  const { scene } = useGLTF('/models/edimascot.glb')
  useEffect(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    console.log('[RobotSceneTuner] model size:', size)
    console.log('[RobotSceneTuner] model center:', center)
  }, [scene])
  return null
}

function CameraAndControlsLogger({
  controlsRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl>
}) {
  const { camera } = useThree()

  useEffect(() => {
    ;(window as any).__logCamera = () => {
      camera.updateMatrixWorld()

      const p = camera.position
      const r = camera.rotation
      const fov = (camera as any).fov
      const zoom = (camera as any).zoom
      const near = camera.near
      const far = camera.far

      console.log('camera.position =', [p.x, p.y, p.z])
      console.log('camera.rotation =', [r.x, r.y, r.z]) // radians
      console.log('camera.fov =', fov)
      console.log('camera.zoom =', zoom)
      console.log('camera.near =', near)
      console.log('camera.far =', far)
    }

    ;(window as any).__logControls = () => {
      const c = controlsRef.current
      if (!c) return console.warn('OrbitControls ref not ready yet')
      const t = c.target
      console.log('controls.target =', [t.x, t.y, t.z])
    }

    ;(window as any).__copyCameraSnapshot = async () => {
      // Prints a ready-to-paste snippet
      const c = controlsRef.current
      camera.updateMatrixWorld()

      const p = camera.position
      const r = camera.rotation
      const fov = (camera as any).fov
      const zoom = (camera as any).zoom
      const near = camera.near
      const far = camera.far
      const t = c?.target

      const snippet = `// Paste into RobotScene.tsx
<Canvas
  camera={{ position: [${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.z.toFixed(
        3
      )}], fov: ${Number(fov).toFixed(0)} }}
>
  {/* after mount (optional) */}
  // camera.rotation.set(${r.x.toFixed(3)}, ${r.y.toFixed(3)}, ${r.z.toFixed(3)})
  // camera.near = ${near.toFixed(3)}; camera.far = ${far.toFixed(3)}; camera.zoom = ${Number(
        zoom
      ).toFixed(3)}

  {/* OrbitControls target (optional) */}
  // controls.target.set(${t?.x.toFixed(3) ?? '0.000'}, ${t?.y.toFixed(3) ?? '0.000'}, ${
        t?.z.toFixed(3) ?? '0.000'
      })
</Canvas>`
      console.log(snippet)

      // Also copy to clipboard
      try {
        await navigator.clipboard.writeText(snippet)
        console.log('[RobotSceneTuner] Copied camera snippet to clipboard.')
      } catch {
        console.log('[RobotSceneTuner] Clipboard copy failed (permission).')
      }
    }

    return () => {
      delete (window as any).__logCamera
      delete (window as any).__logControls
      delete (window as any).__copyCameraSnapshot
    }
  }, [camera, controlsRef])

  return null
}

export function RobotSceneTuner() {
  const controlsRef = useRef<OrbitControlsImpl>(null!)

  const model = useControls('model', {
    px: { value: 0, step: 0.01 },
    py: { value: -1.0, step: 0.01 },
    pz: { value: 0, step: 0.01 },
    rx: { value: 0, step: 0.01 },
    ry: { value: 0, step: 0.01 },
    rz: { value: 0, step: 0.01 },
    scale: { value: 1.2, min: 0.001, max: 20, step: 0.01 },
  })

  const light = useControls('lighting', {
    ambient: { value: 0.9, min: 0, max: 3, step: 0.05 },
    dir1: { value: 1.2, min: 0, max: 5, step: 0.05 },
    dir2: { value: 0.35, min: 0, max: 5, step: 0.05 },
    dir1x: { value: 3, step: 0.1 },
    dir1y: { value: 5, step: 0.1 },
    dir1z: { value: 3, step: 0.1 },
    dir2x: { value: -2, step: 0.1 },
    dir2y: { value: 2, step: 0.1 },
    dir2z: { value: -1, step: 0.1 },
  })

  useControls('export', {
    logCameraToConsole: button(() => (window as any).__logCamera?.()),
    logControlsTarget: button(() => (window as any).__logControls?.()),
    copyCameraSnippet: button(() => (window as any).__copyCameraSnapshot?.()),
    resetCamera: button(() => controlsRef.current?.reset?.()),
  })

  return (
    <div style={{ width: '100%', height: 460, position: 'relative' }}>
      <Leva collapsed={false} />

      <Canvas
        camera={{ position: [0, 0.9, 3.2], fov: 50 }}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Optional helpers while tuning */}
        <axesHelper args={[1.5]} />
        <gridHelper args={[10, 10, '#d6d6d6', '#e9e9e9']} />

        {/* Lighting */}
        <ambientLight intensity={light.ambient} color="#fff8f0" />
        <directionalLight
          position={[light.dir1x, light.dir1y, light.dir1z]}
          intensity={light.dir1}
          color="#ffffff"
        />
        <directionalLight
          position={[light.dir2x, light.dir2y, light.dir2z]}
          intensity={light.dir2}
          color="#4ECDC4"
        />

        <Suspense fallback={null}>
          <CameraAndControlsLogger controlsRef={controlsRef} />
          <ModelSizer />
          <RobotModel
            isJumping={false}
            position={[model.px, model.py, model.pz]}
            rotation={[model.rx, model.ry, model.rz]}
            scale={model.scale}
          />
        </Suspense>

        {/* Pan/zoom/rotate like a 3D editor */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan
          enableZoom
          enableRotate
          panSpeed={1.0}
          zoomSpeed={1.0}
          rotateSpeed={0.9}
        />
      </Canvas>
    </div>
  )
}

useGLTF.preload('/models/edimascot.glb')