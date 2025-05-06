import * as THREE from "three";
import { quantizeColor, calculatePosition } from "./config.js";

export class ColorProcessor {
  constructor(state, renderer) {
    this.state = state;
    this.renderer = renderer;
    this.dummy = new THREE.Object3D();
  }

  static processYear(yearData, state) {
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
}
