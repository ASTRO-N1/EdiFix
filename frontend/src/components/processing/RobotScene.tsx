import { useRef, useState, Suspense, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { RobotModel } from './RobotModel'

function CameraSetup({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl> }) {
  const { camera } = useThree()
  
  useEffect(() => {
    camera.rotation.set(-0.120, -0.215, -0.026)
    if (controlsRef.current) {
      controlsRef.current.target.set(0.006, 1.095, -0.331)
      controlsRef.current.update()
    }
  }, [camera, controlsRef])
  
  return null
}

export function RobotScene() {
  const [isJumping, setIsJumping] = useState(false)
  const controlsRef = useRef<OrbitControlsImpl>(null!)

  const handleClick = () => {
    if (!isJumping) setIsJumping(true)
  }

  return (
    <div
      style={{ width: '100%', height: '460px', cursor: 'pointer' }}
      onClick={handleClick}
      title="Click me!"
    >
      <Canvas
        camera={{ position: [-0.702, 1.483, 2.893], fov: 50 }}
        gl={{ antialias: true }}
        style={{ width: '100%', height: '100%' }}
      >
        <CameraSetup controlsRef={controlsRef} />
        {/* Lighting — soft and warm to match cream theme */}
        <ambientLight intensity={3} color="#fff8f0" />
        <directionalLight
          position={[3, 5, 3]}
          intensity={5}
          color="#ffffff"
        />
        <directionalLight
          position={[-2, 2, -1]}
          intensity={5}
          color="#4ECDC4"
        />

        <Suspense fallback={null}>
          <RobotModel
            position={[0, -0.10, 0]}
            scale={1.2}
            isJumping={isJumping}
            onJumpComplete={() => setIsJumping(false)}
          />
        </Suspense>

        <OrbitControls
          ref={controlsRef}
          enableZoom={false}
          enablePan={false}
          enableRotate={true}
          minPolarAngle={Math.PI / 2} // Lock vertical rotation
          maxPolarAngle={Math.PI / 2} // Lock vertical rotation
        />
      </Canvas>

      <p className="text-center text-sm mt-2 opacity-50"
         style={{ fontFamily: 'Nunito', color: '#1A1A2E' }}>
        Click me while you wait! 👆
      </p>
    </div>
  )
}