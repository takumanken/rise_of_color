import * as THREE from "three";
import { calculatePosition } from "./config.js";

export class ColorProcessor {
  constructor(state, renderer) {
    this.state = state;
    this.renderer = renderer;
    this.dummy = new THREE.Object3D();
  }

  static processYear(yearData, state) {
    const yearColors = [];

    for (const packedColor of yearData.color) {
      // Unpack RGB components
      const r = (packedColor >> 16) & 255;
      const g = (packedColor >> 8) & 255;
      const b = packedColor & 255;

      // Create color key (no quantization)
      const colorKey = `${r},${g},${b}`;

      // Skip already seen colors
      if (state.seen.has(colorKey)) continue;
      state.seen.add(colorKey);

      // Calculate position with original color
      const colorData = calculatePosition([r, g, b]);

      // Add normalized RGB values for rendering
      colorData.r = r / 255;
      colorData.g = g / 255;
      colorData.b = b / 255;

      yearColors.push(colorData);
    }

    // Add to master list without spread
    for (let i = 0; i < yearColors.length; i++) {
      state.colorData.push(yearColors[i]);
    }

    return yearColors;
  }

  static addYearColors(yearColors, state) {
    const spheres = state.instancedSpheres;
    const positionAttr = spheres.geometry.getAttribute("iPosition");
    const scaleAttr = spheres.geometry.getAttribute("iScale");
    const colorAttr = spheres.geometry.getAttribute("instanceColor");

    const dummy = new THREE.Object3D();
    dummy.position.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();

    yearColors.forEach((colorData) => {
      positionAttr.setXYZ(state.instanceCount, colorData.x, colorData.y, colorData.z);

      const dotScale = 0.8 + colorData.c * 0.4;
      scaleAttr.setX(state.instanceCount, dotScale);

      colorAttr.setXYZ(state.instanceCount, colorData.r, colorData.g, colorData.b);

      spheres.setMatrixAt(state.instanceCount, dummy.matrix);
      state.instanceCount++;
    });

    spheres.count = state.instanceCount;
    positionAttr.needsUpdate = true;
    scaleAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    spheres.instanceMatrix.needsUpdate = true;
  }
}
