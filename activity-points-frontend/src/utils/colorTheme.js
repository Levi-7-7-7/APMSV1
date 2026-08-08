// Small, dependency-free color helpers used to turn a single user-picked
// accent color into the small palette of shades the app's CSS variables
// expect (--blue-500 .. --blue-800, plus translucent tint backgrounds).

export function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

export function rgbToHex({ r, g, b }) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

// Mixes a hex color toward white by `amt` (0..1)
export function lighten(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r + (255 - r) * amt, g: g + (255 - g) * amt, b: b + (255 - b) * amt });
}

// Mixes a hex color toward black by `amt` (0..1)
export function darken(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({ r: r * (1 - amt), g: g * (1 - amt), b: b * (1 - amt) });
}

export function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Rough perceived-brightness check, used to decide whether white or dark
// text sits better on top of a solid button using the accent color.
export function isLightColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

// The picked color becomes the "600" shade (the main button/link color,
// matching how the built-in Light/Dark/Teal themes use --blue-600) and the
// rest are derived from it the same way those themes step between shades.
export function buildAccentShades(accentHex) {
  return {
    500: lighten(accentHex, 0.16),
    600: accentHex,
    700: darken(accentHex, 0.16),
    800: darken(accentHex, 0.32),
  };
}
