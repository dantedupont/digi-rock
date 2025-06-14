import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

// Scene setup
const scene = new THREE.Scene();

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 5;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0); // Transparent background
const canvas = renderer.domElement;
// The CSS gradient will be visible behind the 3D scene
document.getElementById('app').appendChild(renderer.domElement);

// Enable WebXR for AR
renderer.xr.enabled = true;

// Add ARButton to the DOM
const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
document.body.appendChild(arButton);

// AR hit test variables
let hitTestSource = null;
let hitTestSourceRequested = false;
let arRockPlaced = false;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 1;
directionalLight.shadow.camera.far = 20;
directionalLight.shadow.camera.left = -5;
directionalLight.shadow.camera.right = 5;
directionalLight.shadow.camera.top = 5;
directionalLight.shadow.camera.bottom = -5;
scene.add(directionalLight);

// Simplex noise for natural deformation
function snoise3(x, y, z) {
  // Simple pseudo-noise using trigonometric functions for demonstration
  return (
    Math.sin(x * 1.5 + Math.cos(z * 0.7)) +
    Math.cos(y * 2.1 + Math.sin(x * 0.5)) +
    Math.sin(z * 1.3 + Math.cos(y * 0.9))
  ) / 3;
}

// Rock geometry (irregular ellipsoid with multi-frequency noise for natural shape)
const rockGeometry = new THREE.SphereGeometry(1, 48, 36); // Higher-res sphere
const position = rockGeometry.attributes.position;
const vertex = new THREE.Vector3();
for (let i = 0; i < position.count; i++) {
  vertex.fromBufferAttribute(position, i);
  // Ellipsoid scaling for river stone shape
  vertex.y *= 0.52;
  vertex.x *= 1.13;
  // Multi-frequency noise for more natural, rougher shape
  let noise =
    snoise3(vertex.x * 1.1, vertex.y * 1.1, vertex.z * 1.1) * 0.07 +
    snoise3(vertex.x * 2.7, vertex.y * 2.7, vertex.z * 2.7) * 0.025 +
    snoise3(vertex.x * 5.5, vertex.y * 5.5, vertex.z * 5.5) * 0.012;
  vertex.addScaledVector(vertex.clone().normalize(), noise);
  position.setXYZ(i, vertex.x, vertex.y, vertex.z);
}
rockGeometry.computeVertexNormals();

// Procedural normal map for roughness
const normalCanvas = document.createElement('canvas');
normalCanvas.width = 256;
normalCanvas.height = 256;
const ctx = normalCanvas.getContext('2d');
for (let y = 0; y < 256; y++) {
  for (let x = 0; x < 256; x++) {
    const nx = x / 256 - 0.5;
    const ny = y / 256 - 0.5;
    const n = snoise3(nx * 8, ny * 8, 0) * 0.5 + 0.5;
    const shade = Math.floor(128 + n * 127);
    ctx.fillStyle = `rgb(${shade},${shade},255)`;
    ctx.fillRect(x, y, 1, 1);
  }
}
const normalMap = new THREE.CanvasTexture(normalCanvas);
normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;

const rockMaterial = new THREE.MeshStandardMaterial({
  color: 0x7b8a8b, // Gray-blue river stone
  roughness: 0.85,
  metalness: 0.18,
  flatShading: false,
  normalMap: normalMap,
  normalScale: new THREE.Vector2(1.2, 1.2),
});
const rock = new THREE.Mesh(rockGeometry, rockMaterial);
rock.castShadow = true;
rock.receiveShadow = true;
scene.add(rock);

// Box size for ground/rock positioning
const boxSize = 2.5;

// Ground plane to receive shadow
const groundGeometry = new THREE.PlaneGeometry(boxSize, boxSize);
const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.35 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -boxSize / 2 + 0.01; // Slightly above the box bottom
scene.add(ground);
ground.receiveShadow = true;

// Position the rock so it sits on the bottom of the box
rock.position.y = -((boxSize / 2) - 1 * 0.55); // 1 is the rock radius, 0.55 is the flattening factor

// Physics variables for bouncing
let velocity = 0;
let isBouncing = false;
const gravity = -0.025; // Gravity acceleration
const bounceImpulse = 0.32; // Initial velocity when clicked
const groundY = rock.position.y;

let rainParticles = null;
let snowParticles = null;
let snowParticles2 = null;
let fogEnabled = false;
let thunderTimeout = null;

// Overlay canvas for weather effects
const overlay = document.getElementById('weather-overlay');
const overlayCtx = overlay.getContext('2d');
function resizeOverlay() {
  overlay.width = window.innerWidth;
  overlay.height = window.innerHeight;
}
resizeOverlay();
window.addEventListener('resize', resizeOverlay);

// Overlay state
let overlayState = {
  rainStreaks: [],
  rainSplashes: [],
  snowAccum: false,
  fogPlanes: [],
  lightning: false,
  clouds: [],
  desaturate: false,
  shake: 0,
  sun: false,
};

// Full-screen 2D snowflake overlay state
let overlaySnowflakes = [];

function initOverlaySnowflakes() {
  overlaySnowflakes = [];
  for (let i = 0; i < 320; i++) {
    overlaySnowflakes.push({
      x: Math.random() * overlay.width,
      y: Math.random() * overlay.height,
      r: 1.5 + Math.random() * 3.5,
      speed: 1.2 + Math.random() * 2.2,
      drift: (Math.random() - 0.5) * 1.2,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

window.addEventListener('resize', () => {
  resizeOverlay();
  if (overlayState.snowAccum) initOverlaySnowflakes();
});

// Utility: draw a simple splash
function drawSplash(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.strokeStyle = '#b7d3e6';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// Utility: draw a simple snow accumulation
function drawSnowAccum(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, ctx.canvas.height * 0.85, ctx.canvas.width, ctx.canvas.height * 0.15);
  ctx.restore();
}

// Utility: draw a lightning bolt
function drawLightning(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  let x = ctx.canvas.width * (0.3 + 0.4 * Math.random());
  let y = 0;
  ctx.moveTo(x, y);
  for (let i = 0; i < 8; i++) {
    x += (Math.random() - 0.5) * 40;
    y += ctx.canvas.height / 10;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

// Utility: draw a simple cloud
function drawCloud(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.2, r, 0, 0, 2 * Math.PI);
  ctx.ellipse(x + r, y, r, r * 0.8, 0, 0, 2 * Math.PI);
  ctx.ellipse(x - r, y, r, r * 0.8, 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.restore();
}

// Utility: draw full-screen rain streak overlay
function drawRainStreakOverlay(ctx) {
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * ctx.canvas.width;
    const y = Math.random() * ctx.canvas.height;
    const len = 40 + Math.random() * 60;
    ctx.save();
    ctx.globalAlpha = 0.10 + Math.random() * 0.08;
    ctx.strokeStyle = '#b7d3e6';
    ctx.lineWidth = 1.5 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + len);
    ctx.stroke();
    ctx.restore();
  }
}

// Utility: draw full-screen drifting snow overlay
function drawFullScreenSnowOverlay(ctx) {
  for (let i = 0; i < 24; i++) {
    const x = (performance.now() / 12 + i * 120) % ctx.canvas.width;
    const y = ctx.canvas.height * 0.1 + Math.sin(performance.now() / 600 + i) * 60;
    ctx.save();
    ctx.globalAlpha = 0.06 + Math.random() * 0.06;
    ctx.beginPath();
    ctx.ellipse(x, y, 120, 28, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }
}

// Utility: draw multiple full-screen lightning bolts
function drawFullScreenLightning(ctx) {
  for (let bolt = 0; bolt < 3 + Math.floor(Math.random() * 2); bolt++) {
    ctx.save();
    ctx.globalAlpha = 0.38 + Math.random() * 0.32;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 4 + Math.random() * 2;
    ctx.beginPath();
    let x = ctx.canvas.width * (0.2 + 0.6 * Math.random());
    let y = 0;
    ctx.moveTo(x, y);
    for (let i = 0; i < 8; i++) {
      x += (Math.random() - 0.5) * 40;
      y += ctx.canvas.height / 10;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }
  // Add a full-screen white flash for extra effect
  ctx.save();
  ctx.globalAlpha = 0.18 + Math.random() * 0.12;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

// Utility: draw stormy dark overlay
function drawStormOverlay(ctx) {
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#222b3a';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

// Thunderstorm state
let thunderFlash = false;
let thunderFlashTimer = 0;
let thunderShake = 0;

// Snow cap mesh for rock accumulation
let snowCap = null;
let snowCapTimeout = null;
let wasRockAtRest = true;

function addSnowCap() {
  if (!snowCap) {
    const snowCapGeometry = new THREE.SphereGeometry(1.05, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.6);
    snowCap = new THREE.Mesh(
      snowCapGeometry,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0.1,
        transparent: true,
        opacity: 0.98,
      })
    );
    snowCap.position.copy(rock.position);
    snowCap.position.y += 0.25;
    snowCap.scale.set(1.05, 0.45, 1.05);
    snowCap.castShadow = false;
    snowCap.receiveShadow = false;
  }
  if (!scene.children.includes(snowCap)) scene.add(snowCap);
}
function removeSnowCap() {
  if (snowCap && scene.children.includes(snowCap)) scene.remove(snowCap);
}

// Utility: draw a sun icon
function drawSunIcon(ctx, x, y, r) {
  ctx.save();
  // Sun core
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffe066';
  ctx.shadowColor = '#ffe066';
  ctx.shadowBlur = 16;
  ctx.fill();
  ctx.shadowBlur = 0;
  // Rays
  ctx.strokeStyle = '#ffe066';
  ctx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * (r + 6), y + Math.sin(angle) * (r + 6));
    ctx.lineTo(x + Math.cos(angle) * (r + 18), y + Math.sin(angle) * (r + 18));
    ctx.stroke();
  }
  ctx.restore();
}

// Update overlays for each weather type
function updateOverlayForWeather(main) {
  overlayState.rainStreaks = [];
  overlayState.rainSplashes = [];
  overlayState.snowAccum = false;
  overlayState.fogPlanes = [];
  overlayState.lightning = false;
  overlayState.clouds = [];
  overlayState.desaturate = false;
  overlayState.shake = 0;
  overlayState.sun = false;
  if (main.includes('rain')) {
    // Rain streaks
    for (let i = 0; i < 60; i++) {
      overlayState.rainStreaks.push({
        x: Math.random() * overlay.width,
        y: Math.random() * overlay.height,
        len: 30 + Math.random() * 30,
        speed: 8 + Math.random() * 4,
      });
    }
    // Rain splashes
    for (let i = 0; i < 10; i++) {
      overlayState.rainSplashes.push({
        x: Math.random() * overlay.width,
        y: overlay.height * 0.85 + Math.random() * overlay.height * 0.1,
        r: 8 + Math.random() * 8,
        alpha: 0.7 + Math.random() * 0.3,
        t: Math.random() * 60,
      });
    }
    // Wet sheen
    rockMaterial.metalness = 0.35;
    rockMaterial.roughness = 0.5;
  } else {
    rockMaterial.metalness = 0.18;
    rockMaterial.roughness = 0.85;
  }
  if (main.includes('snow')) {
    overlayState.snowAccum = true;
    initOverlaySnowflakes();
    addSnowCap();
  } else {
    removeSnowCap();
  }
  if (main.includes('fog') || main.includes('mist')) {
    overlayState.fogPlanes = [
      { y: overlay.height * 0.7, alpha: 0.18 },
      { y: overlay.height * 0.8, alpha: 0.12 },
      { y: overlay.height * 0.9, alpha: 0.08 },
    ];
    overlayState.desaturate = true;
  }
  if (main.includes('thunder')) {
    overlayState.lightning = true;
    overlayState.shake = 1;
    // Heavier rain for thunderstorm
    overlayState.rainStreaks = [];
    for (let i = 0; i < 120; i++) {
      overlayState.rainStreaks.push({
        x: Math.random() * overlay.width,
        y: Math.random() * overlay.height,
        len: 40 + Math.random() * 40,
        speed: 12 + Math.random() * 6,
      });
    }
    // Heavier 3D rain
    if (rainParticles) {
      scene.remove(rainParticles);
      rainParticles.geometry.dispose();
      rainParticles.material.dispose();
      rainParticles = null;
    }
    const rainCount = 500;
    const rainGeometry = new THREE.BufferGeometry();
    const rainPositions = [];
    for (let i = 0; i < rainCount; i++) {
      let x, z;
      do {
        x = (Math.random() - 0.5) * 2.5;
        z = (Math.random() - 0.5) * 2.5;
      } while (Math.abs(x) < 0.7 && Math.abs(z) < 0.7);
      rainPositions.push(x, Math.random() * 2.5, z);
    }
    rainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rainPositions, 3));
    const rainMaterial = new THREE.PointsMaterial({ color: 0xaaaaee, size: 0.05, transparent: true });
    rainParticles = new THREE.Points(rainGeometry, rainMaterial);
    scene.add(rainParticles);
  }
  if (main.includes('cloud')) {
    for (let i = 0; i < 5; i++) {
      overlayState.clouds.push({
        x: Math.random() * overlay.width,
        y: 60 + Math.random() * 80,
        r: 60 + Math.random() * 40,
        alpha: 0.18 + Math.random() * 0.12,
        speed: 0.2 + Math.random() * 0.1,
      });
    }
  }
  if (main.includes('clear') || main.includes('cloud')) {
    overlayState.sun = true;
  }
}

// Animate overlays
function animateOverlay() {
  overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
  // Rain streaks
  overlayState.rainStreaks.forEach(streak => {
    overlayCtx.save();
    overlayCtx.globalAlpha = 0.22;
    overlayCtx.strokeStyle = '#b7d3e6';
    overlayCtx.lineWidth = 2;
    overlayCtx.beginPath();
    overlayCtx.moveTo(streak.x, streak.y);
    overlayCtx.lineTo(streak.x, streak.y + streak.len);
    overlayCtx.stroke();
    overlayCtx.restore();
    streak.y += streak.speed;
    if (streak.y > overlay.height) streak.y = -streak.len;
  });
  // Rain splashes
  overlayState.rainSplashes.forEach(splash => {
    drawSplash(overlayCtx, splash.x, splash.y, splash.r, splash.alpha * Math.abs(Math.sin(performance.now() / 400 + splash.t)));
  });
  // Snow accumulation
  if (overlayState.snowAccum) {
    drawSnowAccum(overlayCtx);
  }
  // Fog planes
  overlayState.fogPlanes.forEach(fog => {
    overlayCtx.save();
    overlayCtx.globalAlpha = fog.alpha;
    overlayCtx.fillStyle = '#fff';
    overlayCtx.fillRect(0, fog.y, overlay.width, overlay.height * 0.1);
    overlayCtx.restore();
  });
  // Lightning
  if (overlayState.lightning && Math.random() < 0.01) {
    drawLightning(overlayCtx);
  }
  // Clouds
  overlayState.clouds.forEach(cloud => {
    drawCloud(overlayCtx, cloud.x, cloud.y, cloud.r, cloud.alpha);
    cloud.x += cloud.speed;
    if (cloud.x - cloud.r > overlay.width) cloud.x = -cloud.r;
  });
  // Desaturate (fog/mist)
  if (overlayState.desaturate) {
    overlayCtx.save();
    overlayCtx.globalAlpha = 0.18;
    overlayCtx.fillStyle = '#bbb';
    overlayCtx.fillRect(0, 0, overlay.width, overlay.height);
    overlayCtx.restore();
  }
  // Full-screen rain overlay
  if (overlayState.rainStreaks.length > 0) {
    drawRainStreakOverlay(overlayCtx);
  }
  // Full-screen snow overlay
  if (overlayState.snowAccum) {
    drawFullScreenSnowOverlay(overlayCtx);
  }
  // Stormy overlay for thunderstorm
  if (overlayState.lightning) {
    drawStormOverlay(overlayCtx);
  }
  // Full-screen lightning flash
  if (overlayState.lightning && thunderFlash) {
    drawFullScreenLightning(overlayCtx);
  }
  // Full-screen 2D snowflakes (blizzard)
  if (overlayState.snowAccum && overlaySnowflakes.length > 0) {
    overlayCtx.save();
    overlayCtx.fillStyle = '#fff';
    overlaySnowflakes.forEach(flake => {
      overlayCtx.globalAlpha = 0.22 + Math.random() * 0.22;
      overlayCtx.beginPath();
      overlayCtx.arc(flake.x, flake.y, flake.r, 0, 2 * Math.PI);
      overlayCtx.fill();
      // Animate
      flake.y += flake.speed;
      flake.x += Math.sin(performance.now() / 800 + flake.phase) * flake.drift;
      if (flake.y > overlay.height) {
        flake.y = -flake.r;
        flake.x = Math.random() * overlay.width;
      }
      if (flake.x < -flake.r) flake.x = overlay.width + flake.r;
      if (flake.x > overlay.width + flake.r) flake.x = -flake.r;
    });
    overlayCtx.restore();
  }
  // Sun icon
  if (overlayState.sun) {
    drawSunIcon(overlayCtx, 70, 70, 32);
  }
}

function addRain() {
  if (rainParticles) {
    scene.remove(rainParticles);
    rainParticles.geometry.dispose();
    rainParticles.material.dispose();
    rainParticles = null;
  }
  const rainCount = 220;
  const rainGeometry = new THREE.BufferGeometry();
  const rainPositions = [];
  for (let i = 0; i < rainCount; i++) {
    // Bias spawn away from the center (rock area)
    let x, z;
    do {
      x = (Math.random() - 0.5) * 2.5;
      z = (Math.random() - 0.5) * 2.5;
    } while (Math.abs(x) < 0.7 && Math.abs(z) < 0.7); // avoid center
    rainPositions.push(x, Math.random() * 2.5, z);
  }
  rainGeometry.setAttribute('position', new THREE.Float32BufferAttribute(rainPositions, 3));
  const rainMaterial = new THREE.PointsMaterial({ color: 0xaaaaee, size: 0.05, transparent: true });
  rainParticles = new THREE.Points(rainGeometry, rainMaterial);
  scene.add(rainParticles);
}

function removeRain() {
  if (rainParticles) {
    scene.remove(rainParticles);
    rainParticles.geometry.dispose();
    rainParticles.material.dispose();
    rainParticles = null;
  }
}

function addSnow() {
  // First layer (existing)
  if (snowParticles) {
    scene.remove(snowParticles);
    snowParticles.geometry.dispose();
    snowParticles.material.dispose();
    snowParticles = null;
  }
  const snowCount = 120;
  const snowGeometry = new THREE.BufferGeometry();
  const snowPositions = [];
  for (let i = 0; i < snowCount; i++) {
    // Bias spawn away from the center (rock area)
    let x, z;
    do {
      x = (Math.random() - 0.5) * 2.5;
      z = (Math.random() - 0.5) * 2.5;
    } while (Math.abs(x) < 0.7 && Math.abs(z) < 0.7);
    snowPositions.push(x, Math.random() * 2.5, z);
  }
  snowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(snowPositions, 3));
  const snowflakeTexture = createSnowflakeTexture();
  const snowMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.13, transparent: true, map: snowflakeTexture, alphaTest: 0.2 });
  snowParticles = new THREE.Points(snowGeometry, snowMaterial);
  scene.add(snowParticles);

  // Second layer (larger, slower flakes)
  if (snowParticles2) {
    scene.remove(snowParticles2);
    snowParticles2.geometry.dispose();
    snowParticles2.material.dispose();
    snowParticles2 = null;
  }
  const snowCount2 = 50;
  const snowGeometry2 = new THREE.BufferGeometry();
  const snowPositions2 = [];
  for (let i = 0; i < snowCount2; i++) {
    let x, z;
    do {
      x = (Math.random() - 0.5) * 2.5;
      z = (Math.random() - 0.5) * 2.5;
    } while (Math.abs(x) < 0.7 && Math.abs(z) < 0.7);
    snowPositions2.push(x, Math.random() * 2.5, z);
  }
  snowGeometry2.setAttribute('position', new THREE.Float32BufferAttribute(snowPositions2, 3));
  const snowMaterial2 = new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.7, map: snowflakeTexture, alphaTest: 0.2 });
  snowParticles2 = new THREE.Points(snowGeometry2, snowMaterial2);
  scene.add(snowParticles2);
}

function removeSnow() {
  if (snowParticles) {
    scene.remove(snowParticles);
    snowParticles.geometry.dispose();
    snowParticles.material.dispose();
    snowParticles = null;
  }
  if (snowParticles2) {
    scene.remove(snowParticles2);
    snowParticles2.geometry.dispose();
    snowParticles2.material.dispose();
    snowParticles2 = null;
  }
}

function addFog() {
  if (!fogEnabled) {
    scene.fog = new THREE.Fog(0xcfd8dc, 2, 7);
    fogEnabled = true;
  }
}

function removeFog() {
  if (fogEnabled) {
    scene.fog = null;
    fogEnabled = false;
  }
}

function triggerThunder() {
  // Simulate a lightning flash by briefly increasing light intensity
  const originalIntensity = directionalLight.intensity;
  directionalLight.intensity = 2.5;
  setTimeout(() => {
    directionalLight.intensity = originalIntensity;
  }, 100 + Math.random() * 200);
  // Schedule next thunder flash
  thunderTimeout = setTimeout(triggerThunder, 2000 + Math.random() * 3000);
}

function stopThunder() {
  if (thunderTimeout) {
    clearTimeout(thunderTimeout);
    thunderTimeout = null;
    directionalLight.intensity = 0.3; // restore to thunderstorm value
  }
}

// Time simulation variables
let simulatedYears = 0;
let yearsPerSecond = 1;
window._yearsPerSecond = yearsPerSecond;

// Erosion parameters
let baseErosionRate = 0.0000001; // per year
function getWeatherErosionMultiplier() {
  if (overlayState.lightning || overlayState.rainStreaks.length > 0) return 8; // thunderstorm/rain
  if (overlayState.snowAccum) return 4;
  if (overlayState.fogPlanes.length > 0) return 1.5;
  return 1;
}

// Erode the rock geometry and scale
function erodeRock(dtYears) {
  // Shrink the rock scale
  const erosion = baseErosionRate * getWeatherErosionMultiplier() * dtYears;
  rock.scale.multiplyScalar(1 - erosion);
  // Optionally, smooth the geometry (not implemented for performance)
}

// Update years display
function updateSimYearsDisplay() {
  const el = document.getElementById('sim-years');
  if (el) el.textContent = `Years: ${simulatedYears.toLocaleString(undefined, {maximumFractionDigits:0})}`;
}

// Helper for placing the rock in AR
function onSelect() {
  if (arReticle.visible && !arRockPlaced) {
    rock.position.setFromMatrixPosition(arReticle.matrix);
    rock.visible = true;
    arRockPlaced = true;
  }
}

// Reticle for AR placement
const arReticleGeometry = new THREE.RingGeometry(0.12, 0.15, 32).rotateX(-Math.PI / 2);
const arReticleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
const arReticle = new THREE.Mesh(arReticleGeometry, arReticleMaterial);
arReticle.matrixAutoUpdate = false;
arReticle.visible = false;
scene.add(arReticle);

renderer.xr.addEventListener('sessionstart', () => {
  arRockPlaced = false;
  rock.visible = false;
});

renderer.xr.addEventListener('sessionend', () => {
  arRockPlaced = false;
  rock.visible = true;
});

// Add AR select event
renderer.xr.getController(0).addEventListener('select', onSelect);

// Replace the animate() function with AR support
function animate() {
  renderer.setAnimationLoop(renderAR);
}

function renderAR(timestamp, frame) {
  // If not in AR, run the normal animation/render logic
  if (!renderer.xr.isPresenting) {
    // ... existing code for normal rendering ...
    renderer.render(scene, camera);
    animateOverlay();
    return;
  }

  // AR mode
  const session = renderer.xr.getSession();
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    if (!hitTestSourceRequested) {
      session.requestReferenceSpace('viewer').then((refSpace) => {
        session.requestHitTestSource({ space: refSpace }).then((source) => {
          hitTestSource = source;
        });
      });
      session.addEventListener('end', () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
      });
      hitTestSourceRequested = true;
    }
    if (hitTestSource && !arRockPlaced) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        arReticle.visible = true;
        arReticle.matrix.fromArray(hit.getPose(renderer.xr.getReferenceSpace()).transform.matrix);
      } else {
        arReticle.visible = false;
      }
    } else {
      arReticle.visible = false;
    }
  }
  renderer.render(scene, camera);
}

animate();

// Click event for bouncing
renderer.domElement.addEventListener('pointerdown', (event) => {
  // Raycast to check if the rock was clicked
  const mouse = new THREE.Vector2(
    (event.clientX / renderer.domElement.clientWidth) * 2 - 1,
    -(event.clientY / renderer.domElement.clientHeight) * 2 + 1
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(rock);
  if (intersects.length > 0 && !isBouncing) {
    velocity = bounceImpulse;
    isBouncing = true;
  }
});

// Responsive resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Weather API integration
const WEATHER_API_KEY = '442d87fd0a3e5468f1f00457de3fee9e';

function setWeatherVisuals(weatherOrString) {
  // Accept string for dev panel
  let main = null;
  if (typeof weatherOrString === 'string') {
    main = weatherOrString;
    weatherOrString = { weather: [{ main }] };
  } else if (weatherOrString) {
    main = weatherOrString.weather[0].main.toLowerCase();
  }
  // Default: clear sky
  let skyColor = '#b7d3e6';
  let groundColor = '#e0cda9';
  let ambientIntensity = 0.7;
  let directionalIntensity = 0.8;
  removeRain();
  removeSnow();
  removeFog();
  stopThunder();
  if (main) {
    if (main.includes('cloud')) {
      skyColor = '#a0b6c8';
      ambientIntensity = 0.6;
      directionalIntensity = 0.5;
    } else if (main.includes('rain')) {
      skyColor = '#7a8fa3';
      ambientIntensity = 0.5;
      directionalIntensity = 0.4;
      addRain();
    } else if (main.includes('snow')) {
      skyColor = '#e6f7ff';
      ambientIntensity = 0.8;
      directionalIntensity = 0.6;
      addSnow();
    } else if (main.includes('thunder')) {
      skyColor = '#5a6a7a';
      ambientIntensity = 0.4;
      directionalIntensity = 0.3;
      addRain();
      triggerThunder();
    } else if (main.includes('mist') || main.includes('fog')) {
      skyColor = '#cfd8dc';
      ambientIntensity = 0.5;
      directionalIntensity = 0.3;
      addFog();
    }
  }
  // Update background gradient
  const canvas = renderer.domElement;
  canvas.style.background = `linear-gradient(to top, ${groundColor} 0%, ${skyColor} 100%)`;
  // Update lighting
  ambientLight.intensity = ambientIntensity;
  directionalLight.intensity = directionalIntensity;
  updateOverlayForWeather(main);
}

// Expose setWeather for dev panel
window.setWeather = (weatherType) => setWeatherVisuals(weatherType);

function fetchWeatherAndSetScene(lat, lon) {
  fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}`)
    .then(res => res.json())
    .then(data => {
      setWeatherVisuals(data);
    })
    .catch(err => {
      console.error('Weather fetch error:', err);
      setWeatherVisuals(null); // fallback
    });
}

if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      fetchWeatherAndSetScene(latitude, longitude);
    },
    (err) => {
      console.warn('Geolocation error:', err);
      setWeatherVisuals(null); // fallback
    }
  );
} else {
  setWeatherVisuals(null); // fallback
}

// Procedural snowflake texture for particles
function createSnowflakeTexture() {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, size / 2 - 2);
    ctx.stroke();
  }
  ctx.restore();
  return new THREE.CanvasTexture(canvas);
}

// Store original rock state for reset
const originalRockScale = new THREE.Vector3(1, 1, 1);
const originalRockPosition = rock.position.clone();
const originalRockGeometry = rockGeometry.clone();

window.resetRock = function() {
  // Reset scale
  rock.scale.copy(originalRockScale);
  // Reset geometry
  rock.geometry.copy(originalRockGeometry);
  // Reset position
  rock.position.copy(originalRockPosition);
  // Reset simulated years
  simulatedYears = 0;
  updateSimYearsDisplay();
  // Reset snow cap
  if (snowCap && scene.children.includes(snowCap)) removeSnowCap();
  if (overlayState.snowAccum) addSnowCap();
}; 