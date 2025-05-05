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
// Set up UI elements that now exist in the HTML
function setupUI() {
  // Get references to DOM elements
  state.yearDisplay = document.getElementById("year-display");
  state.progressFill = document.getElementById("progress-fill");
  state.playButton = document.getElementById("play-pause");

  // Event listeners
  state.playButton.addEventListener("click", () => {
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
  setupUI();
  await initVisualization();
  animate();
})();
