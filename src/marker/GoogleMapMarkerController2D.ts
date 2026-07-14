/// <reference types="google.maps" />
import { MarkerTilingOptions, type MarkerState } from '@mapconductor/js-sdk-core';
import { GoogleMapActualMarker2D } from '../GoogleMapTypeAlias';
import { AbstractGoogleMapsController } from './AbstractGoogleMapsController';
import { GoogleMapMarkerRendererInterface } from './GoogleMapMarkerRendererInterface';

export class GoogleMapMarkerController2D extends AbstractGoogleMapsController<GoogleMapActualMarker2D> {
  constructor(
    renderer: GoogleMapMarkerRendererInterface<GoogleMapActualMarker2D>,
    tilingOptions: MarkerTilingOptions = MarkerTilingOptions.Default,
  ) {
    super(renderer, tilingOptions);
  }

  protected override attachListeners(marker: GoogleMapActualMarker2D, state: MarkerState): void {
    google.maps.event.clearInstanceListeners(marker);
    if (this.renderer.clickEventName) {
      marker.addListener(this.renderer.clickEventName, () => this.dispatchClick(state));
    }
    if (this.renderer.dragstartEventName) {
      marker.addListener(this.renderer.dragstartEventName, () => {
        this.renderer.syncPositionToState(marker, state);
        this.dispatchDragStart(state);
      });
    }
    if (this.renderer.dragEventName) {
      marker.addListener(this.renderer.dragEventName, () => {
        this.renderer.syncPositionToState(marker, state);
        this.dispatchDrag(state);
      });
    }
    if (this.renderer.dragendEventName) {
      marker.addListener(this.renderer.dragendEventName, () => {
        this.renderer.syncPositionToState(marker, state);
        this.dispatchDragEnd(state);
      });
    }
  }
}
