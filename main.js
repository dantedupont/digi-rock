import * as THREE from 'three';

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
renderer.setClearColor(0x87ceeb); // fallback color
const canvas = renderer.domElement;
canvas.style.background = 'linear-gradient(to top, #e0cda9 0%, #b7d3e6 100%)';
document.getElementById('app').appendChild(renderer.domElement);

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

// Animation loop for physics
function animate() {
  requestAnimationFrame(animate);

  if (isBouncing) {
    velocity += gravity;
    rock.position.y += velocity;
    if (rock.position.y <= groundY) {
      rock.position.y = groundY;
      if (Math.abs(velocity) > 0.08) {
        velocity = -velocity * 0.45; // Lose energy on bounce
      } else {
        velocity = 0;
        isBouncing = false;
      }
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