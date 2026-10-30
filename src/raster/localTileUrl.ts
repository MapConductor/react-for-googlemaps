import { parseTilePixelRatio, tilePixelRatioSuffix } from '@mapconductor/js-sdk-core';

/**
 * Marker tiles Google Maps draws from `LocalTileServer` data URLs when no
 * Service Worker is available. The ratio suffix (`@2x`) means the same as in
 * the Service Worker's `/__tiles/` URLs.
 */
export const MAPCONDUCTOR_TILE_PROTOCOL = 'mc-local-tile';

// mc-local-tile://{routeId}/{tileSize}/{cacheKey?}/{z}/{x}/{y}{@2x?}.png
export function localTileUrlTemplate({
  routeId,
  tileSize,
  cacheKey,
  pixelRatio,
}: {
  routeId: string;
  tileSize: number;
  cacheKey?: string;
  pixelRatio?: number;
}): string {
  const base = `${MAPCONDUCTOR_TILE_PROTOCOL}://${routeId}/${tileSize}`;
  const tile = `{z}/{x}/{y}${tilePixelRatioSuffix(pixelRatio)}.png`;
  if (cacheKey) {
    return `${base}/${cacheKey}/${tile}`;
  }
  return `${base}/${tile}`;
}

/**
 * The route behind an `mc-local-tile://` template, or null for any other
 * template (Service Worker `/__tiles/` URLs included: Google loads those as
 * plain URLs).
 */
export function parseLocalTileTemplate(
  template: string,
): { routeId: string; tileSize: number; pixelRatio: number } | null {
  if (!template.startsWith(`${MAPCONDUCTOR_TILE_PROTOCOL}://`)) return null;
  const url = new URL(template);
  const tileSize = Number(url.pathname.split('/').filter(Boolean)[0]);
  if (!Number.isFinite(tileSize)) return null;
  const pixelRatio = parseTilePixelRatio(template.match(/(@\d+x)\.png$/)?.[1]);
  return { routeId: url.hostname, tileSize, pixelRatio };
}
