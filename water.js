import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Water vertex shader with multiple ripple frequencies
const waterVertexShader = `
    uniform float uTime;
    uniform float uSmallWaveSpeed;
    uniform float uLargeWaveSpeed;
    
    varying vec2 vUv;
    varying float vElevation;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
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
        vPosition = pos;
        
        // Calculate normal for lighting
        vNormal = normalize(normalMatrix * normal);
        
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
`;

// Water fragment shader with better coloring
const waterFragmentShader = `
    uniform vec3 uDepthColor;
    uniform vec3 uSurfaceColor;
    uniform float uColorOffset;
    uniform float uColorMultiplier;
    uniform float uTime;
    
    varying vec2 vUv;
    varying float vElevation;
    varying vec3 vNormal;
    varying vec3 vPosition;
    
    void main() {
        // Base water color - mix between depth and surface based on elevation
        float mixStrength = (vElevation + uColorOffset) * uColorMultiplier;
        mixStrength = clamp(mixStrength, 0.0, 1.0);
        
        vec3 color = mix(uDepthColor, uSurfaceColor, mixStrength + 0.5);
        
        // Add foam on wave peaks
        float foam = smoothstep(0.2, 0.3, vElevation);
        color = mix(color, vec3(0.95, 0.98, 1.0), foam * 0.3);
        
        // Simple fresnel effect for more realistic water
        vec3 viewDirection = normalize(cameraPosition - vPosition);
        float fresnel = dot(viewDirection, vNormal);
        fresnel = pow(1.0 - fresnel, 2.0);
        
        // Lighten edges slightly
        color = mix(color, uSurfaceColor * 1.2, fresnel * 0.3);
        
        // Add subtle brightness variation based on position
        color *= 0.95 + vElevation * 0.15;
        
        // Ensure we never go to pure black
        color = max(color, vec3(0.05, 0.15, 0.25));
        
        gl_FragColor = vec4(color, 0.92);
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
        this.scene.fog = new THREE.Fog(0xE0F7FA, 20, 80);
        
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
            powerPreference: "high-performance",
            alpha: false
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Cap at 2 for mobile
        this.renderer.setClearColor(0xB3E5FC);
        this.renderer.shadowMap.enabled = false; // Disable shadows for performance
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
                uDepthColor: { value: new THREE.Color(0x0077BE) }, // Deeper blue
                uSurfaceColor: { value: new THREE.Color(0x52D3F5) }, // Lighter cyan blue
                uColorOffset: { value: 0.1 },
                uColorMultiplier: { value: 3.0 },
                cameraPosition: { value: this.camera.position }
            },
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: true,
            depthTest: true
        });
        
        this.waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
        this.scene.add(this.waterMesh);
        
        // Add a simple plane underneath to prevent seeing through
        const underGeometry = new THREE.PlaneGeometry(55, 55);
        underGeometry.rotateX(-Math.PI / 2);
        const underMaterial = new THREE.MeshBasicMaterial({
            color: 0x004A7C,
            side: THREE.DoubleSide
        });
        const underMesh = new THREE.Mesh(underGeometry, underMaterial);
        underMesh.position.y = -2;
        this.scene.add(underMesh);
    }
    
    setupLighting() {
        // Ambient light for overall brightness
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);
        
        // Directional light for highlights
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);
        
        // Add hemisphere light for better color
        const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x0077BE, 0.5);
        this.scene.add(hemisphereLight);
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
            this.waterMesh.material.uniforms.cameraPosition.value = this.camera.position;
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
