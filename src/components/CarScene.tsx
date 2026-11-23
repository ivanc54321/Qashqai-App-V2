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

export const CarScene: React.FC<CarSceneProps> = ({ hotspotState, onToggleHotspot }) => {
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
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(4.8, 2.0, 5.2);

    const applyCameraOffset = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      if (w >= 1024) {
        // Shift frustum right by 16% so the 3D car sits left-of-center (~34% X)
        camera.setViewOffset(w, h, w * 0.16, 0, w, h);
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
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // Studio Reflection Environment (RoomEnvironment) so glossy obsidian black paint gleams
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 9.5;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minPolarAngle = 0.22;
    controls.target.set(0, 0.72, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.75;

    // Studio & Rim Lighting tuned for Glossy Black Paint
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.45);
    scene.add(ambientLight);

    const overheadKey = new THREE.DirectionalLight(0xffffff, 2.6);
    overheadKey.position.set(4, 9, 5);
    overheadKey.castShadow = true;
    overheadKey.shadow.mapSize.set(1024, 1024);
    scene.add(overheadKey);

    const frontFill = new THREE.DirectionalLight(0xe0f2fe, 1.4);
    frontFill.position.set(-4, 4, 6);
    scene.add(frontFill);

    const cyanRim = new THREE.DirectionalLight(0x38bdf8, 2.4);
    cyanRim.position.set(-6, 4.5, -5.5);
    scene.add(cyanRim);

    const whiteRim = new THREE.DirectionalLight(0xffffff, 1.8);
    whiteRim.position.set(6, 3.5, -4);
    scene.add(whiteRim);

    const underGlow = new THREE.PointLight(0x0ea5e9, 1.8, 6.5);
    underGlow.position.set(0, 0.18, 0);
    scene.add(underGlow);

    // Turntable ring & reflective dark disc
    const ringGeo = new THREE.RingGeometry(2.65, 2.72, 72);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.55,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.01;
    scene.add(ringMesh);

    const innerDiscGeo = new THREE.CircleGeometry(2.65, 72);
    const innerDiscMat = new THREE.MeshStandardMaterial({
      color: 0x050811,
      roughness: 0.18,
      metalness: 0.85,
      transparent: true,
      opacity: 0.55,
    });
    const innerDisc = new THREE.Mesh(innerDiscGeo, innerDiscMat);
    innerDisc.rotation.x = -Math.PI / 2;
    innerDisc.receiveShadow = true;
    scene.add(innerDisc);

    // Car Root Group
    const carGroup = new THREE.Group();
    scene.add(carGroup);

    // Headlight 3D SpotLights (attached to carGroup)
    const spotLeft = new THREE.SpotLight(0xe0f2fe, 0, 14, Math.PI / 5, 0.55, 1.2);
    spotLeft.position.set(0.68, 0.72, 2.05);
    spotLeft.target.position.set(0.68, 0.1, 6.8);
    carGroup.add(spotLeft, spotLeft.target);

    const spotRight = new THREE.SpotLight(0xe0f2fe, 0, 14, Math.PI / 5, 0.55, 1.2);
    spotRight.position.set(-0.68, 0.72, 2.05);
    spotRight.target.position.set(-0.68, 0.1, 6.8);
    carGroup.add(spotRight, spotRight.target);

    // Tracked materials for interactive highlight/emissive feedback
    const headlightMats: THREE.MeshStandardMaterial[] = [];
    const doorMats: THREE.MeshStandardMaterial[] = [];
    const trunkMats: THREE.MeshStandardMaterial[] = [];

    // Shared Glossy Metallic Obsidian Black Car Paint
    const obsidianBlackPaint = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x090b10),
      metalness: 0.86,
      roughness: 0.16,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.75,
    });

    const chromeTrimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xe2e8f0),
      metalness: 0.96,
      roughness: 0.1,
      envMapIntensity: 1.8,
    });

    const tintedGlassMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x060b14),
      metalness: 0.2,
      roughness: 0.06,
      transmission: 0.25,
      transparent: true,
      opacity: 0.86,
      clearcoat: 1.0,
      envMapIntensity: 1.6,
    });

    // Load 2018 Nissan Qashqai FBX
    const loader = new FBXLoader();
    loader.setResourcePath('./models/qashqai/');
    let isDisposed = false;

    loader.load(
      './models/qashqai/FINAL_MODEL.fbx',
      (fbx) => {
        if (isDisposed) return;

        // Normalize scale & center onto turntable (y = 0, max dimension ~4.4 units)
        const box = new THREE.Box3().setFromObject(fbx);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const targetLength = 4.45;
        const scaleFactor = targetLength / maxDim;
        fbx.scale.setScalar(scaleFactor);

        // Recompute bounds after scaling
        const scaledBox = new THREE.Box3().setFromObject(fbx);
        const scaledCenter = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);
        fbx.position.x -= scaledCenter.x;
        fbx.position.z -= scaledCenter.z;
        fbx.position.y -= scaledBox.min.y;

        // Traverse meshes to apply obsidian black paint, preserve chrome, and tag interactive parts
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

            // Car body paint -> Glossy Metallic Obsidian Black
            if (matName.includes('carpaint')) {
              const paintMat = obsidianBlackPaint.clone();
              if ('aoMap' in origMat && (origMat as THREE.MeshStandardMaterial).aoMap) {
                paintMat.aoMap = (origMat as THREE.MeshStandardMaterial).aoMap;
              }
              if (isDoor) doorMats.push(paintMat);
              if (isTrunk) trunkMats.push(paintMat);
              return paintMat;
            }

            // Silver/Chrome trim & Nissan badges -> bright metallic contrast
            if (matName.includes('sliver') || matName.includes('chrome') || matName.includes('nissan')) {
              return chromeTrimMat;
            }

            // Windows -> sleek dark tinted reflective glass
            if (matName.includes('window')) {
              return tintedGlassMat;
            }

            // Headlights / light housings -> emissive-capable standard material
            if (matName.includes('light_tex') || matName.includes('light_glass') || isLightMesh) {
              const std = new THREE.MeshStandardMaterial({
                color: 0xe0f2fe,
                map: (origMat as THREE.MeshPhongMaterial).map || null,
                metalness: 0.4,
                roughness: 0.15,
                emissive: new THREE.Color(0xbae6fd),
                emissiveIntensity: 1.4,
                transparent: matName.includes('glass'),
                opacity: matName.includes('glass') ? 0.65 : 1.0,
              });
              headlightMats.push(std);
              return std;
            }

            // Tires & matte plastic trim
            if (matName.includes('luntai') || matName.includes('blackplasic') || matName.includes('black3')) {
              const std = new THREE.MeshStandardMaterial({
                color: new THREE.Color(0x14171f),
                map: (origMat as THREE.MeshPhongMaterial).map || null,
                roughness: matName.includes('ref') ? 0.28 : 0.72,
                metalness: matName.includes('ref') ? 0.55 : 0.15,
                envMapIntensity: 1.0,
              });
              if (isDoor) doorMats.push(std);
              if (isTrunk) trunkMats.push(std);
              return std;
            }

            // Fallback: convert Phong/Lambert to Standard so it responds to RoomEnvironment
            const src = origMat as THREE.MeshPhongMaterial;
            const fallback = new THREE.MeshStandardMaterial({
              color: src.color ? src.color.clone() : new THREE.Color(0x334155),
              map: src.map || null,
              roughness: 0.45,
              metalness: 0.35,
              envMapIntensity: 1.1,
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
      },
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

    // Interactive 3D Hotspots (clickable glowing spheres)
    const hotspotMeshes: { mesh: THREE.Mesh; key: keyof CarHotspotState }[] = [];
    const createHotspot = (x: number, y: number, z: number, key: keyof CarHotspotState) => {
      const geo = new THREE.SphereGeometry(0.11, 16, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      carGroup.add(mesh);
      hotspotMeshes.push({ mesh, key });
    };

    createHotspot(0, 0.85, 2.32, 'headlights');
    createHotspot(1.12, 0.92, 0.1, 'doorsOpen');
    createHotspot(0, 1.05, -2.28, 'trunkOpen');

    // Raycaster for clicking hotspots
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerDown = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(hotspotMeshes.map((h) => h.mesh));
      if (intersects.length > 0) {
        const hit = hotspotMeshes.find((h) => h.mesh === intersects[0].object);
        if (hit) {
          onToggleHotspot(hit.key);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      applyCameraOffset();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Animation loop
    let animId = 0;
    const clock = new THREE.Clock();
    const cyanEmissive = new THREE.Color(0x06b6d4);
    const amberEmissive = new THREE.Color(0xf59e0b);
    const blackEmissive = new THREE.Color(0x000000);

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const s = stateRef.current;

      // Headlights: 3D SpotLight beams + emissive glow
      spotLeft.intensity = s.headlights ? 8.5 : 0;
      spotRight.intensity = s.headlights ? 8.5 : 0;
      headlightMats.forEach((m) => {
        m.emissiveIntensity = s.headlights ? 2.2 : 0.08;
      });

      // Doors highlight pulse when unlocked/open
      const doorPulse = s.doorsOpen ? 0.35 + Math.sin(t * 4) * 0.2 : 0;
      doorMats.forEach((m) => {
        m.emissive.copy(s.doorsOpen ? cyanEmissive : blackEmissive);
        m.emissiveIntensity = doorPulse;
      });

      // Trunk highlight pulse when open
      const trunkPulse = s.trunkOpen ? 0.4 + Math.sin(t * 4) * 0.2 : 0;
      trunkMats.forEach((m) => {
        m.emissive.copy(s.trunkOpen ? amberEmissive : blackEmissive);
        m.emissiveIntensity = trunkPulse;
      });

      // Pulse hotspots
      hotspotMeshes.forEach(({ mesh, key }, idx) => {
        const scale = 1 + Math.sin(t * 3.5 + idx) * 0.18;
        mesh.scale.setScalar(scale);
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.color.setHex(s[key] ? 0x22d3ee : 0x94a3b8);
      });

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      controls.dispose();
      envTarget.dispose();
      roomEnv.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onToggleHotspot]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left Live Vehicle Status HUD Badges */}
      <div className="pointer-events-none absolute top-6 left-6 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-950/55 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white backdrop-blur-md border border-white/10">
          2018 Nissan Qashqai • Obsidian Black
        </span>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-md border transition ${
            hotspotState.headlights
              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40'
              : 'bg-slate-950/45 text-slate-400 border-white/10'
          }`}
        >
          Lights: {hotspotState.headlights ? 'ON' : 'OFF'}
        </span>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-md border transition ${
            hotspotState.doorsOpen
              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40'
              : 'bg-slate-950/45 text-slate-400 border-white/10'
          }`}
        >
          Doors: {hotspotState.doorsOpen ? 'UNLOCKED' : 'LOCKED'}
        </span>
        <span
          className={`rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-md border transition ${
            hotspotState.trunkOpen
              ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
              : 'bg-slate-950/45 text-slate-400 border-white/10'
          }`}
        >
          Trunk: {hotspotState.trunkOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      {/* Loading Indicator */}
      {!isLoaded && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl bg-slate-950/70 px-6 py-4 text-center backdrop-blur-xl border border-white/15">
            <div className="text-sm font-medium text-white">Loading 2018 Nissan Qashqai 3D Model...</div>
            <div className="mt-2 h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-cyan-400 transition-all duration-200"
                style={{ width: `${Math.max(10, loadProgress)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Bottom Hint Pill */}
      <div className="pointer-events-none absolute bottom-6 left-6 flex items-center gap-3 rounded-full bg-slate-950/50 px-4 py-2 text-xs text-slate-300 backdrop-blur-md border border-white/10">
        <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
        <span>Drag to orbit • Click glowing hotspots to toggle lights, doors &amp; trunk</span>
      </div>
    </div>
  );
};
