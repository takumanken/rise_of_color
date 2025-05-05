// Configuration parameters for the 3D color wheel visualization
export const CONFIG = {
  // STRUCTURE
  radius: 40,
  smallSphereRadius: 0.05,
  shells: 50,
  rotationSpeed: 0.001,
  animationSpeed: 200,

  entranceAnimation: {
    enabled: true,
    duration: 1500,
    easingPower: 3,
    randomizeDelay: true,
  },

  breathingEffect: {
    enabled: false,
    speed: 0.001,
    amplitude: 0.01,
    shellInfluence: 1.0,
    waveform: "pulse",
    asynchronous: true,
    randomOffset: 1,
    pulseSharpness: 0.5,
  },

  camera: {
    distance: 500,
    initialPosition: [70, 70, 240],
    autoRotateSpeed: 0.5,
    autoRotateDuration: 3000,
    damping: 0.05,
    fov: 20,
  },

  grayscaleThreshold: 0.05,
  colorDepth: 7,
  useHSLQuantization: true,

  visualEffects: {
    fog: {
      enabled: true,
      density: 0.025,
      color: 0x000000,
    },
    vignette: {
      enabled: false,
      offset: 10,
      darkness: 10000,
    },
    lighting: {
      ambient: {
        intensity: 0.4,
        color: 0xffffff,
      },
      main: {
        intensity: 0.8,
        color: 0xffffff,
        position: [1, 1, 1],
      },
      rim: {
        intensity: 0.7,
        color: 0xffffff,
        position: [-1, 0.5, -1],
      },
    },
  },

  pointAppearance: {
    baseSize: 200,
    saturationInfluence: 1,
    minSize: 0.8,
    maxSize: 1.2,
    shader: {
      rimIntensity: 0.1,
      rimFalloff: 5,
      edgeDarkening: 0,
      edgeThreshold: 1,
      diffuseIntensity: 1,
      ambientIntensity: 1,
    },
  },

  shininess: 100,
  specular: 0x888888,
  emissiveIntensity: 0.3,
  opacity: {
    base: 1,
    saturatedBoost: 0.5,
  },

  smartSampling: {
    enabled: true,
    prioritizeChroma: true,
    temporalImportance: true,
  },

  jitter: {
    enabled: true,
    intensity: 10.0,
    thetaStrength: 1.5,
    phiStrength: 1.5,
    radialJitter: 1,
  },
};

// Color conversion and utility functions
export function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h,
    s,
    l = (max + min) / 2;

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

export function greyAngle(rgb) {
  const hash = (rgb[0] * 31 + rgb[1] * 17 + rgb[2] * 7) % 360;
  return (hash / 360) * Math.PI * 2;
}

export function quantizeColor(rgb) {
  const factor = Math.pow(2, 8 - CONFIG.colorDepth);
  return [
    Math.floor(rgb[0] / factor) * factor,
    Math.floor(rgb[1] / factor) * factor,
    Math.floor(rgb[2] / factor) * factor,
  ];
}

export function quantizeColorHSL(rgb) {
  // Convert to HSL first
  const [h, s, l] = rgbToHsl(...rgb);

  // Calculate quantization levels based on colorDepth
  const levels = Math.pow(2, CONFIG.colorDepth);

  // Golden ratio approach to distribute points evenly on sphere
  const hueSteps = Math.round(levels * 1.6); // More hue steps (around circumference)
  const satSteps = Math.round(levels * 0.75); // Fewer saturation steps (radius)
  const lightSteps = Math.round(levels * 0.75); // Fewer lightness steps (height)

  // Add a tiny random offset to prevent perfect layers
  const jitter = 1 / levels;
  const hRand = (Math.random() - 0.5) * jitter;
  const sRand = (Math.random() - 0.5) * jitter;
  const lRand = (Math.random() - 0.5) * jitter;

  // Quantize with slight randomness to break up layers
  let hQ = Math.round((h + hRand) * hueSteps) / hueSteps;
  let sQ = Math.round((s + sRand) * satSteps) / satSteps;
  let lQ = Math.round((l + lRand) * lightSteps) / lightSteps;

  // Keep values in valid range
  hQ = Math.max(0, Math.min(1, hQ));
  sQ = Math.max(0, Math.min(1, sQ));
  lQ = Math.max(0, Math.min(1, lQ));

  // Convert back to RGB for storage/comparison
  return hslToRgb(hQ, sQ, lQ);
}

export function calculatePosition(rgb) {
  const [h, s, l] = rgbToHsl(...rgb);

  // Check if this is a grayscale color (saturation below threshold)
  const isGrayscale = s < CONFIG.grayscaleThreshold;

  // Calculate chroma (for scaling and visual importance)
  const c = (1 - Math.abs(2 * l - 1)) * s;

  const R = CONFIG.radius;

  let jitter, thetaJitter, phiJitter, radialJitter;

  if (CONFIG.jitter.enabled) {
    // Base jitter amount calculated from color depth
    jitter = (1.0 / (Math.pow(2, CONFIG.colorDepth) * 1.6)) * CONFIG.jitter.intensity;

    // Apply configured strengths to different dimensions
    thetaJitter = (Math.random() - 0.5) * jitter * CONFIG.jitter.thetaStrength;
    phiJitter = (Math.random() - 0.5) * jitter * CONFIG.jitter.phiStrength;

    // Optional radial jitter
    radialJitter =
      CONFIG.jitter.radialJitter > 0 ? 1.0 + (Math.random() - 0.5) * CONFIG.jitter.radialJitter * 0.2 : 1.0;
  } else {
    thetaJitter = phiJitter = 0;
    radialJitter = 1.0;
  }

  // Apply jitter to angular coordinates
  let theta;
  if (isGrayscale) {
    theta = greyAngle(rgb) + thetaJitter;
  } else {
    theta = 2 * Math.PI * h + thetaJitter;
  }
  const phi = (1 - l) * Math.PI + phiJitter;

  // Calculate Cartesian coordinates
  const rMax = R * Math.sin(phi);
  // Apply radial jitter to radius
  const r = (isGrayscale ? 0.1 * rMax : s * rMax) * radialJitter;

  const x = r * Math.cos(theta);
  const z = r * Math.sin(theta);
  const y = R * Math.cos(phi);

  // Calculate shell number (for breathing and visual effects)
  const shell = Math.floor((1 - s) * CONFIG.shells);

  return { x, y, z, shell, h, s, l, c, r, phi, theta, rgb, isGrayscale };
}
