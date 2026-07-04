/// <reference types="google.maps" />
import {
  AbstractMarkerOverlayRenderer,
  type AddParams,
  type ChangeParams,
  type GeoPoint,
  type MarkerEntity,
  MarkerState,
} from '@mapconductor/js-sdk-core';
import { createMarkerEntity } from '@mapconductor/js-sdk-core';
import { latLngToGeoPoint, geoPointToLatLng } from '../helpers';
import { GoogleMapActualMarker2D } from '../GoogleMapsTypeAlias';
import { GoogleMapViewHolder2D } from '../GoogleMapViewHolder2D';

export class GoogleMapMarkerRenderer2D extends AbstractMarkerOverlayRenderer<
  GoogleMapViewHolder2D,
  GoogleMapActualMarker2D
> {
  constructor(holder: GoogleMapViewHolder2D) {
    super({ holder });
  }

  async onAdd(data: AddParams[]): Promise<(GoogleMapActualMarker2D | null)[]> {
    return data.map(({ state, bitmapIcon }) => {
      const icon: google.maps.Icon = {
        url: bitmapIcon.url,
        anchor: new google.maps.Point(
          bitmapIcon.anchor.x * bitmapIcon.size.width,
          bitmapIcon.anchor.y * bitmapIcon.size.height,
        ),
        scaledSize: new google.maps.Size(bitmapIcon.size.width, bitmapIcon.size.height),
      };
      return new google.maps.Marker({
        position: geoPointToLatLng(state.position),
        map: this.holder.map,
        icon,
        clickable: state.clickable,
        draggable: state.draggable,
        zIndex: state.zIndex,
      });
    });
  }

  async onChange(
    data: ChangeParams<GoogleMapActualMarker2D>[],
  ): Promise<(GoogleMapActualMarker2D | null)[]> {
    return data.map(({ current, bitmapIcon }) => {
      const marker = current.marker;
      if (!marker) return null;
      const icon: google.maps.Icon = {
        url: bitmapIcon.url,
        anchor: new google.maps.Point(
          bitmapIcon.anchor.x * bitmapIcon.size.width,
          bitmapIcon.anchor.y * bitmapIcon.size.height,
        ),
        scaledSize: new google.maps.Size(bitmapIcon.size.width, bitmapIcon.size.height),
      };
      (marker as google.maps.Marker).setOptions({
        position: geoPointToLatLng(current.state.position),
        map: this.holder.map,
        icon,
        clickable: current.state.clickable,
        draggable: current.state.draggable,
        zIndex: current.state.zIndex,
      });
      return marker;
    });
  }

  async onRemove(data: MarkerEntity<GoogleMapActualMarker2D>[]): Promise<void> {
    for (const entity of data) {
      if (!entity.marker) continue;
      google.maps.event.clearInstanceListeners(entity.marker);
      (entity.marker as google.maps.Marker).setMap(null);
    }
  }

  async onPostProcess(): Promise<void> {
    // no-op for Google Maps
  }

  setMarkerPosition(entity: MarkerEntity<GoogleMapActualMarker2D>, position: GeoPoint): void {
    (entity.marker as google.maps.Marker)?.setPosition(geoPointToLatLng(position));
  }

  syncPositionToState(marker: GoogleMapActualMarker2D, state: MarkerState): void {
    const position = (marker as google.maps.Marker).getPosition();
    if (!position) return;
    state.setPosition(latLngToGeoPoint(position));
  }

  buildEntity(
    marker: GoogleMapActualMarker2D,
    state: MarkerState,
  ): MarkerEntity<google.maps.Marker> {
    return createMarkerEntity({
      marker: marker as google.maps.Marker,
      state,
      isRendered: true,
    });
  }
}
