export interface GoogleMapsFillStyle {
  color: string;
  opacity: number;
}

const RGBA_RE = /^rgba\(\s*([+-]?\d*\.?\d+%?)\s*,\s*([+-]?\d*\.?\d+%?)\s*,\s*([+-]?\d*\.?\d+%?)\s*,\s*([+-]?\d*\.?\d+%?)\s*\)$/i;
const HEX_RGBA_RE = /^#([0-9a-f]{8})$/i;

function clampOpacity(value: number): number {
  if (Number.isNaN(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function alphaToOpacity(value: string): number {
  if (value.endsWith('%')) {
    return clampOpacity(parseFloat(value) / 100);
  }
  return clampOpacity(parseFloat(value));
}

export function toGoogleMapsFillStyle(fillColor: string): GoogleMapsFillStyle {
  const rgba = RGBA_RE.exec(fillColor);
  if (rgba) {
    return {
      color: `rgb(${rgba[1]}, ${rgba[2]}, ${rgba[3]})`,
      opacity: alphaToOpacity(rgba[4]),
    };
  }

  const hex = HEX_RGBA_RE.exec(fillColor);
  if (hex) {
    const value = hex[1];
    const alpha = parseInt(value.slice(6, 8), 16) / 255;
    return {
      color: `#${value.slice(0, 6)}`,
      opacity: clampOpacity(alpha),
    };
  }

  return { color: fillColor, opacity: 1 };
}
