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
    const sizeScale = (count / totalColors) * 5;

    // Calculate position in color space
    const position = calculatePosition(rgb);

    // Create colorful material with custom shader for consistent colors
    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255) },
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
        varying vec3 vNormal;
        void main() {
          float intensity = 0.8 + 0.4 * dot(vNormal, vec3(0.0, 1.0, 0.0));
          vec3 finalColor = color * intensity;
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
    });

    // Create sphere mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.scale.set(sizeScale, sizeScale, sizeScale);

    // Add outline for better visibility
    const outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.3,
    });

    const outlineMesh = new THREE.Mesh(geometry, outlineMaterial);
    outlineMesh.scale.set(1.05, 1.05, 1.05);
    mesh.add(outlineMesh);

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
export function toggleClusterView(renderer, showClusters, year, k) {
  if (showClusters) {
    // Hide the point cloud visualization
    if (renderer.instancedSpheres) {
      renderer.instancedSpheres.visible = false;
    } else if (renderer.group && renderer.group.children) {
      renderer.group.children.forEach((child) => {
        if (child.type === "InstancedMesh") {
          child.visible = false;
        }
      });
    }

    displayClusterSphere(renderer, year, k);
  } else {
    // Show point cloud visualization again
    if (renderer.instancedSpheres) {
      renderer.instancedSpheres.visible = true;
    } else if (renderer.group && renderer.group.children) {
      renderer.group.children.forEach((child) => {
        if (child.type === "InstancedMesh") {
          child.visible = true;
        }
      });
    }

    clearClusterVisualization(renderer);
  }
}
