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

    // Get material properties
    const matProps = CONFIG.clustering.spheres.materialProperties || {
      matte: true,
      specularIntensity: 0.05,
      diffuseIntensity: 0.9,
      ambientIntensity: 0.7,
    };

    // Create colorful material with matte appearance
    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255) },
        colorIntensity: { value: CONFIG.clustering.spheres.colorIntensity },
        opacity: { value: CONFIG.clustering.spheres.opacity },
        specularIntensity: { value: matProps.specularIntensity },
        diffuseIntensity: { value: matProps.diffuseIntensity },
        ambientIntensity: { value: matProps.ambientIntensity },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec2 vUv;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float colorIntensity;
        uniform float opacity;
        uniform float specularIntensity;
        uniform float diffuseIntensity;
        uniform float ambientIntensity;
        varying vec3 vNormal;
        varying vec2 vUv;
        
        // Function to get perceived brightness
        float getLuminance(vec3 color) {
          return dot(color, vec3(0.299, 0.587, 0.114));
        }
        
        void main() {
          // Base lighting
          vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
          
          // Get perceived brightness (luminance) of this color
          float luminance = getLuminance(color);
          
          // Determine if this is a dark color
          bool isDark = luminance < 0.5;
          
          // For dark colors, add minimum brightness 
          vec3 enhancedColor = color;
          if (isDark) {
            // Add a minimum brightness floor to ensure visibility
            // Use configurable enhancement amount
            float enhancement = ${matProps.darkColorEnhancement.toFixed(3)};
            enhancedColor = mix(color, vec3(enhancement), 0.6);
          }
          
          // Ambient component
          vec3 ambient = enhancedColor * ambientIntensity;
          
          // Diffuse component 
          float diffuseFactor = max(dot(vNormal, lightDir), 0.0) * diffuseIntensity;
          vec3 diffuse = enhancedColor * diffuseFactor;
          
          // Minimal specular component for matte finish
          float specular = pow(max(dot(reflect(-lightDir, vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 
                                32.0) * specularIntensity;
          
          // Combine components for appearance (no rim)
          vec3 baseColor = enhancedColor * colorIntensity;
          vec3 finalColor = baseColor * (ambient + diffuse) + vec3(specular);
          
          // Extra brightness boost at edges for dark colors
          if (isDark) {
            float edge = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 5.0);
            finalColor += edge * 0.2; // Reduced glow effect
          }
          
          gl_FragColor = vec4(finalColor, opacity);
        }
      `,
      transparent: CONFIG.clustering.spheres.opacity < 1.0,
    });

    // Create sphere mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.scale.set(sizeScale, sizeScale, sizeScale);

    // Calculate perceived brightness
    const luminance = (0.299 * rgb[0]) / 255 + (0.587 * rgb[1]) / 255 + (0.114 * rgb[2]) / 255;
    const isDark = luminance < 0.2;

    // Add outline for dark colors
    if (isDark && CONFIG.clustering.spheres.materialProperties.outlineForDarkColors) {
      const outlineGeometry = new THREE.SphereGeometry(2.0, 24, 24);
      const outlineColor = CONFIG.clustering.spheres.materialProperties.outlineColor || 0x555555;
      const outlineOpacity = CONFIG.clustering.spheres.materialProperties.outlineOpacity || 0.4;
      const thickness = CONFIG.clustering.spheres.materialProperties.outlineThickness || 1.06;

      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: outlineColor,
        side: THREE.BackSide,
        transparent: true,
        opacity: outlineOpacity,
      });

      const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
      outlineMesh.scale.set(thickness, thickness, thickness); // Apply configured thickness
      mesh.add(outlineMesh);
    }

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
