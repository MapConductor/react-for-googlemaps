/// <reference types="google.maps" />
import {
  AbstractMarkerOverlayRenderer,
  type AddParams,
  type ChangeParams,
  type GeoPoint,
  type MarkerEntity,
  MarkerState,
} from '@mapconductor/core';
import { GoogleMapActualMarker } from '../GoogleMapsTypeAlias';
import { GoogleMapViewHolder } from '../GoogleMapViewHolder';

export class GoogleMapMarkerRenderer extends AbstractMarkerOverlayRenderer<
  GoogleMapViewHolder,
  GoogleMapActualMarker
> {
  constructor(holder: GoogleMapViewHolder) {
    super({ holder });
  }

  async onAdd(data: AddParams[]): Promise<(GoogleMapActualMarker | null)[]> {
    return data.map(_ => null);
  }

  async onChange(
    data: ChangeParams<GoogleMapActualMarker>[],
  ): Promise<(GoogleMapActualMarker | null)[]> {
    return data.map(_ => null);
  }

  async onRemove(_data: MarkerEntity<GoogleMapActualMarker>[]): Promise<void> {
    
  }

  async onPostProcess(): Promise<void> {
    
  }

  setMarkerPosition(_entity: MarkerEntity<GoogleMapActualMarker>, _position: GeoPoint): void {
    
  }

  syncPositionToState(_marker: GoogleMapActualMarker, _state: MarkerState): void {
    
  }
}
