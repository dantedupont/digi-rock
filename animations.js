import * as THREE from 'three';

export class AnimationManager {
    constructor(scene, rock, overlay) {
        this.scene = scene;
        this.rock = rock;
        this.overlay = overlay;
        this.overlayCtx = overlay.getContext('2d');

        // Animation state
        this.velocity = 0;
        this.isBouncing = false;
        this.gravity = -0.025;
        this.bounceImpulse = 0.32;
        this.groundY = 0;
        this.initialGroundY = 0;

        // Weather effects
        this.rainParticles = null;
        this.snowParticles = null;
        this.snowParticles2 = null;
        this.fogEnabled = false;
        this.thunderTimeout = null;
        this.snowCap = null;
        this.snowCapTimeout = null;
        this.wasRockAtRest = true;

        // Overlay state
        this.overlayState = {
            rainStreaks: [],
            rainSplashes: [],
            snowAccum: false,
            fogPlanes: [],
            lightning: false,
            clouds: [],
            desaturate: false,
            shake: 0,
            sun: false
        };

        // Full-screen 2D snowflake overlay state
        this.overlaySnowflakes = [];
    }

    // Initialize overlay snowflakes
    initOverlaySnowflakes() {
        this.overlaySnowflakes = [];
        for (let i = 0; i < 320; i++) {
            this.overlaySnowflakes.push({
                x: Math.random() * this.overlay.width,
                y: Math.random() * this.overlay.height,
                r: 1.5 + Math.random() * 3.5,
                speed: 1.2 + Math.random() * 2.2,
                drift: (Math.random() - 0.5) * 1.2,
                phase: Math.random() * Math.PI * 2
            });
        }
    }

    // Update animations
    update(dt) {
        this.updateBouncing();
        this.updateParticles();
        this.animateOverlay();
    }

    // Update bouncing physics
    updateBouncing() {
        if (this.isBouncing) {
            this.velocity += this.gravity;
            this.rock.position.y += this.velocity;
            if (this.rock.position.y <= this.groundY) {
                this.rock.position.y = this.groundY;
                this.velocity = 0;
                this.isBouncing = false;
            }
        }
    }

    // Update all particle systems
    updateParticles() {
        this.updateRainParticles();
        this.updateSnowParticles();
        this.updateSnowParticles2();
    }

    // Update rain particles
    updateRainParticles() {
        if (this.rainParticles) {
            const positions = this.rainParticles.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                positions.array[i * 3 + 1] -= 0.08 + Math.random() * 0.04;
                if (positions.array[i * 3 + 1] < 0) {
                    positions.array[i * 3 + 1] = 2.5;
                }
            }
            positions.needsUpdate = true;
        }
    }

    // Update first layer of snow particles
    updateSnowParticles() {
        if (this.snowParticles) {
            const positions = this.snowParticles.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                positions.array[i * 3 + 1] -= 0.015 + Math.random() * 0.01;
                positions.array[i * 3] += (Math.random() - 0.5) * 0.01;
                if (positions.array[i * 3 + 1] < 0) {
                    positions.array[i * 3 + 1] = 2.5;
                }
            }
            positions.needsUpdate = true;
        }
    }

    // Update second layer of snow particles
    updateSnowParticles2() {
        if (this.snowParticles2) {
            const positions = this.snowParticles2.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                positions.array[i * 3 + 1] -= 0.008 + Math.random() * 0.008;
                positions.array[i * 3] += (Math.random() - 0.5) * 0.008;
                if (positions.array[i * 3 + 1] < 0) {
                    positions.array[i * 3 + 1] = 2.5;
                }
            }
            positions.needsUpdate = true;
        }
    }

    // Animate overlay effects
    animateOverlay() {
        this.overlayCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);
        
        // Draw rain streaks
        this.drawRainStreaks();
        
        // Draw rain splashes
        this.drawRainSplashes();
        
        // Draw snow accumulation
        if (this.overlayState.snowAccum) {
            this.drawSnowAccumulation();
        }
        
        // Draw fog planes
        this.drawFogPlanes();
        
        // Draw lightning
        if (this.overlayState.lightning) {
            this.drawLightning();
        }
        
        // Draw clouds
        this.drawClouds();
        
        // Draw full-screen effects
        this.drawFullScreenEffects();
    }

    // Draw rain streaks
    drawRainStreaks() {
        this.overlayState.rainStreaks.forEach(streak => {
            this.overlayCtx.save();
            this.overlayCtx.globalAlpha = 0.22;
            this.overlayCtx.strokeStyle = '#b7d3e6';
            this.overlayCtx.lineWidth = 2;
            this.overlayCtx.beginPath();
            this.overlayCtx.moveTo(streak.x, streak.y);
            this.overlayCtx.lineTo(streak.x, streak.y + streak.len);
            this.overlayCtx.stroke();
            this.overlayCtx.restore();
            
            streak.y += streak.speed;
            if (streak.y > this.overlay.height) {
                streak.y = -streak.len;
            }
        });
    }

    // Draw rain splashes
    drawRainSplashes() {
        this.overlayState.rainSplashes.forEach(splash => {
            this.overlayCtx.save();
            this.overlayCtx.globalAlpha = splash.alpha * Math.abs(Math.sin(performance.now() / 400 + splash.t));
            this.overlayCtx.beginPath();
            this.overlayCtx.arc(splash.x, splash.y, splash.r, 0, 2 * Math.PI);
            this.overlayCtx.strokeStyle = '#b7d3e6';
            this.overlayCtx.lineWidth = 2;
            this.overlayCtx.stroke();
            this.overlayCtx.restore();
        });
    }

    // Draw snow accumulation
    drawSnowAccumulation() {
        this.overlayCtx.save();
        this.overlayCtx.globalAlpha = 0.25;
        this.overlayCtx.fillStyle = '#fff';
        this.overlayCtx.fillRect(0, this.overlay.height * 0.85, this.overlay.width, this.overlay.height * 0.15);
        this.overlayCtx.restore();
    }

    // Draw fog planes
    drawFogPlanes() {
        this.overlayState.fogPlanes.forEach(fog => {
            this.overlayCtx.save();
            this.overlayCtx.globalAlpha = fog.alpha;
            this.overlayCtx.fillStyle = '#fff';
            this.overlayCtx.fillRect(0, fog.y, this.overlay.width, this.overlay.height * 0.1);
            this.overlayCtx.restore();
        });
    }

    // Draw lightning
    drawLightning() {
        if (Math.random() < 0.01) {
            this.overlayCtx.save();
            this.overlayCtx.globalAlpha = 0.7;
            this.overlayCtx.strokeStyle = '#fff';
            this.overlayCtx.lineWidth = 4;
            this.overlayCtx.beginPath();
            let x = this.overlay.width * (0.3 + 0.4 * Math.random());
            let y = 0;
            this.overlayCtx.moveTo(x, y);
            for (let i = 0; i < 8; i++) {
                x += (Math.random() - 0.5) * 40;
                y += this.overlay.height / 10;
                this.overlayCtx.lineTo(x, y);
            }
            this.overlayCtx.stroke();
            this.overlayCtx.restore();
        }
    }

    // Draw clouds
    drawClouds() {
        this.overlayState.clouds.forEach(cloud => {
            this.overlayCtx.save();
            this.overlayCtx.globalAlpha = cloud.alpha;
            this.overlayCtx.fillStyle = '#fff';
            this.overlayCtx.beginPath();
            this.overlayCtx.ellipse(cloud.x, cloud.y, cloud.r * 1.2, cloud.r, 0, 0, 2 * Math.PI);
            this.overlayCtx.ellipse(cloud.x + cloud.r, cloud.y, cloud.r, cloud.r * 0.8, 0, 0, 2 * Math.PI);
            this.overlayCtx.ellipse(cloud.x - cloud.r, cloud.y, cloud.r, cloud.r * 0.8, 0, 0, 2 * Math.PI);
            this.overlayCtx.fill();
            this.overlayCtx.restore();
            
            cloud.x += cloud.speed;
            if (cloud.x - cloud.r > this.overlay.width) {
                cloud.x = -cloud.r;
            }
        });
    }

    // Draw full-screen effects
    drawFullScreenEffects() {
        // Full-screen rain overlay
        if (this.overlayState.rainStreaks.length > 0) {
            this.drawFullScreenRain();
        }
        
        // Full-screen snow overlay
        if (this.overlayState.snowAccum) {
            this.drawFullScreenSnow();
        }
        
        // Full-screen lightning flash
        if (this.overlayState.lightning) {
            this.drawFullScreenLightning();
        }
        
        // Full-screen 2D snowflakes
        if (this.overlayState.snowAccum && this.overlaySnowflakes.length > 0) {
            this.drawFullScreenSnowflakes();
        }
        
        // Sun icon
        if (this.overlayState.sun) {
            this.drawSunIcon();
        }
    }

    // Draw full-screen rain
    drawFullScreenRain() {
        for (let i = 0; i < 120; i++) {
            const x = Math.random() * this.overlay.width;
            const y = Math.random() * this.overlay.height;
            const len = 40 + Math.random() * 60;
            this.overlayCtx.save();
            this.overlayCtx.globalAlpha = 0.10 + Math.random() * 0.08;
            this.overlayCtx.strokeStyle = '#b7d3e6';
            this.overlayCtx.lineWidth = 1.5 + Math.random();
            this.overlayCtx.beginPath();
            this.overlayCtx.moveTo(x, y);
            this.overlayCtx.lineTo(x, y + len);
            this.overlayCtx.stroke();
            this.overlayCtx.restore();
        }
    }

    // Draw full-screen snow
    drawFullScreenSnow() {
        for (let i = 0; i < 24; i++) {
            const x = (performance.now() / 12 + i * 120) % this.overlay.width;
            const y = this.overlay.height * 0.1 + Math.sin(performance.now() / 600 + i) * 60;
            this.overlayCtx.save();
            this.overlayCtx.globalAlpha = 0.06 + Math.random() * 0.06;
            this.overlayCtx.beginPath();
            this.overlayCtx.ellipse(x, y, 120, 28, 0, 0, 2 * Math.PI);
            this.overlayCtx.fillStyle = '#fff';
            this.overlayCtx.fill();
            this.overlayCtx.restore();
        }
    }

    // Draw full-screen lightning
    drawFullScreenLightning() {
        for (let bolt = 0; bolt < 3 + Math.floor(Math.random() * 2); bolt++) {
            this.overlayCtx.save();
            this.overlayCtx.globalAlpha = 0.38 + Math.random() * 0.32;
            this.overlayCtx.strokeStyle = '#fff';
            this.overlayCtx.lineWidth = 4 + Math.random() * 2;
            this.overlayCtx.beginPath();
            let x = this.overlay.width * (0.2 + 0.6 * Math.random());
            let y = 0;
            this.overlayCtx.moveTo(x, y);
            for (let i = 0; i < 8; i++) {
                x += (Math.random() - 0.5) * 40;
                y += this.overlay.height / 10;
                this.overlayCtx.lineTo(x, y);
            }
            this.overlayCtx.stroke();
            this.overlayCtx.restore();
        }
        
        // Add a full-screen white flash
        this.overlayCtx.save();
        this.overlayCtx.globalAlpha = 0.18 + Math.random() * 0.12;
        this.overlayCtx.fillStyle = '#fff';
        this.overlayCtx.fillRect(0, 0, this.overlay.width, this.overlay.height);
        this.overlayCtx.restore();
    }

    // Draw full-screen snowflakes
    drawFullScreenSnowflakes() {
        this.overlayCtx.save();
        this.overlayCtx.fillStyle = '#fff';
        this.overlaySnowflakes.forEach(flake => {
            this.overlayCtx.globalAlpha = 0.22 + Math.random() * 0.22;
            this.overlayCtx.beginPath();
            this.overlayCtx.arc(flake.x, flake.y, flake.r, 0, 2 * Math.PI);
            this.overlayCtx.fill();
            
            // Animate
            flake.y += flake.speed;
            flake.x += Math.sin(performance.now() / 800 + flake.phase) * flake.drift;
            if (flake.y > this.overlay.height) {
                flake.y = -flake.r;
                flake.x = Math.random() * this.overlay.width;
            }
            if (flake.x < -flake.r) flake.x = this.overlay.width + flake.r;
            if (flake.x > this.overlay.width + flake.r) flake.x = -flake.r;
        });
        this.overlayCtx.restore();
    }

    // Draw sun icon
    drawSunIcon() {
        const x = 70;
        const y = 70;
        const r = 32;
        
        this.overlayCtx.save();
        // Sun core
        this.overlayCtx.globalAlpha = 0.92;
        this.overlayCtx.beginPath();
        this.overlayCtx.arc(x, y, r, 0, 2 * Math.PI);
        this.overlayCtx.fillStyle = '#ffe066';
        this.overlayCtx.shadowColor = '#ffe066';
        this.overlayCtx.shadowBlur = 16;
        this.overlayCtx.fill();
        this.overlayCtx.shadowBlur = 0;
        
        // Rays
        this.overlayCtx.strokeStyle = '#ffe066';
        this.overlayCtx.lineWidth = 3;
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            this.overlayCtx.beginPath();
            this.overlayCtx.moveTo(x + Math.cos(angle) * (r + 6), y + Math.sin(angle) * (r + 6));
            this.overlayCtx.lineTo(x + Math.cos(angle) * (r + 18), y + Math.sin(angle) * (r + 18));
            this.overlayCtx.stroke();
        }
        this.overlayCtx.restore();
    }

    // Set weather visuals
    setWeatherVisuals(weatherOrString) {
        // Accept string for dev panel
        let main = null;
        if (typeof weatherOrString === 'string') {
            main = weatherOrString;
            weatherOrString = { weather: [{ main }] };
        } else if (weatherOrString) {
            main = weatherOrString.weather[0].main.toLowerCase();
        }

        // Clean up all existing weather effects
        this.removeRain();
        this.removeSnow();
        this.removeFog();
        this.stopThunder();
        
        // Reset overlay state
        this.overlayState = {
            rainStreaks: [],
            rainSplashes: [],
            snowAccum: false,
            fogPlanes: [],
            lightning: false,
            clouds: [],
            desaturate: false,
            shake: 0,
            sun: false
        };

        // Default: clear sky
        let skyColor = '#b7d3e6';
        let groundColor = '#e0cda9';
        let ambientIntensity = 0.7;
        let directionalIntensity = 0.8;

        if (main) {
            if (main.includes('cloud')) {
                skyColor = '#a0b6c8';
                ambientIntensity = 0.6;
                directionalIntensity = 0.5;
            } else if (main.includes('rain')) {
                skyColor = '#7a8fa3';
                ambientIntensity = 0.5;
                directionalIntensity = 0.4;
                this.addRain();
            } else if (main.includes('snow')) {
                skyColor = '#e6f7ff';
                ambientIntensity = 0.8;
                directionalIntensity = 0.6;
                this.addSnow();
            } else if (main.includes('thunder')) {
                skyColor = '#5a6a7a';
                ambientIntensity = 0.4;
                directionalIntensity = 0.3;
                this.addRain();
                this.triggerThunder();
            } else if (main.includes('mist') || main.includes('fog')) {
                skyColor = '#cfd8dc';
                ambientIntensity = 0.5;
                directionalIntensity = 0.3;
                this.addFog();
            }
        }

        // Update background gradient
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.style.background = `linear-gradient(to top, ${groundColor} 0%, ${skyColor} 100%)`;
        }

        // Update lighting
        const ambientLight = this.scene.getObjectByName('ambientLight');
        const directionalLight = this.scene.getObjectByName('directionalLight');
        
        if (ambientLight) ambientLight.intensity = ambientIntensity;
        if (directionalLight) directionalLight.intensity = directionalIntensity;

        this.updateOverlayForWeather(main);
    }

    // Add rain effect
    addRain() {
        if (this.rainParticles) {
            this.scene.remove(this.rainParticles);
            this.rainParticles.geometry.dispose();
            this.rainParticles.material.dispose();
            this.rainParticles = null;
        }

        const rainCount = 220;
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
        const rainMaterial = new THREE.PointsMaterial({ 
            color: 0xaaaaee, 
            size: 0.05, 
            transparent: true 
        });
        
        this.rainParticles = new THREE.Points(rainGeometry, rainMaterial);
        this.scene.add(this.rainParticles);
    }

    // Remove rain effect
    removeRain() {
        if (this.rainParticles) {
            this.scene.remove(this.rainParticles);
            this.rainParticles.geometry.dispose();
            this.rainParticles.material.dispose();
            this.rainParticles = null;
        }
        this.overlayState.rainStreaks = [];
        this.overlayState.rainSplashes = [];
    }

    // Add snow effect
    addSnow() {
        // First layer
        if (this.snowParticles) {
            this.scene.remove(this.snowParticles);
            this.snowParticles.geometry.dispose();
            this.snowParticles.material.dispose();
            this.snowParticles = null;
        }

        const snowCount = 120;
        const snowGeometry = new THREE.BufferGeometry();
        const snowPositions = [];
        
        for (let i = 0; i < snowCount; i++) {
            let x, z;
            do {
                x = (Math.random() - 0.5) * 2.5;
                z = (Math.random() - 0.5) * 2.5;
            } while (Math.abs(x) < 0.7 && Math.abs(z) < 0.7);
            snowPositions.push(x, Math.random() * 2.5, z);
        }
        
        snowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(snowPositions, 3));
        const snowflakeTexture = this.createSnowflakeTexture();
        const snowMaterial = new THREE.PointsMaterial({ 
            color: 0xffffff, 
            size: 0.13, 
            transparent: true, 
            map: snowflakeTexture, 
            alphaTest: 0.2 
        });
        
        this.snowParticles = new THREE.Points(snowGeometry, snowMaterial);
        this.scene.add(this.snowParticles);

        // Second layer
        if (this.snowParticles2) {
            this.scene.remove(this.snowParticles2);
            this.snowParticles2.geometry.dispose();
            this.snowParticles2.material.dispose();
            this.snowParticles2 = null;
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
        const snowMaterial2 = new THREE.PointsMaterial({ 
            color: 0xffffff, 
            size: 0.22, 
            transparent: true, 
            opacity: 0.7, 
            map: snowflakeTexture, 
            alphaTest: 0.2 
        });
        
        this.snowParticles2 = new THREE.Points(snowGeometry2, snowMaterial2);
        this.scene.add(this.snowParticles2);
    }

    // Remove snow effect
    removeSnow() {
        if (this.snowParticles) {
            this.scene.remove(this.snowParticles);
            this.snowParticles.geometry.dispose();
            this.snowParticles.material.dispose();
            this.snowParticles = null;
        }
        if (this.snowParticles2) {
            this.scene.remove(this.snowParticles2);
            this.snowParticles2.geometry.dispose();
            this.snowParticles2.material.dispose();
            this.snowParticles2 = null;
        }
        this.overlayState.snowAccum = false;
    }

    // Add fog effect
    addFog() {
        if (!this.fogEnabled) {
            this.scene.fog = new THREE.Fog(0xcfd8dc, 2, 7);
            this.fogEnabled = true;
        }
    }

    // Remove fog effect
    removeFog() {
        this.fogEnabled = false;
        this.overlayState.fogPlanes = [];
    }

    // Trigger thunder effect
    triggerThunder() {
        const originalIntensity = this.scene.getObjectByName('directionalLight').intensity;
        this.scene.getObjectByName('directionalLight').intensity = 2.5;
        setTimeout(() => {
            this.scene.getObjectByName('directionalLight').intensity = originalIntensity;
        }, 100 + Math.random() * 200);
        
        this.thunderTimeout = setTimeout(() => this.triggerThunder(), 2000 + Math.random() * 3000);
    }

    // Stop thunder effect
    stopThunder() {
        if (this.thunderTimeout) {
            clearTimeout(this.thunderTimeout);
            this.thunderTimeout = null;
        }
        this.overlayState.lightning = false;
    }

    // Create snowflake texture
    createSnowflakeTexture() {
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

    // Update overlay for weather
    updateOverlayForWeather(main) {
        if (main) {
            if (main.includes('rain')) {
                // Rain streaks
                for (let i = 0; i < 60; i++) {
                    this.overlayState.rainStreaks.push({
                        x: Math.random() * this.overlay.width,
                        y: Math.random() * this.overlay.height,
                        len: 30 + Math.random() * 30,
                        speed: 8 + Math.random() * 4
                    });
                }
                // Rain splashes
                for (let i = 0; i < 10; i++) {
                    this.overlayState.rainSplashes.push({
                        x: Math.random() * this.overlay.width,
                        y: this.overlay.height * 0.85 + Math.random() * this.overlay.height * 0.1,
                        r: 8 + Math.random() * 8,
                        alpha: 0.7 + Math.random() * 0.3,
                        t: Math.random() * 60
                    });
                }
            }
            if (main.includes('snow')) {
                this.overlayState.snowAccum = true;
                this.initOverlaySnowflakes();
            }
            if (main.includes('fog') || main.includes('mist')) {
                this.overlayState.fogPlanes = [
                    { y: this.overlay.height * 0.7, alpha: 0.18 },
                    { y: this.overlay.height * 0.8, alpha: 0.12 },
                    { y: this.overlay.height * 0.9, alpha: 0.08 }
                ];
                this.overlayState.desaturate = true;
            }
            if (main.includes('thunder')) {
                this.overlayState.lightning = true;
                this.overlayState.shake = 1;
                // Heavier rain for thunderstorm
                this.overlayState.rainStreaks = [];
                for (let i = 0; i < 120; i++) {
                    this.overlayState.rainStreaks.push({
                        x: Math.random() * this.overlay.width,
                        y: Math.random() * this.overlay.height,
                        len: 40 + Math.random() * 40,
                        speed: 12 + Math.random() * 6
                    });
                }
            }
            if (main.includes('cloud')) {
                for (let i = 0; i < 5; i++) {
                    this.overlayState.clouds.push({
                        x: Math.random() * this.overlay.width,
                        y: 60 + Math.random() * 80,
                        r: 60 + Math.random() * 40,
                        alpha: 0.18 + Math.random() * 0.12,
                        speed: 0.2 + Math.random() * 0.1
                    });
                }
            }
            if (main.includes('clear') || main.includes('cloud')) {
                this.overlayState.sun = true;
            }
        }
    }
} 