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
import { loadLibrary } from '../LibraryLoader';
import { createMarkerContent } from './createMarkerContent';
import { GoogleMapActualMarker2D } from '../GoogleMapTypeAlias';
import { GoogleMapViewHolder2D } from '../GoogleMapViewHolder2D';
import { GoogleMapMarkerRendererInterface } from './GoogleMapMarkerRendererInterface';



export class GoogleMapAdvancedMarkerElementRenderer2D extends AbstractMarkerOverlayRenderer<
  GoogleMapViewHolder2D,
  GoogleMapActualMarker2D
> implements GoogleMapMarkerRendererInterface<GoogleMapActualMarker2D> {
  constructor(holder: GoogleMapViewHolder2D) {
    super({ holder });
    this.supportsAnimationOverlay = true;
  }

  clickEventName: string | null = 'gmp-click';
  dragstartEventName: string | null = 'dragstart';
  dragEventName: string | null = 'drag';
  dragendEventName: string | null = 'dragend';

  async onAdd(data: AddParams[]): Promise<(GoogleMapActualMarker2D | null)[]> {

    const { AdvancedMarkerElement } = await loadLibrary<google.maps.MarkerLibrary>('marker');

    return data.map(({ state, bitmapIcon }) =>
      new AdvancedMarkerElement({
        position: geoPointToLatLng(state.position),
        map: this.holder.map,
        content: createMarkerContent(bitmapIcon),
        gmpClickable: state.clickable,
        gmpDraggable: state.draggable,
        zIndex: Math.max(0, state.zIndex),
      }),
    );
  }

  async onChange(
    data: ChangeParams<GoogleMapActualMarker2D>[],
  ): Promise<(GoogleMapActualMarker2D | null)[]> {
    return data.map(({ current, bitmapIcon }) => {
      const marker = current.marker as google.maps.marker.AdvancedMarkerElement;
      if (!marker) return null;
      marker.position = geoPointToLatLng(current.state.position);
      marker.content = createMarkerContent(bitmapIcon);
      marker.gmpClickable = current.state.clickable;
      marker.gmpDraggable = current.state.draggable;
      marker.zIndex = Math.max(0, current.state.zIndex);
      return marker;
    });
  }

  async onRemove(data: MarkerEntity<GoogleMapActualMarker2D>[]): Promise<void> {
    for (const entity of data) {
      if (!entity.marker) continue;
      google.maps.event.clearInstanceListeners(entity.marker);
      (entity.marker as google.maps.marker.AdvancedMarkerElement).map = null;
    }
  }

  async onPostProcess(): Promise<void> {
    // no-op for Google Maps
  }

  setMarkerPosition(
    entity: MarkerEntity<GoogleMapActualMarker2D>,
    position: GeoPoint,
  ): void {
    if (!entity.marker) return;
    (entity.marker as google.maps.marker.AdvancedMarkerElement).position = geoPointToLatLng(position);
  }

  override setMarkerVisible(entity: MarkerEntity<GoogleMapActualMarker2D>, visible: boolean): void {
    const marker = entity.marker as google.maps.marker.AdvancedMarkerElement | null;
    if (!marker) return;
    marker.map = visible ? this.holder.map : null;
  }

  syncPositionToState(
    marker: GoogleMapActualMarker2D,
    state: MarkerState,
  ): void {
    const pos = (marker as google.maps.marker.AdvancedMarkerElement).position;
    if (!pos) return;
    // position は LatLng | LatLngLiteral | LatLngAltitude | LatLngAltitudeLiteral
    // geoPointFromLatLng は LatLng を受け取るため必要に応じて変換する
    const latLng =
      pos instanceof google.maps.LatLng
        ? pos
        : new google.maps.LatLng(
            (pos as google.maps.LatLngLiteral).lat,
            (pos as google.maps.LatLngLiteral).lng,
          );
    state.setPosition(latLngToGeoPoint(latLng));
  }

  buildEntity(
    marker: GoogleMapActualMarker2D,
    state: MarkerState,
  ): MarkerEntity<GoogleMapActualMarker2D> {
    return createMarkerEntity({ marker, state, isRendered: true });
  }
}
