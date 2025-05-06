import * as THREE from "three";
import { CONFIG, calculatePosition } from "./config.js";

// State for cluster visualization
export const clusterState = {
  isActive: false,
  currentK: 16,
  currentYear: null,
  clusterData: null,
  centroidMeshes: [],
};

// Load the cluster data
export async function loadClusterData() {
  try {
    const response = await fetch("assets/yearly_clustered_colors.json");
    if (!response.ok) throw new Error("Failed to load cluster data");

    clusterState.clusterData = await response.json();
    return true;
  } catch (err) {
    console.error("Error loading cluster data:", err);
    return false;
  }
}

// Get cluster data for specific year and k value
export function getYearClusters(year, k) {
  if (!clusterState.clusterData?.year_clusters) return null;

  // Find the nearest year that has data if exact year not found
  const years = Object.keys(clusterState.clusterData.year_clusters)
    .map(Number)
    .sort((a, b) => a - b);

  let targetYear = year.toString();
  if (!clusterState.clusterData.year_clusters[targetYear]) {
    // Find closest year less than or equal to target
    const nearestYear = years.filter((y) => y <= year).pop();
    if (nearestYear) {
      targetYear = nearestYear.toString();
    } else {
      return null;
    }
  }

  const yearData = clusterState.clusterData.year_clusters[targetYear];
  return yearData?.[k] || null;
}

// Display cluster centroids on sphere
export function displayClusterSphere(renderer, year, k) {
  clearClusterVisualization(renderer);

  const clusterData = getYearClusters(year, k);
  if (!clusterData) return;

  clusterState.currentYear = year;
  clusterState.currentK = k;

  const geometry = new THREE.SphereGeometry(1.0, 24, 24);

  clusterData.centroids.forEach((rgb, i) => {
    // Calculate size
    const count = clusterData.counts[i];
    const totalColors = clusterData.total_colors;
    const percentage = count / totalColors;

    let sizeScale;
    if (CONFIG.clustering.spheres.sizeByCount) {
      const sizePower = CONFIG.clustering.spheres.sizePower || 0.4;
      const calculatedSize = Math.pow(percentage, sizePower) * CONFIG.clustering.spheres.sizeMultiplier;
      sizeScale = Math.max(CONFIG.clustering.spheres.minSize || 0.2, calculatedSize);
    } else {
      sizeScale = CONFIG.clustering.spheres.sizeMultiplier;
    }

    // Calculate position
    const position = calculatePosition(rgb);

    // Get material properties
    const matProps = CONFIG.clustering.spheres.materialProperties || {
      matte: true,
      specularIntensity: 0.05,
      diffuseIntensity: 0.9,
      ambientIntensity: 0.7,
      darkColorEnhancement: 0.3,
    };

    // Create material
    const material = createClusterMaterial(rgb, matProps);

    // Create sphere mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, position.y, position.z);
    mesh.scale.set(sizeScale, sizeScale, sizeScale);

    // Add outline if needed
    addOutlineIfNeeded(mesh, rgb, matProps);

    renderer.group.add(mesh);
    clusterState.centroidMeshes.push(mesh);
  });

  clusterState.isActive = true;
}

// Helper to create cluster material
function createClusterMaterial(rgb, matProps) {
  return new THREE.ShaderMaterial({
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
      void main() {
        vNormal = normalize(normalMatrix * normal);
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
      
      float getLuminance(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
      }
      
      void main() {
        vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
        float luminance = getLuminance(color);
        bool isDark = luminance < 0.5;
        
        vec3 enhancedColor = color;
        if (isDark) {
          float enhancement = ${matProps.darkColorEnhancement.toFixed(2)};
          enhancedColor = mix(color, vec3(enhancement), 0.6);
        }
        
        vec3 ambient = enhancedColor * ambientIntensity;
        float diffuseFactor = max(dot(vNormal, lightDir), 0.0) * diffuseIntensity;
        vec3 diffuse = enhancedColor * diffuseFactor;
        float specular = pow(max(dot(reflect(-lightDir, vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 32.0) * specularIntensity;
        
        vec3 finalColor = enhancedColor * colorIntensity * (ambient + diffuse) + vec3(specular);
        
        if (isDark) {
          float edge = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 5.0);
          finalColor += edge * 0.2;
        }
        
        gl_FragColor = vec4(finalColor, opacity);
      }
    `,
    transparent: CONFIG.clustering.spheres.opacity < 1.0,
  });
}

// Helper to add outline
function addOutlineIfNeeded(mesh, rgb, matProps) {
  if (!matProps.outlineEnabled) return;

  // Calculate luminance
  const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  const luminanceRange = matProps.outlineLuminanceRange || { min: 0.0, max: 0.3 };

  // Calculate outline opacity
  let outlineOpacity = 0;
  if (luminance <= luminanceRange.min) {
    outlineOpacity = matProps.outlineMaxOpacity;
  } else if (luminance < luminanceRange.max) {
    const normalizedLuminance = (luminance - luminanceRange.min) / (luminanceRange.max - luminanceRange.min);
    outlineOpacity = matProps.outlineMaxOpacity * (1 - normalizedLuminance);
  }

  if (outlineOpacity <= 0.01) return;

  // Create outline
  const outlineGeometry = new THREE.SphereGeometry(1.0, 24, 24);
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: matProps.outlineColor || 0x555555,
    side: THREE.BackSide,
    transparent: true,
    opacity: outlineOpacity,
  });

  const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
  const thickness = matProps.outlineThickness || 1.1;
  outlineMesh.scale.set(thickness, thickness, thickness);
  mesh.add(outlineMesh);
}

// Remove cluster visualization
function clearClusterVisualization(renderer) {
  clusterState.centroidMeshes.forEach((mesh) => {
    renderer.group.remove(mesh);
    mesh.geometry?.dispose();
    mesh.material?.dispose();
  });

  clusterState.centroidMeshes = [];
  clusterState.isActive = false;
}

// Toggle between showing all points and just clusters
export function toggleClusterView(renderer, showClusters, year, k, instancedSpheres) {
  if (!instancedSpheres?.material?.uniforms) return;

  if (showClusters) {
    // Make original points semi-transparent
    instancedSpheres.material.uniforms.opacity.value = CONFIG.clustering.originalPoints.opacityWhenClustered;
    instancedSpheres.material.transparent = true;
    instancedSpheres.material.needsUpdate = true;

    displayClusterSphere(renderer, year, k);
  } else {
    // Restore original opacity
    instancedSpheres.material.uniforms.opacity.value = 1.0;
    instancedSpheres.material.needsUpdate = true;

    clearClusterVisualization(renderer);
  }
}
