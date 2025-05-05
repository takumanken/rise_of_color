import * as THREE from "three";
import { CONFIG, quantizeColorHSL, quantizeColor, calculatePosition, rgbToHsl } from "./config.js";
import { Renderer } from "./renderer.js";

// Application State
const state = {
  data: [], // All data from JSON
  i: -1, // Current year index
  playing: false, // Is animation playing?
  timer: null, // Animation timer
  colorData: [], // All processed colors
  seen: new Set(), // Track unique colors
  totalSpheres: 0, // Track sphere count
  instanceCount: 0, // Track instance count
};

// Create renderer
const renderer = new Renderer();
// Create dummy for instanced mesh
const dummy = new THREE.Object3D();

// --- UI Elements --------------------------------------------------------------
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
  state.instanceCount = 0;

  // Remove all spheres
  while (renderer.group.children.length > 0) {
    renderer.group.remove(renderer.group.children[0]);
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
  renderer.group.rotation.y += CONFIG.rotationSpeed;

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

  // Render
  renderer.render();
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
  state.instancedSpheres = renderer.setupShaderInstancedMesh(estimatedColors);
  state.dummy = dummy;
  //state.points = renderer.setupPointCloudMesh(estimatedColors); // Alternate option for better performance
}

// Start everything
(async function init() {
  createUI();
  await initVisualization();
  animate();
})();
