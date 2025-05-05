import * as THREE from "three";
import { CONFIG, quantizeColor, calculatePosition, rgbToHsl } from "./config.js";
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

// Create renderer and dummy for instanced mesh
const renderer = new Renderer();
const dummy = new THREE.Object3D();

// ----- UI SETUP -----------------------------------------------------
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

// ----- DATA HANDLING ------------------------------------------------
async function loadData() {
  try {
    const response = await fetch("download_data/unique_colors_history.json");
    return await response.json();
  } catch (err) {
    console.error("Error loading data:", err);
    return [];
  }
}

function processYear(yearData) {
  const yearColors = [];
  const colors = yearData.color || [];

  for (const rgb of colors) {
    // Quantize and create a unique key
    const quantizedRgb = quantizeColor(rgb);
    const key = quantizedRgb.join(",");

    // Only add if we haven't seen this color before
    if (!state.seen.has(key)) {
      state.seen.add(key);
      const position = calculatePosition(quantizedRgb);

      yearColors.push(position);
      state.colorData.push(position);
      state.totalSpheres++;
    }
  }

  return yearColors;
}

function addYearColors(yearColors) {
  const spheres = state.instancedSpheres;

  // Get attributes
  const positionAttr = spheres.geometry.getAttribute("iPosition");
  const scaleAttr = spheres.geometry.getAttribute("iScale");
  const colorAttr = spheres.geometry.getAttribute("instanceColor");

  // Prepare dummy object for matrix
  dummy.position.set(0, 0, 0);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();

  yearColors.forEach((colorData) => {
    // Position
    positionAttr.setXYZ(state.instanceCount, colorData.x, colorData.y, colorData.z);

    // Scale based on color saturation
    const dotScale = 0.8 + colorData.c * 0.4;
    scaleAttr.setX(state.instanceCount, dotScale);

    // Color
    colorAttr.setXYZ(state.instanceCount, colorData.rgb[0] / 255, colorData.rgb[1] / 255, colorData.rgb[2] / 255);

    // Matrix
    spheres.setMatrixAt(state.instanceCount, dummy.matrix);
    state.instanceCount++;
  });

  // Update buffers
  spheres.count = state.instanceCount;
  positionAttr.needsUpdate = true;
  scaleAttr.needsUpdate = true;
  colorAttr.needsUpdate = true;
  spheres.instanceMatrix.needsUpdate = true;
}

// ----- ANIMATION CONTROL --------------------------------------------
function play() {
  state.playing = true;
  state.playButton.textContent = "Pause";
  state.timer = setInterval(step, CONFIG.animationSpeed);
}

function pause() {
  state.playing = false;
  state.playButton.textContent = "Resume";
  clearInterval(state.timer);
}

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
  state.progressFill.style.width = "0%";
  state.playButton.textContent = "Start";

  // Recreate visualization
  initVisualization();
}

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
  document.getElementById("total-colors").textContent = state.colorData.length;
  state.progressFill.style.width = `${((state.i + 1) / state.data.length) * 100}%`;

  // Add spheres
  addYearColors(yearColors);
}

function animate() {
  requestAnimationFrame(animate);
  renderer.group.rotation.y += CONFIG.rotationSpeed;
  renderer.render();
}

// ----- INITIALIZATION ----------------------------------------------
async function initVisualization() {
  state.data = await loadData();
  console.log(`Loaded data for ${state.data.length} years`);

  // Create mesh with reasonable capacity estimate
  const estimatedColors = 2000000;
  state.instancedSpheres = renderer.setupShaderInstancedMesh(estimatedColors);
}

// Start everything
(async function init() {
  setupUI();
  await initVisualization();
  animate();
})();
