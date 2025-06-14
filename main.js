import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

// Scene setup
const scene = new THREE.Scene();
let rainParticles = null; // For 3D rain effect
let snowParticles = null; // For 3D snow effect

let thunderTimeout = null; // Stores the timeout ID for thunder
let fogEnabled = false; // Tracks if 3D scene fog is active

// State for 2D overlay canvas effects
let thunderFlash = false; // Flag for 2D full-screen lightning flash
let overlaySnowflakes = []; // For 2D animated snowflakes
let overlayState = {
  rainStreaks: [],
  rainSplashes: [],
  snowAccum: false, // Or an object if it stores more complex state
  fogParticles: [], // For particle-based 2D fogs
  lightning: false,
  clouds: [],
  moonPosition: null // { x, y, r } for drawing the moon
};
let rock; // Declare the main rock object
let arRockPlaced = false; // Variable to track if the rock has been placed in AR
let arOriginalRockMaterial = null; // To store material before AR

// Camera setup
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 10;

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0); // Transparent background
const canvas = renderer.domElement;
// The CSS gradient will be visible behind the 3D scene
document.getElementById('app').appendChild(renderer.domElement);
renderer.xr.enabled = true;

// Overlay canvas for 2D weather effects
const overlay = document.getElementById('weather-overlay');
let overlayCtx;
if (overlay) {
  overlayCtx = overlay.getContext('2d');
  overlay.width = window.innerWidth;
  overlay.height = window.innerHeight;
  console.log('Overlay canvas initialized.');
} else {
  console.error('ERROR: Overlay canvas element with ID "weather-overlay" not found!');
}

// Enable WebXR for AR
renderer.xr.enabled = true;

// Add ARButton to the DOM
const arButton = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
document.body.appendChild(arButton);
// Ensure the main animation loop is set up initially for non-AR rendering
// ARButton will take over the animation loop during an AR session.
renderer.setAnimationLoop(animate);

// AR hit test variables
let hitTestSource = null;
let hitTestSourceRequested = false;
let arDisplayRock = null; // Simple object for AR display

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7.5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 1;
directionalLight.shadow.camera.far = 20;
directionalLight.shadow.camera.left = -4;
directionalLight.shadow.camera.right = 4;
directionalLight.shadow.camera.top = 4;
directionalLight.shadow.camera.bottom = -4;
directionalLight.shadow.camera.left = -5; // Expanded frustum slightly
directionalLight.shadow.camera.right = 5;
directionalLight.shadow.camera.top = 5;
directionalLight.shadow.camera.bottom = -5;
directionalLight.shadow.bias = -0.0005; // Added shadow bias
directionalLight.shadow.camera.updateProjectionMatrix(); // Update projection matrix after changes
scene.add(directionalLight);

// Day/Night toggle state and function
let isDayMode = true;
const dayAmbientIntensity = 0.7;
const dayDirectionalIntensity = 0.8;
const dayDirectionalColor = 0xffffff;

const nightAmbientIntensity = 0.15; // Slightly more ambient for night to see silhouette
const nightDirectionalIntensity = 0.3;
const nightDirectionalColor = 0x6060aa; // Softer blue for moonlight

function toggleDayNight() {
  isDayMode = !isDayMode;
  if (isDayMode) {
    // DAY MODE
    ambientLight.intensity = dayAmbientIntensity;
    directionalLight.intensity = dayDirectionalIntensity;
    directionalLight.color.setHex(dayDirectionalColor);
    directionalLight.visible = true; // Sun is visible and casts shadows
    renderer.setClearColor(0x87ceeb, 1); // Sky blue background
    if (scene.fog) scene.fog = null; // Remove fog
  } else {
    // NIGHT MODE
    ambientLight.intensity = nightAmbientIntensity;
    directionalLight.visible = false; // Sun/moon light source off, rely on ambient and maybe point lights later
    renderer.setClearColor(0x000020, 1); // Dark navy blue background
    // Add or adjust fog for nighttime
    if (!scene.fog) {
      scene.fog = new THREE.Fog(0x000020, camera.near + 2, camera.far / 2.5); 
    } else {
      scene.fog.color.setHex(0x000020);
      scene.fog.near = camera.near + 2; // Adjust as needed
      scene.fog.far = camera.far / 2.5;  // Adjust as needed
    }
  }
}
window.toggleDayNight = toggleDayNight;

// Parameters for the custom rock (will be updated from localStorage or defaults)
let customRockParams = {
    size: 50,
    xScale: 50,
    yScale: 50,
    smoothness: 80,
    surfaceDetail: 50
};
let currentRockType = 'granite'; // Default rock type

// Rock material presets (copied from rock-customization/script.js)
const rockPresets = {
    granite: { color: 0x8b7355, roughness: 0.7, metalness: 0.1, name: "Granite" },
    marble: { color: 0xf5f5dc, roughness: 0.3, metalness: 0.05, name: "Marble" },
    sandstone: { color: 0xD2B48C, roughness: 0.8, metalness: 0.05, name: "Sandstone" },
    limestone: { color: 0xb0a4b8, roughness: 0.65, metalness: 0.05, name: "Limestone" },
    slate: { color: 0x6A737D, roughness: 0.6, metalness: 0.05, name: "Slate" },
    basalt: { color: 0x36454f, roughness: 0.9, metalness: 0.02, name: "Basalt" },
    quartzite: { color: 0xf0f8ff, roughness: 0.5, metalness: 0.15, name: "Quartzite" },
    obsidian: { color: 0x1c1c1c, roughness: 0.1, metalness: 0.3, name: "Obsidian" }
};

// For storing the initial state of the first generated rock for reset
let initialRockParams;
let initialRockType;

// Simplex noise for normal map generation (remains unchanged)
function snoise3(x, y, z) {
  return (
    Math.sin(x * 1.5 + Math.cos(z * 0.7)) +
    Math.cos(y * 2.1 + Math.sin(x * 0.5)) +
    Math.sin(z * 1.3 + Math.cos(y * 0.9))
  ) / 3;
}

function loadCustomRockData() {
    try {
        const paramsString = localStorage.getItem('customRockParams');
        const typeString = localStorage.getItem('customRockType');

        if (paramsString && typeString) {
            customRockParams = JSON.parse(paramsString);
            currentRockType = typeString;
            console.log('Loaded custom rock from localStorage:', customRockParams, currentRockType);
        }

        const rockName = localStorage.getItem('rockName') || 'My Rock';
        const rockEnvironmentTitleElement = document.getElementById('rockEnvironmentTitle');
        if (rockEnvironmentTitleElement) {
            rockEnvironmentTitleElement.textContent = `${rockName}'s environment`;
        }
        console.log('Loaded rock name for title:', rockName);
        
        if (!paramsString || !typeString) { // Adjusted the 'else' condition to only log if data was truly missing
            console.log('No custom rock data in localStorage, using defaults.');
            // Defaults are already set globally
        }
    } catch (error) {
        console.error('Error loading rock data from localStorage:', error);
        // Defaults are already set, so we can proceed
        const rockEnvironmentTitleElement = document.getElementById('rockEnvironmentTitle');
        if (rockEnvironmentTitleElement) {
            rockEnvironmentTitleElement.textContent = "My Rock's environment";
        }
    }
}

function generateCustomRockGeometry(params, rockType) { // rockType is not used for geometry but passed for consistency
    const actualSize = (params.size / 100) * 2.5 + 0.5;
    const actualXScale = (params.xScale / 100) * 1.7 + 0.3;
    const actualYScale = (params.yScale / 100) * 1.7 + 0.3;
    const actualSmoothness = params.smoothness / 100;
    const actualDetail = params.surfaceDetail / 100;

    const newRockGeometry = new THREE.SphereGeometry(1, 128, 128);
    
    const vertices = newRockGeometry.attributes.position.array;
    const vertexCount = vertices.length / 3;
    
    for (let i = 0; i < vertexCount; i++) {
        const x = vertices[i * 3];
        const y = vertices[i * 3 + 1];
        const z = vertices[i * 3 + 2];
        
        const length = Math.sqrt(x * x + y * y + z * z);
        const nx = x / length;
        const ny = y / length;
        const nz = z / length;
        
        const smoothnessFactor = actualSmoothness;
        const jaggednessFactor = 1 - smoothnessFactor;
        
        const seed1 = 12.34, seed2 = 56.78, seed3 = 90.12, seed4 = 34.56, seed5 = 78.90, seed6 = 1.23;
        let noiseSum = 0.0;
        
        noiseSum += (Math.sin((nx + 17.3 + seed1) * 3.7) * Math.cos((ny - 8.1 + seed2) * 3.1) + 
                     Math.sin((ny + 23.5 + seed3) * 2.9) * Math.cos((nz - 12.9 + seed4) * 3.3) + 
                     Math.sin((nz + 5.7 + seed5) * 3.5) * Math.cos((nx - 19.2 + seed6) * 2.7)) * 
                     (0.12 + jaggednessFactor * 0.45) / 3;
        
        noiseSum += (Math.sin((nx - 11.8 + seed4) * 7.2) * Math.cos((ny + 31.1 + seed5) * 6.8) + 
                     Math.sin((ny - 5.4 + seed6) * 6.5) * Math.cos((nz + 27.6 + seed1) * 7.1)) * 
                     actualDetail * (0.08 + jaggednessFactor * 0.25) / 2;
        
        if (jaggednessFactor > 0.1) {
            noiseSum += (Math.sin((nx + 3.9 + seed2) * 15.7) * Math.cos((ny - 22.4 + seed3) * 14.3) + 
                         Math.sin((ny + 14.2 + seed4) * 16.1) * Math.cos((nz - 7.8 + seed5) * 15.9) + 
                         Math.sin((nz + 33.1 + seed6) * 14.7) * Math.cos((nx - 1.5 + seed1) * 15.3)) * 
                         actualDetail * jaggednessFactor * 0.18 / 3;
        }
        
        if (jaggednessFactor > 0.3) {
            noiseSum += (Math.sin((nx - 25.6 + seed5) * 32.1) * Math.cos((ny + 9.3 + seed6) * 31.7) + 
                         Math.sin((ny - 18.7 + seed1) * 33.3) * Math.cos((nz + 2.4 + seed2) * 32.9)) * 
                         actualDetail * jaggednessFactor * jaggednessFactor * 0.15 / 2;
        }
        
        if (jaggednessFactor > 0.7) {
            noiseSum += (Math.sin((nx + 13.1 + seed3) * 64.3) * Math.cos((ny - 28.9 + seed4) * 67.1) + 
                         Math.sin((ny + 2.7 + seed5) * 71.7) * Math.cos((nz - 15.3 + seed6) * 59.3) + 
                         Math.sin((nz + 20.8 + seed1) * 83.9) * Math.cos((nx - 34.5 + seed2) * 76.4)) * 
                         actualDetail * Math.pow(jaggednessFactor, 3) * 0.2 / 3;
        }
        
        noiseSum += ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 
                    jaggednessFactor * jaggednessFactor * 0.12;

        const poleAttenuation = 1.0 - Math.pow(Math.abs(ny), 4.0);
        let effectiveNoise = noiseSum * poleAttenuation;
        let displacement = 1.0 + effectiveNoise;
        displacement = Math.max(0.75, displacement);

        const finalRadius = actualSize * displacement;
        vertices[i * 3] = nx * finalRadius * actualXScale;
        vertices[i * 3 + 1] = ny * finalRadius * actualYScale;
        vertices[i * 3 + 2] = nz * finalRadius;
    }
    
    newRockGeometry.attributes.position.needsUpdate = true;
    newRockGeometry.computeVertexNormals();
    return newRockGeometry;
}

// Load custom rock data or use defaults
loadCustomRockData();

// Generate custom rock geometry
let rockGeometry = generateCustomRockGeometry(customRockParams, currentRockType);

// Procedural normal map for roughness (uses snoise3 defined above)
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
    ctx.fillStyle = `rgb(${shade},${shade},255)`; // Blue channel for normal map convention
    ctx.fillRect(x, y, 1, 1);
  }
}
const normalMap = new THREE.CanvasTexture(normalCanvas);
normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;

// Create custom rock material
const rockPreset = rockPresets[currentRockType] || rockPresets.granite; // Fallback
let rockMaterial = new THREE.MeshStandardMaterial({
  color: rockPreset.color,
  roughness: rockPreset.roughness,
  metalness: rockPreset.metalness,
  flatShading: false,
  normalMap: normalMap,
  normalScale: new THREE.Vector2(1.2, 1.2),
});

// Create rock mesh (rock is already declared globally via 'let rock;' at the top of the module by Three.js examples style, or should be)
// If 'rock' is not declared globally, uncomment the line below:
// let rock;
rock = new THREE.Mesh(rockGeometry, rockMaterial);
rock.castShadow = true;
rock.receiveShadow = true;
scene.add(rock);

// Function to store the initial state of the rock for reset
function storeInitialRockState() {
    initialRockParams = JSON.parse(JSON.stringify(customRockParams)); // Deep copy
    initialRockType = currentRockType;
}
storeInitialRockState(); // Store after the first rock is created

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

// Physics variables for bounce
let groundY = 0; // Will be set dynamically AFTER rock is positioned
// Position the rock so it sits on the ground plane
rock.updateMatrixWorld(); // Ensure world matrix is up to date for boundingBox calculation
const boundingBox = new THREE.Box3().setFromObject(rock);
const groundLevel = ground.position.y;
// The rock's pivot is at its center. We want its bottom (boundingBox.min.y) to be at groundLevel.
// The amount to shift the rock's center (rock.position.y) is groundLevel - boundingBox.min.y.
// However, rock.position.y is relative to its parent (scene origin if not nested).
// The offset from the rock's current origin (likely 0,0,0 initially) to its bottom is boundingBox.min.y (if origin is 0,0,0).
// So, new rock.position.y = groundLevel - boundingBox.min.y (if rock was at origin)
// More robust: current rock's center is rock.position.y. Its world bottom is boundingBox.min.y.
// We want new world bottom to be groundLevel. So, shift needed is groundLevel - boundingBox.min.y.
// rock.position.y += (groundLevel - boundingBox.min.y);
// Let's simplify: the distance from rock's origin to its bottom edge is (rock.position.y - boundingBox.min.y)
rock.position.y = groundLevel - boundingBox.min.y; // Position rock bottom at groundLevel
if (isNaN(rock.position.y) || !isFinite(rock.position.y)) { 
  console.warn('Initial rock.position.y is NaN or Infinity. Setting to 0.'); 
  rock.position.y = 0; 
}
groundY = rock.position.y; // Set groundY for physics

let velocity = 0;
let isBouncing = false;
const gravity = -0.025; // Adjusted for a slightly more pronounced effect
const bounceImpulse = 0.45; // Adjusted for a slightly more pronounced effect

// Animate overlays
function animateOverlay() {
  // console.log('animateOverlay called'); // DEBUG: Check if called
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
  // Fog particles
  if (overlayState.fogParticles.length > 0) {
    // overlayCtx.fillStyle = 'rgba(190, 195, 200, 1)'; // Base color for particles, alpha controlled per particle - Now using gradient
    overlayState.fogParticles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.life--;

      // Fade in/out logic
      const lifeRatio = p.life / p.maxLife;
      if (lifeRatio > 0.8) { // Fade in for first 20% of life
        p.currentAlpha = p.initialAlpha * ((1 - lifeRatio) / 0.2);
      } else if (lifeRatio < 0.2) { // Fade out for last 20% of life
        p.currentAlpha = p.initialAlpha * (lifeRatio / 0.2);
      } else { // Stable alpha for middle 60%
        p.currentAlpha = p.initialAlpha;
      }
      p.currentAlpha = Math.max(0, Math.min(p.initialAlpha, p.currentAlpha)); // Clamp alpha

      // Draw particle
      if (p.currentAlpha > 0) {
        overlayCtx.globalAlpha = p.currentAlpha; // Overall particle opacity

        const gradient = overlayCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        // For dense fog, particles should be more uniformly opaque within their gradient
        gradient.addColorStop(0, 'rgba(170, 172, 175, 0.8)'); // Center of particle (dense fog color, high alpha)
        gradient.addColorStop(0.6, 'rgba(175, 177, 180, 0.5)');
        gradient.addColorStop(1, 'rgba(180, 182, 185, 0)');   // Transparent edge

        overlayCtx.fillStyle = gradient;
        overlayCtx.beginPath();
        overlayCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        overlayCtx.fill();
      }

      // Reset particle if life is over or off-screen
      if (p.life <= 0 || p.x + p.radius < 0 || p.x - p.radius > overlay.width || p.y + p.radius < 0 || p.y - p.radius > overlay.height) {
        p.x = Math.random() * overlay.width;
        p.y = overlay.height * (0.3 + Math.random() * 0.7) + p.radius; // Respawn towards bottom, ensuring on screen
        p.life = p.maxLife * (Math.random() * 0.5 + 0.75); // Reset life, bit varied
        p.currentAlpha = 0; // Start faded out
        p.speedX = (Math.random() - 0.5) * 0.3;
        p.speedY = (Math.random() - 0.5) * 0.1;
      }
    });
    overlayCtx.globalAlpha = 1; // Reset global alpha
  }

  // Clouds animation
  if(overlayState.clouds && overlayState.clouds.length > 0) {
    overlayState.clouds.forEach(cloud => {
      cloud.x += cloud.speed;
      // Wrap around logic for clouds
      if (cloud.speed > 0 && cloud.x - cloud.r > overlay.width) {
        cloud.x = -cloud.r * 2; // Reset to left, considering cloud width (approx r*2 or more)
      } else if (cloud.speed < 0 && cloud.x + cloud.r < 0) {
        cloud.x = overlay.width + cloud.r * 2; // Reset to right
      }
      drawCloud(overlayCtx, cloud.x, cloud.y, cloud.r, cloud.alpha);
    });
  }

  // Lightning
  if (overlayState.lightning && Math.random() < 0.01) {
    drawLightning(overlayCtx);
    // Cloud drawing logic moved before this block
  }
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
  if (overlayState.sunPosition) {
    drawSunIcon(overlayCtx, overlayState.sunPosition.x, overlayState.sunPosition.y, overlayState.sunPosition.r);
  }
  if (overlayState.moonPosition) {
    drawMoonIcon(overlayCtx, overlayState.moonPosition.x, overlayState.moonPosition.y, overlayState.moonPosition.r);
  }
  // Full-screen storm overlay
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

// Placeholder 2D Overlay Drawing Functions
function drawSplash(ctx, x, y, r, alpha) { /* console.log('drawSplash called'); */ }
function drawSnowAccum(ctx) { /* console.log('drawSnowAccum called'); */ }
function drawLightning(ctx) {
  // console.log('[Weather Overlay] drawLightning called - drawing streak');
  const startX = Math.random() * ctx.canvas.width;
  let y = 0;
  const segments = Math.floor(Math.random() * 5) + 5; // 5-9 segments
  let currentX = startX;

  ctx.save();
  ctx.strokeStyle = `rgba(255, 255, 220, ${Math.random() * 0.2 + 0.8})`; // Brighter yellow, more opaque
  ctx.lineWidth = Math.random() * 4 + 3; // Thicker bolt (3px to 7px)
  ctx.beginPath();
  ctx.moveTo(currentX, y);

  for (let i = 0; i < segments; i++) {
    const segmentLength = (ctx.canvas.height / segments) * (Math.random() * 0.5 + 0.5);
    y += segmentLength;
    currentX += (Math.random() - 0.5) * 40; // Jaggedness
    ctx.lineTo(currentX, y);
  }
  ctx.stroke();
  ctx.restore();
}
function drawCloud(ctx, x, y, r, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha; // Apply overall cloud alpha

  const createCloudPartGradient = (cx, cy, cr, baseAlpha, isHorizontalStretch = false) => {
    // For horizontally stretched parts, the gradient might need to be elliptical too, 
    // but for simplicity, we'll use a circular gradient with sharper falloff.
    // A true elliptical gradient isn't directly supported, so we make the circle gradient sharper.
    const gradient = ctx.createRadialGradient(cx, cy, cr * (isHorizontalStretch ? 0.3 : 0.1), cx, cy, cr);
    // Less blurry: sharper transition
    gradient.addColorStop(0, `rgba(240, 242, 245, ${baseAlpha * 0.95})`); // Brighter, more opaque center
    gradient.addColorStop(0.7, `rgba(230, 232, 235, ${baseAlpha * 0.5})`); // Stays opaque longer
    gradient.addColorStop(1, `rgba(220, 222, 225, 0)`);      // Sharper drop to transparent
    return gradient;
  };

  // Main cloud body (center) - make it wider using ellipse or by scaling context
  // Using ellipse for simplicity for the main body
  let mainBodyWidth = r * 1.8; // Make main body wider than it is tall
  let mainBodyHeight = r * 0.9; // Make it a bit flatter
  ctx.fillStyle = createCloudPartGradient(x, y, Math.max(mainBodyWidth, mainBodyHeight) / 2, 0.7, true);
  ctx.beginPath();
  ctx.ellipse(x, y, mainBodyWidth / 2, mainBodyHeight / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Add a few smaller, slightly offset puffs to give it texture and length
  // Puff 1 (left-ish)
  let puffX = x - mainBodyWidth * 0.35;
  let puffY = y + mainBodyHeight * 0.1;
  let puffR = r * 0.55;
  ctx.fillStyle = createCloudPartGradient(puffX, puffY, puffR, 0.65);
  ctx.beginPath();
  ctx.arc(puffX, puffY, puffR, 0, Math.PI * 2);
  ctx.fill();

  // Puff 2 (right-ish)
  puffX = x + mainBodyWidth * 0.35;
  puffY = y - mainBodyHeight * 0.05;
  puffR = r * 0.6;
  ctx.fillStyle = createCloudPartGradient(puffX, puffY, puffR, 0.75);
  ctx.beginPath();
  ctx.arc(puffX, puffY, puffR, 0, Math.PI * 2);
  ctx.fill();
  
  // Puff 3 (farther right, smaller, for more length)
  puffX = x + mainBodyWidth * 0.6;
  puffY = y + mainBodyHeight * 0.15;
  puffR = r * 0.45;
  ctx.fillStyle = createCloudPartGradient(puffX, puffY, puffR, 0.6);
  ctx.beginPath();
  ctx.arc(puffX, puffY, puffR, 0, Math.PI * 2);
  ctx.fill();

  // Puff 4 (top-ish, for some vertical texture)
  puffX = x + mainBodyWidth * 0.05;
  puffY = y - mainBodyHeight * 0.3;
  puffR = r * 0.5;
  ctx.fillStyle = createCloudPartGradient(puffX, puffY, puffR, 0.8);
  ctx.beginPath();
  ctx.arc(puffX, puffY, puffR, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore(); // This also resets globalAlpha
}
function drawRainStreakOverlay(ctx) { console.log('[Weather Overlay] drawRainStreakOverlay called - placeholder'); }
function drawFullScreenSnowOverlay(ctx) { console.log('[Weather Overlay] drawFullScreenSnowOverlay called - placeholder'); }
function drawStormOverlay(ctx) { console.log('[Weather Overlay] drawStormOverlay called - placeholder'); }
function drawFullScreenLightning(ctx) { console.log('[Weather Overlay] drawFullScreenLightning called - placeholder'); }
function drawMoonIcon(ctx, x, y, r) {
  console.log('[Weather Overlay] drawMoonIcon called with:', x, y, r);

  ctx.save();
  ctx.fillStyle = 'rgba(240, 240, 255, 0.9)'; // Pale, slightly bluish white for moon
  ctx.beginPath();
  // Draw main circle for moon
  ctx.arc(x, y, r, 0, 2 * Math.PI, false);
  ctx.fill();

  // Create crescent by overlaying a darker circle (simulating shadow)
  // Offset this circle slightly to the right and make it a bit smaller or same size
  ctx.globalCompositeOperation = 'destination-out'; // This will effectively subtract the new shape
  ctx.beginPath();
  ctx.arc(x - r * 0.4, y - r * 0.2, r * 0.95, 0, 2 * Math.PI, false);
  ctx.fill();
  
  ctx.restore(); // This will also reset globalCompositeOperation to 'source-over'
}

function drawSunIcon(ctx, x, y, r) {
  console.log('[Weather Overlay] drawSunIcon called with:', x, y, r);

  ctx.save();
  ctx.fillStyle = 'rgba(255, 223, 0, 0.8)'; // Sunny yellow
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();

  // Optional: Sun rays
  ctx.strokeStyle = 'rgba(255, 223, 0, 0.6)';
  ctx.lineWidth = r * 0.15;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * 2 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(angle) * r * 1.2, y + Math.sin(angle) * r * 1.2);
    ctx.lineTo(x + Math.cos(angle) * r * 1.7, y + Math.sin(angle) * r * 1.7);
    ctx.stroke();
  }
  ctx.restore();
}

function addRain() {
  console.log('[Weather Effect] addRain called');
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
    let x = (Math.random() - 0.5) * 20; // Spread X from -10 to 10
    let z = (Math.random() - 0.5) * 20; // Spread Z from -10 to 10
    rainPositions.push(x, 4 + Math.random() * 3, z); // Generate rain higher up (Y from 4 to 7)
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
  console.log('[Weather Effect] addSnow called');
  // First layer (existing)
  if (snowParticles) {
    scene.remove(snowParticles);
    snowParticles.geometry.dispose();
    snowParticles.material.dispose();
    snowParticles = null;
  }
  const snowCount = 10000; // Further increased for very dense snowfall
  const snowGeometry = new THREE.BufferGeometry();
  const snowPositions = [];
  for (let i = 0; i < snowCount; i++) {
    let x = (Math.random() - 0.5) * 20; // Spread X from -10 to 10
    let z = (Math.random() - 0.5) * 20; // Spread Z from -10 to 10
    snowPositions.push(x, 4 + Math.random() * 3, z); // Generate snow higher up (Y from 4 to 7)
  }
  snowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(snowPositions, 3));
  const snowflakeTexture = createSnowflakeTexture();
  const snowMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, map: snowflakeTexture, alphaTest: 0.2 }); // Further reduced size
  snowParticles = new THREE.Points(snowGeometry, snowMaterial);
  scene.add(snowParticles);
}

function removeSnow() {
  if (snowParticles) {
    scene.remove(snowParticles);
    snowParticles.geometry.dispose();
    snowParticles.material.dispose();
    snowParticles = null;
  }
}

function addFog() {
  console.log('[Weather Effect] addFog called');
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
  const originalAmbientIntensity = ambientLight.intensity;
  directionalLight.intensity = 4.5; // Increased flash intensity
  ambientLight.intensity *= 2.0; // Boost ambient light too
  thunderFlash = true;
  setTimeout(() => {
    directionalLight.intensity = originalIntensity;
    ambientLight.intensity = originalAmbientIntensity; // Restore ambient light
    thunderFlash = false; // Reset the 2D flash flag shortly after
  }, 100 + Math.random() * 200);
  // Schedule next thunder flash
  thunderTimeout = setTimeout(triggerThunder, 2000 + Math.random() * 3000);
}

function stopThunder() {
  if (thunderTimeout) {
    clearTimeout(thunderTimeout);
    thunderTimeout = null;
    directionalLight.intensity = 0.3; // restore to thunderstorm value
    thunderFlash = false; // Ensure 2D flash is also off
  }
}

// Time simulation variables
let simulatedYears = 0;
let lastTime = 0; // For delta time calculation in animation loop
let yearsPerSecond = 1;
// window._yearsPerSecond = yearsPerSecond; // Keep this if used elsewhere, or remove if setTimeSpeed is the sole controller

function setTimeSpeed(newSpeed) {
  yearsPerSecond = newSpeed;
  window._yearsPerSecond = newSpeed; // Update the underscored version too for now
  console.log(`Time speed set to: ${newSpeed} years/sec`);
  // If we want immediate feedback on the display without waiting for the next animation frame:
  // updateSimYearsDisplay(); // Or, let the animation loop handle it.
}
window.setTimeSpeed = setTimeSpeed;

// Erosion parameters
let baseErosionRate = 0.0000001; // per year
function getWeatherErosionMultiplier() {
  if (overlayState.lightning || overlayState.rainStreaks.length > 0) return 8; // thunderstorm/rain
  if (overlayState.snowAccum) return 4;
  if (overlayState.fogParticles.length > 0) return 1.5;
  return 1;
}

// Erode the rock geometry and scale
function erodeRock(dtYears) {
  // Shrink the rock scale
  const erosion = baseErosionRate * getWeatherErosionMultiplier() * dtYears;
  rock.scale.multiplyScalar(1 - erosion); // Apply erosion to current scale
  // Note: Erosion only affects scale. It does not change the rock's base position or groundY directly.
  // If scale changes significantly, the visual bottom of the rock might change relative to its origin.
  // For true geometric erosion that affects position, the geometry itself would need to be modified.
  // Optionally, smooth the geometry (not implemented for performance)
}

// Update years display
function updateSimYearsDisplay() {
  const el = document.getElementById('sim-years');
  if (el) el.textContent = `Years: ${simulatedYears.toLocaleString(undefined, {maximumFractionDigits:0})}`;
}

// Helper for placing the rock in AR
function onSelect() {
  console.log('[AR Debug Simplified] onSelect triggered.');
  if (arReticle.visible && arDisplayRock) {
    console.log('[AR Debug Simplified] Reticle visible, AR display rock exists. Placing.');
    arDisplayRock.position.setFromMatrixPosition(arReticle.matrix);
    arDisplayRock.position.y += 0.01; // Slight elevation
    arDisplayRock.visible = true;
    arRockPlaced = true; // Use this to track if the AR object is placed
    arReticle.visible = false;
    console.log('[AR Debug Simplified] arDisplayRock placed. Position:', arDisplayRock.position.clone(), 'Visible:', arDisplayRock.visible);
  } else {
    console.log('[AR Debug Simplified] Reticle not visible or arDisplayRock not ready, cannot place.');
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
  console.log('[AR Debug Simplified] Session started.');
  arRockPlaced = false;

  // Hide non-AR elements
  if(rock) rock.visible = false;
  if(ground) ground.visible = false;
  scene.background = null; // Use camera feed as background
  console.log('[AR Debug Simplified] Hid original rock, ground. Set scene background to null.');

  // Create or prepare arDisplayRock (simple green sphere)
  if (!arDisplayRock) {
    const arGeo = new THREE.SphereGeometry(0.1, 32, 32); // Approx 20cm diameter sphere
    const arMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 }); // Solid green
    arDisplayRock = new THREE.Mesh(arGeo, arMat);
    console.log('[AR Debug Simplified] Created arDisplayRock.');
  }
  arDisplayRock.visible = false; // Initially hidden, placed onSelect
  scene.add(arDisplayRock); // Add to scene if not already (or re-add)
  console.log('[AR Debug Simplified] arDisplayRock prepared and added to scene (initially hidden).');
});

renderer.xr.addEventListener('sessionend', () => {
  console.log('[AR Debug Nuke] Session ended. Attempting to restore non-AR scene via full reset.');
  arRockPlaced = false; // Reset AR placement flag

  // Clean up AR-specific display object if it exists and is in the scene
  if (arDisplayRock) {
    if (arDisplayRock.parent) {
        arDisplayRock.parent.remove(arDisplayRock);
    }
    if (arDisplayRock.geometry) arDisplayRock.geometry.dispose();
    if (arDisplayRock.material) arDisplayRock.material.dispose();
    arDisplayRock = null;
    console.log('[AR Debug Nuke] arDisplayRock removed and disposed.');
  }
  
  // Call the grand scene reset function
  reinitializeScene();

  // After reinitializeScene, the main rock, ground, lights, etc., are new instances.
  // The scene background and renderer clear color are set by setWeatherVisuals within reinitializeScene.

  // Attempt to reset XR state on the renderer
  console.log('[AR Debug Nuke] Attempting to reset renderer XR state post-scene-reset.');
  renderer.xr.enabled = false; // Temporarily disable XR
  renderer.xr.enabled = true;  // Re-enable XR (ARButton will manage sessions)

  // Ensure the non-AR animation loop is running with the new scene objects
  if (renderer.xr.isPresenting) {
    console.warn('[AR Debug Nuke] XR is still presenting after sessionend and scene reset, this is unexpected.');
  } else {
    renderer.setAnimationLoop(animate); // Restart the main animation loop
    console.log('[AR Debug Nuke] Main animation loop (animate) re-established for new scene.');
  }

  scene.updateMatrixWorld(true); // Force update of all objects' world matrices
  console.log('[AR Debug Nuke] scene.updateMatrixWorld(true) called post-scene-reset.');
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
    // Apply bounce physics if the rock is bouncing
    if (isBouncing) {
      velocity += gravity; // Apply gravity
      rock.position.y += velocity; // Update position based on velocity

      if (rock.position.y <= groundY) { // Check for collision with ground
        rock.position.y = groundY; // Snap to ground
        isBouncing = false;        // Stop bouncing
        velocity = 0;              // Reset velocity
      }
    }
    // Animate 3D rain particles
    if (rainParticles) {
      const positions = rainParticles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= 0.05; // Adjust speed as needed
        if (positions[i + 1] < -1) { // Reset when below a certain y-level
          positions[i + 1] = 2.5; // Reset to top
        }
      }
      rainParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Animate 3D snow particles
    if (snowParticles) {
      const positions = snowParticles.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] -= 0.015; // Snow falls slower
        // Add some horizontal drift for snow
        positions[i] += (Math.random() - 0.5) * 0.005;
        if (positions[i + 1] < -1) {
          positions[i + 1] = 2.5;
          positions[i] = (Math.random() - 0.5) * 2.5; // Reset x position too
        }
      }
      snowParticles.geometry.attributes.position.needsUpdate = true;
    }

    // Time simulation
    if (lastTime > 0) { // Ensure lastTime is initialized
      const currentTime = timestamp;
      const deltaTime = (currentTime - lastTime) / 1000; // Convert ms to seconds
      simulatedYears += yearsPerSecond * deltaTime;
      updateSimYearsDisplay();
    }
    lastTime = timestamp; // Update lastTime for the next frame

    // ... any other existing code for normal rendering updates ...
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
        console.log('[AR Debug] Hit test successful. Results:', hitTestResults.length);
        const hit = hitTestResults[0];
        arReticle.visible = true;
        arReticle.matrix.fromArray(hit.getPose(renderer.xr.getReferenceSpace()).transform.matrix);
      } else {
        // console.log('[AR Debug] No hit test results.'); // This can be very spammy
        arReticle.visible = false;
      }
    } else if (hitTestSource && arRockPlaced) {
      // console.log('[AR Debug] Hit test source available, but rock already placed.'); // Also spammy
      arReticle.visible = false;
    } else {
      arReticle.visible = false;
    }
  }
  renderer.render(scene, camera);
}

// ARButton is already created and added around line 60 (const arButton = ...).
// Removing redundant creation here.
// document.body.appendChild(ARButton.createButton(renderer, {
//     requiredFeatures: ['hit-test']
// }));

animate();

// Click event for bouncing
renderer.domElement.addEventListener('pointerdown', (event) => {
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
  console.log('[Weather] setWeatherVisuals called with:', weatherOrString);
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
    console.log('[Weather] Processing main condition:', main);
    if (main.includes('cloud')) {
      skyColor = '#a0b6c8'; // Slightly darker blue for cloudy
      groundColor = '#d3c5b0'; // Muted ground for cloudy
      ambientIntensity = 0.6;
      directionalIntensity = 0.5;
    } else if (main.includes('rain')) {
      skyColor = '#6c7883'; // Darker, more muted blue-grey
      groundColor = '#788078'; // Darker, desaturated grey for wet ground
      ambientIntensity = 0.4;
      directionalIntensity = 0.3;
      addRain();
    } else if (main.includes('snow')) {
      skyColor = '#e8edf0'; // Very light, almost white, overcast grey-blue
      groundColor = '#ffffff'; // Pure white for fresh snow
      ambientIntensity = 0.75;
      directionalIntensity = 0.55;
      console.log('[Weather] Calling addSnow()');
      addSnow();
    } else if (main.includes('thunder')) {
      skyColor = '#282c34'; // Very dark, near-black desaturated blue/grey, ominous
      groundColor = '#4a4e58'; // Very dark grey, reflecting heavy shadow and wetness
      ambientIntensity = 0.3;
      directionalIntensity = 0.2;
      addRain();
      triggerThunder();
    } else if (main.includes('mist') || main.includes('fog')) {
      // For very dense fog, sky and ground colors should be very similar to the fog color itself
      skyColor = '#ACAEB0'; // Very light, dense gray
      groundColor = '#A5A7A9'; // Slightly darker dense gray
      ambientIntensity = 0.3; // Reduced ambient light due to dense fog
      directionalIntensity = 0.1; // Reduced directional light
      if (scene.fog) {
        scene.fog.color.set('#A8AAAC'); // Dense fog color, matching sky/ground
        scene.fog.near = 0.5;    // Fog starts very close to camera
        scene.fog.far = 12;   // Visibility limited to ~12 units (approx 20-30ft if 1 unit ~ 2ft)
      } else {
        scene.fog = new THREE.Fog('#A8AAAC', 0.5, 12);
      }
      fogEnabled = true;
      removeRain();
      removeSnow();
      stopThunder();
      // Old addFog() call and related logic removed as 3D fog is now handled directly here,
      // and 2D fog planes are in updateOverlayForWeather/animateOverlay.
    } else { // Default for 'clear' or unknown
      skyColor = '#b7d3e6'; // Standard clear sky blue
      groundColor = '#e0cda9'; // Standard ground color
      ambientIntensity = 0.7;
      directionalIntensity = 0.8;
    }
  }
  // Update scene background color
  scene.background = new THREE.Color(skyColor);
  // Update lighting
  ambientLight.intensity = ambientIntensity;
  directionalLight.intensity = directionalIntensity;
  updateOverlayForWeather(main);
}

// Expose setWeather for dev panel
window.setWeather = (weatherType) => setWeatherVisuals(weatherType);

function updateOverlayForWeather(mainCondition) {
  console.log('[Weather Overlay] Updating for condition:', mainCondition);

  // Reset 2D overlay states
  overlayState.rainStreaks = [];
  overlayState.rainSplashes = [];
  overlayState.sunPosition = null; // Reset sun position
  overlayState.moonPosition = null; // Reset moon position
  overlayState.fogParticles.length = 0; // Clear existing fog particles
  overlayState.lightning = false;
  overlayState.clouds = []; // Clear existing clouds
  overlaySnowflakes.length = 0; // Clear 2D snowflakes by default

  if (!mainCondition) return;

  if (mainCondition.includes('rain') || mainCondition.includes('thunder')) {
    // Add initial rain streaks for 2D overlay
    for (let i = 0; i < 50; i++) { // Example: 50 streaks
      overlayState.rainStreaks.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        len: Math.random() * 20 + 10,
        speed: Math.random() * 5 + 5
      });
    }
    console.log('[Weather Overlay] Added 2D rain streaks.');
  }

  if (mainCondition.includes('thunder')) {
    overlayState.lightning = true; // Enable lightning flashes in animateOverlay
    console.log('[Weather Overlay] Enabled 2D lightning.');
  }

  if (mainCondition.includes('snow')) {
    // For snow, 2D accumulation might be more complex or handled differently.
    // For now, let's just log it. We can add 2D falling flakes later if desired.
    overlayState.snowAccum = true; // Placeholder for potential 2D snow accumulation effect
    console.log('[Weather Overlay] Set snow accumulation state (placeholder).');
    // Add some 2D snowflakes
    for (let i = 0; i < 100; i++) { // Example: 100 snowflakes
      overlaySnowflakes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 2 + 1, // radius
        speed: Math.random() * 0.5 + 0.2, // fall speed
        drift: (Math.random() - 0.5) * 0.5, // horizontal drift
        phase: Math.random() * Math.PI * 2 // for sine wave drift
      });
    }
    console.log('[Weather Overlay] Added 2D snowflakes to overlaySnowflakes array.');
  }

  if (mainCondition.includes('fog') || mainCondition.includes('mist')) {
    // Add fog particles for a more natural look - Denser for heavy fog
    const numFogParticles = 400; // Increased for density
    for (let i = 0; i < numFogParticles; i++) {
      const life = Math.random() * 250 + 150; // Slightly shorter lifetime for more churn
      overlayState.fogParticles.push({
        x: Math.random() * window.innerWidth,
        y: window.innerHeight * (0.1 + Math.random() * 0.9) + (Math.random() * 20 + 30), // Spread more across the screen vertically
        radius: Math.random() * 50 + 30, // Radius: 30px to 80px (larger particles)
        initialAlpha: Math.random() * 0.15 + 0.05, // Max alpha: 0.05 to 0.20 (more opaque)
        currentAlpha: 0,
        speedX: (Math.random() - 0.5) * 0.2, // Even slower horizontal drift
        speedY: (Math.random() - 0.5) * 0.05, // Even slower vertical drift
        life: life,
        maxLife: life,
        phase: Math.random() * Math.PI * 2 // For subtle cyclical variations
      });
    }
    console.log('[Weather Overlay] Added 2D fog particles.');
  }
  
  if (mainCondition.includes('cloud')) {
    // Add some clouds, ensuring they are at the top
    const numClouds = Math.floor(Math.random() * 3) + 3; // 3-5 clouds
    for (let i = 0; i < numClouds; i++) {
      const cloudRadius = Math.random() * 20 + 40; // Radius 40-60px
      overlayState.clouds.push({
        x: Math.random() * window.innerWidth,
        // Position clouds higher, ensuring they are fully visible given their radius
        y: (window.innerHeight * (Math.random() * 0.05 + 0.02)) + cloudRadius, // Top 2-7% of screen + radius
        r: cloudRadius, 
        alpha: Math.random() * 0.3 + 0.5, // Opacity 0.5-0.8 (overall cloud alpha, gradient handles internal)

        speed: (Math.random() * 0.5 + 0.2) * (Math.random() < 0.5 ? 1 : -1) // Speed 0.2-0.7, random direction
      });
    }
    // Sort clouds by y then by r to give a slight parallax / layering if desired (optional)
    overlayState.clouds.sort((a, b) => (a.y - a.r) - (b.y - b.r) || a.r - b.r);
    console.log('[Weather Overlay] Added 2D clouds.');
  }

  if (mainCondition === 'Clear') {
    if (isDayTime) {
      overlayState.sunPosition = { x: 50, y: 50, r: 30 }; // Top-left
      console.log('[Weather Overlay] Set sun position for clear day.');
    } else { // Clear night
      overlayState.moonPosition = { x: 50, y: 50, r: 25 }; // Top-left, moon radius 25
      console.log('[Weather Overlay] Set moon position for clear night.');
    }
  }
  // The following was part of the broken cloud/clear logic, ensure it's removed or correctly placed.
  // If it was intended for clouds, it's now handled above.
  // If it was for sun/moon, it's also handled above.
  // r: 30
    // Stray characters removed here
    // Cloud logic handled above
  // Clear sky logic (sun/moon) handled above

  // Other conditions like 'clear' (if not day/night specific) will just have the reset (empty) overlayState.
}

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

// Set initial weather to clear before attempting geolocation
setWeatherVisuals('clear');

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

function resetRock() {
  console.log('Resetting rock to initial custom/default state...');
  if (rock) {
    scene.remove(rock);
    if (rock.geometry) rock.geometry.dispose();
    if (rock.material) {
      // Assuming normalMap is shared and managed elsewhere or re-created if needed
      // If normalMap was specific to this material instance and needs disposal:
      // if (rock.material.normalMap) rock.material.normalMap.dispose();
      rock.material.dispose();
    }
  }

  // Use the stored initial parameters to regenerate the rock
  customRockParams = JSON.parse(JSON.stringify(initialRockParams));
  currentRockType = initialRockType;

  rockGeometry = generateCustomRockGeometry(customRockParams, currentRockType);
  
  const preset = rockPresets[currentRockType] || rockPresets.granite;
  // Re-use the global normalMap, assuming it's not parameter-dependent for reset
  rockMaterial = new THREE.MeshStandardMaterial({
    color: preset.color,
    roughness: preset.roughness,
    metalness: preset.metalness,
    flatShading: false,
    normalMap: normalMap, // Re-use existing global normalMap
    normalScale: new THREE.Vector2(1.2, 1.2),
  });

  rock = new THREE.Mesh(rockGeometry, rockMaterial);
  rock.castShadow = true;
  rock.receiveShadow = true;
  scene.add(rock);

  // Re-place on ground
  rock.updateMatrixWorld();
  const boundingBox = new THREE.Box3().setFromObject(rock);
  const groundLevel = ground.position.y;
  rock.position.y = groundLevel - boundingBox.min.y;
  groundY = rock.position.y; // Update groundY for physics after rock is placed

  // Reset physics state
  velocity = 0;
  isBouncing = false;
  simulatedYears = 0; // Reset erosion
  updateSimYearsDisplay();
  if (snowCap && scene.children.includes(snowCap)) scene.remove(snowCap); // Remove snow cap
  
  // Reset AR placement state if needed for consistency
  arRockPlaced = false; 
  if(arReticle) arReticle.visible = true; 

  console.log('Rock reset to initial custom/default state.');
};