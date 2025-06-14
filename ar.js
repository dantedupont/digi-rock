import * as THREE from 'three';
import { ARButton } from 'three/addons/webxr/ARButton.js';

export class ARManager {
    constructor(scene, camera, renderer, rock) {
        console.log('Initializing AR Manager...');
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.rock = rock;
        
        // AR state variables
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
        this.arRockPlaced = false;
        
        // Initialize AR
        this.initAR();
    }

    initAR() {
        console.log('Setting up AR...');
        // Enable WebXR for AR
        this.renderer.xr.enabled = true;

        // Add ARButton to the DOM
        const arButton = ARButton.createButton(this.renderer, { 
            requiredFeatures: ['hit-test'],
            optionalFeatures: ['dom-overlay'],
            domOverlay: { root: document.body }
        });
        document.body.appendChild(arButton);
        console.log('AR Button added to DOM');

        // Create AR reticle
        this.createReticle();

        // Add event listeners
        this.addEventListeners();
    }

    createReticle() {
        console.log('Creating AR reticle...');
        const arReticleGeometry = new THREE.RingGeometry(0.12, 0.15, 32).rotateX(-Math.PI / 2);
        const arReticleMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff, 
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        this.arReticle = new THREE.Mesh(arReticleGeometry, arReticleMaterial);
        this.arReticle.matrixAutoUpdate = false;
        this.arReticle.visible = false;
        this.scene.add(this.arReticle);
        console.log('AR reticle created and added to scene');
    }

    addEventListeners() {
        console.log('Adding AR event listeners...');
        this.renderer.xr.addEventListener('sessionstart', () => {
            console.log('AR session started');
            this.arRockPlaced = false;
            this.rock.visible = false;
        });

        this.renderer.xr.addEventListener('sessionend', () => {
            console.log('AR session ended');
            this.arRockPlaced = false;
            this.rock.visible = true;
        });

        // Add AR select event
        const controller = this.renderer.xr.getController(0);
        controller.addEventListener('select', () => {
            console.log('AR select event triggered');
            this.onSelect();
        });
        this.scene.add(controller);
        console.log('AR controller added to scene');
    }

    onSelect() {
        console.log('AR select handler called');
        if (this.arReticle.visible && !this.arRockPlaced) {
            console.log('Placing rock in AR...');
            
            // Get the hit position from the reticle
            const hitPosition = new THREE.Vector3();
            hitPosition.setFromMatrixPosition(this.arReticle.matrix);
            
            // Set the rock's position to the hit position
            this.rock.position.copy(hitPosition);
            
            // Adjust the rock's scale for AR
            this.rock.scale.set(0.15, 0.15, 0.15);
            
            // Make sure the rock is visible
            this.rock.visible = true;
            
            // Mark the rock as placed
            this.arRockPlaced = true;
            
            console.log('Rock placed in AR at position:', hitPosition);
        }
    }

    update(frame) {
        if (!this.renderer.xr.isPresenting) return;

        const session = this.renderer.xr.getSession();
        if (frame) {
            const referenceSpace = this.renderer.xr.getReferenceSpace();
            if (!this.hitTestSourceRequested) {
                console.log('Requesting hit test source...');
                session.requestReferenceSpace('viewer').then((refSpace) => {
                    session.requestHitTestSource({ space: refSpace }).then((source) => {
                        console.log('Hit test source obtained');
                        this.hitTestSource = source;
                    }).catch(err => {
                        console.error('Error getting hit test source:', err);
                    });
                }).catch(err => {
                    console.error('Error requesting reference space:', err);
                });
                session.addEventListener('end', () => {
                    console.log('AR session ended, cleaning up hit test');
                    this.hitTestSourceRequested = false;
                    this.hitTestSource = null;
                });
                this.hitTestSourceRequested = true;
            }

            if (this.hitTestSource && !this.arRockPlaced) {
                const hitTestResults = frame.getHitTestResults(this.hitTestSource);
                if (hitTestResults.length > 0) {
                    const hit = hitTestResults[0];
                    this.arReticle.visible = true;
                    this.arReticle.matrix.fromArray(hit.getPose(this.renderer.xr.getReferenceSpace()).transform.matrix);
                } else {
                    this.arReticle.visible = false;
                }
            } else {
                this.arReticle.visible = false;
            }
        }
    }

    // Helper method to check if we're in AR mode
    isInARMode() {
        return this.renderer.xr.isPresenting;
    }

    // Helper method to get AR rock placement status
    isRockPlaced() {
        return this.arRockPlaced;
    }
}
