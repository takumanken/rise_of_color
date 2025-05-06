import { CONFIG } from "./config.js";
import { clusterState, toggleClusterView } from "./cluster_viz.js";
import { ColorProcessor } from "./colorProcessor.js";

export class Timeline {
  constructor(state, renderer) {
    this.state = state;
    this.renderer = renderer;
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
    const minYearElem = document.getElementById("min-year");
    const maxYearElem = document.getElementById("max-year");

    const minYear = 1850;
    const maxYear = 2025;

    minYearElem.textContent = minYear;
    maxYearElem.textContent = maxYear;

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

  play() {
    this.state.playing = true;
    this.state.playButton.textContent = "Pause";
    this.state.timer = setInterval(() => this.step(), CONFIG.animationSpeed);
  }

  pause() {
    this.state.playing = false;
    this.state.playButton.textContent = "Resume";
    clearInterval(this.state.timer);
  }

  reset() {
    this.pause();

    this.state.i = -1;
    this.state.colorData = [];
    this.state.seen = new Set();
    this.state.totalSpheres = 0;
    this.state.instanceCount = 0;

    while (this.renderer.group.children.length > 0) {
      this.renderer.group.remove(this.renderer.group.children[0]);
    }

    this.state.yearDisplay.textContent = "–";
    document.getElementById("total-colors").textContent = "0";
    this.state.progressFill.style.width = "0%";
    this.state.playButton.textContent = "Start";

    if (!this.state.isJumping) {
      this.initVisualization();
    } else {
      this.state.instancedSpheres = this.renderer.setupShaderInstancedMesh(2000000);
    }
  }

  step() {
    if (this.state.i >= this.state.data.length - 1) {
      this.pause();
      this.state.playButton.textContent = "Restart";
      return;
    }

    this.state.i++;
    const yearData = this.state.data[this.state.i];
    const yearColors = ColorProcessor.processYear(yearData, this.state);

    this.state.yearDisplay.textContent = yearData.year;
    document.getElementById("total-colors").textContent = this.state.colorData.length.toLocaleString();
    this.state.progressFill.style.width = `${((this.state.i + 1) / this.state.data.length) * 100}%`;

    ColorProcessor.addYearColors(yearColors, this.state);

    if (clusterState.isActive) {
      toggleClusterView(this.renderer, true, yearData.year, clusterState.currentK, this.state.instancedSpheres);
    }

    const slider = document.getElementById("year-slider");
    slider.value = yearData.year;
  }

  async initVisualization() {
    document.getElementById("loading-message").textContent = "Loading...";
    this.state.loading.isLoading = true;
    this.state.playButton.disabled = true;

    this.state.data = await this.loadData();
    this.state.instancedSpheres = this.renderer.setupShaderInstancedMesh(2000000);

    this.state.playing = true;
    this.state.playButton.textContent = "Pause";
    this.step();

    this.state.timer = setInterval(() => this.step(), CONFIG.animationSpeed);

    setTimeout(() => {
      document.getElementById("loading-overlay").style.opacity = 0;
      setTimeout(() => {
        document.getElementById("loading-overlay").style.display = "none";
      }, 500);
      this.state.loading.isLoading = false;
      this.state.playButton.disabled = false;
    }, 100);

    this.setupYearSlider();
  }
}
