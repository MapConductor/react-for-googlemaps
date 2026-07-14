/// <reference types="google.maps" />
import { MarkerTilingOptions, type MarkerState } from '@mapconductor/js-sdk-core';
import { GoogleMapActualMarker } from '../GoogleMapTypeAlias';
import { AbstractGoogleMapsController } from './AbstractGoogleMapsController';
import { GoogleMapMarkerRenderer } from './GoogleMapMarkerRenderer';

export class GoogleMapMarkerController extends AbstractGoogleMapsController<
  GoogleMapActualMarker,
  GoogleMapMarkerRenderer
> {
  constructor(
    renderer: GoogleMapMarkerRenderer,
    tilingOptions: MarkerTilingOptions = MarkerTilingOptions.Default,
  ) {
    super(renderer, tilingOptions);
  }

  protected override attachListeners(marker: GoogleMapActualMarker, state: MarkerState): void {
    google.maps.event.clearInstanceListeners(marker);
    if (!(marker instanceof HTMLElement)) return;
    const source = marker.firstElementChild;
    const dragThresholdPx = 5;
    const clickMaxMs = 1000;
    let mousedownStartTime = 0;
    let downX = 0;
    let downY = 0;
    let dragging = false;

    const toMapOffset = (event: MouseEvent) => {
      const rect = this.renderer.holder.map.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onWindowMouseMove = (event: MouseEvent) => {
      if (!dragging) {
        if (Math.hypot(event.clientX - downX, event.clientY - downY) < dragThresholdPx) return;
        dragging = true;
        this.dispatchDragStart(state);
      }
      event.preventDefault();
      const position = this.renderer.holder.fromScreenOffsetSync(toMapOffset(event));
      if (position) {
        state.setPosition(position);
        this.dispatchDrag(state);
      }
    };

    const onWindowMouseUp = (event: MouseEvent) => {
      window.removeEventListener('mousemove', onWindowMouseMove, true);
      window.removeEventListener('mouseup', onWindowMouseUp, true);
      if (dragging) {
        dragging = false;
        event.stopPropagation();
        this.dispatchDragEnd(state);
        return;
      }
      const moved = Math.hypot(event.clientX - downX, event.clientY - downY) >= dragThresholdPx;
      if (!moved && Date.now() - mousedownStartTime < clickMaxMs) {
        event.stopPropagation();
        this.dispatchClick(state);
      }
    };

    source?.addEventListener('mousedown', (event) => {
      event.stopPropagation();
      event.preventDefault();
      mousedownStartTime = Date.now();
      downX = (event as MouseEvent).clientX;
      downY = (event as MouseEvent).clientY;
      dragging = false;
      if (state.draggable) {
        window.addEventListener('mousemove', onWindowMouseMove, true);
      }
      window.addEventListener('mouseup', onWindowMouseUp, true);
    });
  }
}
