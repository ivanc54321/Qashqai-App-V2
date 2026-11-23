import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

export interface CarHotspotState {
  headlights: boolean;
  doorsOpen: boolean;
  trunkOpen: boolean;
}

interface CarSceneProps {
  hotspotState: CarHotspotState;
  onToggleHotspot: (key: keyof CarHotspotState) => void;
}

declare global {
  interface Window {
    __EMBEDDED_FBX_B64__?: string;
    __EMBEDDED_TEXTURES__?: Record<string, string>;
  }
}

/**
 * Builds a custom procedural automotive photo-studio light-tent scene for PMREM reflections:
 * long cool-white overhead softbox ribbons + side rim bounce cards + pitch-black lower hemisphere
 * so jet-black clearcoat paint catches liquid-mirror studio highlights like a car commercial.
 */
function createAutomotiveStudioEnv(renderer: THREE.WebGLRenderer): THREE.WebGLRenderTarget {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x020305);

  const addSoftbox = (
    w: number,
    h: number,
    pos: [number, number, number],
    lookAt: [number, number, number],
    rgb: [number, number, number]
  ) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setRGB(rgb[0], rgb[1], rgb[2]),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(...pos);
    mesh.lookAt(...lookAt);
    studio.add(mesh);
  };

  // Main overhead longitudinal softbox ribbon (creates crisp hood & roof reflection lines)
  addSoftbox(14, 2.2, [0, 8.5, 0.5], [0, 0, 0.5], [4.2, 4.4, 4.8]);
  // Secondary angled overhead key strip (sculpts front hood & A-pillar)
  addSoftbox(10, 1.8, [4.5, 6.2, 4.5], [0, 0.5, 0], [3.0, 3.2, 3.5]);
  // Left & right low side bounce strips (defines door creases & wheel arches)
  addSoftbox(12, 1.4, [8.5, 2.4, 0], [0, 0.8, 0], [1.6, 1.7, 1.9]);
  addSoftbox(12, 1.4, [-8.5, 2.6, -0.5], [0, 0.8, 0], [1.5, 1.65, 1.9]);
  // Rear 3/4 accent bounce (highlights C-pillar & tail)
  addSoftbox(8, 1.6, [-4.5, 4.5, -7.5], [0, 0.7, 0], [1.4, 1.5, 1.7]);
  // Soft front fill card (illuminates chrome grille & Nissan emblem)
  addSoftbox(6, 2.4, [1.5, 2.2, 8.5], [0, 0.6, 0], [1.8, 1.9, 2.1]);

  const envTarget = pmrem.fromScene(studio, 0.02);
  pmrem.dispose();
  return envTarget;
}

function createSpotlightFloorTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.03, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, 'rgba(220, 228, 238, 0.36)');
  grad.addColorStop(0.28, 'rgba(148, 160, 176, 0.17)');
  grad.addColorStop(0.62, 'rgba(42, 48, 58, 0.05)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function createHeadlightGlowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  grad.addColorStop(0.22, 'rgba(224, 242, 254, 0.55)');
  grad.addColorStop(0.55, 'rgba(186, 230, 253, 0.15)');
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
    // Low 3/4 front hero angle matching dark studio reference
    camera.position.set(4.1, 1.52, 4.65);

    const applyCameraOffset = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      if (w >= 900) {
        // Position the Qashqai prominently in the lower-left quadrant
        camera.setViewOffset(w, h, w * 0.2, -h * 0.05, w, h);
      } else {
        camera.clearViewOffset();
      }
      camera.updateProjectionMatrix();
    };
    applyCameraOffset();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    container.appendChild(renderer.domElement);

    // Custom Automotive Softbox Studio Reflection Environment
    const envTarget = createAutomotiveStudioEnv(renderer);
    scene.environment = envTarget.texture;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.055;
    controls.enablePan = false;
    controls.minDistance = 3.2;
    controls.maxDistance = 9.0;
    controls.maxPolarAngle = Math.PI / 2 - 0.025;
    controls.minPolarAngle = 0.18;
    controls.target.set(0, 0.65, 0);
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // Studio Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xe2e8f0, 0.2);
    scene.add(ambientLight);

    const overheadSpot = new THREE.SpotLight(0xf8fafc, 62, 24, Math.PI / 4.2, 0.72, 1.3);
    overheadSpot.position.set(1.8, 7.8, 2.6);
    overheadSpot.target.position.set(0, 0.4, 0.2);
    overheadSpot.castShadow = true;
    overheadSpot.shadow.mapSize.set(2048, 2048);
    overheadSpot.shadow.bias = -0.0003;
    scene.add(overheadSpot, overheadSpot.target);

    const hoodKey = new THREE.DirectionalLight(0xffffff, 1.85);
    hoodKey.position.set(4.5, 5.5, 5.5);
    scene.add(hoodKey);

    const leftRim = new THREE.DirectionalLight(0xe0f2fe, 1.2);
    leftRim.position.set(-5.8, 3.8, -3.2);
    scene.add(leftRim);

    const backRim = new THREE.DirectionalLight(0xf1f5f9, 1.05);
    backRim.position.set(3.5, 3.2, -5.5);
    scene.add(backRim);

    // Feathered soft studio spotlight pool on floor
    const floorTex = createSpotlightFloorTexture();
    const floorPool = new THREE.Mesh(
      new THREE.PlaneGeometry(9.6, 9.6),
      new THREE.MeshBasicMaterial({
        map: floorTex,
        transparent: true,
        depthWrite: false,
      })
    );
    floorPool.rotation.x = -Math.PI / 2;
    floorPool.position.y = 0.002;
    scene.add(floorPool);

    // High-contrast soft contact shadow catcher beneath tires & chassis
    const shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.ShadowMaterial({ opacity: 0.78 })
    );
    shadowCatcher.rotation.x = -Math.PI / 2;
    shadowCatcher.position.y = 0.004;
    shadowCatcher.receiveShadow = true;
    scene.add(shadowCatcher);

    // Car Root Group
    const carGroup = new THREE.Group();
    scene.add(carGroup);

    // Headlight 3D SpotLights + Soft Additive Glow Sprites
    const spotLeft = new THREE.SpotLight(0xf8fafc, 0, 15, Math.PI / 4.8, 0.65, 1.2);
    spotLeft.position.set(0.68, 0.74, 2.02);
    spotLeft.target.position.set(0.68, 0.1, 7.0);
    carGroup.add(spotLeft, spotLeft.target);

    const spotRight = new THREE.SpotLight(0xf8fafc, 0, 15, Math.PI / 4.8, 0.65, 1.2);
    spotRight.position.set(-0.68, 0.74, 2.02);
    spotRight.target.position.set(-0.68, 0.1, 7.0);
    carGroup.add(spotRight, spotRight.target);

    const glowTex = createHeadlightGlowTexture();
    const createGlowSprite = (x: number, y: number, z: number) => {
      const mat = new THREE.SpriteMaterial({
        map: glowTex,
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(x, y, z);
      sprite.scale.set(0.95, 0.65, 1);
      carGroup.add(sprite);
      return mat;
    };
    const glowLeftMat = createGlowSprite(0.68, 0.76, 2.08);
    const glowRightMat = createGlowSprite(-0.68, 0.76, 2.08);

    // Tracked materials for interactive feedback
    const headlightMats: THREE.MeshStandardMaterial[] = [];
    const doorMats: THREE.MeshStandardMaterial[] = [];
    const trunkMats: THREE.MeshStandardMaterial[] = [];

    // Resolve textures from embedded base64 map (in self-contained preview) or ./models/qashqai/ (in Vite)
    const embeddedB64 = window.__EMBEDDED_FBX_B64__;
    const embeddedTextures = window.__EMBEDDED_TEXTURES__;
    const blankPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    const resolveTextureUrl = (rawUrl: string): string => {
      if (rawUrl.startsWith('data:')) return rawUrl;
      const base = rawUrl.split(/[\\/]/).pop() || '';
      const key = base.toLowerCase();
      if (embeddedTextures) {
        return embeddedTextures[key] || blankPng;
      }
      return base ? `./models/qashqai/${base}` : rawUrl;
    };

    const manager = new THREE.LoadingManager();
    manager.setURLModifier(resolveTextureUrl);

    const texLoader = new THREE.TextureLoader(manager);
    const carpaintAoTex = texLoader.load('carpaint_occ.jpg');
    carpaintAoTex.colorSpace = THREE.NoColorSpace;

    // Baked soft underbody contact shadow decal from the model zip
    const bakedShadowTex = texLoader.load('shadow_main2.png');
    const bakedShadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 5.4),
      new THREE.MeshBasicMaterial({
        map: bakedShadowTex,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      })
    );
    bakedShadowPlane.rotation.x = -Math.PI / 2;
    bakedShadowPlane.position.y = 0.005;
    carGroup.add(bakedShadowPlane);

    // Mirror-gloss Jet Black Clearcoat Paint
    const jetBlackPaint = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x040507),
      metalness: 0.9,
      roughness: 0.11,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 2.2,
      aoMap: carpaintAoTex,
      aoMapIntensity: 0.7,
    });

    const chromeTrimMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0xf8fafc),
      metalness: 0.98,
      roughness: 0.07,
      envMapIntensity: 2.2,
    });

    const tintedGlassMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x080c14),
      metalness: 0.15,
      roughness: 0.04,
      transparent: true,
      opacity: 0.76,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.4,
    });

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

        // Ensure UV1 exists for aoMap support
        const geo = child.geometry as THREE.BufferGeometry;
        if (geo && geo.attributes.uv && !geo.attributes.uv1) {
          geo.setAttribute('uv1', geo.attributes.uv);
        }

        const meshName = child.name.toLowerCase();
        const isDoor = meshName.includes('door_');
        const isTrunk = meshName.includes('houbeixiang') || meshName.includes('goubeixiang');
        const isWheelRim = meshName.includes('lungu') || meshName.includes('wheel') || meshName.includes('rim');
        const isLightMesh =
          meshName.includes('light_tex') || meshName.includes('f_glass') || meshName.includes('light_glass');

        const upgradeMaterial = (origMat: THREE.Material): THREE.Material => {
          const matName = (origMat.name || '').toLowerCase();
          const src = origMat as THREE.MeshPhongMaterial;
          const srcMap = src.map || null;
          if (srcMap) {
            srcMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          }

          // 1. Body Paint -> Mirror-Gloss Jet Black Clearcoat + AO
          if (matName.includes('carpaint')) {
            const paintMat = jetBlackPaint.clone();
            if (isDoor) doorMats.push(paintMat);
            if (isTrunk) trunkMats.push(paintMat);
            return paintMat;
          }

          // 2. Chrome trim & Nissan badges (preserve map if badge has texture)
          if (matName.includes('sliver') || matName.includes('chrome') || matName.includes('nissan')) {
            if (srcMap) {
              return new THREE.MeshStandardMaterial({
                color: new THREE.Color(0xf8fafc),
                map: srcMap,
                metalness: 0.92,
                roughness: 0.12,
                envMapIntensity: 2.1,
              });
            }
            return chromeTrimMat;
          }

          // 3. Windows -> High-gloss Fresnel dark glass
          if (matName.includes('window')) {
            return tintedGlassMat;
          }

          // 4. Outer clear headlight glass lenses
          if (matName.includes('light_glass') || meshName.includes('f_glass')) {
            return new THREE.MeshPhysicalMaterial({
              color: 0xf1f5f9,
              metalness: 0.1,
              roughness: 0.04,
              clearcoat: 1.0,
              clearcoatRoughness: 0.02,
              transparent: true,
              opacity: 0.36,
              envMapIntensity: 2.3,
            });
          }

          // 5. Internal headlight/taillight optics (preserve detailed light.jpg)
          if (matName.includes('light_tex') || isLightMesh) {
            const std = new THREE.MeshStandardMaterial({
              color: 0xffffff,
              map: srcMap,
              metalness: 0.65,
              roughness: 0.12,
              emissive: new THREE.Color(0xf0f9ff),
              emissiveMap: srcMap,
              emissiveIntensity: 0.6,
              envMapIntensity: 1.9,
            });
            headlightMats.push(std);
            return std;
          }

          // 6. Tires & Machined Alloy Wheels (preserve Tire_05_DM_black.jpg & lungu17.jpg)
          if (matName.includes('luntai') || isWheelRim) {
            const hasRimTex = srcMap && (srcMap.name?.toLowerCase().includes('lungu') || isWheelRim);
            return new THREE.MeshStandardMaterial({
              color: hasRimTex ? new THREE.Color(0xe2e8f0) : new THREE.Color(0x16181d),
              map: srcMap,
              roughness: hasRimTex ? 0.18 : 0.84,
              metalness: hasRimTex ? 0.86 : 0.08,
              envMapIntensity: hasRimTex ? 1.9 : 0.7,
            });
          }

          // 7. Grille mesh & matte/gloss black plastic trim (preserve wangge.jpg)
          if (matName.includes('blackplasic') || matName.includes('black3')) {
            const isGloss = matName.includes('ref');
            const std = new THREE.MeshStandardMaterial({
              color: srcMap ? new THREE.Color(0xcbd5e1) : new THREE.Color(0x0b0d12),
              map: srcMap,
              roughness: isGloss ? 0.18 : 0.74,
              metalness: isGloss ? 0.65 : 0.14,
              envMapIntensity: isGloss ? 1.5 : 0.8,
            });
            if (isDoor) doorMats.push(std);
            if (isTrunk) trunkMats.push(std);
            return std;
          }

          // 8. Interior / remaining detailed textured parts (preserve real textures!)
          const fallback = new THREE.MeshStandardMaterial({
            color: srcMap ? new THREE.Color(0xdbe2ea) : src.color ? src.color.clone() : new THREE.Color(0x1e293b),
            map: srcMap,
            roughness: srcMap ? 0.42 : 0.45,
            metalness: srcMap ? 0.35 : 0.4,
            envMapIntensity: 1.35,
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

      // Headlights + soft additive bloom halos
      spotLeft.intensity = s.headlights ? 14 : 0;
      spotRight.intensity = s.headlights ? 14 : 0;
      const targetGlow = s.headlights ? 0.65 : 0;
      glowLeftMat.opacity += (targetGlow - glowLeftMat.opacity) * 0.12;
      glowRightMat.opacity += (targetGlow - glowRightMat.opacity) * 0.12;

      headlightMats.forEach((m) => {
        m.emissiveIntensity = s.headlights ? 2.6 : 0.15;
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
      glowTex.dispose();
      carpaintAoTex.dispose();
      bakedShadowTex.dispose();
      envTarget.dispose();
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
