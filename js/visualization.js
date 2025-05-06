import * as THREE from "three";
import { CONFIG, quantizeColor, calculatePosition } from "./config.js";
import { Renderer } from "./renderer.js";
import { loadClusterData, toggleClusterView, clusterState } from "./cluster_viz.js";

// Application State
const state = {
  data: [],
  i: -1,
  playing: false,
  timer: null,
  colorData: [],
  seen: new Set(),
  totalSpheres: 0,
  instanceCount: 0,
  instancedSpheres: null,
  yearDisplay: null,
  progressFill: null,
  playButton: null,
  loading: { isLoading: true },
  isJumping: false,
};

const renderer = new Renderer();
const dummy = new THREE.Object3D();

function setupUI() {
  state.yearDisplay = document.getElementById("year-display");
  state.progressFill = document.getElementById("progress-fill");
  state.playButton = document.getElementById("play-pause");

  state.playButton.addEventListener("click", () => {
    if (!state.playing) {
      if (state.i >= state.data.length - 1) reset();
      play();
    } else {
      pause();
    }
  });

  document.getElementById("view-top").addEventListener("click", () => {
    animateCameraTo({ x: 0, y: 1, z: 0 });
  });

  document.getElementById("view-bottom").addEventListener("click", () => {
    animateCameraTo({ x: 0, y: -1, z: 0 });
  });

  document.getElementById("view-default").addEventListener("click", () => {
    const initialPos = CONFIG.camera.initialPosition;
    const initialVector = new THREE.Vector3(initialPos[0], initialPos[1], initialPos[2]);
    const initialSpherical = new THREE.Spherical().setFromVector3(initialVector);
    const camera = renderer.camera;
    const currentPosition = camera.position.clone();
    const currentSpherical = new THREE.Spherical().setFromVector3(currentPosition);
    const targetSpherical = new THREE.Spherical(currentSpherical.radius, initialSpherical.phi, currentSpherical.theta);
    const targetVector = new THREE.Vector3().setFromSpherical(targetSpherical);
    animateCameraTo({
      x: targetVector.x,
      y: targetVector.y,
      z: targetVector.z,
    });
  });
}

async function loadData() {
  try {
    const response = await fetch("assets/unique_colors_history.json");
    return await response.json();
  } catch (err) {
    console.error("Error loading data:", err);
    return [];
  }
}

function setupYearSlider() {
  const slider = document.getElementById("year-slider");
  const minYearElem = document.getElementById("min-year");
  const maxYearElem = document.getElementById("max-year");

  const minYear = 1850;
  const maxYear = 2025;

  minYearElem.textContent = minYear;
  maxYearElem.textContent = maxYear;

  slider.min = minYear;
  slider.max = maxYear;
  slider.value = minYear;

  slider.addEventListener("input", function () {
    const targetYear = parseInt(this.value);
    const targetIndex = state.data.findIndex((item) => item.year >= targetYear);

    if (targetIndex === -1) return;

    if (state.playing) pause();

    jumpToYear(targetIndex);
  });
}

function jumpToYear(index) {
  const targetYear = state.data[index].year;
  const slider = document.getElementById("year-slider");
  slider.value = targetYear;

  if (index < state.i) {
    state.isJumping = true;
    reset();
    state.i = -1;
    state.isJumping = false;
  }

  while (state.i < index) {
    step();
  }

  slider.value = targetYear;
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
    positionAttr.setXYZ(state.instanceCount, colorData.x, colorData.y, colorData.z);

    const dotScale = 0.8 + colorData.c * 0.4;
    scaleAttr.setX(state.instanceCount, dotScale);

    colorAttr.setXYZ(state.instanceCount, colorData.rgb[0] / 255, colorData.rgb[1] / 255, colorData.rgb[2] / 255);

    spheres.setMatrixAt(state.instanceCount, dummy.matrix);
    state.instanceCount++;
  });

  spheres.count = state.instanceCount;
  positionAttr.needsUpdate = true;
  scaleAttr.needsUpdate = true;
  colorAttr.needsUpdate = true;
  spheres.instanceMatrix.needsUpdate = true;
}

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

  while (renderer.group.children.length > 0) {
    renderer.group.remove(renderer.group.children[0]);
  }

  state.yearDisplay.textContent = "–";
  document.getElementById("total-colors").textContent = "0";
  state.progressFill.style.width = "0%";
  state.playButton.textContent = "Start";

  if (!state.isJumping) {
    initVisualization();
  } else {
    state.instancedSpheres = renderer.setupShaderInstancedMesh(2000000);
  }
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

  state.yearDisplay.textContent = yearData.year;
  document.getElementById("total-colors").textContent = state.colorData.length.toLocaleString();
  state.progressFill.style.width = `${((state.i + 1) / state.data.length) * 100}%`;

  addYearColors(yearColors);

  if (clusterState.isActive) {
    toggleClusterView(renderer, true, yearData.year, clusterState.currentK, state.instancedSpheres);
  }

  const slider = document.getElementById("year-slider");
  slider.value = yearData.year;
}

function animate() {
  requestAnimationFrame(animate);
  renderer.group.rotation.y += CONFIG.rotationSpeed;
  renderer.render();
}

async function initVisualization() {
  document.getElementById("loading-message").textContent = "Loading...";
  state.loading.isLoading = true;
  state.playButton.disabled = true;

  state.data = await loadData();
  state.instancedSpheres = renderer.setupShaderInstancedMesh(2000000);

  state.playing = true;
  state.playButton.textContent = "Pause";
  step();

  state.timer = setInterval(step, CONFIG.animationSpeed);

  setTimeout(() => {
    document.getElementById("loading-overlay").style.opacity = 0;
    setTimeout(() => {
      document.getElementById("loading-overlay").style.display = "none";
    }, 500);
    state.loading.isLoading = false;
    state.playButton.disabled = false;
  }, 100);

  setupYearSlider();
}

function setupClusterControls() {
  const toggleButton = document.getElementById("toggle-clusters");
  const kSelect = document.getElementById("cluster-k");

  kSelect.innerHTML = "";
  [4, 8, 16, 32, 64].forEach((k) => {
    const option = document.createElement("option");
    option.value = k;
    option.textContent = `${k} Clusters`;
    kSelect.appendChild(option);
  });

  kSelect.value = "16";

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

  kSelect.addEventListener("change", () => {
    if (clusterState.isActive) {
      toggleClusterView(renderer, true, state.data[state.i].year, parseInt(kSelect.value), state.instancedSpheres);
    }
  });
}

function animateCameraTo(targetDirection) {
  const camera = renderer.camera;
  const startPosition = camera.position.clone();
  const radius = startPosition.length();
  const startSpherical = new THREE.Spherical().setFromVector3(startPosition);

  const targetVector = new THREE.Vector3(targetDirection.x, targetDirection.y, targetDirection.z)
    .normalize()
    .multiplyScalar(radius);
  const targetSpherical = new THREE.Spherical().setFromVector3(targetVector);

  if (Math.abs(targetSpherical.phi - startSpherical.phi) > Math.PI) {
    if (targetSpherical.phi > startSpherical.phi) {
      targetSpherical.phi -= 2 * Math.PI;
    } else {
      targetSpherical.phi += 2 * Math.PI;
    }
  }

  const duration = 1500;
  const startTime = Date.now();

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);

    const currentSpherical = new THREE.Spherical(
      radius,
      startSpherical.phi + (targetSpherical.phi - startSpherical.phi) * easeProgress,
      startSpherical.theta + (targetSpherical.theta - startSpherical.theta) * easeProgress
    );

    camera.position.setFromSpherical(currentSpherical);
    camera.lookAt(0, 0, 0);

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  animate();
}

(async function init() {
  setupUI();
  await initVisualization();

  const clusteringAvailable = await loadClusterData();

  if (clusteringAvailable) {
    setupClusterControls();
  } else {
    document.querySelector(".cluster-controls").style.display = "none";
  }

  animate();
})();
