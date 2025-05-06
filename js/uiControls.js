import * as THREE from "three";
import { CONFIG } from "./config.js";
import { toggleClusterView, clusterState } from "./cluster_viz.js";

export class UIControls {
  constructor(state, renderer, timeline) {
    this.state = state;
    this.renderer = renderer;
    this.timeline = timeline;
  }

  setupUI() {
    this.state.yearDisplay = document.getElementById("year-display");
    this.state.playButton = document.getElementById("play-pause");

    this.state.playButton.addEventListener("click", () => {
      if (!this.state.playing) {
        if (this.state.i >= this.state.data.length - 1) this.timeline.reset();
        this.timeline.play();
      } else {
        this.timeline.pause();
      }
    });

    document.getElementById("view-top").addEventListener("click", () => {
      this.animateCameraTo({ x: 0, y: 1, z: 0 });
    });

    document.getElementById("view-bottom").addEventListener("click", () => {
      this.animateCameraTo({ x: 0, y: -1, z: 0 });
    });

    document.getElementById("view-default").addEventListener("click", () => {
      const initialPos = CONFIG.camera.initialPosition;
      const initialVector = new THREE.Vector3(initialPos[0], initialPos[1], initialPos[2]);
      const initialSpherical = new THREE.Spherical().setFromVector3(initialVector);
      const camera = this.renderer.camera;
      const currentPosition = camera.position.clone();
      const currentSpherical = new THREE.Spherical().setFromVector3(currentPosition);

      const targetSpherical = new THREE.Spherical(
        currentSpherical.radius,
        initialSpherical.phi,
        currentSpherical.theta
      );

      const targetVector = new THREE.Vector3().setFromSpherical(targetSpherical);

      this.animateCameraTo({
        x: targetVector.x,
        y: targetVector.y,
        z: targetVector.z,
      });
    });
  }

  setupClusterControls() {
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
        toggleClusterView(
          this.renderer,
          true,
          this.state.data[this.state.i].year,
          parseInt(kSelect.value),
          this.state.instancedSpheres
        );
      } else {
        toggleButton.textContent = "Show Clusters";
        kSelect.style.display = "none";
        toggleClusterView(this.renderer, false, null, null, this.state.instancedSpheres);
      }
    });

    kSelect.addEventListener("change", () => {
      if (clusterState.isActive) {
        toggleClusterView(
          this.renderer,
          true,
          this.state.data[this.state.i].year,
          parseInt(kSelect.value),
          this.state.instancedSpheres
        );
      }
    });
  }

  animateCameraTo(targetDirection) {
    const camera = this.renderer.camera;
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
}
