import * as THREE from "three";
import { SparkRenderer, SplatMesh, dyno, textSplats } from "@sparkjsdev/spark";

// ─── CONFIG ───
const CFG = {
  // Rain
  rainCount: 200000,
  rainArea: { x: 12, y: 10, z: 12 },
  rainSpeed: 4.0,
  rainColor: [0.4, 0.55, 0.9],
  // Text wall (glass surface)
  textWallZ: -2,
  // Water drops on glass
  dropCount: 80000,
  dropAreaX: 8,
  dropAreaY: 6,
  dropSpeed: 0.3,
  // Ripple
  rippleSpeed: 4.0,
  rippleDecay: 0.7,
  // Fog particles
  fogCount: 50000,
  fogArea: 15,
  // City lights (background bokeh)
  bokehCount: 30000,
  bokehDepth: [-8, -20],
  bokehArea: { x: 20, y: 12 },
  bokehColors: [
    [1.0, 0.6, 0.2],   // warm orange
    [0.3, 0.5, 1.0],   // blue
    [1.0, 0.3, 0.5],   // pink
    [0.2, 0.9, 0.6],   // green
    [1.0, 0.9, 0.3],   // yellow
  ],
};

// ─── SCENE SETUP ───
const canvas = document.createElement("canvas");
document.body.prepend(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x040810, 1);

const scene = new THREE.Scene();
const spark = new SparkRenderer({ renderer });
scene.add(spark);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 0, 5);
camera.lookAt(0, 0, 0);

// ─── ORBIT (simple manual) ───
let isDragging = false, prevMouse = { x: 0, y: 0 };
let rotX = 0, rotY = 0, zoom = 5;

canvas.addEventListener("pointerdown", e => { isDragging = true; prevMouse = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener("pointerup", () => isDragging = false);
canvas.addEventListener("pointermove", e => {
  if (!isDragging) return;
  rotY += (e.clientX - prevMouse.x) * 0.003;
  rotX += (e.clientY - prevMouse.y) * 0.003;
  rotX = Math.max(-0.5, Math.min(0.5, rotX));
  prevMouse = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener("wheel", e => {
  zoom = Math.max(2, Math.min(10, zoom + e.deltaY * 0.005));
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── UNIFORMS ───
const uTime = dyno.dynoFloat(0);
const uRippleOrigin = dyno.dynoVec3(new THREE.Vector3(999, 999, 999));
const uRippleTime = dyno.dynoFloat(99);

// ─── RIPPLE CLICK ───
const raycaster = new THREE.Raycaster();
canvas.addEventListener("pointerdown", e => {
  const ndc = new THREE.Vector2(
    (e.clientX / window.innerWidth) * 2 - 1,
    -(e.clientY / window.innerHeight) * 2 + 1
  );
  // Map click to world position on glass plane
  const worldPos = new THREE.Vector3(
    ndc.x * CFG.dropAreaX * 0.5,
    ndc.y * CFG.dropAreaY * 0.5,
    CFG.textWallZ
  );
  uRippleOrigin.value.copy(worldPos);
  uRippleTime.value = 0;
});

// ─── 1. RAIN PARTICLES ───
const rain = new SplatMesh({
  constructSplats: (splats) => {
    const center = new THREE.Vector3();
    const scales = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const color = new THREE.Color();
    for (let i = 0; i < CFG.rainCount; i++) {
      center.set(
        (Math.random() - 0.5) * CFG.rainArea.x,
        (Math.random() - 0.5) * CFG.rainArea.y,
        (Math.random() - 0.5) * CFG.rainArea.z
      );
      // Elongated vertically for rain streak look
      scales.set(0.001, 0.008 + Math.random() * 0.012, 0.001);
      const bright = 0.3 + Math.random() * 0.4;
      color.setRGB(
        CFG.rainColor[0] * bright,
        CFG.rainColor[1] * bright,
        CFG.rainColor[2] * bright
      );
      splats.pushSplat(center, scales, quat, 0.15 + Math.random() * 0.2, color);
    }
  }
});

// Rain shader: falling + slight wind
rain.objectModifier = dyno.dynoBlock(
  { gsplat: dyno.Gsplat }, { gsplat: dyno.Gsplat },
  ({ gsplat }) => {
    const shader = new dyno.Dyno({
      inTypes: { gsplat: dyno.Gsplat, t: "float" },
      outTypes: { gsplat: dyno.Gsplat },
      globals: () => [dyno.unindent(`
        vec3 rainHash(vec3 p) { return fract(sin(p * 78.233) * 43758.5453); }
      `)],
      statements: ({ inputs, outputs }) => dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat};
        vec3 pos = ${inputs.gsplat}.center;
        vec3 h = rainHash(pos * 100.0);
        float speed = ${String(CFG.rainSpeed)} + h.x * 2.0;
        pos.y -= mod(${inputs.t} * speed + h.y * 10.0, ${String(CFG.rainArea.y)}) - ${String(CFG.rainArea.y * 0.5)};
        pos.x += sin(${inputs.t} * 0.5 + h.z * 6.28) * 0.1;
        ${outputs.gsplat}.center = pos;
        ${outputs.gsplat}.rgba.a *= 0.6 + 0.4 * sin(${inputs.t} * 3.0 + h.x * 6.28);
      `)
    });
    return { gsplat: shader.apply({ gsplat, t: uTime }).gsplat };
  }
);
scene.add(rain);

// ─── 2. WATER DROPS ON GLASS ───
const drops = new SplatMesh({
  constructSplats: (splats) => {
    const center = new THREE.Vector3();
    const scales = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const color = new THREE.Color();
    for (let i = 0; i < CFG.dropCount; i++) {
      center.set(
        (Math.random() - 0.5) * CFG.dropAreaX,
        (Math.random() - 0.5) * CFG.dropAreaY,
        CFG.textWallZ + (Math.random() - 0.5) * 0.1
      );
      // Round-ish drops
      const s = 0.003 + Math.random() * 0.008;
      scales.set(s, s * (1.0 + Math.random() * 0.5), s);
      const bright = 0.5 + Math.random() * 0.5;
      color.setRGB(0.3 * bright, 0.5 * bright, 1.0 * bright);
      splats.pushSplat(center, scales, quat, 0.3 + Math.random() * 0.3, color);
    }
  }
});

// Drops shader: slow drip + ripple reaction
drops.objectModifier = dyno.dynoBlock(
  { gsplat: dyno.Gsplat }, { gsplat: dyno.Gsplat },
  ({ gsplat }) => {
    const shader = new dyno.Dyno({
      inTypes: { gsplat: dyno.Gsplat, t: "float", rippleOrigin: "vec3", rippleT: "float" },
      outTypes: { gsplat: dyno.Gsplat },
      globals: () => [dyno.unindent(`
        vec3 dropHash(vec3 p) { return fract(sin(p * 127.1) * 43758.5453); }
      `)],
      statements: ({ inputs, outputs }) => dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat};
        vec3 pos = ${inputs.gsplat}.center;
        vec3 h = dropHash(pos * 50.0);

        // Slow dripping
        float dripSpeed = ${String(CFG.dropSpeed)} * (0.5 + h.x);
        pos.y -= mod(${inputs.t} * dripSpeed + h.y * 20.0, ${String(CFG.dropAreaY)}) - ${String(CFG.dropAreaY * 0.5)};
        // Slight horizontal wander
        pos.x += sin(${inputs.t} * 0.3 + h.z * 6.28) * 0.02;

        // Ripple effect
        float dist = length(pos.xy - ${inputs.rippleOrigin}.xy);
        float rippleWave = sin(dist * 15.0 - ${inputs.rippleT} * ${String(CFG.rippleSpeed)}) 
                          * exp(-${inputs.rippleT} * ${String(CFG.rippleDecay)}) 
                          * smoothstep(${inputs.rippleT} * 3.0, 0.0, dist);
        pos.z += rippleWave * 0.15;
        ${outputs.gsplat}.rgba.rgb += vec3(0.2, 0.3, 0.5) * abs(rippleWave) * 3.0;
        ${outputs.gsplat}.rgba.a += abs(rippleWave) * 0.5;

        ${outputs.gsplat}.center = pos;
      `)
    });
    return {
      gsplat: shader.apply({ gsplat, t: uTime, rippleOrigin: uRippleOrigin, rippleT: uRippleTime }).gsplat
    };
  }
);
scene.add(drops);

// ─── 3. CITY BOKEH (background lights) ───
const bokeh = new SplatMesh({
  constructSplats: (splats) => {
    const center = new THREE.Vector3();
    const scales = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const color = new THREE.Color();
    for (let i = 0; i < CFG.bokehCount; i++) {
      const z = CFG.bokehDepth[0] + Math.random() * (CFG.bokehDepth[1] - CFG.bokehDepth[0]);
      center.set(
        (Math.random() - 0.5) * CFG.bokehArea.x,
        (Math.random() - 0.5) * CFG.bokehArea.y - 1,
        z
      );
      // Larger = more bokeh blur
      const s = 0.02 + Math.random() * 0.08;
      scales.set(s, s, s);
      const c = CFG.bokehColors[Math.floor(Math.random() * CFG.bokehColors.length)];
      const bright = 0.3 + Math.random() * 0.7;
      color.setRGB(c[0] * bright, c[1] * bright, c[2] * bright);
      splats.pushSplat(center, scales, quat, 0.1 + Math.random() * 0.25, color);
    }
  }
});

// Bokeh shader: gentle float + twinkle
bokeh.objectModifier = dyno.dynoBlock(
  { gsplat: dyno.Gsplat }, { gsplat: dyno.Gsplat },
  ({ gsplat }) => {
    const shader = new dyno.Dyno({
      inTypes: { gsplat: dyno.Gsplat, t: "float" },
      outTypes: { gsplat: dyno.Gsplat },
      globals: () => [dyno.unindent(`
        vec3 bokehHash(vec3 p) { return fract(sin(p * 311.7) * 43758.5453); }
      `)],
      statements: ({ inputs, outputs }) => dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat};
        vec3 pos = ${inputs.gsplat}.center;
        vec3 h = bokehHash(pos * 10.0);
        // Gentle float
        pos.y += sin(${inputs.t} * 0.2 + h.x * 6.28) * 0.05;
        pos.x += sin(${inputs.t} * 0.15 + h.y * 6.28) * 0.03;
        ${outputs.gsplat}.center = pos;
        // Twinkle
        float twinkle = 0.7 + 0.3 * sin(${inputs.t} * (1.0 + h.z * 3.0) + h.x * 6.28);
        ${outputs.gsplat}.rgba.a *= twinkle;
      `)
    });
    return { gsplat: shader.apply({ gsplat, t: uTime }).gsplat };
  }
);
scene.add(bokeh);

// ─── 4. FOG / MIST ───
const fog = new SplatMesh({
  constructSplats: (splats) => {
    const center = new THREE.Vector3();
    const scales = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const color = new THREE.Color();
    for (let i = 0; i < CFG.fogCount; i++) {
      center.set(
        (Math.random() - 0.5) * CFG.fogArea,
        (Math.random() - 0.5) * CFG.fogArea * 0.6,
        (Math.random() - 0.5) * CFG.fogArea
      );
      const s = 0.05 + Math.random() * 0.15;
      scales.set(s, s * 0.5, s);
      color.setRGB(0.08, 0.12, 0.2);
      splats.pushSplat(center, scales, quat, 0.03 + Math.random() * 0.04, color);
    }
  }
});

// Fog shader: slow drift
fog.objectModifier = dyno.dynoBlock(
  { gsplat: dyno.Gsplat }, { gsplat: dyno.Gsplat },
  ({ gsplat }) => {
    const shader = new dyno.Dyno({
      inTypes: { gsplat: dyno.Gsplat, t: "float" },
      outTypes: { gsplat: dyno.Gsplat },
      statements: ({ inputs, outputs }) => dyno.unindentLines(`
        ${outputs.gsplat} = ${inputs.gsplat};
        vec3 pos = ${inputs.gsplat}.center;
        pos.x += sin(${inputs.t} * 0.05 + pos.z) * 0.3;
        pos.z += cos(${inputs.t} * 0.03 + pos.x) * 0.2;
        ${outputs.gsplat}.center = pos;
      `)
    });
    return { gsplat: shader.apply({ gsplat, t: uTime }).gsplat };
  }
);
scene.add(fog);

// ─── 5. TEXT SPLATS (张爱玲 on the glass) ───
const poems = [
  "我将只是萎谢了",
  "因为我已经",
  "在你的怀里",
  "受过了春天",
];

const textGroup = new THREE.Group();
poems.forEach((line, i) => {
  const t = textSplats({
    text: line,
    font: "Noto Serif SC",
    fontSize: 48,
    color: new THREE.Color(0.25, 0.4, 0.8),
  });
  const baseScale = 0.4 / 60;
  t.scale.setScalar(baseScale);
  t.position.set(-1.5, 1.2 - i * 0.6, CFG.textWallZ + 0.05);
  textGroup.add(t);
});

// English subtitle
const enText = textSplats({
  text: "A Wet Rainy Night",
  font: "Georgia",
  fontSize: 36,
  color: new THREE.Color(0.2, 0.35, 0.7),
});
enText.scale.setScalar(0.3 / 50);
enText.position.set(-0.8, -1.5, CFG.textWallZ + 0.05);
textGroup.add(enText);

scene.add(textGroup);

// ─── ANIMATION LOOP ───
const clock = new THREE.Clock();

renderer.setAnimationLoop(() => {
  const dt = clock.getDelta();
  const elapsed = clock.getElapsedTime();

  uTime.value = elapsed;
  uRippleTime.value += dt;

  // Update camera orbit
  camera.position.x = Math.sin(rotY) * zoom;
  camera.position.z = Math.cos(rotY) * zoom;
  camera.position.y = rotX * zoom * 0.5;
  camera.lookAt(0, 0, CFG.textWallZ * 0.5);

  // Gentle auto-rotation
  if (!isDragging) {
    rotY += 0.0005;
  }

  // Update all splat meshes
  rain.updateVersion();
  drops.updateVersion();
  bokeh.updateVersion();
  fog.updateVersion();

  renderer.render(scene, camera);
});
