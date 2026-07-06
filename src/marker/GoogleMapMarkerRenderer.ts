/// <reference types="google.maps" />
import {
  AbstractMarkerOverlayRenderer,
  createGeoPoint,
  type AddParams,
  type ChangeParams,
  type GeoPoint,
  type MarkerEntity,
  MarkerState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapActualMarker } from '../GoogleMapsTypeAlias';
import { GoogleMapViewHolder } from '../GoogleMapViewHolder';
import { loadLibrary } from '../LibraryLoader';
import { GoogleMapMarkerRendererInterface } from './GoogleMapMarkerRendererInterface';

export class GoogleMapMarkerRenderer extends AbstractMarkerOverlayRenderer<
  GoogleMapViewHolder,
  GoogleMapActualMarker
> implements GoogleMapMarkerRendererInterface<GoogleMapActualMarker> {
  constructor(
    holder: GoogleMapViewHolder,
  ) {
    super({ holder });
    this.supportsAnimationOverlay = true;
  }
  clickEventName: string | null = 'gmp-click';
  dragstartEventName: string | null = null;
  dragEventName: string | null = null;
  dragendEventName: string | null = null;

  async onAdd(data: AddParams[]): Promise<(GoogleMapActualMarker | null)[]> {
    const { MarkerElement } = await loadLibrary<google.maps.Maps3DLibrary>('maps3d');
    
    const markers = await Promise.all(data.map(async ({bitmapIcon, state }) => {

      const icon: HTMLImageElement = await new Promise(
        (resolve: (element: HTMLImageElement) => void, reject: (error: string | Event) => void) => {

        const image = new Image();
        image.src = bitmapIcon.url;
        image.style.width = `${bitmapIcon.size.width}px`;
        image.style.height = `${bitmapIcon.size.height}px`;
        image.onload = () => resolve(image);
        image.onerror = reject;
      });
      // Prevent native HTML5 image drag-and-drop: it swallows mousedown/mousemove,
      // which the controller needs for its own marker-drag implementation.
      icon.draggable = false;

      const marker = new MarkerElement({
        position: {
          lat: state.position.latitude,
          lng: state.position.longitude,
          altitude: state.position.altitude || 0,
        },
        anchorLeft: `${(bitmapIcon.anchor.x) * -100}%`,
        anchorTop: `${(bitmapIcon.anchor.y) * -100}%`,
        
      //   clickable: state.clickable,
      //   draggable: state.draggable,
      //   zIndex: state.zIndex,
      });
      marker.append(icon);
      return marker;
    }));
    this.holder.map.append(...markers);
    return markers;
  }

  async onChange(
    data: ChangeParams<GoogleMapActualMarker>[],
  ): Promise<(GoogleMapActualMarker | null)[]> {
    return data.map(({ current, prev }) => {
      const marker = prev.marker;
      if (!marker) return null;
      marker.position = {
        lat: current.state.position.latitude,
        lng: current.state.position.longitude,
        altitude: current.state.position.altitude || 0,
      };
      return marker;
    });
  }

  async onRemove(data: MarkerEntity<GoogleMapActualMarker>[]): Promise<void> {
    for (const entity of data) {
      entity.marker?.remove();
    }
  }

  async onPostProcess(): Promise<void> {

  }

  setMarkerPosition(entity: MarkerEntity<GoogleMapActualMarker>, position: GeoPoint): void {
    if (!entity.marker) return;
    entity.marker.position = {
      lat: position.latitude,
      lng: position.longitude,
      altitude: position.altitude || 0,
    };
  }

  override setMarkerVisible(entity: MarkerEntity<GoogleMapActualMarker>, visible: boolean): void {
    if (!entity.marker) return;
    entity.marker.style.display = visible ? '' : 'none';
  }

  syncPositionToState(marker: GoogleMapActualMarker, state: MarkerState): void {
    const position = marker.position;
    if (!position) return;
    state.setPosition(createGeoPoint({
      latitude: position.lat,
      longitude: position.lng,
      altitude: position.altitude,
    }));
  }
}
