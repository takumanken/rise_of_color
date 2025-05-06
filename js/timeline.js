import { CONFIG } from "./config.js";
import { clusterState, toggleClusterView } from "./cluster_viz.js";
import { ColorProcessor } from "./colorProcessor.js";

export class Timeline {
  constructor(state, renderer) {
    this.state = state;
    this.renderer = renderer;
    this.resettingFromPlay = false; // Track if reset was called from play
  }

  // Helper methods for timer management
  _startTimer() {
    this._stopTimer(); // Always ensure only one timer is running
    this.state.timer = setInterval(() => this.step(), CONFIG.animationSpeed);
  }

  _stopTimer() {
    if (this.state.timer !== null) {
      clearInterval(this.state.timer);
      this.state.timer = null;
    }
  }

  async loadData() {
    try {
      const response = await fetch("assets/unique_colors_history.json");
      return await response.json();
    } catch (err) {
      console.error("Error loading data:", err);
      return [];
    }
  }

  setupYearSlider() {
    const slider = document.getElementById("year-slider");
    const minYear = 1850;
    const maxYear = 2025;
    slider.min = minYear;
    slider.max = maxYear;
    slider.value = minYear;

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
    slider.value = targetYear;

    if (index < this.state.i) {
      this.state.isJumping = true;
      this.reset();
      this.state.i = -1;
      this.state.isJumping = false;
    }

    while (this.state.i < index) {
      this.step();
    }

    slider.value = targetYear;
  }

  async play() {
    // Guard against double play clicks
    if (this.state.playing) return;

    // If we're at the end, restart first
    if (this.state.i >= this.state.data.length - 1) {
      this.resettingFromPlay = true;
      await this.reset();
      this.resettingFromPlay = false;
    }

    this.state.playing = true;
    this.state.playButton.textContent = "";
    this.state.playButton.classList.remove("play");
    this.state.playButton.classList.add("pause");

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

    this.state.i = -1;
    this.state.colorData = [];
    this.state.seen = new Set();
    this.state.totalSpheres = 0;
    this.state.instanceCount = 0;

    // Properly dispose of Three.js objects
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

    this.state.yearDisplay.textContent = "–";
    document.getElementById("total-colors").textContent = "0";
    this.state.playButton.textContent = "";
    this.state.playButton.classList.remove("pause");
    this.state.playButton.classList.add("play");

    if (!this.state.isJumping) {
      // Pass flag to initVisualization to prevent it from starting its own timer
      await this.initVisualization(this.resettingFromPlay);
    } else {
      this.state.instancedSpheres = this.renderer.setupShaderInstancedMesh(2000000);
    }
  }

  step() {
    if (this.state.i >= this.state.data.length - 1) {
      this.pause();
      // Don't change the button text - just make it a play button
      this.state.playButton.classList.remove("pause");
      this.state.playButton.classList.add("play");
      return;
    }

    this.state.i++;
    const yearData = this.state.data[this.state.i];
    const yearColors = ColorProcessor.processYear(yearData, this.state);

    this.state.yearDisplay.textContent = yearData.year;
    document.getElementById("total-colors").textContent = this.state.colorData.length.toLocaleString();

    ColorProcessor.addYearColors(yearColors, this.state);

    if (clusterState.isActive) {
      toggleClusterView(this.renderer, true, yearData.year, clusterState.currentK, this.state.instancedSpheres);
    }

    const slider = document.getElementById("year-slider");
    slider.value = yearData.year;
  }

  async initVisualization(skipTimer = false) {
    this._stopTimer();

    document.getElementById("loading-message").textContent = "Loading...";
    this.state.loading.isLoading = true;
    this.state.playButton.disabled = true;

    this.state.data = await this.loadData();
    this.state.instancedSpheres = this.renderer.setupShaderInstancedMesh(2000000);

    if (!this.sliderInitialized) {
      this.setupYearSlider();
      this.sliderInitialized = true;
    }

    // Update button state to show pause icon
    this.state.playing = true;
    this.state.playButton.textContent = "";
    this.state.playButton.classList.remove("play");
    this.state.playButton.classList.add("pause");

    // Only set up timer if not reset from play
    if (!skipTimer) {
      this._startTimer();
    }

    setTimeout(() => {
      document.getElementById("loading-overlay").style.opacity = 0;
      setTimeout(() => {
        document.getElementById("loading-overlay").style.display = "none";
      }, 500);
      this.state.loading.isLoading = false;
      this.state.playButton.disabled = false;
    }, 100);
  }
}
