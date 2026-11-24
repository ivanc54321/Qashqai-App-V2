import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { RotateCcw } from 'lucide-react';

export interface CarHotspotState {
  headlights: boolean;
  doorsOpen: boolean;
  trunkOpen: boolean;
}

export type CameraPreset = 'overview' | 'navigation' | 'media' | 'lights' | 'doors' | 'trunk';
export type LayoutMode = 'horizontal-tablet' | 'horizontal-mobile' | 'vertical-mobile';

interface CameraPresetConfig {
  position: [number, number, number];
  target: [number, number, number];
  autoRotate: boolean;
  label: string;
}

const CAMERA_PRESETS: Record<CameraPreset, CameraPresetConfig> = {
  overview: {
    position: [4.1, 1.52, 4.65],
    target: [0, 0.65, 0],
    autoRotate: true,
    label: 'Overview',
  },
  navigation: {
    position: [0, 5.8, -5.2],
    target: [0, 0.35, 1.15],
    autoRotate: false,
    label: 'Navigation',
  },
  media: {
    position: [2.75, 1.16, 2.45],
    target: [0.05, 0.82, 0.15],
    autoRotate: false,
    label: 'Media Close-Up',
  },
  lights: {
    position: [1.3, 0.88, 4.05],
    target: [0, 0.62, 1.65],
    autoRotate: false,
    label: 'Headlights',
  },
  doors: {
    position: [4.25, 1.24, 0.12],
    target: [0, 0.78, 0.05],
    autoRotate: false,
    label: 'Side Profile',
  },
  trunk: {
    position: [-2.6, 1.36, -4.05],
    target: [0, 0.72, -1.35],
    autoRotate: false,
    label: 'Rear View',
  },
};

interface CarSceneProps {
  hotspotState: CarHotspotState;
  onToggleHotspot: (key: keyof CarHotspotState) => void;
  cameraPreset: CameraPreset;
  presetTrigger: number;
  menuCollapsed: boolean;
  showLaneLines: boolean;
  layoutMode: LayoutMode;
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

/**
 * Generates an authentic UK number plate texture (white for front, yellow for rear)
 * aligned to the exact UV band of the Qashqai FBX plate meshes (u: 0.003..0.997, v: 0.329..0.658).
 */
function createUKPlateTexture(text: string, variant: 'front' | 'rear'): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Fill entire canvas with plate base color so beveled edges match seamlessly
  const bgColor = variant === 'front' ? '#f8fafc' : '#f5c518';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);

  // Visible front/rear plate face lies at y = 350..687 (height 337px)
  const top = 352;
  const height = 334;
  const centerY = top + height / 2;

  // Subtle vertical acrylic sheen gradient
  const sheen = ctx.createLinearGradient(0, top, 0, top + height);
  sheen.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
  sheen.addColorStop(0.5, 'rgba(255, 255, 255, 0.0)');
  sheen.addColorStop(1, 'rgba(0, 0, 0, 0.08)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, top, size, height);

  // Crisp outer plate border
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, top + 8, size - 28, height - 16);

  // Authentic UK bold condensed Charles Wright-style plate lettering (~70% of plate height)
  ctx.fillStyle = '#09090b';
  ctx.font = '900 225px "Arial Narrow", "Impact", "Helvetica Neue", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, centerY + 10);

  // Tiny subtle BS AU 145e mark in bottom-right corner for realism
  ctx.fillStyle = 'rgba(9, 9, 11, 0.45)';
  ctx.font = '600 18px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('BS AU 145e', size - 30, top + height - 22);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates a subtle glowing studio floor compass & radar ring
 * that fades in during Navigation bird's-eye view.
 */
function createNavCompassTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  // Soft outer radar glow
  const glow = ctx.createRadialGradient(cx, cy, size * 0.24, cx, cy, size * 0.49);
  glow.addColorStop(0, 'rgba(56, 189, 248, 0)');
  glow.addColorStop(0.55, 'rgba(56, 189, 248, 0.08)');
  glow.addColorStop(0.82, 'rgba(148, 163, 184, 0.05)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  // Concentric thin studio rings
  const drawRing = (radius: number, stroke: string, width: number, dash: number[] = []) => {
    ctx.save();
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  };

  drawRing(size * 0.46, 'rgba(186, 230, 253, 0.34)', 2.5);
  drawRing(size * 0.42, 'rgba(148, 163, 184, 0.22)', 1.5, [6, 12]);
  drawRing(size * 0.33, 'rgba(56, 189, 248, 0.22)', 1.5);

  // Degree tick marks around the outer compass ring
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * Math.PI * 2;
    const isMajor = i % 18 === 0;
    const isMedium = i % 6 === 0;
    const rOuter = size * 0.46;
    const rInner = rOuter - (isMajor ? 24 : isMedium ? 14 : 7);
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * rInner, cy + Math.sin(angle) * rInner);
    ctx.lineTo(cx + Math.cos(angle) * rOuter, cy + Math.sin(angle) * rOuter);
    ctx.strokeStyle = isMajor ? 'rgba(224, 242, 254, 0.78)' : 'rgba(148, 163, 184, 0.32)';
    ctx.lineWidth = isMajor ? 3 : 1.5;
    ctx.stroke();
  }

  // Forward heading chevron (pointing toward +Z in world space -> bottom of plane UV)
  ctx.save();
  ctx.fillStyle = 'rgba(56, 189, 248, 0.85)';
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.485);
  ctx.lineTo(cx - 14, cy + size * 0.445);
  ctx.lineTo(cx + 14, cy + size * 0.445);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Cardinal labels
  ctx.fillStyle = 'rgba(226, 232, 240, 0.7)';
  ctx.font = '700 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N', cx, cy + size * 0.39);
  ctx.fillText('S', cx, cy - size * 0.39);
  ctx.fillText('E', cx - size * 0.39, cy);
  ctx.fillText('W', cx + size * 0.39, cy);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Generates glowing blue ADAS inner lane lines and subtle outer road lines
 * matching the Tesla-style driving visualization.
 */
function createLaneLinesTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const drawVerticalGlowLine = (x: number, colorCore: string, colorGlow: string, lineWidth: number) => {
    const grad = ctx.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.15, colorGlow);
    grad.addColorStop(0.65, colorCore);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth = lineWidth;
    ctx.shadowColor = colorCore;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(x, h * 0.96);
    ctx.lineTo(x, h * 0.04);
    ctx.stroke();
    ctx.restore();
  };

  // Inner glowing blue Autopilot/ADAS lane boundaries
  drawVerticalGlowLine(w * 0.34, 'rgba(56, 189, 248, 0.95)', 'rgba(37, 99, 235, 0.65)', 5);
  drawVerticalGlowLine(w * 0.66, 'rgba(56, 189, 248, 0.95)', 'rgba(37, 99, 235, 0.65)', 5);

  // Outer subtle grey road boundary lines
  drawVerticalGlowLine(w * 0.14, 'rgba(148, 163, 184, 0.38)', 'rgba(100, 116, 139, 0.15)', 2.5);
  drawVerticalGlowLine(w * 0.86, 'rgba(148, 163, 184, 0.38)', 'rgba(100, 116, 139, 0.15)', 2.5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

interface CameraTransition {
  active: boolean;
  startTime: number;
  duration: number;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  endAutoRotate: boolean;
}

export const CarScene: React.FC<CarSceneProps> = ({
  hotspotState,
  cameraPreset,
  presetTrigger,
  menuCollapsed,
  showLaneLines,
  layoutMode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<CarHotspotState>(hotspotState);
  const presetRef = useRef<CameraPreset>(cameraPreset);
  const menuCollapsedRef = useRef<boolean>(menuCollapsed);
  const showLaneLinesRef = useRef<boolean>(showLaneLines);
  const layoutModeRef = useRef<LayoutMode>(layoutMode);
  const applyOffsetRef = useRef<(() => void) | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const transitionRef = useRef<CameraTransition>({
    active: false,
    startTime: 0,
    duration: 0.9,
    fromPos: new THREE.Vector3(),
    toPos: new THREE.Vector3(),
    fromTarget: new THREE.Vector3(),
    toTarget: new THREE.Vector3(),
    endAutoRotate: true,
  });

  const [loadProgress, setLoadProgress] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [orbitedTrigger, setOrbitedTrigger] = useState<number>(-1);
  const presetTriggerRef = useRef<number>(presetTrigger);

  const isUserOrbited = orbitedTrigger === presetTrigger;

  const triggerGlideToPreset = (presetKey: CameraPreset) => {
    const cam = cameraRef.current;
    const ctrls = controlsRef.current;
    if (!cam || !ctrls) return;
    const cfg = CAMERA_PRESETS[presetKey];
    ctrls.autoRotate = false;
    transitionRef.current = {
      active: true,
      startTime: performance.now(),
      duration: 0.9,
      fromPos: cam.position.clone(),
      toPos: new THREE.Vector3(...cfg.position),
      fromTarget: ctrls.target.clone(),
      toTarget: new THREE.Vector3(...cfg.target),
      endAutoRotate: cfg.autoRotate,
    };
    setOrbitedTrigger(-1);
  };

  useEffect(() => {
    stateRef.current = hotspotState;
  }, [hotspotState]);

  useEffect(() => {
    showLaneLinesRef.current = showLaneLines;
  }, [showLaneLines]);

  useEffect(() => {
    menuCollapsedRef.current = menuCollapsed;
    layoutModeRef.current = layoutMode;
    applyOffsetRef.current?.();
  }, [menuCollapsed, layoutMode]);

  useEffect(() => {
    presetRef.current = cameraPreset;
    presetTriggerRef.current = presetTrigger;
    if (presetTrigger === 0) return;
    const cam = cameraRef.current;
    const ctrls = controlsRef.current;
    if (!cam || !ctrls) return;
    const cfg = CAMERA_PRESETS[cameraPreset];
    ctrls.autoRotate = false;
    transitionRef.current = {
      active: true,
      startTime: performance.now(),
      duration: 0.9,
      fromPos: cam.position.clone(),
      toPos: new THREE.Vector3(...cfg.position),
      fromTarget: ctrls.target.clone(),
      toTarget: new THREE.Vector3(...cfg.target),
      endAutoRotate: cfg.autoRotate,
    };
  }, [cameraPreset, presetTrigger]);

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
    // Initialize camera from initial preset (upward Navigation chase view in split-screen)
    const initialCfg = CAMERA_PRESETS[presetRef.current];
    camera.position.set(...initialCfg.position);
    cameraRef.current = camera;

    const applyCameraOffset = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      const mode = layoutModeRef.current;
      if (menuCollapsedRef.current) {
        camera.clearViewOffset();
      } else if (mode === 'vertical-mobile') {
        // Shift 3D car into the top 38% stage above the bottom 62% panel
        camera.setViewOffset(w, h, 0, h * 0.27, w, h);
      } else if (mode === 'horizontal-mobile') {
        camera.setViewOffset(w, h, w * 0.31, -h * 0.02, w, h);
      } else {
        camera.setViewOffset(w, h, w * 0.3, -h * 0.04, w, h);
      }
      camera.updateProjectionMatrix();
    };
    applyOffsetRef.current = applyCameraOffset;
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
    controls.minDistance = 2.2;
    controls.maxDistance = 12.0;
    controls.maxPolarAngle = Math.PI / 2 - 0.025;
    controls.minPolarAngle = 0.12;
    controls.target.set(...initialCfg.target);
    controls.autoRotate = initialCfg.autoRotate;
    controls.autoRotateSpeed = 0.5;
    controlsRef.current = controls;

    const handleUserControlStart = () => {
      transitionRef.current.active = false;
      controls.autoRotate = false;
      setOrbitedTrigger(presetTriggerRef.current);
    };
    controls.addEventListener('start', handleUserControlStart);

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

    // Navigation floor compass / radar ring (fades in during Navigation preset)
    const navCompassTex = createNavCompassTexture();
    const navCompassMat = new THREE.MeshBasicMaterial({
      map: navCompassTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const navCompassPlane = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 6.8), navCompassMat);
    navCompassPlane.rotation.x = -Math.PI / 2;
    navCompassPlane.position.y = 0.006;
    scene.add(navCompassPlane);

    // Tesla-style glowing blue ADAS lane lines (fade in during Drive / Navigation mode)
    const laneLinesTex = createLaneLinesTexture();
    const laneLinesMat = new THREE.MeshBasicMaterial({
      map: laneLinesTex,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const laneLinesPlane = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 16), laneLinesMat);
    laneLinesPlane.rotation.x = -Math.PI / 2;
    laneLinesPlane.position.set(0, 0.007, 1.5);
    scene.add(laneLinesPlane);

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

    // Authentic UK Number Plates: White Front & Yellow Rear (WG62 HJC)
    const frontPlateTex = createUKPlateTexture('WG62 HJC', 'front');
    const rearPlateTex = createUKPlateTexture('WG62 HJC', 'rear');
    const frontPlateDataUrl = (frontPlateTex.image as HTMLCanvasElement).toDataURL('image/png');

    // Resolve textures from embedded base64 map (in self-contained preview) or ./models/qashqai/ (in Vite)
    const embeddedB64 = window.__EMBEDDED_FBX_B64__;
    const embeddedTextures = window.__EMBEDDED_TEXTURES__;
    const blankPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

    const resolveTextureUrl = (rawUrl: string): string => {
      if (rawUrl.startsWith('data:') || rawUrl.startsWith('blob:')) return rawUrl;
      const base = rawUrl.split(/[\\/]/).pop() || '';
      const key = base.toLowerCase();
      if (key === 'mingpai.jpg' || key === 'mingpai.jpeg' || key === 'mingpai.png') {
        return frontPlateDataUrl;
      }
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

    const frontPlateMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: frontPlateTex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: frontPlateTex,
      emissiveIntensity: 0.28,
      roughness: 0.22,
      metalness: 0.05,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
      envMapIntensity: 0.9,
    });
    const rearPlateMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: rearPlateTex,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: rearPlateTex,
      emissiveIntensity: 0.28,
      roughness: 0.22,
      metalness: 0.05,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
      envMapIntensity: 0.9,
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
      fbx.updateMatrixWorld(true);

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
        const isPlateMesh =
          meshName.includes('paizi') ||
          meshName.includes('1326') ||
          meshName.includes('material_928') ||
          meshName.includes('mingpai') ||
          meshName.includes('plate');

        const meshBox = new THREE.Box3().setFromObject(child);
        const meshCenter = new THREE.Vector3();
        meshBox.getCenter(meshCenter);

        const upgradeMaterial = (origMat: THREE.Material): THREE.Material => {
          const matName = (origMat.name || '').toLowerCase();
          const src = origMat as THREE.MeshPhongMaterial;
          const srcMap = src.map || null;
          if (srcMap) {
            srcMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          }
          const mapName = (srcMap?.name || '').toLowerCase();
          const mapSrc = ((srcMap?.image as HTMLImageElement | undefined)?.src || '');

          // 0. UK Number Plates (WG62 HJC): White front (z >= 0), Yellow rear (z < 0)
          if (
            isPlateMesh ||
            matName.includes('material__2255') ||
            matName.includes('mingpai') ||
            matName.includes('plate') ||
            mapName.includes('mingpai') ||
            mapSrc === frontPlateDataUrl
          ) {
            return meshCenter.z >= 0 ? frontPlateMat : rearPlateMat;
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

      // Smooth cubic ease-out camera glide between presets
      const tr = transitionRef.current;
      if (tr.active) {
        const elapsed = (performance.now() - tr.startTime) / 1000;
        const p = Math.min(1, elapsed / tr.duration);
        const ease = 1 - Math.pow(1 - p, 3);
        camera.position.lerpVectors(tr.fromPos, tr.toPos, ease);
        controls.target.lerpVectors(tr.fromTarget, tr.toTarget, ease);
        if (p >= 1) {
          tr.active = false;
          controls.autoRotate = tr.endAutoRotate;
        }
      }

      // Smooth fade & subtle rotation for Navigation floor compass ring
      const targetCompassOpacity = presetRef.current === 'navigation' && !showLaneLinesRef.current ? 0.78 : 0;
      navCompassMat.opacity += (targetCompassOpacity - navCompassMat.opacity) * 0.08;
      if (navCompassMat.opacity > 0.01) {
        navCompassPlane.rotation.z = Math.sin(t * 0.25) * 0.04;
      }

      // Smooth fade for glowing blue ADAS lane lines
      const targetLaneOpacity = showLaneLinesRef.current ? 0.92 : 0;
      laneLinesMat.opacity += (targetLaneOpacity - laneLinesMat.opacity) * 0.08;

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      controls.removeEventListener('start', handleUserControlStart);
      controls.dispose();
      floorTex.dispose();
      navCompassTex.dispose();
      laneLinesTex.dispose();
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

      {isLoaded && isUserOrbited && (
        <button
          onClick={() => triggerGlideToPreset(cameraPreset)}
          className="absolute bottom-20 left-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/65 px-3.5 py-2 text-xs font-medium text-zinc-100 backdrop-blur-xl shadow-xl hover:border-white/35 hover:bg-black/80 active:scale-95 transition cursor-pointer"
          aria-label="Reset camera view"
        >
          <RotateCcw className="h-3.5 w-3.5 text-zinc-300" />
          <span>Reset View</span>
        </button>
      )}

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
