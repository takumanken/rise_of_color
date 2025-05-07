// Configuration parameters for the 3D color wheel visualization
export const CONFIG = {
  // STRUCTURE
  radius: 44,
  smallSphereRadius: 0.1,
  shells: 50,
  rotationSpeed: 0.0015,
  animationSpeed: 300,

  // CAMERA
  camera: {
    initialPosition: [70, 70, 240],
    initialRotation: 180,
    autoRotateSpeed: 0.5,
    autoRotateDuration: 3000,
    damping: 0.05,
    fov: 20,
    zoomControl: {
      enabled: false,
      initialDistance: 280,
    },
  },

  // LIGHTING
  lighting: {
    ambient: {
      intensity: 1,
      color: 0xffffff,
    },
  },

  // APPEARANCE
  pointAppearance: {
    baseSize: 200,
    saturationInfluence: 1,
    minSize: 1,
    maxSize: 1,
    shader: {
      ambientIntensity: 1,
    },
  },

  // POSITION JITTERING
  jitter: {
    enabled: true,
    intensity: 6,
    thetaStrength: 1.5,
    phiStrength: 1.5,
    radialJitter: 1.5,
  },

  // CLUSTERING VISUALIZATION
  clustering: {
    spheres: {
      opacity: 1,
      colorIntensity: 1.1,
      sizeMultiplier: 0.5,
      sizeByCount: true,
      minSize: 0.8,
      sizePower: 0.5,
      materialProperties: {
        matte: true,
        specularIntensity: 0.05,
        diffuseIntensity: 0.15,
        ambientIntensity: 0.7,
        darkColorEnhancement: 0.3,
        outlineEnabled: true,
        outlineColor: 0x555555,
        outlineMaxOpacity: 0.5,
        outlineLuminanceRange: {
          min: 0.4,
          max: 0.8,
        },
        outlineThickness: 1.05,
      },
    },
    originalPoints: {
      opacityWhenClustered: 0,
    },
  },
};

// COLOR CONVERSION FUNCTIONS
export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // grayscale
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

export function hslToRgb(h, s, l) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l; // achromatic
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// UTILITY FUNCTIONS
export function greyAngle(rgb) {
  const hash = (rgb[0] * 31 + rgb[1] * 17 + rgb[2] * 7) % 360;
  return (hash / 360) * Math.PI * 2;
}

// POSITION CALCULATION
export function calculatePosition(color) {
  const rgb = color.rgb || color; // Support both raw RGB arrays and color objects
  const [h, s, l] = rgbToHsl(...rgb);

  // Use the pre-processed isGrayscale property if available, otherwise
  // don't attempt to re-determine grayscale status
  const isGrayscale = color.isGrayscale !== undefined ? color.isGrayscale : false;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const R = CONFIG.radius;

  // Apply jitter for natural distribution
  let thetaJitter = 0,
    phiJitter = 0,
    radialJitter = 1.0;

  if (CONFIG.jitter.enabled) {
    // Fixed jitter value instead of depending on colorDepth
    const jitter = 0.005 * CONFIG.jitter.intensity;
    thetaJitter = (Math.random() - 0.5) * jitter * CONFIG.jitter.thetaStrength;
    phiJitter = (Math.random() - 0.5) * jitter * CONFIG.jitter.phiStrength;
    radialJitter =
      CONFIG.jitter.radialJitter > 0 ? 1.0 + (Math.random() - 0.5) * CONFIG.jitter.radialJitter * 0.2 : 1.0;
  }

  // Calculate spherical coordinates with jitter
  const theta = isGrayscale ? greyAngle(rgb) + thetaJitter : 2 * Math.PI * h + thetaJitter;

  const phi = (1 - l) * Math.PI + phiJitter;

  // Convert to Cartesian coordinates
  const rMax = R * Math.sin(phi);
  const r = (isGrayscale ? 0.1 * rMax : s * rMax) * radialJitter;

  const x = r * Math.cos(theta);
  const z = r * Math.sin(theta);
  const y = R * Math.cos(phi);

  // Calculate shell number for point sizing
  const shell = Math.floor((1 - s) * CONFIG.shells);

  return { x, y, z, shell, h, s, l, c, r, phi, theta, rgb, isGrayscale };
}
