import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CONFIG } from "./config.js";

// Shaders for instanced geometry
const INSTANCE_VERTEX_SHADER = `
attribute vec3 instanceColor;
attribute vec3 iPosition;
attribute float iScale;
varying vec3 vColor;
varying vec3 vNormal;

void main() {
  vColor = instanceColor;
  vNormal = normal;
  vec3 scaledPosition = position * iScale;
  vec4 mvPosition = modelViewMatrix * vec4(iPosition + scaledPosition, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}`;

const INSTANCE_FRAGMENT_SHADER = (config) => `
uniform float opacity;
varying vec3 vColor;
varying vec3 vNormal;

void main() {
  vec3 finalColor = vColor * ${config.pointAppearance.shader.ambientIntensity.toFixed(2)};
  gl_FragColor = vec4(finalColor, opacity);
}`;

export class Renderer {
  constructor() {
    this.setupScene();
    this.setupCamera();
    this.setupRenderer();
    this.setupLighting();
    this.setupControls();
    this.setupEventListeners();
  }

  // Get visualization container dimensions
  getContainerDimensions() {
    const vizContainer = document.querySelector(".visualization");
    if (vizContainer) {
      return {
        element: vizContainer,
        width: vizContainer.clientWidth,
        height: vizContainer.clientHeight,
      };
    }

    // Fallback dimensions
    return {
      element: null,
      width: window.innerWidth * 0.75,
      height: window.innerHeight,
    };
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.group = new THREE.Group();
    this.scene.add(this.group);
  }

  setupCamera() {
    const { width, height } = this.getContainerDimensions();
    const aspect = width / height;

    this.camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, aspect, 1, 1000);

    this.camera.position.set(...CONFIG.camera.initialPosition);
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });

    const { element, width, height } = this.getContainerDimensions();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));

    if (element) {
      element.appendChild(this.renderer.domElement);
    } else {
      document.body.appendChild(this.renderer.domElement);
    }

    // Enhanced visual settings
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(CONFIG.lighting.ambient.color, CONFIG.lighting.ambient.intensity);
    this.scene.add(ambientLight);
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableZoom = false;

    // Set initial camera position and rotation
    const initialAngleRad = ((CONFIG.camera.initialRotation || 0) * Math.PI) / 180;
    const distance = Math.sqrt(Math.pow(this.camera.position.x, 2) + Math.pow(this.camera.position.z, 2));

    this.camera.position.x = Math.sin(initialAngleRad) * distance;
    this.camera.position.z = Math.cos(initialAngleRad) * distance;

    // Focus camera
    this.controls.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);

    // Motion settings
    this.controls.enableDamping = true;
    this.controls.dampingFactor = CONFIG.camera.damping;

    // Auto-rotation
    setTimeout(() => {
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = CONFIG.camera.autoRotateSpeed;
      setTimeout(() => {
        this.controls.autoRotate = false;
      }, CONFIG.camera.autoRotateDuration);
    }, 1000);
  }

  setupEventListeners() {
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  handleResize() {
    const { width, height } = this.getContainerDimensions();

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);

    // Maintain consistent zoom
    if (!CONFIG.camera.zoomControl.enabled) {
      const dir = this.camera.position.clone().normalize();
      const fixedDistance = CONFIG.camera.zoomControl.initialDistance;
      this.camera.position.set(dir.x * fixedDistance, dir.y * fixedDistance, dir.z * fixedDistance);
    }
  }

  render() {
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setupShaderInstancedMesh(estimatedCount) {
    // Create geometry
    const baseGeometry = new THREE.SphereGeometry(CONFIG.smallSphereRadius, 6, 4);

    // Create instance attributes
    const positionArray = new Float32Array(estimatedCount * 3);
    const scaleArray = new Float32Array(estimatedCount);
    const colorArray = new Float32Array(estimatedCount * 3);

    // Apply attributes
    baseGeometry.setAttribute("iPosition", new THREE.InstancedBufferAttribute(positionArray, 3));
    baseGeometry.setAttribute("iScale", new THREE.InstancedBufferAttribute(scaleArray, 1));
    baseGeometry.setAttribute("instanceColor", new THREE.InstancedBufferAttribute(colorArray, 3));

    // Create shader material
    const material = new THREE.ShaderMaterial({
      vertexShader: INSTANCE_VERTEX_SHADER,
      fragmentShader: INSTANCE_FRAGMENT_SHADER(CONFIG),
      uniforms: {
        opacity: { value: 1.0 },
      },
      transparent: true,
    });

    // Create and add instanced mesh
    const spheres = new THREE.InstancedMesh(baseGeometry, material, estimatedCount);
    spheres.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    this.group.add(spheres);

    return spheres;
  }
}
