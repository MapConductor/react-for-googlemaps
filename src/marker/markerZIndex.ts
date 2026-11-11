import { markerDrawOrder, type GeoPoint, type MarkerState } from '@mapconductor/js-sdk-core';

/**
 * Google's marker zIndex for the shared draw order (zIndex, then south, then
 * west; see markerDrawOrder).
 *
 * Advanced markers turn it into a CSS z-index, so it has to be a non-negative
 * integer: the order is shifted up by 1000 and scaled so that the position
 * share keeps about 50 m of resolution. zIndex values outside about -1000..1100
 * are clamped.
 */
export function googleMarkerZIndex(state: MarkerState, position: GeoPoint = state.position): number {
  const scaled = Math.round((markerDrawOrder(state.zIndex, position) + 1000) * 1_000_000);
  return Math.min(2_147_483_647, Math.max(0, scaled));
}
