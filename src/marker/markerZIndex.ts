import { MarkerDrawOrderView, type GeoPoint, type MarkerState } from '@mapconductor/js-sdk-core';

/**
 * Google's marker zIndex for the shared draw order (zIndex, then lower on the
 * rotated screen, then further left; see markerDrawOrder).
 *
 * Advanced markers turn it into a CSS z-index, so it has to be a non-negative
 * integer: the order is shifted up by 1000 and scaled so that the position
 * share keeps about 70 m of resolution. zIndex values outside about -1000..1100
 * are clamped.
 */
export function googleMarkerZIndex(
  state: MarkerState,
  drawOrder: MarkerDrawOrderView,
  position: GeoPoint = state.position,
): number {
  const scaled = Math.round((drawOrder.order(state.zIndex, position) + 1000) * 1_000_000);
  return Math.min(2_147_483_647, Math.max(0, scaled));
}

/**
 * Keeps the markers' zIndex in step with the map's heading. Google itself puts
 * the marker lower on the rotated screen in front, and an explicit zIndex
 * replaces that, so the markers have to be re-stacked as the map turns.
 */
export class GoogleMarkerStacking<Marker> {
  readonly drawOrder = new MarkerDrawOrderView();
  private readonly states = new Map<Marker, MarkerState>();

  constructor(
    private readonly map: google.maps.Map,
    private readonly applyZIndex: (marker: Marker, zIndex: number) => void,
  ) {
    const follow = () => this.followBearing();
    map.addListener('heading_changed', follow);
    // Catches the heading the map was created with, and far pans.
    map.addListener('idle', follow);
  }

  zIndexOf(state: MarkerState, position: GeoPoint = state.position): number {
    return googleMarkerZIndex(state, this.drawOrder, position);
  }

  track(marker: Marker, state: MarkerState): void {
    this.states.set(marker, state);
  }

  forget(marker: Marker): void {
    this.states.delete(marker);
  }

  private followBearing(): void {
    if (!this.drawOrder.update(this.map.getHeading(), this.map.getCenter()?.lng())) return;
    for (const [marker, state] of this.states) this.applyZIndex(marker, this.zIndexOf(state));
  }
}
