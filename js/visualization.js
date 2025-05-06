import * as THREE from "three";
import { Renderer } from "./renderer.js";
import { Timeline } from "./timeline.js";
import { ColorProcessor } from "./colorProcessor.js";
import { UIControls } from "./uiControls.js";
import { loadClusterData } from "./cluster_viz.js";

// Global application state
export const state = {
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

// Main components (using the existing class-based architecture)
export const renderer = new Renderer();
export const timeline = new Timeline(state, renderer);
export const colorProcessor = new ColorProcessor(state, renderer);
export const uiControls = new UIControls(state, renderer, timeline);

// Initialize the application (simplified)
(async function init() {
  // Setup UI
  uiControls.setupUI();

  // Initialize visualization
  await timeline.initVisualization();

  // Set up clusters
  const clusteringAvailable = await loadClusterData();
  if (clusteringAvailable) {
    uiControls.setupClusterControls();
  } else {
    document.querySelector(".cluster-controls").style.display = "none";
  }

  // Start animation loop
  animate();
})();

function animate() {
  requestAnimationFrame(animate);
  renderer.group.rotation.y += 0.0015;
  renderer.render();
}
