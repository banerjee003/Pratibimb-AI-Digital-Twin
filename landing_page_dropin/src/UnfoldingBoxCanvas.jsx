import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * UnfoldingBoxCanvas
 * 
 * 3D High-Tech Quantum Vault / Digital Twin Capsule.
 * Unfolds step-by-step as the user scrolls through the 7 narrative sections:
 *  - Step 0 (The Reflection): Sealed cyber-vault, softly glowing seamlines, slow hover rotation.
 *  - Step 1 (Digital Twin): Unlocks & levitates; top lid unseals and cracks open 25°.
 *  - Step 2 (Synthesis Engine): Top lid swings back 75°; inner neural lattice illuminates, light rays leak.
 *  - Step 3 (Neural Voice AI): Front panel unlatches and drops 45°; inner voice core pulses with harmonics.
 *  - Step 4 (Interaction Loop): Left & Right panels fold 60°; dual gyro rings spin around core.
 *  - Step 5 (System Utility): All 4 side panels fold completely flat (90°); core levitates above platform.
 *  - Step 6 (Live Workspace): Full deployment! Shockwave rings, ascending particle vortex, full activation.
 */
export default function UnfoldingBoxCanvas({
  scrollProgress = 0,
  activeStep = 0,
  activeColor = '#0077b6'
}) {
  const mountRef = useRef(null);

  // Store target progress and color in refs for smooth animation loop
  const stateRef = useRef({
    step: activeStep,
    progress: scrollProgress,
    colorHex: activeColor,
    mouseX: 0,
    mouseY: 0,
    targetMouseX: 0,
    targetMouseY: 0,
  });

  useEffect(() => {
    stateRef.current.step = activeStep;
    stateRef.current.progress = scrollProgress;
    stateRef.current.colorHex = activeColor;
  }, [activeStep, scrollProgress, activeColor]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const width = container.clientWidth || 450;
    const height = container.clientHeight || 520;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060608, 0.08);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 1.8, 6.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // 2. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight1.position.set(5, 8, 6);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x384b66, 0.8);
    dirLight2.position.set(-6, -4, -4);
    scene.add(dirLight2);

    // Dynamic interior core point light
    const coreLight = new THREE.PointLight(new THREE.Color(activeColor), 3.5, 9);
    coreLight.position.set(0, 0, 0);
    scene.add(coreLight);

    // 3. Vault Geometry Constants
    const S = 2.1; // Box dimension
    const H = S / 2; // Half size = 1.05
    const T = 0.05; // Panel thickness

    const mainVaultGroup = new THREE.Group();
    scene.add(mainVaultGroup);

    // Materials
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: 0x0c0f16,
      roughness: 0.28,
      metalness: 0.9,
    });

    const innerPanelMaterial = new THREE.MeshStandardMaterial({
      color: 0x141a24,
      roughness: 0.35,
      metalness: 0.8,
    });

    const edgeColor = new THREE.Color(activeColor);
    const edgeMaterial = new THREE.LineBasicMaterial({
      color: edgeColor,
      linewidth: 1.5,
      transparent: true,
      opacity: 0.9,
    });

    const dimEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0x334455,
      transparent: true,
      opacity: 0.4,
    });

    // Helper: create panel with technical glowing wireframe edges & inner circuit layer
    const createSegmentedPanel = (w, h, d, offsetX, offsetY, offsetZ) => {
      const panelGroup = new THREE.Group();

      const geom = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geom, [
        panelMaterial, panelMaterial,
        panelMaterial, panelMaterial,
        innerPanelMaterial, panelMaterial
      ]);
      mesh.position.set(offsetX, offsetY, offsetZ);
      panelGroup.add(mesh);

      // Glowing edges
      const edges = new THREE.EdgesGeometry(geom);
      const line = new THREE.LineSegments(edges, edgeMaterial);
      line.position.copy(mesh.position);
      panelGroup.add(line);

      // Subtle tech crosshair in center of panel
      const insetGeom = new THREE.PlaneGeometry(w * 0.55, h * 0.55);
      const insetEdges = new THREE.EdgesGeometry(insetGeom);
      const insetLine = new THREE.LineSegments(insetEdges, dimEdgeMaterial);
      insetLine.position.set(offsetX, offsetY, offsetZ + (d > T ? 0 : d * 0.55));
      panelGroup.add(insetLine);

      return { group: panelGroup, line, mesh };
    };

    // ── BASE (BOTTOM) PANEL ───────────────────────────────────────────
    const baseGeom = new THREE.BoxGeometry(S, T, S);
    const baseMesh = new THREE.Mesh(baseGeom, panelMaterial);
    baseMesh.position.set(0, -H, 0);
    mainVaultGroup.add(baseMesh);

    const baseEdges = new THREE.LineSegments(new THREE.EdgesGeometry(baseGeom), edgeMaterial);
    baseEdges.position.copy(baseMesh.position);
    mainVaultGroup.add(baseEdges);

    // Glowing base projection ring on the floor of the box
    const baseRingGeom = new THREE.RingGeometry(0.3, 0.8, 32);
    const baseRingMat = new THREE.MeshBasicMaterial({
      color: edgeColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
    });
    const baseRing = new THREE.Mesh(baseRingGeom, baseRingMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.set(0, -H + T * 0.6, 0);
    mainVaultGroup.add(baseRing);

    // ── HINGED PANELS (PIVOTS) ────────────────────────────────────────
    // 1. TOP LID: Hinged at top-back edge (0, H, -H)
    const topPivot = new THREE.Group();
    topPivot.position.set(0, H, -H);
    const topPanel = createSegmentedPanel(S, T, S, 0, 0, H);
    topPivot.add(topPanel.group);
    mainVaultGroup.add(topPivot);

    // 2. FRONT PANEL: Hinged at bottom-front edge (0, -H, H)
    const frontPivot = new THREE.Group();
    frontPivot.position.set(0, -H, H);
    const frontPanel = createSegmentedPanel(S, S, T, 0, H, 0);
    frontPivot.add(frontPanel.group);
    mainVaultGroup.add(frontPivot);

    // 3. BACK PANEL: Hinged at bottom-back edge (0, -H, -H)
    const backPivot = new THREE.Group();
    backPivot.position.set(0, -H, -H);
    const backPanel = createSegmentedPanel(S, S, T, 0, H, 0);
    backPivot.add(backPanel.group);
    mainVaultGroup.add(backPivot);

    // 4. LEFT PANEL: Hinged at bottom-left edge (-H, -H, 0)
    const leftPivot = new THREE.Group();
    leftPivot.position.set(-H, -H, 0);
    const leftPanel = createSegmentedPanel(T, S, S, 0, H, 0);
    leftPivot.add(leftPanel.group);
    mainVaultGroup.add(leftPivot);

    // 5. RIGHT PANEL: Hinged at bottom-right edge (H, -H, 0)
    const rightPivot = new THREE.Group();
    rightPivot.position.set(H, -H, 0);
    const rightPanel = createSegmentedPanel(T, S, S, 0, H, 0);
    rightPivot.add(rightPanel.group);
    mainVaultGroup.add(rightPivot);

    // ── INNER QUANTUM NEURAL CORE ─────────────────────────────────────
    const coreGroup = new THREE.Group();
    coreGroup.position.set(0, 0, 0);
    mainVaultGroup.add(coreGroup);

    // Outer crystalline icosahedron lattice
    const coreGeom = new THREE.IcosahedronGeometry(0.48, 1);
    const coreWireGeom = new THREE.WireframeGeometry(coreGeom);
    const coreWireMat = new THREE.LineBasicMaterial({
      color: edgeColor,
      transparent: true,
      opacity: 0.9,
    });
    const coreWire = new THREE.LineSegments(coreWireGeom, coreWireMat);
    coreGroup.add(coreWire);

    // Inner glowing sphere
    const coreSphereGeom = new THREE.SphereGeometry(0.24, 24, 24);
    const coreSphereMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    const coreSphere = new THREE.Mesh(coreSphereGeom, coreSphereMat);
    coreGroup.add(coreSphere);

    // Concentric Gyro Rings
    const ringMat = new THREE.MeshBasicMaterial({
      color: edgeColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
      wireframe: true,
    });

    const gyroRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.015, 8, 48), ringMat);
    coreGroup.add(gyroRing1);

    const gyroRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.012, 8, 48), ringMat);
    gyroRing2.rotation.x = Math.PI / 3;
    coreGroup.add(gyroRing2);

    const gyroRing3 = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.01, 8, 48), ringMat);
    gyroRing3.rotation.y = Math.PI / 4;
    coreGroup.add(gyroRing3);

    // ── ASCENDING DATA/ENERGY PARTICLES ───────────────────────────────
    const particleCount = 140;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = [];

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3 + 0] = (Math.random() - 0.5) * 1.2;
      particlePositions[i * 3 + 1] = -H + Math.random() * 2.8;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
      particleVelocities.push({
        y: 0.008 + Math.random() * 0.014,
        driftX: (Math.random() - 0.5) * 0.003,
        driftZ: (Math.random() - 0.5) * 0.003,
      });
    }

    const particleGeom = new THREE.BufferGeometry();
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: edgeColor,
      size: 0.045,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeom, particleMat);
    mainVaultGroup.add(particles);

    // Initial orientation: slightly tilted to show 3D depth
    mainVaultGroup.rotation.x = 0.28;
    mainVaultGroup.rotation.y = -0.55;

    // ── MOUSE PARALLAX TRACKER ────────────────────────────────────────
    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      stateRef.current.targetMouseX = nx * 0.35;
      stateRef.current.targetMouseY = ny * 0.25;
    };
    window.addEventListener('mousemove', onMouseMove, { passive: true });

    // ── RESIZE HANDLER ────────────────────────────────────────────────
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || 450;
      const h = container.clientHeight || 520;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ── ANIMATION STATE SMOOTHERS ──────────────────────────────────────
    let currentOpenness = 0; // 0 (closed) to 1 (fully open)
    let currentCoreElevation = 0;
    let clock = new THREE.Clock();

    // Mapping function from 7 discrete steps + continuous scroll to target angles
    const getTargetStageValues = (step, progress) => {
      // Step definitions (0 to 6)
      // 0: Sealed
      // 1: Unlocked, lid cracked 25°
      // 2: Lid open 80°, inner core glowing
      // 3: Lid 125°, front dropped 45°
      // 4: Lid 135°, front 70°, sides 50°
      // 5: All 4 sides down 90° (flat), lid back 145°, core lifts
      // 6: Full burst, all flat, core high, rings expanding

      const stage = Math.min(6, Math.max(0, step));
      // Interpolate with local progress inside stage if applicable
      const fraction = (progress * 7) % 1;

      let topAngle = 0;
      let frontAngle = 0;
      let backAngle = 0;
      let leftAngle = 0;
      let rightAngle = 0;
      let coreY = 0;
      let coreScale = 0.8;
      let coreIntensity = 1.0;

      if (stage === 0) {
        topAngle = 0;
        frontAngle = 0;
        backAngle = 0;
        leftAngle = 0;
        rightAngle = 0;
        coreY = -0.15;
        coreScale = 0.7;
        coreIntensity = 0.8;
      } else if (stage === 1) {
        topAngle = 0.45; // ~25°
        frontAngle = 0.05;
        backAngle = 0;
        leftAngle = 0.02;
        rightAngle = 0.02;
        coreY = 0.0;
        coreScale = 0.85;
        coreIntensity = 1.6;
      } else if (stage === 2) {
        topAngle = 1.35; // ~77°
        frontAngle = 0.15;
        backAngle = 0.05;
        leftAngle = 0.1;
        rightAngle = 0.1;
        coreY = 0.15;
        coreScale = 0.95;
        coreIntensity = 2.4;
      } else if (stage === 3) {
        topAngle = 2.1; // ~120°
        frontAngle = 0.78; // ~45°
        backAngle = 0.2;
        leftAngle = 0.25;
        rightAngle = 0.25;
        coreY = 0.35;
        coreScale = 1.05;
        coreIntensity = 3.2;
      } else if (stage === 4) {
        topAngle = 2.35; // ~135°
        frontAngle = 1.25; // ~72°
        backAngle = 0.55;
        leftAngle = 0.95; // ~55°
        rightAngle = 0.95;
        coreY = 0.65;
        coreScale = 1.15;
        coreIntensity = 4.0;
      } else if (stage === 5) {
        topAngle = 2.5; // ~143°
        frontAngle = Math.PI / 2; // 90° flat
        backAngle = Math.PI / 2;
        leftAngle = Math.PI / 2;
        rightAngle = Math.PI / 2;
        coreY = 1.05;
        coreScale = 1.25;
        coreIntensity = 4.8;
      } else {
        // Stage 6 (Final activation)
        topAngle = 2.65;
        frontAngle = Math.PI / 2 + 0.15; // slightly overfolded for dynamic look
        backAngle = Math.PI / 2 + 0.15;
        leftAngle = Math.PI / 2 + 0.15;
        rightAngle = Math.PI / 2 + 0.15;
        coreY = 1.35;
        coreScale = 1.38;
        coreIntensity = 5.8;
      }

      return {
        topAngle,
        frontAngle,
        backAngle,
        leftAngle,
        rightAngle,
        coreY,
        coreScale,
        coreIntensity,
        openness: stage / 6,
      };
    };

    // ── MAIN RENDER LOOP ──────────────────────────────────────────────
    let animId;
    let curTop = 0;
    let curFront = 0;
    let curBack = 0;
    let curLeft = 0;
    let curRight = 0;
    let curCoreY = 0;
    let curScale = 0.8;
    let curIntensity = 1.0;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();
      const { step, progress, colorHex } = stateRef.current;

      // Update Dynamic Color
      const c = new THREE.Color(colorHex);
      edgeMaterial.color.lerp(c, 0.1);
      baseRingMat.color.lerp(c, 0.1);
      coreLight.color.lerp(c, 0.1);
      coreWireMat.color.lerp(c, 0.1);
      ringMat.color.lerp(c, 0.1);
      particleMat.color.lerp(c, 0.1);

      // Smooth Mouse Parallax
      stateRef.current.mouseX += (stateRef.current.targetMouseX - stateRef.current.mouseX) * 0.05;
      stateRef.current.mouseY += (stateRef.current.targetMouseY - stateRef.current.mouseY) * 0.05;

      // Calculate Target Opening Angles
      const targets = getTargetStageValues(step, progress);

      // Smoothly LERP angles towards target for organic physics feel
      const lerpSpeed = 0.075;
      curTop += (targets.topAngle - curTop) * lerpSpeed;
      curFront += (targets.frontAngle - curFront) * lerpSpeed;
      curBack += (targets.backAngle - curBack) * lerpSpeed;
      curLeft += (targets.leftAngle - curLeft) * lerpSpeed;
      curRight += (targets.rightAngle - curRight) * lerpSpeed;
      curCoreY += (targets.coreY - curCoreY) * lerpSpeed;
      curScale += (targets.coreScale - curScale) * lerpSpeed;
      curIntensity += (targets.coreIntensity - curIntensity) * lerpSpeed;
      currentOpenness += (targets.openness - currentOpenness) * lerpSpeed;

      // Apply Hinge Rotations
      // Top lid rotates backwards around X (negative)
      topPivot.rotation.x = -curTop;

      // Front panel rotates forward/down around X (positive)
      frontPivot.rotation.x = curFront;

      // Back panel rotates backward/down around X (negative)
      backPivot.rotation.x = -curBack;

      // Left panel rotates outward/down around Z (positive)
      leftPivot.rotation.z = curLeft;

      // Right panel rotates outward/down around Z (negative)
      rightPivot.rotation.z = -curRight;

      // Inner Core animation
      coreGroup.position.y = curCoreY + Math.sin(elapsedTime * 2) * 0.04;
      coreGroup.scale.setScalar(curScale);
      coreLight.position.copy(coreGroup.position);
      coreLight.intensity = curIntensity + Math.sin(elapsedTime * 6) * 0.4;

      // Core rotations: multi-axis celestial spin
      coreWire.rotation.x = elapsedTime * 0.6;
      coreWire.rotation.y = elapsedTime * 0.9;
      coreSphere.scale.setScalar(1 + Math.sin(elapsedTime * 4) * 0.06);

      gyroRing1.rotation.x = elapsedTime * 1.2;
      gyroRing1.rotation.y = elapsedTime * 0.5;
      gyroRing2.rotation.y = -elapsedTime * 1.4;
      gyroRing2.rotation.z = elapsedTime * 0.8;
      gyroRing3.rotation.z = elapsedTime * 1.6;

      // Whole Vault Hover & Mouse Look-At
      const baseRotationY = -0.55 + Math.sin(elapsedTime * 0.35) * 0.08;
      mainVaultGroup.rotation.y = baseRotationY + stateRef.current.mouseX;
      mainVaultGroup.rotation.x = 0.28 + stateRef.current.mouseY + Math.sin(elapsedTime * 0.5) * 0.03;
      mainVaultGroup.position.y = Math.sin(elapsedTime * 1.2) * 0.06;

      // Base ring pulse
      baseRingMat.opacity = 0.2 + currentOpenness * 0.5 + Math.sin(elapsedTime * 3) * 0.1;
      baseRing.scale.setScalar(1 + currentOpenness * 0.3);

      // Particle physics: rising energy fountain
      const pos = particleGeom.attributes.position.array;
      for (let i = 0; i < particleCount; i++) {
        const vel = particleVelocities[i];
        pos[i * 3 + 1] += vel.y * (1 + currentOpenness * 1.8);
        pos[i * 3 + 0] += vel.driftX;
        pos[i * 3 + 2] += vel.driftZ;

        // Reset if reached ceiling
        if (pos[i * 3 + 1] > H + 1.8 + currentOpenness * 1.2) {
          pos[i * 3 + 1] = -H + 0.1;
          pos[i * 3 + 0] = (Math.random() - 0.5) * 0.8;
          pos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
        }
      }
      particleGeom.attributes.position.needsUpdate = true;
      particleMat.opacity = 0.2 + currentOpenness * 0.75;

      renderer.render(scene, camera);
    };

    animate();

    // ── CLEANUP ON UNMOUNT ────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);

      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.clear();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
      }}
    >
      {/* Subtle diagnostic stage badge at the bottom of the 3D viewport */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '0.68rem',
          letterSpacing: '0.14em',
          color: 'rgba(255, 255, 255, 0.45)',
          background: 'rgba(10, 10, 14, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '4px 12px',
          borderRadius: 999,
          backdropFilter: 'blur(8px)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: activeColor,
            boxShadow: 'none',
            display: 'inline-block',
          }}
        />
        <span>
          {activeStep === 0 && 'VAULT_STATE: [SEALED]'}
          {activeStep === 1 && 'VAULT_STATE: [UNLATCHING]'}
          {activeStep === 2 && 'VAULT_STATE: [LID_DEPLOYED]'}
          {activeStep === 3 && 'VAULT_STATE: [CORE_UNVEILED]'}
          {activeStep === 4 && 'VAULT_STATE: [EXPANDING_NET]'}
          {activeStep === 5 && 'VAULT_STATE: [PLATFORM_OPEN]'}
          {activeStep === 6 && 'VAULT_STATE: [FULL_SYNTHESIS]'}
        </span>
      </div>
    </div>
  );
}
