import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "https://cdn.jsdelivr.net/npm/three@0.152.2/examples/jsm/postprocessing/ShaderPass.js";

// --- Configuration parameters ------------------------------
const CONFIG = {
  // STRUCTURE: Controls the overall size and resolution of the color sphere
  // -----------------------------------------------------------------
  radius: 40, // The overall radius of the color sphere in world units
  smallSphereRadius: 0.05, // Size of each individual color dot
  shells: 50, // Number of concentric shells - higher means more granular saturation levels

  // ANIMATION: Controls the timing and movement of the visualization
  // -----------------------------------------------------------------
  rotationSpeed: 0.001, // How fast the sphere auto-rotates (0 = no rotation)
  animationSpeed: 200, // Milliseconds between each year in the animation (lower = faster)

  // Controls how points appear when first added to the visualization
  entranceAnimation: {
    enabled: true, // Turn entrance animation on/off
    duration: 1500, // How long entrance animation lasts in milliseconds
    easingPower: 3, // Controls the "snap" of the animation (1=linear, 2=quadratic, 3=cubic)
    randomizeDelay: true, // Whether points appear all at once or staggered
  },

  // BREATHING EFFECT: Makes dots pulse in and out from center
  // -----------------------------------------------------------------
  breathingEffect: {
    enabled: false, // Turn breathing effect on/off
    speed: 0.001, // Speed of breathing cycles (higher = faster breathing)
    amplitude: 0.01, // How much dots move during breathing (higher = bigger movement)
    shellInfluence: 1.0, // How much shell number affects breathing (0=uniform, 1=outer shells breathe more)
    waveform: "pulse", // Shape of the breathing: "sine" (smooth), "triangle" (linear), "pulse" (sharp)
    asynchronous: true, // Whether all colors breathe together or independently
    randomOffset: 1, // How much random variation in breathing phases (0=synchronized, 1=fully random)
    pulseSharpness: 0.5, // For pulse waveform, controls transition sharpness (0-1)
  },

  // CAMERA: Controls viewing angle and behavior
  // -----------------------------------------------------------------
  camera: {
    distance: 500, // Base distance of camera (usually not directly used)
    initialPosition: [70, 70, 240], // Starting position [x, y, z]
    autoRotateSpeed: 0.5, // Speed of initial auto-rotation demonstration
    autoRotateDuration: 3000, // How long the intro auto-rotation lasts (milliseconds)
    damping: 0.05, // How quickly camera movement slows down (higher = more smooth)
    fov: 20, // Field of view in degrees (lower = more zoomed in/telephoto effect)
  },

  // COLOR MAPPING: Controls how RGB colors map to 3D positions
  // -----------------------------------------------------------------
  grayscaleThreshold: 0.05, // Saturation below this value is treated as grayscale (0-1)
  colorDepth: 7, // Bit depth for color quantization (higher = more unique colors)
  useHSLQuantization: true, // Whether to quantize in HSL space (true) or RGB space (false)

  // VISUAL EFFECTS: Controls additional visual enhancements
  // -----------------------------------------------------------------
  visualEffects: {
    // Fog creates depth by fading distant objects
    fog: {
      enabled: true, // Turn fog on/off
      density: 0.025, // How thick the fog is (higher = more dense/less visibility)
      color: 0x000000, // Fog color (hex format)
    },
    // Vignette darkens the edges of the screen
    vignette: {
      enabled: false, // Turn vignette effect on/off
      offset: 10, // Size of the bright center area (higher = larger bright area)
      darkness: 10000, // Intensity of edge darkening (higher = darker edges)
    },
    // Lighting settings for all lights in the scene
    lighting: {
      ambient: {
        intensity: 0.4, // Overall ambient light level (higher = brighter scene)
        color: 0xffffff, // Color of ambient light (hex format)
      },
      main: {
        intensity: 0.8, // Brightness of main directional light
        color: 0xffffff, // Color of main light (hex format)
        position: [1, 1, 1], // Direction of main light [x, y, z]
      },
      rim: {
        intensity: 0.7, // Brightness of rim light (creates edge highlights)
        color: 0xffffff, // Color of rim light (hex format)
        position: [-1, 0.5, -1], // Direction of rim light [x, y, z]
      },
    },
  },

  // POINT APPEARANCE: Controls the visual style of each dot (point cloud mode)
  // -----------------------------------------------------------------
  pointAppearance: {
    baseSize: 200, // Base size multiplier for points (higher = bigger dots)
    saturationInfluence: 1, // How much saturation affects point size (0-1)
    minSize: 0.8, // Minimum size multiplier (relative to baseSize)
    maxSize: 1.2, // Maximum size multiplier (relative to baseSize)

    // Shader effects for custom point rendering
    shader: {
      rimIntensity: 0.1, // Strength of rim lighting effect (0-1)
      rimFalloff: 5, // Sharpness of rim light falloff (higher = sharper)
      edgeDarkening: 0, // How much edges of points darken (0-1)
      edgeThreshold: 1, // Where edge darkening begins (0-1, higher = smaller dark edge)
      diffuseIntensity: 1, // Strength of directional lighting (0-1)
      ambientIntensity: 1, // Strength of ambient lighting (0-1)
    },
  },

  // APPEARANCE: Controls material properties for the dots
  // -----------------------------------------------------------------
  shininess: 100, // How shiny the material is (higher = more specular highlights)
  specular: 0x888888, // Color of specular highlights (hex format)
  emissiveIntensity: 0.3, // How much points self-illuminate (higher = more glow)
  opacity: {
    base: 1, // Base opacity for all points (0-1)
    saturatedBoost: 0.5, // Additional opacity for saturated colors (0-1)
  },

  // SMART SAMPLING: Controls how colors are selected from source data
  // -----------------------------------------------------------------
  smartSampling: {
    enabled: true, // Turn smart sampling on/off
    prioritizeChroma: true, // Whether to prioritize high-chroma colors (more saturated)
    temporalImportance: true, // Whether to prioritize colors by their historical significance
  },

  // JITTER: Controls how randomly positioned each dot is
  // -----------------------------------------------------------------
  jitter: {
    enabled: true, // Turn spatial jittering on/off
    intensity: 10.0, // Overall multiplier for jitter (0=perfect grid, 2=twice as random)
    thetaStrength: 1.5, // Horizontal/longitudinal jitter strength
    phiStrength: 1.5, // Vertical/latitudinal jitter strength (smaller to prevent messy poles)
    radialJitter: 1, // Random variation in distance from center (0-1)
  },
};

// --- Application State --------------------------------------------------------------
const state = {
  data: [], // All data from JSON
  i: -1, // Current year index
  playing: false, // Is animation playing?
  timer: null, // Animation timer
  colorData: [], // All processed colors
  seen: new Set(), // Track unique colors
  totalSpheres: 0, // Track sphere count
};

// --- Scene Setup --------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

// Apply fog based on CONFIG
if (CONFIG.visualEffects.fog.enabled) {
  scene.fog = new THREE.FogExp2(CONFIG.visualEffects.fog.color, CONFIG.visualEffects.fog.density);
}

// Camera setup
const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(...CONFIG.camera.initialPosition);

// Renderer setup
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
document.body.appendChild(renderer.domElement);

// Enable proper color encoding for more vibrant colors
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// --- Post-processing setup ------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

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
  composer.addPass(vignettePass);
}

// --- Lighting --------------------------------------------------------------
// Add ambient light
const ambientLight = new THREE.AmbientLight(
  CONFIG.visualEffects.lighting.ambient.color,
  CONFIG.visualEffects.lighting.ambient.intensity
);
scene.add(ambientLight);

// Add main directional light
const mainLight = new THREE.DirectionalLight(
  CONFIG.visualEffects.lighting.main.color,
  CONFIG.visualEffects.lighting.main.intensity
);
mainLight.position.set(...CONFIG.visualEffects.lighting.main.position);
scene.add(mainLight);

// Add rim light
const rimLight = new THREE.DirectionalLight(
  CONFIG.visualEffects.lighting.rim.color,
  CONFIG.visualEffects.lighting.rim.intensity
);
rimLight.position.set(...CONFIG.visualEffects.lighting.rim.position);
scene.add(rimLight);

// --- Controls --------------------------------------------------------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = CONFIG.camera.damping;

// Add an initial camera movement to show dimension
setTimeout(() => {
  controls.autoRotate = true;
  controls.autoRotateSpeed = CONFIG.camera.autoRotateSpeed;
  setTimeout(() => {
    controls.autoRotate = false;
  }, CONFIG.camera.autoRotateDuration);
}, 1000);

// --- Color Wheel Group --------------------------------------------------------------
const group = new THREE.Group();
scene.add(group);

// --- Shaders & Rendering Functions --------------------------------------------------------------

// Waveform calculation function for shaders
const waveformFunction = `
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

// Setup instanced mesh with shader-based animation
function setupShaderInstancedMesh(estimatedCount) {
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
  group.add(spheres);

  // Setup state
  state.instanceCount = 0;
  state.instancedSpheres = spheres;
  state.dummy = new THREE.Object3D();

  return spheres;
}

// Alternative: Point cloud rendering for performance
function setupPointCloudMesh(estimatedCount) {
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
  group.add(points);

  state.points = points;
  state.instanceCount = 0;

  return points;
}

// --- DOM Elements --------------------------------------------------------------
// Create UI elements
function createUI() {
  // Year display
  const yearDisplay = document.createElement("div");
  yearDisplay.style.position = "absolute";
  yearDisplay.style.top = "50px";
  yearDisplay.style.width = "100%";
  yearDisplay.style.textAlign = "center";
  yearDisplay.style.fontSize = "2.4rem";
  yearDisplay.style.fontWeight = "900";
  yearDisplay.innerHTML = "–";
  document.body.appendChild(yearDisplay);
  state.yearDisplay = yearDisplay;

  // Stats container
  const statsContainer = document.createElement("div");
  statsContainer.style.position = "absolute";
  statsContainer.style.top = "110px";
  statsContainer.style.width = "100%";
  statsContainer.style.textAlign = "center";
  statsContainer.style.fontSize = "1rem";
  statsContainer.innerHTML =
    '<span id="total-colors">0</span> Total Colors | <span id="year-colors">0</span> New This Year';
  document.body.appendChild(statsContainer);

  // Progress bar
  const progressBar = document.createElement("div");
  progressBar.style.position = "absolute";
  progressBar.style.bottom = "20px";
  progressBar.style.left = "50%";
  progressBar.style.transform = "translateX(-50%)";
  progressBar.style.width = "80%";
  progressBar.style.maxWidth = "800px";
  progressBar.style.height = "4px";
  progressBar.style.background = "rgba(255,255,255,0.2)";
  progressBar.style.borderRadius = "2px";
  progressBar.style.overflow = "hidden";

  const progressFill = document.createElement("div");
  progressFill.style.height = "100%";
  progressFill.style.width = "0%";
  progressFill.style.background = "linear-gradient(to right, #ff3e9d, #0ff0fc)";
  progressFill.style.transition = "width 0.3s ease";
  progressBar.appendChild(progressFill);
  document.body.appendChild(progressBar);
  state.progressFill = progressFill;

  // Play/pause button
  const playButton = document.createElement("button");
  playButton.id = "play-pause";
  playButton.textContent = "Start";
  playButton.style.position = "absolute";
  playButton.style.bottom = "40px";
  playButton.style.left = "50%";
  playButton.style.transform = "translateX(-50%)";
  document.body.appendChild(playButton);
  state.playButton = playButton;

  // Event listeners
  playButton.addEventListener("click", () => {
    if (!state.playing) {
      if (state.i >= state.data.length - 1) {
        reset();
      }
      play();
    } else {
      pause();
    }
  });
}

// --- Color Processing Functions --------------------------------------------------------------
// RGB to HSL conversion
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // grayscale
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

// HSL to RGB converter
function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Deterministic pseudo-random angle for grayscale colors
function greyAngle(rgb) {
  const hash = (rgb[0] * 31 + rgb[1] * 17 + rgb[2] * 7) % 360;
  return (hash / 360) * Math.PI * 2;
}

// Quantize color to reduce number of unique colors
function quantizeColor(rgb) {
  const factor = Math.pow(2, 8 - CONFIG.colorDepth);
  return [
    Math.floor(rgb[0] / factor) * factor,
    Math.floor(rgb[1] / factor) * factor,
    Math.floor(rgb[2] / factor) * factor,
  ];
}

// HSL-based quantization function
function quantizeColorHSL(rgb) {
  // Convert to HSL first
  const [h, s, l] = rgbToHsl(...rgb);

  // Calculate quantization levels based on colorDepth
  const levels = Math.pow(2, CONFIG.colorDepth);

  // Golden ratio approach to distribute points evenly on sphere
  const hueSteps = Math.round(levels * 1.6); // More hue steps (around circumference)
  const satSteps = Math.round(levels * 0.75); // Fewer saturation steps (radius)
  const lightSteps = Math.round(levels * 0.75); // Fewer lightness steps (height)

  // Add a tiny random offset to prevent perfect layers
  const jitter = 1 / levels;
  const hRand = (Math.random() - 0.5) * jitter;
  const sRand = (Math.random() - 0.5) * jitter;
  const lRand = (Math.random() - 0.5) * jitter;

  // Quantize with slight randomness to break up layers
  let hQ = Math.round((h + hRand) * hueSteps) / hueSteps;
  let sQ = Math.round((s + sRand) * satSteps) / satSteps;
  let lQ = Math.round((l + lRand) * lightSteps) / lightSteps;

  // Keep values in valid range
  hQ = Math.max(0, Math.min(1, hQ));
  sQ = Math.max(0, Math.min(1, sQ));
  lQ = Math.max(0, Math.min(1, lQ));

  // Convert back to RGB for storage/comparison
  return hslToRgb(hQ, sQ, lQ);
}

// Calculate position based on color
function calculatePosition(rgb) {
  const [h, s, l] = rgbToHsl(...rgb);

  // Check if this is a grayscale color (saturation below threshold)
  const isGrayscale = s < CONFIG.grayscaleThreshold;

  // Calculate chroma (for scaling and visual importance)
  const c = (1 - Math.abs(2 * l - 1)) * s;

  const R = CONFIG.radius;

  let jitter, thetaJitter, phiJitter, radialJitter;

  if (CONFIG.jitter.enabled) {
    // Base jitter amount calculated from color depth
    jitter = (1.0 / (Math.pow(2, CONFIG.colorDepth) * 1.6)) * CONFIG.jitter.intensity;

    // Apply configured strengths to different dimensions
    thetaJitter = (Math.random() - 0.5) * jitter * CONFIG.jitter.thetaStrength;
    phiJitter = (Math.random() - 0.5) * jitter * CONFIG.jitter.phiStrength;

    // Optional radial jitter
    radialJitter =
      CONFIG.jitter.radialJitter > 0 ? 1.0 + (Math.random() - 0.5) * CONFIG.jitter.radialJitter * 0.2 : 1.0;
  } else {
    thetaJitter = phiJitter = 0;
    radialJitter = 1.0;
  }

  // Apply jitter to angular coordinates
  let theta;
  if (isGrayscale) {
    theta = greyAngle(rgb) + thetaJitter;
  } else {
    theta = 2 * Math.PI * h + thetaJitter;
  }
  const phi = (1 - l) * Math.PI + phiJitter;

  // Calculate Cartesian coordinates
  const rMax = R * Math.sin(phi);
  // Apply radial jitter to radius
  const r = (isGrayscale ? 0.1 * rMax : s * rMax) * radialJitter;

  const x = r * Math.cos(theta);
  const z = r * Math.sin(theta);
  const y = R * Math.cos(phi);

  // Calculate shell number (for breathing and visual effects)
  const shell = Math.floor((1 - s) * CONFIG.shells);

  return { x, y, z, shell, h, s, l, c, r, phi, theta, rgb, isGrayscale };
}

// --- Data Loading & Processing --------------------------------------------------------------
// Load the color data
async function loadData() {
  try {
    const response = await fetch("download_data/unique_colors_history.json");
    return await response.json();
  } catch (err) {
    console.error("Error loading data:", err);
    return [];
  }
}

// Process year data
function processYear(yearData) {
  const yearColors = [];
  const colors = yearData.color || [];

  if (CONFIG.smartSampling.enabled) {
    // Sort colors by chroma before processing, if enabled
    if (CONFIG.smartSampling.prioritizeChroma) {
      colors.sort((a, b) => {
        const [h1, s1, l1] = rgbToHsl(...a);
        const [h2, s2, l2] = rgbToHsl(...b);
        const c1 = (1 - Math.abs(2 * l1 - 1)) * s1; // Chroma of color a
        const c2 = (1 - Math.abs(2 * l2 - 1)) * s2; // Chroma of color b
        return c2 - c1; // Higher chroma first
      });
    }
  }

  for (const rgb of colors) {
    // Quantize using either RGB or HSL method
    const quantizedRgb = CONFIG.useHSLQuantization ? quantizeColorHSL(rgb) : quantizeColor(rgb);

    const key = quantizedRgb.join(",");

    // Only add if we haven't seen this color before
    if (!state.seen.has(key)) {
      state.seen.add(key);

      // Calculate position and properties
      const position = calculatePosition(quantizedRgb);

      // Add to year data and global state
      yearColors.push(position);
      state.colorData.push(position);

      // Update counter
      state.totalSpheres++;
    }
  }

  return yearColors;
}

// Add processed colors to instanced mesh
function addYearColors(yearColors) {
  const spheres = state.instancedSpheres;

  // Get attributes directly
  const positionAttr = spheres.geometry.getAttribute("iPosition");
  const scaleAttr = spheres.geometry.getAttribute("iScale");
  const shellAttr = spheres.geometry.getAttribute("iShell");
  const colorAttr = spheres.geometry.getAttribute("instanceColor");

  // Set dummy identity matrices (will be ignored, positions come from attributes)
  const dummy = state.dummy;
  dummy.position.set(0, 0, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();

  yearColors.forEach((colorData) => {
    // Store original position in attribute
    positionAttr.setXYZ(state.instanceCount, colorData.x, colorData.y, colorData.z);

    // Store scale in attribute
    const dotScale = 0.8 + colorData.c * 0.4;
    scaleAttr.setX(state.instanceCount, dotScale);

    // Store shell in attribute
    shellAttr.setX(state.instanceCount, colorData.shell);

    // Store color in attribute
    colorAttr.setXYZ(state.instanceCount, colorData.rgb[0] / 255, colorData.rgb[1] / 255, colorData.rgb[2] / 255);

    // Set static identity matrix
    spheres.setMatrixAt(state.instanceCount, dummy.matrix);

    state.instanceCount++;
  });

  // Update the count
  spheres.count = state.instanceCount;

  // Mark all attributes for update (one time only)
  positionAttr.needsUpdate = true;
  scaleAttr.needsUpdate = true;
  shellAttr.needsUpdate = true;
  colorAttr.needsUpdate = true;
  spheres.instanceMatrix.needsUpdate = true;
}

// Add colors to point cloud (alternative rendering)
function addYearColorsAsPoints(yearColors) {
  const points = state.points;
  const positions = points.geometry.getAttribute("position");
  const colors = points.geometry.getAttribute("color");
  const scales = points.geometry.getAttribute("scale");
  const shells = points.geometry.getAttribute("shell");

  yearColors.forEach((colorData) => {
    // Position
    positions.setXYZ(state.instanceCount, colorData.x, colorData.y, colorData.z);

    // Color
    colors.setXYZ(state.instanceCount, colorData.rgb[0] / 255, colorData.rgb[1] / 255, colorData.rgb[2] / 255);

    // Scale
    const dotScale =
      CONFIG.pointAppearance.minSize + colorData.c * (CONFIG.pointAppearance.maxSize - CONFIG.pointAppearance.minSize);
    scales.setX(state.instanceCount, dotScale);

    // Shell
    shells.setX(state.instanceCount, colorData.shell);

    state.instanceCount++;
  });

  // Update count and mark attributes for update
  points.geometry.setDrawRange(0, state.instanceCount);
  positions.needsUpdate = true;
  colors.needsUpdate = true;
  scales.needsUpdate = true;
  shells.needsUpdate = true;
}

// --- Animation & Control Functions --------------------------------------------------------------
// Play animation
function play() {
  state.playing = true;
  state.playButton.textContent = "Pause";
  state.timer = setInterval(step, CONFIG.animationSpeed);
}

// Pause animation
function pause() {
  state.playing = false;
  state.playButton.textContent = "Resume";
  clearInterval(state.timer);
}

// Reset visualization
function reset() {
  pause();
  state.i = -1;
  state.colorData = [];
  state.seen = new Set();
  state.totalSpheres = 0;

  // Remove all spheres
  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }

  // Reset UI
  state.yearDisplay.textContent = "–";
  document.getElementById("total-colors").textContent = "0";
  document.getElementById("year-colors").textContent = "0";
  state.progressFill.style.width = "0%";
  state.playButton.textContent = "Start";

  // Recreate visualization with fresh settings
  initVisualization();
}

// Advance to next year
function step() {
  if (state.i >= state.data.length - 1) {
    pause();
    state.playButton.textContent = "Restart";
    return;
  }

  state.i++;
  const yearData = state.data[state.i];
  const yearColors = processYear(yearData);

  // Update UI
  state.yearDisplay.textContent = yearData.year;
  document.getElementById("year-colors").textContent = yearColors.length;
  document.getElementById("total-colors").textContent = state.colorData.length;
  state.progressFill.style.width = `${((state.i + 1) / state.data.length) * 100}%`;

  // Add spheres
  addYearColors(yearColors);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);

  // Auto-rotation
  group.rotation.y += CONFIG.rotationSpeed;

  // Update breathing in shaders
  if (state.instancedSpheres?.material?.uniforms) {
    const uniforms = state.instancedSpheres.material.uniforms;
    uniforms.uTime.value += CONFIG.breathingEffect.speed;
    uniforms.uBreathingEnabled.value = CONFIG.breathingEffect.enabled ? 1.0 : 0.0;
  }

  if (state.points?.material?.uniforms) {
    const uniforms = state.points.material.uniforms;
    uniforms.uTime.value += CONFIG.breathingEffect.speed;
    uniforms.uBreathingEnabled.value = CONFIG.breathingEffect.enabled ? 1.0 : 0.0;
  }

  // Update controls
  controls.update();

  // Render with post-processing
  composer.render();
}

// --- Initialization --------------------------------------------------------------
async function initVisualization() {
  state.data = await loadData();
  console.log(`Loaded data for ${state.data.length} years`);

  // Calculate approximately how many spheres we'll need
  const levels = Math.pow(2, CONFIG.colorDepth);
  const hueSteps = Math.round(levels * 1.6);
  const satSteps = Math.round(levels * 0.75);
  const lightSteps = Math.round(levels * 0.75);
  const estimatedColors = hueSteps * satSteps * lightSteps;

  // Choose rendering method - comment out one of these
  setupShaderInstancedMesh(estimatedColors);
  //setupPointCloudMesh(estimatedColors); // Alternate option for better performance
}

// Window resize handler
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// Start everything
(async function init() {
  createUI();
  await initVisualization();
  animate();
})();
