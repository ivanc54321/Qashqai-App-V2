import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface CarHotspotState {
  headlights: boolean;
  doorsOpen: boolean;
  trunkOpen: boolean;
}

interface CarSceneProps {
  hotspotState: CarHotspotState;
  onToggleHotspot: (key: keyof CarHotspotState) => void;
}

function createSpotlightFloorTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.04, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, 'rgba(210, 220, 232, 0.34)');
  grad.addColorStop(0.32, 'rgba(140, 152, 168, 0.16)');
  grad.addColorStop(0.68, 'rgba(40, 46, 56, 0.05)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export const CarScene: React.FC<CarSceneProps> = ({ hotspotState }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<CarHotspotState>(hotspotState);
  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);

  useEffect(() => {
    stateRef.current = hotspotState;
  }, [hotspotState]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      34,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    // Low 3/4 front hero angle matching studio reference
    camera.position.set(4.1, 1.55, 4.7);

    const applyCameraOffset = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      if (w >= 900) {
        // Shift frustum right by 20% and slightly up so the Qashqai sits prominently on the lower-left
        camera.setViewOffset(w, h, w * 0.2, -h * 0.05, w, h);
      } else {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
    };
    applyCameraOffset();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    // Neutral studio reflection environment so jet-black clearcoat gleams with crisp white/silver highlights
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.03);
    scene.environment = envTarget.texture;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.minDistance = 3.4;
    controls.maxDistance = 9.0;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;
    controls.minPolarAngle = 0.2;
    controls.target.set(0, 0.65, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;

    // Dramatic dark-studio lighting (cool-white overhead spotlight + subtle silver rim lights)
    const ambientLight = new THREE.AmbientLight(0xe2e8f0, 0.22);
    scene.add(ambientLight);

    const overheadSpot = new THREE.SpotLight(0xf8fafc, 55, 22, Math.PI / 4.2, 0.72, 1.3);
    overheadSpot.position.set(1.8, 7.8, 2.6);
    overheadSpot.target.position.set(0, 0.4, 0.2);
    overheadSpot.castShadow = true;
    overheadSpot.shadow.mapSize.set(2048, 2048);
    overheadSpot.shadow.bias = -0.0004;
    scene.add(overheadSpot, overheadSpot.target);

    const hoodKey = new THREE.DirectionalLight(0xffffff, 1.7);
    hoodKey.position.set(4.5, 5.5, 5.5);
    scene.add(hoodKey);

    const leftRim = new THREE.DirectionalLight(0xdbeafe, 1.15);
    leftRim.position.set(-5.5, 3.8, -3.5);
    scene.add(leftRim);

    const backRim = new THREE.DirectionalLight(0xf1f5f9, 1.0);
    backRim.position.set(3.5, 3.2, -5.5);
    scene.add(backRim);

    // Feathered soft studio spotlight pool on floor (no hard ring)
    const floorTex = createSpotlightFloorTexture();
    const floorPool = new THREE.Mesh(
      new THREE.PlaneGeometry(9.5, 9.5),
      new THREE.MeshBasicMaterial({
        map: floorTex,
        transparent: true,
        depthWrite: false,
      })
    );
    floorPool.rotation.x = -Math.PI / 2;
    floorPool.position.y = 0.002;
    scene.add(floorPool);

    // Soft contact shadow catcher directly beneath the Qashqai
    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.ShadowMaterial({ opacity: 0.72 })
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = 0.004;
    shadowCatcher.receiveShadow = true;
    scene.add(shadowCatcher);

    // Car Root Group
    const carGroup = new THREE.Group();
    scene.add(carGroup);

    // Headlight 3D SpotLights
    const spotLeft = new THREE.SpotLight(0xf8fafc, 0, 14, Math.PI / 5, 0.6, 1.2);
    spotLeft.position.set(0.68, 0.72, 2.05);
    spotLeft.target.position.set(0.68, 0.1, 6.8);
    carGroup.add(spotLeft, spotLeft.target);

    const spotRight = new THREE.SpotLight(0xf8fafc, 0, 14, Math.PI / 5, 0.6, 1.2);
    spotRight.position.set(-0.68, 0.72, 2.05);
    spotRight.target.position.set(-0.68, 0.1, 6.8);
    carGroup.add(spotRight, spotRight.target);

    // Tracked materials for interactive feedback
    const headlightMats: THREE.MeshStandardMaterial[] = [];
    const doorMats: THREE.MeshStandardMaterial[] = [];
    const trunkMats: THREE.MeshStandardMaterial[] = [];

    // Mirror-gloss Jet Black Clearcoat Paint matching reference image
    const jetBlackPaint = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x050608),
      metalness: 0.88,
      roughness: 0.13,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      envMapIntensity: 1.9,
    });

    const chromeTrimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf1f5f9),
      metalness: 0.96,
      roughness: 0.09,
      envMapIntensity: 2.0,
    });

    const tintedGlassMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x0b1018),
      metalness: 0.15,
      roughness: 0.05,
      transparent: true,
      opacity: 0.82,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.75,
    });

    // Load 2018 Nissan Qashqai FBX
    const embeddedB64 = (window as unknown as { __EMBEDDED_FBX_B64__?: string }).__EMBEDDED_FBX_B64__;
    const manager = new THREE.LoadingManager();
    if (embeddedB64) {
      const blankPng =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      manager.setURLModifier(() => blankPng);
    }

    const loader = new FBXLoader(manager);
    if (!embeddedB64) {
      loader.setResourcePath('./models/qashqai/');
    }
    let isDisposed = false;

    const handleLoadedModel = (fbx: THREE.Group) => {
      if (isDisposed) return;

      const box = new THREE.Box3().setFromObject(fbx);
      const size = new THREE.Vector3();
      box.getSize(size);

      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetLength = 4.65;
      fbx.scale.setScalar(targetLength / maxDim);

      const scaledBox = new THREE.Box3().setFromObject(fbx);
      const scaledCenter = new THREE.Vector3();
      scaledBox.getCenter(scaledCenter);
      fbx.position.x -= scaledCenter.x;
      fbx.position.z -= scaledCenter.z;
      fbx.position.y -= scaledBox.min.y;

      fbx.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        child.castShadow = true;
        child.receiveShadow = true;

        const meshName = child.name.toLowerCase();
        const isDoor = meshName.includes('door_');
        const isTrunk = meshName.includes('houbeixiang') || meshName.includes('goubeixiang');
        const isLightMesh =
          meshName.includes('light_tex') || meshName.includes('f_glass') || meshName.includes('light_glass');

        const upgradeMaterial = (origMat: THREE.Material): THREE.Material => {
          const matName = (origMat.name || '').toLowerCase();

          if (matName.includes('carpaint')) {
            const paintMat = jetBlackPaint.clone();
            if (!embeddedB64 && 'aoMap' in origMat && (origMat as THREE.MeshStandardMaterial).aoMap) {
              paintMat.aoMap = (origMat as THREE.MeshStandardMaterial).aoMap;
            }
            if (isDoor) doorMats.push(paintMat);
            if (isTrunk) trunkMats.push(paintMat);
            return paintMat;
          }

          if (matName.includes('sliver') || matName.includes('chrome') || matName.includes('nissan')) {
            return chromeTrimMat;
          }

          if (matName.includes('window')) {
            return tintedGlassMat;
          }

          if (matName.includes('light_tex') || matName.includes('light_glass') || isLightMesh) {
            const std = new THREE.MeshStandardMaterial({
              color: 0xe2e8f0,
              map: !embeddedB64 ? (origMat as THREE.MeshPhongMaterial).map || null : null,
              metalness: 0.6,
              roughness: 0.1,
              emissive: new THREE.Color(0xf8fafc),
              emissiveIntensity: 0.6,
              transparent: matName.includes('glass'),
              opacity: matName.includes('glass') ? 0.55 : 1.0,
              envMapIntensity: 1.8,
            });
            headlightMats.push(std);
            return std;
          }

          if (matName.includes('luntai') || matName.includes('blackplasic') || matName.includes('black3')) {
            const std = new THREE.MeshStandardMaterial({
              color: new THREE.Color(0x0c0e12),
              map: !embeddedB64 ? (origMat as THREE.MeshPhongMaterial).map || null : null,
              roughness: matName.includes('ref') ? 0.22 : 0.75,
              metalness: matName.includes('ref') ? 0.6 : 0.12,
              envMapIntensity: 1.1,
            });
            if (isDoor) doorMats.push(std);
            if (isTrunk) trunkMats.push(std);
            return std;
          }

          const src = origMat as THREE.MeshPhongMaterial;
          const fallback = new THREE.MeshStandardMaterial({
            color: src.color ? src.color.clone() : new THREE.Color(0x1e293b),
            map: !embeddedB64 ? src.map || null : null,
            roughness: 0.4,
            metalness: 0.4,
            envMapIntensity: 1.2,
          });
          if (isDoor) doorMats.push(fallback);
          if (isTrunk) trunkMats.push(fallback);
          return fallback;
        };

        if (Array.isArray(child.material)) {
          child.material = child.material.map(upgradeMaterial);
        } else if (child.material) {
          child.material = upgradeMaterial(child.material);
        }
      });

      carGroup.add(fbx);
      setIsLoaded(true);
    };

    if (embeddedB64) {
      try {
        const binary = atob(embeddedB64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const parsed = loader.parse(bytes.buffer, '');
        handleLoadedModel(parsed);
      } catch (err) {
        console.error('Failed to parse embedded Qashqai FBX:', err);
        setIsLoaded(true);
      }
    } else {
      loader.load(
        './models/qashqai/FINAL_MODEL.fbx',
        handleLoadedModel,
        (xhr) => {
          if (xhr.total > 0) {
            setLoadProgress(Math.round((xhr.loaded / xhr.total) * 100));
          }
        },
        (err) => {
          console.error('Failed to load Qashqai FBX:', err);
          setIsLoaded(true);
        }
      );
    }

    const handleResize = () => {
      if (!container) return;
      applyCameraOffset();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    let animId = 0;
    const clock = new THREE.Clock();
    const whiteEmissive = new THREE.Color(0xe2e8f0);
    const blackEmissive = new THREE.Color(0x000000);

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const s = stateRef.current;

      // Headlights
      spotLeft.intensity = s.headlights ? 12 : 0;
      spotRight.intensity = s.headlights ? 12 : 0;
      headlightMats.forEach((m) => {
        m.emissiveIntensity = s.headlights ? 2.4 : 0.12;
      });

      // Subtle silver highlight pulse when doors/trunk toggled
      const doorPulse = s.doorsOpen ? 0.18 + Math.sin(t * 3.5) * 0.1 : 0;
      doorMats.forEach((m) => {
        m.emissive.copy(s.doorsOpen ? whiteEmissive : blackEmissive);
        m.emissiveIntensity = doorPulse;
      });

      const trunkPulse = s.trunkOpen ? 0.2 + Math.sin(t * 3.5) * 0.1 : 0;
      trunkMats.forEach((m) => {
        m.emissive.copy(s.trunkOpen ? whiteEmissive : blackEmissive);
        m.emissiveIntensity = trunkPulse;
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      floorTex.dispose();
      envTarget.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {!isLoaded && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl bg-black/70 px-6 py-4 text-center backdrop-blur-xl border border-white/10">
            <div className="text-sm font-medium text-white">Loading 2018 Nissan Qashqai...</div>
            <div className="mt-2 h-1 w-44 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/80 transition-all duration-200"
                style={{ width: `${Math.max(12, loadProgress)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
