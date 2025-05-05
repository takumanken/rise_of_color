import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { CONFIG } from "./config.js";

// Waveform calculation function for shaders
export const waveformFunction = `
// Calculate waveform value based on type
float calculateWaveform(float phase, float sharpness) {
  // Sine wave (default)
  float wave = sin(phase);
  
  #if defined(WAVEFORM_TRIANGLE)
    // Triangle wave
    float p = mod(phase / 6.283, 1.0);
    wave = abs(2.0 * p - 1.0) * 2.0 - 1.0;
  #elif defined(WAVEFORM_PULSE)
    // Pulse wave with adjustable sharpness
    float p = mod(phase / 6.283, 1.0);
    float threshold = 0.5 - sharpness * 0.4;
    wave = p < threshold ? -1.0 : 1.0;
    
    // Optional: smooth transition
    float transition = 0.1 * (1.0 - sharpness);
    wave = smoothstep(-1.0, 1.0, wave);
  #endif
  
  return wave;
}`;

export class Renderer {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Apply fog based on CONFIG
    if (CONFIG.visualEffects.fog.enabled) {
      this.scene.fog = new THREE.FogExp2(CONFIG.visualEffects.fog.color, CONFIG.visualEffects.fog.density);
    }

    // Camera setup
    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 1, 1000);
    this.camera.position.set(...CONFIG.camera.initialPosition);

    // Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    document.body.appendChild(this.renderer.domElement);

    // Enable proper color encoding for more vibrant colors
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    // Post-processing setup
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    // Add vignette effect if enabled
    if (CONFIG.visualEffects.vignette.enabled) {
      const vignettePass = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          offset: { value: CONFIG.visualEffects.vignette.offset },
          darkness: { value: CONFIG.visualEffects.vignette.darkness },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D tDiffuse;
          uniform float offset;
          uniform float darkness;
          varying vec2 vUv;
          void main() {
            vec2 uv = vUv;
            vec4 texel = texture2D(tDiffuse, vUv);
            
            // Create vignette
            vec2 center = vec2(0.5);
            float dist = length(uv - center) * offset;
            float vignette = 1.0 - dist * darkness;
            
            // Apply vignette
            texel.rgb *= vignette;
            
            gl_FragColor = texel;
          }
        `,
      });
      this.composer.addPass(vignettePass);
    }

    // Set up lighting
    this.setupLighting();

    // Controls setup
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = CONFIG.camera.damping;

    // Add an initial camera movement to show dimension
    setTimeout(() => {
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = CONFIG.camera.autoRotateSpeed;
      setTimeout(() => {
        this.controls.autoRotate = false;
      }, CONFIG.camera.autoRotateDuration);
    }, 1000);

    // Main color wheel group
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Handle window resize
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  setupLighting() {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(
      CONFIG.visualEffects.lighting.ambient.color,
      CONFIG.visualEffects.lighting.ambient.intensity
    );
    this.scene.add(ambientLight);

    // Add main directional light
    const mainLight = new THREE.DirectionalLight(
      CONFIG.visualEffects.lighting.main.color,
      CONFIG.visualEffects.lighting.main.intensity
    );
    mainLight.position.set(...CONFIG.visualEffects.lighting.main.position);
    this.scene.add(mainLight);

    // Add rim light
    const rimLight = new THREE.DirectionalLight(
      CONFIG.visualEffects.lighting.rim.color,
      CONFIG.visualEffects.lighting.rim.intensity
    );
    rimLight.position.set(...CONFIG.visualEffects.lighting.rim.position);
    this.scene.add(rimLight);
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.controls.update();
    this.composer.render();
  }

  // Setup instanced mesh with shader-based animation
  setupShaderInstancedMesh(estimatedCount) {
    // Create geometry with optimized poly count
    const baseGeometry = new THREE.SphereGeometry(CONFIG.smallSphereRadius, 6, 4);

    // Create instanced attributes to store immutable data
    const positionArray = new Float32Array(estimatedCount * 3);
    const scaleArray = new Float32Array(estimatedCount);
    const shellArray = new Float32Array(estimatedCount);

    // Add attributes to geometry
    baseGeometry.setAttribute("iPosition", new THREE.InstancedBufferAttribute(positionArray, 3));
    baseGeometry.setAttribute("iScale", new THREE.InstancedBufferAttribute(scaleArray, 1));
    baseGeometry.setAttribute("iShell", new THREE.InstancedBufferAttribute(shellArray, 1));

    // Color attribute
    const colorArray = new Float32Array(estimatedCount * 3);
    const colorAttribute = new THREE.InstancedBufferAttribute(colorArray, 3);
    baseGeometry.setAttribute("instanceColor", colorAttribute);

    // Prepare shader defines based on CONFIG
    const shaderDefines = {};
    if (CONFIG.breathingEffect.waveform === "triangle") {
      shaderDefines.WAVEFORM_TRIANGLE = "";
    } else if (CONFIG.breathingEffect.waveform === "pulse") {
      shaderDefines.WAVEFORM_PULSE = "";
    }

    // Create shader material with breathing animation
    const material = new THREE.ShaderMaterial({
      defines: shaderDefines,
      uniforms: {
        uTime: { value: 0 },
        uBreathingEnabled: { value: CONFIG.breathingEffect.enabled ? 1.0 : 0.0 },
        uBreathingAmplitude: { value: CONFIG.breathingEffect.amplitude },
        uBreathingShellInfluence: { value: CONFIG.breathingEffect.shellInfluence },
        uShellCount: { value: CONFIG.shells },
        uRandomOffset: { value: CONFIG.breathingEffect.randomOffset },
        uPulseSharpness: { value: CONFIG.breathingEffect.pulseSharpness },
      },
      vertexShader: `
        attribute vec3 instanceColor;
        attribute vec3 iPosition;  // Original position
        attribute float iScale;    // Per-instance scale
        attribute float iShell;    // Shell index
        
        uniform float uTime;
        uniform float uBreathingEnabled;
        uniform float uBreathingAmplitude;
        uniform float uBreathingShellInfluence;
        uniform float uShellCount;
        uniform float uRandomOffset;
        uniform float uPulseSharpness;
        
        varying vec3 vColor;
        varying vec3 vNormal;
        
        ${waveformFunction}
        
        void main() {
          vColor = instanceColor;
          vNormal = normal;
          
          // Calculate breathing factor in shader
          float breatheFactor = 1.0;
          if (uBreathingEnabled > 0.5) {
            // Phase offset based on shell and optional random offset
            float phaseOffset = iShell * 0.1;
            if (uRandomOffset > 0.0) {
              // Add some pseudo-random offset using point position hash
              phaseOffset += dot(iPosition, vec3(0.17, 0.23, 0.31)) * uRandomOffset;
            }
            
            float phase = uTime * 6.28 + phaseOffset;
            float wave = calculateWaveform(phase, uPulseSharpness);
            
            float influenceFactor = mix(1.0, iShell / uShellCount, uBreathingShellInfluence);
            breatheFactor = 1.0 + wave * uBreathingAmplitude * influenceFactor;
          }
          
          // Apply breathing to position
          vec3 breathedPosition = iPosition * breatheFactor;
          
          // Apply instance scale to vertices
          vec3 scaledPosition = position * iScale;
          
          // Combine for final position
          vec4 mvPosition = modelViewMatrix * vec4(breathedPosition + scaledPosition, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying vec3 vNormal;
        
        void main() {
          // Simple lighting
          vec3 light = normalize(vec3(0.5, 0.8, 0.5));
          float diffuse = max(dot(vNormal, light), 0.0);
          
          // Calculate rim light effect
          vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
          float rim = pow(1.0 - abs(dot(vNormal, viewDir)), ${CONFIG.pointAppearance.shader.rimFalloff.toFixed(1)});
          
          // Mix ambient and diffuse for better visibility
          vec3 finalColor = vColor * (${CONFIG.pointAppearance.shader.ambientIntensity.toFixed(2)} + 
                                      ${CONFIG.pointAppearance.shader.diffuseIntensity.toFixed(2)} * diffuse);
          
          // Add rim highlight
          finalColor = mix(finalColor, vec3(1.0), rim * ${CONFIG.pointAppearance.shader.rimIntensity.toFixed(2)});
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    // Use static draw since we'll only set positions once
    const spheres = new THREE.InstancedMesh(baseGeometry, material, estimatedCount);
    spheres.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.group.add(spheres);

    return spheres;
  }

  // Alternative: Point cloud rendering for performance
  setupPointCloudMesh(estimatedCount) {
    // Use simple point geometry - one vertex per sphere!
    const geometry = new THREE.BufferGeometry();

    // Allocate position buffer
    const positions = new Float32Array(estimatedCount * 3);
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // Colors, scales, shells
    const colors = new Float32Array(estimatedCount * 3);
    const scales = new Float32Array(estimatedCount);
    const shells = new Float32Array(estimatedCount);

    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("scale", new THREE.BufferAttribute(scales, 1));
    geometry.setAttribute("shell", new THREE.BufferAttribute(shells, 1));

    // Prepare shader defines based on CONFIG
    const shaderDefines = {};
    if (CONFIG.breathingEffect.waveform === "triangle") {
      shaderDefines.WAVEFORM_TRIANGLE = "";
    } else if (CONFIG.breathingEffect.waveform === "pulse") {
      shaderDefines.WAVEFORM_PULSE = "";
    }

    // Point sprite shader
    const material = new THREE.ShaderMaterial({
      defines: shaderDefines,
      uniforms: {
        uTime: { value: 0 },
        uBreathingEnabled: { value: CONFIG.breathingEffect.enabled ? 1.0 : 0.0 },
        uBreathingAmplitude: { value: CONFIG.breathingEffect.amplitude },
        uBreathingShellInfluence: { value: CONFIG.breathingEffect.shellInfluence },
        uShellCount: { value: CONFIG.shells },
        uPointSize: { value: CONFIG.pointAppearance.baseSize },
        uRandomOffset: { value: CONFIG.breathingEffect.randomOffset },
        uPulseSharpness: { value: CONFIG.breathingEffect.pulseSharpness },
        uSaturationInfluence: { value: CONFIG.pointAppearance.saturationInfluence },
        uMinSize: { value: CONFIG.pointAppearance.minSize },
        uMaxSize: { value: CONFIG.pointAppearance.maxSize },
        uRimIntensity: { value: CONFIG.pointAppearance.shader.rimIntensity },
        uRimFalloff: { value: CONFIG.pointAppearance.shader.rimFalloff },
        uEdgeDarkening: { value: CONFIG.pointAppearance.shader.edgeDarkening },
        uEdgeThreshold: { value: CONFIG.pointAppearance.shader.edgeThreshold },
        uDiffuseIntensity: { value: CONFIG.pointAppearance.shader.diffuseIntensity },
        uAmbientIntensity: { value: CONFIG.pointAppearance.shader.ambientIntensity },
      },
      vertexShader: `
        attribute vec3 color;
        attribute float scale;
        attribute float shell;
        
        uniform float uTime;
        uniform float uBreathingEnabled;
        uniform float uBreathingAmplitude;
        uniform float uBreathingShellInfluence;
        uniform float uShellCount;
        uniform float uPointSize;
        uniform float uRandomOffset;
        uniform float uPulseSharpness;
        uniform float uSaturationInfluence;
        uniform float uMinSize;
        uniform float uMaxSize;
        
        varying vec3 vColor;
        
        ${waveformFunction}
        
        void main() {
          vColor = color;
          
          // Breathing effect
          float breatheFactor = 1.0;
          if (uBreathingEnabled > 0.5) {
            // Phase offset based on shell and optional random offset
            float phaseOffset = shell * 0.1;
            if (uRandomOffset > 0.0) {
              // Add some pseudo-random offset using point position hash
              phaseOffset += dot(position, vec3(0.17, 0.23, 0.31)) * uRandomOffset;
            }
            
            float phase = uTime * 6.28 + phaseOffset;
            float wave = calculateWaveform(phase, uPulseSharpness);
            
            float influenceFactor = mix(1.0, shell / uShellCount, uBreathingShellInfluence);
            breatheFactor = 1.0 + wave * uBreathingAmplitude * influenceFactor;
          }
          
          // Apply breathing to position
          vec3 breathedPosition = position * breatheFactor;
          
          // Calculate size based on distance, scale, and color importance
          vec4 mvPosition = modelViewMatrix * vec4(breathedPosition, 1.0);
          
          // Enhance size based on saturation (lower shell = higher saturation)
          float saturationFactor = mix(uMaxSize, uMinSize, shell / uShellCount * uSaturationInfluence);
          
          gl_PointSize = uPointSize * scale * saturationFactor / -mvPosition.z;
          
          // Output position
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float uRimIntensity;
        uniform float uRimFalloff;
        uniform float uEdgeDarkening;
        uniform float uEdgeThreshold;
        uniform float uDiffuseIntensity;
        uniform float uAmbientIntensity;
        
        varying vec3 vColor;
        
        void main() {
          // Create circle with soft edge
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(uv, uv);
          if (r2 > 1.0) discard; // Clip to circle
          
          // Fake sphere shading
          float z = sqrt(1.0 - r2);
          vec3 normal = normalize(vec3(uv, z));
          vec3 light = normalize(vec3(0.5, 0.8, 0.5));
          float diffuse = max(dot(normal, light), 0.0);
          
          // Calculate rim light (facing away from camera)
          float rim = pow(1.0 - abs(dot(normal, vec3(0.0, 0.0, 1.0))), uRimFalloff);
          
          // Add subtle dark edge for better definition
          float edge = smoothstep(uEdgeThreshold, 1.0, r2);
          
          // Mix ambient, diffuse, rim light, and edge
          vec3 finalColor = vColor * (uAmbientIntensity + uDiffuseIntensity * diffuse);  // Base lighting
          finalColor = mix(finalColor, vec3(1.0), rim * uRimIntensity);                 // Add rim highlight
          finalColor *= 1.0 - edge * uEdgeDarkening;                                     // Darken at edge
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      vertexColors: true,
    });

    // Create points - dramatically reduces vertex count
    const points = new THREE.Points(geometry, material);
    this.group.add(points);

    return points;
  }
}
