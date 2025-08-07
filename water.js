import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Water vertex shader with multiple ripple frequencies
const waterVertexShader = `
    uniform float uTime;
    uniform float uSmallWaveSpeed;
    uniform float uLargeWaveSpeed;
    
    varying vec2 vUv;
    varying float vElevation;
    
    void main() {
        vUv = uv;
        vec3 pos = position;
        
        // Small ripples - primary wave pattern
        float smallFrequency = 8.0;
        float smallAmplitude = 0.15;
        float smallWave = sin(pos.x * smallFrequency + uTime * uSmallWaveSpeed) * 
                          cos(pos.y * smallFrequency * 0.5 + uTime * uSmallWaveSpeed * 0.8) * 
                          smallAmplitude;
        
        // Medium ripples - secondary wave pattern
        float mediumFrequency = 4.0;
        float mediumAmplitude = 0.25;
        float mediumWave = sin(pos.x * mediumFrequency + pos.y * mediumFrequency * 0.3 + uTime * uSmallWaveSpeed * 1.2) * 
                           mediumAmplitude;
        
        // Large ripples - varied pattern for natural look
        float largeFrequency1 = 2.0;
        float largeFrequency2 = 1.5;
        float largeAmplitude = 0.4;
        float largeWave1 = sin(pos.x * largeFrequency1 + uTime * uLargeWaveSpeed) * 
                           cos(pos.y * largeFrequency1 * 0.4 + uTime * uLargeWaveSpeed * 0.6) * 
                           largeAmplitude;
        float largeWave2 = sin(pos.x * largeFrequency2 * 1.3 + pos.y * largeFrequency2 * 0.2 + uTime * uLargeWaveSpeed * 0.8) * 
                           largeAmplitude * 0.7;
        
        // Combine all waves with slight randomization based on position
        float combinedWave = smallWave + mediumWave * 0.6 + largeWave1 * 0.5 + largeWave2 * 0.4;
        
        // Add subtle position-based variation for more organic feel
        float positionVariation = sin(pos.x * 0.5) * cos(pos.y * 0.5) * 0.1;
        
        pos.z += combinedWave + positionVariation;
        vElevation = pos.z;
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

// Water fragment shader with depth-based coloring
const waterFragmentShader = `
    uniform vec3 uDepthColor;
    uniform vec3 uSurfaceColor;
    uniform float uColorOffset;
    uniform float uColorMultiplier;
    
    varying vec2 vUv;
    varying float vElevation;
    
    void main() {
        // Create color gradient based on wave elevation
        float mixStrength = (vElevation + uColorOffset) * uColorMultiplier;
        mixStrength = clamp(mixStrength, 0.0, 1.0);
        
        vec3 color = mix(uDepthColor, uSurfaceColor, mixStrength);
        
        // Add subtle brightness variation
        color += vElevation * 0.2;
        
        gl_FragColor = vec4(color, 0.95);
    }
`;

class WaterScene {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.waterMesh = null;
        this.clock = new THREE.Clock();
        
        this.init();
        this.animate();
    }
    
    init() {
        // Scene setup
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x87CEEB, 10, 100);
        
        // Camera setup
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(10, 8, 10);
        this.camera.lookAt(0, 0, 0);
        
        // Renderer setup - optimized for mobile
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: false, // Disable for better mobile performance
            powerPreference: "high-performance"
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for mobile
        this.renderer.setClearColor(0x87CEEB);
        document.body.appendChild(this.renderer.domElement);
        
        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxDistance = 50;
        this.controls.minDistance = 5;
        this.controls.maxPolarAngle = Math.PI * 0.48;
        
        // Create water surface
        this.createWater();
        
        // Lighting
        this.setupLighting();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    createWater() {
        // Geometry - balanced for mobile performance
        const waterGeometry = new THREE.PlaneGeometry(
            50, // width
            50, // height
            128, // width segments - reduced for mobile
            128  // height segments - reduced for mobile
        );
        waterGeometry.rotateX(-Math.PI / 2);
        
        // Material with custom shaders
        const waterMaterial = new THREE.ShaderMaterial({
            vertexShader: waterVertexShader,
            fragmentShader: waterFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uSmallWaveSpeed: { value: 2.0 },
                uLargeWaveSpeed: { value: 1.0 },
                uDepthColor: { value: new THREE.Color(0x064273) },
                uSurfaceColor: { value: new THREE.Color(0x4FC3F7) },
                uColorOffset: { value: 0.25 },
                uColorMultiplier: { value: 2.0 }
            },
            side: THREE.DoubleSide,
            transparent: true
        });
        
        this.waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
        this.scene.add(this.waterMesh);
    }
    
    setupLighting() {
        // Ambient light for overall brightness
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light for highlights
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const elapsedTime = this.clock.getElapsedTime();
        
        // Update water uniforms
        if (this.waterMesh) {
            this.waterMesh.material.uniforms.uTime.value = elapsedTime;
        }
        
        // Update controls
        this.controls.update();
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }
}

// Initialize the scene when the page loads
window.addEventListener('DOMContentLoaded', () => {
    new WaterScene();
});
