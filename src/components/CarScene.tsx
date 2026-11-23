import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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

  useEffect(() => {
    stateRef.current = hotspotState;
  }, [hotspotState]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      40,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(5.2, 2.3, 5.4);

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
    renderer.toneMappingExposure = 1.25;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 3.6;
    controls.maxDistance = 9;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minPolarAngle = 0.25;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.85;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xdbeafe, 0.7);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.8);
    rimLight.position.set(-6, 4, -5);
    scene.add(rimLight);

    const underGlow = new THREE.PointLight(0x0ea5e9, 1.5, 6);
    underGlow.position.set(0, 0.2, 0);
    scene.add(underGlow);

    // Turntable ring
    const ringGeo = new THREE.RingGeometry(2.55, 2.62, 72);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = 0.01;
    scene.add(ringMesh);

    const innerDiscGeo = new THREE.CircleGeometry(2.55, 72);
    const innerDiscMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.25,
      metalness: 0.8,
      transparent: true,
      opacity: 0.55,
    });
    const innerDisc = new THREE.Mesh(innerDiscGeo, innerDiscMat);
    innerDisc.rotation.x = -Math.PI / 2;
    innerDisc.receiveShadow = true;
    scene.add(innerDisc);

    // Car Group
    const carGroup = new THREE.Group();
    scene.add(carGroup);

    const bodyPaint = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.88,
      roughness: 0.18,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.05,
      transparent: true,
      opacity: 0.78,
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      metalness: 0.5,
      roughness: 0.5,
    });

    // Lower Chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.52, 4.4), bodyPaint);
    chassis.position.set(0, 0.56, 0);
    chassis.castShadow = true;
    carGroup.add(chassis);

    // Front Hood slope
    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.22, 1.35), bodyPaint);
    hood.position.set(0, 0.78, 1.42);
    hood.rotation.x = 0.08;
    hood.castShadow = true;
    carGroup.add(hood);

    // Cabin / Greenhouse
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.54, 2.05), glassMat);
    cabin.position.set(0, 1.06, -0.15);
    cabin.castShadow = true;
    carGroup.add(cabin);

    // Roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 1.65), bodyPaint);
    roof.position.set(0, 1.34, -0.2);
    carGroup.add(roof);

    // Left & Right Doors (pivotable)
    const leftDoorPivot = new THREE.Group();
    leftDoorPivot.position.set(0.98, 0.58, 0.65);
    const leftDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.25), bodyPaint);
    leftDoorMesh.position.set(0, 0, -0.62);
    leftDoorPivot.add(leftDoorMesh);
    carGroup.add(leftDoorPivot);

    const rightDoorPivot = new THREE.Group();
    rightDoorPivot.position.set(-0.98, 0.58, 0.65);
    const rightDoorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 1.25), bodyPaint);
    rightDoorMesh.position.set(0, 0, -0.62);
    rightDoorPivot.add(rightDoorMesh);
    carGroup.add(rightDoorPivot);

    // Trunk Lid (pivotable)
    const trunkPivot = new THREE.Group();
    trunkPivot.position.set(0, 0.85, -1.25);
    const trunkMesh = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.14, 0.92), bodyPaint);
    trunkMesh.position.set(0, 0, -0.46);
    trunkPivot.add(trunkMesh);
    carGroup.add(trunkPivot);

    // Headlights
    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.0,
    });
    const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.08), headlightMat);
    hlLeft.position.set(0.65, 0.65, 2.2);
    const hlRight = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.08), headlightMat);
    hlRight.position.set(-0.65, 0.65, 2.2);
    carGroup.add(hlLeft, hlRight);

    // Headlight SpotLights
    const spotLeft = new THREE.SpotLight(0xe0f2fe, 4, 12, Math.PI / 5, 0.5);
    spotLeft.position.set(0.65, 0.65, 2.25);
    spotLeft.target.position.set(0.65, 0.1, 6.5);
    carGroup.add(spotLeft, spotLeft.target);

    const spotRight = new THREE.SpotLight(0xe0f2fe, 4, 12, Math.PI / 5, 0.5);
    spotRight.position.set(-0.65, 0.65, 2.25);
    spotRight.target.position.set(-0.65, 0.1, 6.5);
    carGroup.add(spotRight, spotRight.target);

    // Taillight bar
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 1.8,
    });
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.08, 0.06), tailMat);
    tailBar.position.set(0, 0.68, -2.21);
    carGroup.add(tailBar);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.26, 28);
    const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.28, 16);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.2,
    });

    const wheelPositions: [number, number, number][] = [
      [0.96, 0.38, 1.38],
      [-0.96, 0.38, 1.38],
      [0.96, 0.38, -1.38],
      [-0.96, 0.38, -1.38],
    ];

    wheelPositions.forEach(([x, y, z]) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(x, y, z);
      const tire = new THREE.Mesh(wheelGeo, trimMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(tire, rim);
      carGroup.add(wheelGroup);
    });

    // Interactive 3D Hotspots (clickable spheres)
    const hotspotMeshes: { mesh: THREE.Mesh; key: keyof CarHotspotState }[] = [];
    const createHotspot = (x: number, y: number, z: number, key: keyof CarHotspotState) => {
      const geo = new THREE.SphereGeometry(0.11, 16, 16);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      carGroup.add(mesh);
      hotspotMeshes.push({ mesh, key });
    };

    createHotspot(0, 0.72, 2.35, 'headlights');
    createHotspot(1.12, 0.72, 0.1, 'doorsOpen');
    createHotspot(0, 0.95, -2.28, 'trunkOpen');

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

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const s = stateRef.current;

      // Smoothly animate doors & trunk
      const targetDoor = s.doorsOpen ? 0.65 : 0;
      leftDoorPivot.rotation.y += (targetDoor - leftDoorPivot.rotation.y) * 0.1;
      rightDoorPivot.rotation.y += (-targetDoor - rightDoorPivot.rotation.y) * 0.1;

      const targetTrunk = s.trunkOpen ? 0.75 : 0;
      trunkPivot.rotation.x += (targetTrunk - trunkPivot.rotation.x) * 0.1;

      // Headlights
      const hlIntensity = s.headlights ? 2.5 : 0.15;
      headlightMat.emissiveIntensity = hlIntensity;
      spotLeft.intensity = s.headlights ? 6 : 0;
      spotRight.intensity = s.headlights ? 6 : 0;

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
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      controls.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [onToggleHotspot]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute bottom-6 left-6 flex items-center gap-3 rounded-full bg-slate-950/50 px-4 py-2 text-xs text-slate-300 backdrop-blur-md border border-white/10">
        <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
        <span>Drag to orbit • Click glowing hotspots to toggle lights, doors & trunk</span>
      </div>
    </div>
  );
};
