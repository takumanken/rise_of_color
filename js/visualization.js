import * as THREE from "three";
import { CONFIG, quantizeColor, calculatePosition } from "./config.js";
import { Renderer } from "./renderer.js";
import { loadClusterData, toggleClusterView, clusterState } from "./cluster_viz.js";

// Application State
const state = {
  data: [], // All years from JSON
  i: -1, // Current year index
  playing: false, // Animation state
  timer: null, // Animation timer
  colorData: [], // Processed colors
  seen: new Set(), // Unique colors tracker
  totalSpheres: 0, // Total sphere count
  instanceCount: 0, // Instance tracker
  instancedSpheres: null, // Instanced mesh reference
  yearDisplay: null, // UI elements
  progressFill: null,
  playButton: null,
  loading: {
    isLoading: true,
    dataReady: false,
    message: "Loading visualization data...",
  },
};

// Create renderer and dummy for instanced mesh
const renderer = new Renderer();
const dummy = new THREE.Object3D();

// UI Setup
function setupUI() {
  state.yearDisplay = document.getElementById("year-display");
  state.progressFill = document.getElementById("progress-fill");
  state.playButton = document.getElementById("play-pause");

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

// Data Handling
async function loadData() {
  try {
    const response = await fetch("assets/unique_colors_history.json");
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
    const quantizedRgb = quantizeColor(rgb);
    const key = quantizedRgb.join(",");

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
  const positionAttr = spheres.geometry.getAttribute("iPosition");
  const scaleAttr = spheres.geometry.getAttribute("iScale");
  const colorAttr = spheres.geometry.getAttribute("instanceColor");

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

// Animation Control
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
  document.getElementById("total-colors").textContent = state.colorData.length.toLocaleString();
  state.progressFill.style.width = `${((state.i + 1) / state.data.length) * 100}%`;

  // Add spheres
  addYearColors(yearColors);

  // Update clusters if they're being displayed
  if (clusterState.isActive) {
    toggleClusterView(renderer, true, yearData.year, clusterState.currentK, state.instancedSpheres);
  }
}

function animate() {
  requestAnimationFrame(animate);
  renderer.group.rotation.y += CONFIG.rotationSpeed;
  renderer.render();
}

// Initialization
async function initVisualization() {
  // Show loading state
  document.getElementById("loading-message").textContent = "Loading color data...";
  state.loading.isLoading = true;
  state.playButton.disabled = true;

  // Load data with progress indication if possible
  state.data = await loadData();
  document.getElementById("loading-message").textContent = "Initializing visualization...";

  // Create mesh with capacity estimate
  const estimatedColors = 2000000;
  state.instancedSpheres = renderer.setupShaderInstancedMesh(estimatedColors);

  // Hide loading overlay when ready
  setTimeout(() => {
    document.getElementById("loading-overlay").style.opacity = 0;
    setTimeout(() => {
      document.getElementById("loading-overlay").style.display = "none";
    }, 500);
    state.loading.isLoading = false;
    state.playButton.disabled = false;
  }, 500);
}

function setupClusterControls() {
  const toggleButton = document.getElementById("toggle-clusters");
  const kSelect = document.getElementById("cluster-k");

  // Setup cluster size options
  kSelect.innerHTML = "";
  const kValues = [4, 8, 16, 32, 64];

  kValues.forEach((k) => {
    const option = document.createElement("option");
    option.value = k;
    option.textContent = `${k} Clusters`;
    kSelect.appendChild(option);
  });

  kSelect.value = "16";

  // Toggle clusters visibility
  toggleButton.addEventListener("click", () => {
    const showClusters = toggleButton.textContent === "Show Clusters";

    if (showClusters) {
      toggleButton.textContent = "Show All Colors";
      kSelect.style.display = "inline-block";

      toggleClusterView(renderer, true, state.data[state.i].year, parseInt(kSelect.value), state.instancedSpheres);
    } else {
      toggleButton.textContent = "Show Clusters";
      kSelect.style.display = "none";

      toggleClusterView(renderer, false, null, null, state.instancedSpheres);
    }
  });

  // Handle cluster count changes
  kSelect.addEventListener("change", () => {
    if (clusterState.isActive) {
      toggleClusterView(renderer, true, state.data[state.i].year, parseInt(kSelect.value), state.instancedSpheres);
    }
  });
}

// Initialize application
(async function init() {
  setupUI();
  await initVisualization();

  // Set up clustering if available
  const clusteringAvailable = await loadClusterData();

  if (clusteringAvailable) {
    setupClusterControls();
  } else {
    document.querySelector(".cluster-controls").style.display = "none";
  }

  animate();
})();
