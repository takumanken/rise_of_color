import * as THREE from "three";
import { CONFIG, rgbToHsl, calculatePosition } from "./config.js";

// State for cluster visualization
export const clusterState = {
  isActive: false,
  currentK: 6, // Default K value
  currentYear: null,
  clusterData: null,
  centroidMeshes: [],
  yearClusters: {},
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
  if (!clusterState.clusterData) return null;

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
      console.log(`No cluster data for ${year}, using ${targetYear}`);
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
  if (!clusterData) {
    console.error(`No cluster data available for year ${year}, k=${k}`);
    return;
  }

  clusterState.currentYear = year;
  clusterState.currentK = k;

  // Create spheres for each cluster centroid
  const geometry = new THREE.SphereGeometry(1, 16, 16);

  clusterData.centroids.forEach((rgb, i) => {
    // Size based on count
    const count = clusterData.counts[i];
    const totalColors = clusterData.total_colors;
    const sizeScale = Math.max(1, Math.sqrt(count / totalColors) * 5);

    // Calculate position in color space
    const position = calculatePosition(rgb);

    // Create material with centroid color
    const material = new THREE.MeshBasicMaterial({
      color: new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255),
      transparent: true,
      opacity: 0.8,
    });

    // Create sphere mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.scale.set(sizeScale, sizeScale, sizeScale);

    // Add outline
    const wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3,
      })
    );
    mesh.add(wireframe);

    renderer.group.add(mesh);
    clusterState.centroidMeshes.push(mesh);
  });

  clusterState.isActive = true;
}

// Remove cluster visualization
function clearClusterVisualization(renderer) {
  clusterState.centroidMeshes.forEach((mesh) => {
    renderer.group.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  });

  clusterState.centroidMeshes = [];
  clusterState.isActive = false;
}

// Toggle between showing all points and just clusters
export function toggleClusterView(renderer, showClusters, year, k) {
  if (showClusters) {
    // Make sure instancedSpheres exists before trying to hide it
    if (renderer.instancedSpheres) {
      renderer.instancedSpheres.visible = false;
    } else if (renderer.group && renderer.group.children) {
      // Alternative: hide all regular spheres in the scene
      renderer.group.children.forEach((child) => {
        if (child.type === "InstancedMesh") {
          child.visible = false;
        }
      });
    }

    displayClusterSphere(renderer, year, k);
  } else {
    // Show individual points again
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
