import * as THREE from "three";
import { CONFIG, calculatePosition } from "./config.js";

// State for cluster visualization
export const clusterState = {
  isActive: false,
  currentK: 6,
  currentYear: null,
  clusterData: null,
  centroidMeshes: [],
};

// Load the cluster data
export async function loadClusterData() {
  try {
    const response = await fetch("download_data/yearly_clustered_colors.json");
    if (!response.ok) throw new Error("Failed to load cluster data");

    clusterState.clusterData = await response.json();
    console.log("Loaded cluster data for years:", Object.keys(clusterState.clusterData.year_clusters).length);
    return true;
  } catch (err) {
    console.error("Error loading cluster data:", err);
    return false;
  }
}

// Get cluster data for specific year and k value
export function getYearClusters(year, k) {
  if (!clusterState.clusterData || !clusterState.clusterData.year_clusters) {
    return null;
  }

  // Find the nearest year that has data if exact year not found
  const years = Object.keys(clusterState.clusterData.year_clusters)
    .map((y) => parseInt(y))
    .sort((a, b) => a - b);

  let targetYear = year.toString();
  if (!clusterState.clusterData.year_clusters[targetYear]) {
    // Find closest year less than or equal to target
    const nearestYear = years.filter((y) => y <= parseInt(year)).pop();
    if (nearestYear) {
      targetYear = nearestYear.toString();
    } else {
      return null;
    }
  }

  const yearData = clusterState.clusterData.year_clusters[targetYear];
  return yearData && yearData[k] ? yearData[k] : null;
}

// Display cluster centroids on sphere
export function displayClusterSphere(renderer, year, k) {
  // Clear any existing cluster visualization
  clearClusterVisualization(renderer);

  const clusterData = getYearClusters(year, k);
  if (!clusterData) return;

  clusterState.currentYear = year;
  clusterState.currentK = k;

  // Create spheres for each cluster centroid
  const geometry = new THREE.SphereGeometry(2.0, 24, 24);

  clusterData.centroids.forEach((rgb, i) => {
    // Size based on count
    const count = clusterData.counts[i];
    const totalColors = clusterData.total_colors;
    const percentage = count / totalColors;
    const sizeScale = Math.max(1.5, Math.pow(percentage, 0.4) * CONFIG.clustering.spheres.sizeMultiplier);

    // Calculate position in color space
    const position = calculatePosition(rgb);

    // Create colorful material with custom shader
    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255) },
        colorIntensity: { value: CONFIG.clustering.spheres.colorIntensity },
        opacity: { value: CONFIG.clustering.spheres.opacity },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float colorIntensity;
        uniform float opacity;
        varying vec3 vNormal;
        void main() {
          float intensity = 0.8 + 0.4 * dot(vNormal, vec3(0.0, 1.0, 0.0));
          vec3 finalColor = color * colorIntensity * intensity;
          gl_FragColor = vec4(finalColor, opacity);
        }
      `,
      transparent: CONFIG.clustering.spheres.opacity < 1.0,
    });

    // Create sphere mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.scale.set(sizeScale, sizeScale, sizeScale);

    renderer.group.add(mesh);
    clusterState.centroidMeshes.push(mesh);
  });

  clusterState.isActive = true;
}

// Remove cluster visualization
function clearClusterVisualization(renderer) {
  clusterState.centroidMeshes.forEach((mesh) => {
    renderer.group.remove(mesh);
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) mesh.material.dispose();
  });

  clusterState.centroidMeshes = [];
  clusterState.isActive = false;
}

// Toggle between showing all points and just clusters
export function toggleClusterView(renderer, showClusters, year, k, instancedSpheres) {
  if (showClusters) {
    // Make original points semi-transparent
    if (instancedSpheres && instancedSpheres.material && instancedSpheres.material.uniforms) {
      instancedSpheres.material.uniforms.opacity.value = CONFIG.clustering.originalPoints.opacityWhenClustered;
      instancedSpheres.material.transparent = true;
      instancedSpheres.material.needsUpdate = true;
    }

    displayClusterSphere(renderer, year, k);
  } else {
    // Restore original opacity
    if (instancedSpheres && instancedSpheres.material && instancedSpheres.material.uniforms) {
      instancedSpheres.material.uniforms.opacity.value = 1.0;
      instancedSpheres.material.needsUpdate = true;
    }

    clearClusterVisualization(renderer);
  }
}
