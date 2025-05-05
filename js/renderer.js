import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CONFIG } from "./config.js";

// Extract shader code as constants
const INSTANCE_VERTEX_SHADER = `
  attribute vec3 instanceColor;
  attribute vec3 iPosition;
  attribute float iScale;
  attribute float iShell;

  uniform float uShellCount;

  varying vec3 vColor;
  varying vec3 vNormal;

  void main() {
    vColor = instanceColor;
    vNormal = normal;

    vec3 scaledPosition = position * iScale;

    vec4 mvPosition = modelViewMatrix * vec4(iPosition + scaledPosition, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const INSTANCE_FRAGMENT_SHADER = (config) => `
  varying vec3 vColor;
  varying vec3 vNormal;

  void main() {
    // Just use original color with minimal spherical shading
    vec3 finalColor = vColor * ${config.pointAppearance.shader.ambientIntensity.toFixed(2)};
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

export class Renderer {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

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
    // Ambient light only
    const ambientLight = new THREE.AmbientLight(
      CONFIG.visualEffects.lighting.ambient.color,
      CONFIG.visualEffects.lighting.ambient.intensity
    );
    this.scene.add(ambientLight);

    // Both main and rim lights removed
  }

  handleResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setupShaderInstancedMesh(estimatedCount) {
    const baseGeometry = new THREE.SphereGeometry(CONFIG.smallSphereRadius, 6, 4);

    const positionArray = new Float32Array(estimatedCount * 3);
    const scaleArray = new Float32Array(estimatedCount);
    const shellArray = new Float32Array(estimatedCount);

    baseGeometry.setAttribute("iPosition", new THREE.InstancedBufferAttribute(positionArray, 3));
    baseGeometry.setAttribute("iScale", new THREE.InstancedBufferAttribute(scaleArray, 1));
    baseGeometry.setAttribute("iShell", new THREE.InstancedBufferAttribute(shellArray, 1));

    const colorArray = new Float32Array(estimatedCount * 3);
    const colorAttribute = new THREE.InstancedBufferAttribute(colorArray, 3);
    baseGeometry.setAttribute("instanceColor", colorAttribute);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uShellCount: { value: CONFIG.shells },
      },
      vertexShader: INSTANCE_VERTEX_SHADER,
      fragmentShader: INSTANCE_FRAGMENT_SHADER(CONFIG),
    });

    const spheres = new THREE.InstancedMesh(baseGeometry, material, estimatedCount);
    spheres.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.group.add(spheres);

    return spheres;
  }
}
