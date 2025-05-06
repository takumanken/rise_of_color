import { CONFIG } from "./config.js";
import { clusterState, toggleClusterView } from "./cluster_viz.js";
import { ColorProcessor } from "./colorProcessor.js";

export class Timeline {
  constructor(state, renderer) {
    this.state = state;
    this.renderer = renderer;
    this.resettingFromPlay = false;
    this.sliderInitialized = false;
  }

  // ===== DATA LOADING =====

  async loadData() {
    try {
      const response = await fetch("assets/unique_colors_history.json");
      return await response.json();
    } catch (err) {
      console.error("Error loading data:", err);
      return [];
    }
  }

  async initVisualization(skipTimer = false) {
    this._stopTimer();

    // Show loading state
    document.getElementById("loading-message").textContent = "Loading...";
    this.state.loading.isLoading = true;
    this.state.playButton.disabled = true;

    // Load data and initialize 3D objects
    this.state.data = await this.loadData();
    this.state.instancedSpheres = this.renderer.setupShaderInstancedMesh(2000000);

    // Setup slider once
    if (!this.sliderInitialized) {
      this.setupYearSlider();
      this.sliderInitialized = true;
    }

    // Set initial UI state
    this.state.playing = true;
    this.state.playButton.textContent = "";
    this.state.playButton.classList.remove("play");
    this.state.playButton.classList.add("pause");

    // Start animation if not being reset during play
    if (!skipTimer) {
      this._startTimer();
    }

    // Hide loading overlay
    setTimeout(() => {
      document.getElementById("loading-overlay").style.opacity = 0;
      setTimeout(() => {
        document.getElementById("loading-overlay").style.display = "none";
      }, 500);
      this.state.loading.isLoading = false;
      this.state.playButton.disabled = false;
    }, 100);
  }

  // ===== PLAYBACK CONTROLS =====

  _startTimer() {
    this._stopTimer();
    this.state.timer = setInterval(() => this.step(), CONFIG.animationSpeed);
  }

  _stopTimer() {
    if (this.state.timer !== null) {
      clearInterval(this.state.timer);
      this.state.timer = null;
    }
  }

  async play() {
    // Prevent double-click issues
    if (this.state.playing) return;

    // Reset if at the end
    if (this.state.i >= this.state.data.length - 1) {
      this.resettingFromPlay = true;
      await this.reset();
      this.resettingFromPlay = false;
    }

    // Update UI
    this.state.playing = true;
    this.state.playButton.textContent = "";
    this.state.playButton.classList.remove("play");
    this.state.playButton.classList.add("pause");

    // Start playback
    this._startTimer();
  }

  pause() {
    this.state.playing = false;
    this.state.playButton.textContent = "";
    this.state.playButton.classList.remove("pause");
    this.state.playButton.classList.add("play");
    this._stopTimer();
  }

  async reset() {
    this.pause();

    // Reset state
    this.state.i = -1;
    this.state.colorData = [];
    this.state.seen = new Set();
    this.state.totalSpheres = 0;
    this.state.instanceCount = 0;

    // Clean up 3D objects and release memory
    this._disposeThreeJsObjects();

    // Reset UI
    this.state.yearDisplay.textContent = "–";
    document.getElementById("total-colors").textContent = "0";
    this.state.playButton.textContent = "";
    this.state.playButton.classList.remove("pause");
    this.state.playButton.classList.add("play");

    // Reinitialize visualization
    if (!this.state.isJumping) {
      await this.initVisualization(this.resettingFromPlay);
    } else {
      this.state.instancedSpheres = this.renderer.setupShaderInstancedMesh(2000000);
    }
  }

  _disposeThreeJsObjects() {
    while (this.renderer.group.children.length > 0) {
      const obj = this.renderer.group.children[0];
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((mat) => mat.dispose());
        } else {
          obj.material.dispose();
        }
      }
      this.renderer.group.remove(obj);
    }
  }

  step() {
    // Handle end of timeline
    if (this.state.i >= this.state.data.length - 1) {
      this.pause();
      this.state.playButton.classList.remove("pause");
      this.state.playButton.classList.add("play");
      return;
    }

    // Advance to next year
    this.state.i++;
    const yearData = this.state.data[this.state.i];
    const yearColors = ColorProcessor.processYear(yearData, this.state);

    // Update UI
    this.state.yearDisplay.textContent = yearData.year;
    document.getElementById("total-colors").textContent = this.state.colorData.length.toLocaleString();
    document.getElementById("year-slider").value = yearData.year;

    // Update visualization
    ColorProcessor.addYearColors(yearColors, this.state);

    // Update clusters if active
    if (clusterState.isActive) {
      toggleClusterView(this.renderer, true, yearData.year, clusterState.currentK, this.state.instancedSpheres);
    }
  }

  // ===== SLIDER CONTROLS =====

  setupYearSlider() {
    const slider = document.getElementById("year-slider");
    slider.min = 1850;
    slider.max = 2025;
    slider.value = 1850;

    slider.addEventListener("input", (e) => {
      const targetYear = parseInt(e.target.value);
      const targetIndex = this.state.data.findIndex((item) => item.year >= targetYear);

      if (targetIndex === -1) return;
      if (this.state.playing) this.pause();

      this.jumpToYear(targetIndex);
    });
  }

  jumpToYear(index) {
    const targetYear = this.state.data[index].year;
    const slider = document.getElementById("year-slider");

    // Reset if jumping backward
    if (index < this.state.i) {
      this.state.isJumping = true;
      this.reset();
      this.state.i = -1;
      this.state.isJumping = false;
    }

    // Step forward to target year
    while (this.state.i < index) {
      this.step();
    }

    // Ensure slider shows correct year
    slider.value = targetYear;
  }
}
