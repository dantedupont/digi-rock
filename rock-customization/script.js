// Scene setup
let scene, camera, renderer, rock, controls;
let rockMaterial, rockGeometry;

// Simplified rock parameters (1-100 scale)
const rockParams = {
    size: 50,
    xScale: 50,
    yScale: 50,
    smoothness: 80,  // 80 = smooth by default
    surfaceDetail: 50
};

// Rock material presets with realistic colors and properties
const rockPresets = {
    granite: {
        color: 0x8b7355,
        roughness: 0.7,
        metalness: 0.1,
        name: "Granite"
    },
    marble: {
        color: 0xf5f5dc,
        roughness: 0.3,
        metalness: 0.05,
        name: "Marble"
    },
    sandstone: {
        color: 0xD2B48C, // More natural Tan/Earthy color
        roughness: 0.8,
        metalness: 0.05,
        name: "Sandstone"
    },
    limestone: {
        color: 0xb0a4b8, // Light purple-grey
        roughness: 0.65,
        metalness: 0.05,
        name: "Limestone"
    },
    slate: {
        color: 0x6A737D, // Medium-dark gray with slight blueish tint
        roughness: 0.6,
        metalness: 0.05,
        name: "Slate"
    },
    basalt: {
        color: 0x36454f,
        roughness: 0.9,
        metalness: 0.02,
        name: "Basalt"
    },
    quartzite: {
        color: 0xf0f8ff,
        roughness: 0.5,
        metalness: 0.15,
        name: "Quartzite"
    },
    obsidian: {
        color: 0x1c1c1c,
        roughness: 0.1,
        metalness: 0.3,
        name: "Obsidian"
    }
};

let currentRockType = 'granite';

// Initialize the 3D scene
function init() {
    console.log('Initializing 3D scene...');
    
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 0, 5);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    const container = document.getElementById('container');
    if (container) {
        container.appendChild(renderer.domElement);
    } else {
        document.body.appendChild(renderer.domElement);
    }

    // Setup orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Setup lighting
    setupLighting();
    
    // Create initial rock
    createRock();
    
    // Setup UI controls
    setupControls();
    
    // Handle window resize
    window.addEventListener('resize', onWindowResize);
    
    // Start animation loop
    animate();
    
    console.log('Initialization complete!');
}

function setupLighting() {
    // Bright, consistent lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(10, 10, 5);
    directionalLight1.castShadow = true;
    directionalLight1.shadow.mapSize.width = 2048;
    directionalLight1.shadow.mapSize.height = 2048;
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-10, -10, -5);
    scene.add(directionalLight2);

    const pointLight = new THREE.PointLight(0xffffff, 0.5);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);
}

function createRock() {
    // Remove existing rock if it exists
    if (rock) {
        scene.remove(rock);
        if (rockGeometry) rockGeometry.dispose();
        if (rockMaterial) rockMaterial.dispose();
    }

    // Convert 1-100 scale to actual values
    const actualSize = (rockParams.size / 100) * 2.5 + 0.5; // 0.5 to 3.0
    const actualXScale = (rockParams.xScale / 100) * 1.7 + 0.3; // 0.3 to 2.0
    const actualYScale = (rockParams.yScale / 100) * 1.7 + 0.3; // 0.3 to 2.0
    const actualSmoothness = rockParams.smoothness / 100; // 0 to 1
    const actualDetail = rockParams.surfaceDetail / 100; // 0 to 1

    // Create base geometry with high resolution for smooth appearance
    rockGeometry = new THREE.SphereGeometry(1, 128, 128);
    
    // Get vertex positions
    const vertices = rockGeometry.attributes.position.array;
    const vertexCount = vertices.length / 3;
    
    // Generate natural rock shape - smoothness controls jaggedness
    for (let i = 0; i < vertexCount; i++) {
        const x = vertices[i * 3];
        const y = vertices[i * 3 + 1];
        const z = vertices[i * 3 + 2];
        
        // Normalize to get direction
        const length = Math.sqrt(x * x + y * y + z * z);
        const nx = x / length;
        const ny = y / length;
        const nz = z / length;
        
        // Start with base sphere
        // Smoothness: 1 = completely jagged, 100 = completely smooth
        const smoothnessFactor = actualSmoothness; // 0 to 1
        const jaggednessFactor = 1 - smoothnessFactor; // 1 to 0
        
        // Use different noise seeds to avoid regular patterns
        const seed1 = 12.34;
        const seed2 = 56.78;
        const seed3 = 90.12;
        const seed4 = 34.56;
        const seed5 = 78.90;
        const seed6 = 1.23;

        let noiseSum = 0.0;
        
        // Natural organic variation using multiple offset noise layers
        noiseSum += (Math.sin((nx + 17.3 + seed1) * 3.7) * Math.cos((ny - 8.1 + seed2) * 3.1) + 
                     Math.sin((ny + 23.5 + seed3) * 2.9) * Math.cos((nz - 12.9 + seed4) * 3.3) + 
                     Math.sin((nz + 5.7 + seed5) * 3.5) * Math.cos((nx - 19.2 + seed6) * 2.7)) * 
                     (0.12 + jaggednessFactor * 0.45) / 3;
        
        // Medium-scale natural variation with different frequencies
        noiseSum += (Math.sin((nx - 11.8 + seed4) * 7.2) * Math.cos((ny + 31.1 + seed5) * 6.8) + 
                     Math.sin((ny - 5.4 + seed6) * 6.5) * Math.cos((nz + 27.6 + seed1) * 7.1)) * 
                     actualDetail * (0.08 + jaggednessFactor * 0.25) / 2;
        
        // Fine detail with organic randomness - much more intense when jagged
        if (jaggednessFactor > 0.1) {
            noiseSum += (Math.sin((nx + 3.9 + seed2) * 15.7) * Math.cos((ny - 22.4 + seed3) * 14.3) + 
                         Math.sin((ny + 14.2 + seed4) * 16.1) * Math.cos((nz - 7.8 + seed5) * 15.9) + 
                         Math.sin((nz + 33.1 + seed6) * 14.7) * Math.cos((nx - 1.5 + seed1) * 15.3)) * 
                         actualDetail * jaggednessFactor * 0.18 / 3;
        }
        
        // Very fine chaotic detail for extreme jaggedness - much more dramatic
        if (jaggednessFactor > 0.3) {
            noiseSum += (Math.sin((nx - 25.6 + seed5) * 32.1) * Math.cos((ny + 9.3 + seed6) * 31.7) + 
                         Math.sin((ny - 18.7 + seed1) * 33.3) * Math.cos((nz + 2.4 + seed2) * 32.9)) * 
                         actualDetail * jaggednessFactor * jaggednessFactor * 0.15 / 2;
        }
        
        // Ultra-chaotic detail for maximum jaggedness at very low smoothness
        if (jaggednessFactor > 0.7) {
            noiseSum += (Math.sin((nx + 13.1 + seed3) * 64.3) * Math.cos((ny - 28.9 + seed4) * 67.1) + 
                         Math.sin((ny + 2.7 + seed5) * 71.7) * Math.cos((nz - 15.3 + seed6) * 59.3) + 
                         Math.sin((nz + 20.8 + seed1) * 83.9) * Math.cos((nx - 34.5 + seed2) * 76.4)) * 
                         actualDetail * Math.pow(jaggednessFactor, 3) * 0.2 / 3;
        }
        
        // Natural random variation with much higher intensity for jagged rocks
        noiseSum += ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 
                    jaggednessFactor * jaggednessFactor * 0.12;

        // Calculate pole attenuation factor (Math.abs(ny) is 0 at equator, 1 at poles)
        // Power of 4.0 for a strong falloff near poles, reducing noise displacement there.
        const poleAttenuation = 1.0 - Math.pow(Math.abs(ny), 4.0);
        let effectiveNoise = noiseSum * poleAttenuation;

        // Start with base displacement (1.0) and add attenuated noise
        let displacement = 1.0 + effectiveNoise;
        
        // Ensure displacement doesn't go below a threshold to prevent inward collapse
        displacement = Math.max(0.75, displacement); // Clamp to prevent divots

        // Apply displacement with scaling
        const finalRadius = actualSize * displacement;
        vertices[i * 3] = nx * finalRadius * actualXScale;
        vertices[i * 3 + 1] = ny * finalRadius * actualYScale;
        vertices[i * 3 + 2] = nz * finalRadius;
    }
    
    // Update geometry
    rockGeometry.attributes.position.needsUpdate = true;
    rockGeometry.computeVertexNormals();

    // Create natural rock material
    const rockPreset = rockPresets[currentRockType];
    rockMaterial = new THREE.MeshStandardMaterial({
        color: rockPreset.color,
        roughness: rockPreset.roughness,
        metalness: rockPreset.metalness,
        normalScale: new THREE.Vector2(1, 1)
    });

    // Create mesh
    rock = new THREE.Mesh(rockGeometry, rockMaterial);
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
}

function setupControls() {
    console.log('Setting up controls...');
    
    // Setup all slider/input pairs
    const sliders = ['size', 'xScale', 'yScale', 'smoothness', 'surfaceDetail'];
    sliders.forEach(sliderId => {
        console.log(`Setting up slider: ${sliderId}`);
        
        // Initialize slider and input values from rockParams
        const slider = document.getElementById(sliderId);
        const input = document.getElementById(sliderId + '-value');
        
        if (slider && input) {
            // Set initial values
            slider.value = rockParams[sliderId];
            input.value = rockParams[sliderId];
            
            // Setup synchronization
            syncSliderAndInput(sliderId);
            console.log(`✓ Successfully set up ${sliderId}`);
        } else {
            console.error(`✗ Failed to find elements for ${sliderId}`, { slider, input });
        }
    });

    // Rock type dropdown
    const rockTypeSelect = document.getElementById('rockType');
    if (rockTypeSelect) {
        rockTypeSelect.onchange = function() {
            currentRockType = this.value;
            console.log(`Changed rock type to: ${currentRockType}`);
            createRock();
        };
    }

    // Randomize button
    const randomizeBtn = document.getElementById('randomize');
    if (randomizeBtn) {
        randomizeBtn.addEventListener('click', () => {
            console.log('Randomizing rock...');
            randomizeRock();
        });
    }

    // Reset camera button
    const resetBtn = document.getElementById('resetCamera');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            console.log('Resetting camera...');
            camera.position.set(0, 0, 5);
            controls.reset();
        });
    }
    
    // Finalize Rock button
    const finalizeBtn = document.getElementById('finalizeRock');
    if (finalizeBtn) {
        finalizeBtn.addEventListener('click', () => {
            console.log('Finalizing rock and saving to localStorage...');
            try {
                localStorage.setItem('customRockParams', JSON.stringify(rockParams));
                localStorage.setItem('customRockType', currentRockType);
                console.log('Rock parameters saved:', rockParams);
                console.log('Rock type saved:', currentRockType);
                // Redirect to the main scene page (assuming it's index.html in the parent directory)
                window.location.href = '../index.html'; 
            } catch (error) {
                console.error('Error saving to localStorage:', error);
                alert('Could not save rock settings. Please ensure localStorage is enabled and not full.');
            }
        });
    }

    console.log('Controls setup complete!');
}

function syncSliderAndInput(sliderId) {
    const slider = document.getElementById(sliderId);
    const input = document.getElementById(sliderId + '-value');
    
    if (!slider || !input) {
        console.error(`Slider or input not found for: ${sliderId}`);
        return;
    }
    
    console.log(`Syncing ${sliderId} - slider:`, slider.value, 'input:', input.value, 'param:', rockParams[sliderId]);
    
    // Simple, direct event listeners that actually work
    slider.oninput = function() {
        const value = parseInt(this.value);
        input.value = value;
        rockParams[sliderId] = value;
        console.log(`Slider ${sliderId}: ${value}`);
        updateRock(sliderId);
    };
    
    input.oninput = function() {
        let value = parseInt(this.value);
        value = Math.max(1, Math.min(100, value || 1));
        this.value = value;
        slider.value = value;
        rockParams[sliderId] = value;
        console.log(`Input ${sliderId}: ${value}`);
        updateRock(sliderId);
    };
    
    input.onblur = function() {
        let value = parseInt(this.value);
        value = Math.max(1, Math.min(100, value || 1));
        this.value = value;
        slider.value = value;
        rockParams[sliderId] = value;
        updateRock(sliderId);
    };
}

function updateRock(paramName) {
    console.log(`Updating rock for parameter: ${paramName}`);
    // Always regenerate the entire rock for simplicity and consistency
    createRock();
}

function randomizeRock() {
    console.log('Randomizing all parameters including rock type...');

    // Randomize Rock Type
    const rockTypeKeys = Object.keys(rockPresets);
    const randomRockTypeKey = rockTypeKeys[Math.floor(Math.random() * rockTypeKeys.length)];
    currentRockType = randomRockTypeKey;
    
    const rockTypeSelect = document.getElementById('rockType');
    if (rockTypeSelect) {
        rockTypeSelect.value = currentRockType;
        console.log(`Randomly selected rock type: ${currentRockType}`);
    }

    // Generate random values for all slider parameters
    rockParams.size = Math.floor(Math.random() * 100) + 1;
    rockParams.xScale = Math.floor(Math.random() * 100) + 1;
    rockParams.yScale = Math.floor(Math.random() * 100) + 1;
    rockParams.smoothness = Math.floor(Math.random() * 100) + 1;
    rockParams.surfaceDetail = Math.floor(Math.random() * 100) + 1;
    
    // Update all sliders and inputs to reflect new values
    Object.keys(rockParams).forEach(param => {
        const slider = document.getElementById(param);
        const input = document.getElementById(param + '-value');
        
        if (slider && input) {
            slider.value = rockParams[param];
            input.value = rockParams[param];
            console.log(`Updated ${param} to ${rockParams[param]}`);
        }
    });
    
    // Regenerate the rock with new parameters and rock type
    createRock();
    console.log('Randomization complete!');
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    
    controls.update();
    renderer.render(scene, camera);
}

// Initialize when page loads
window.addEventListener('load', init);
