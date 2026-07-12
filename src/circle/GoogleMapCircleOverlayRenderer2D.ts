/// <reference types="google.maps" />
import {
  AbstractCircleOverlayRenderer,
  type CircleEntity,
  type CircleState,
} from '@mapconductor/js-sdk-core';
import { toGoogleMapFillStyle } from '../color';
import { geoPointToLatLng } from '../helpers';
import { GoogleMapViewHolder2D } from '../GoogleMapViewHolder2D';

export class GoogleMapCircleOverlayRenderer2D extends AbstractCircleOverlayRenderer<
  GoogleMapViewHolder2D,
  google.maps.Circle
> {
  constructor(holder: GoogleMapViewHolder2D) {
    super(holder);
  }

  async createCircle(state: CircleState): Promise<google.maps.Circle | null> {
    const fill = toGoogleMapFillStyle(state.fillColor);
    return new google.maps.Circle({
      center: geoPointToLatLng(state.center),
      radius: state.radiusMeters,
      strokeColor: state.strokeColor,
      strokeWeight: state.strokeWidth,
      fillColor: fill.color,
      fillOpacity: fill.opacity,
      zIndex: state.zIndex,
      clickable: state.clickable,
      map: this.holder.map,
    });
  }

  async updateCircleProperties({
    circle,
    current,
  }: {
    circle: google.maps.Circle;
    current: CircleEntity<google.maps.Circle>;
    prev: CircleEntity<google.maps.Circle>;
  }): Promise<google.maps.Circle | null> {
    const fill = toGoogleMapFillStyle(current.state.fillColor);
    circle.setOptions({
      center: geoPointToLatLng(current.state.center),
      radius: current.state.radiusMeters,
      strokeColor: current.state.strokeColor,
      strokeWeight: current.state.strokeWidth,
      fillColor: fill.color,
      fillOpacity: fill.opacity,
      zIndex: current.state.zIndex,
      clickable: current.state.clickable,
      map: this.holder.map,
    });
    return circle;
  }

  async removeCircle(entity: CircleEntity<google.maps.Circle>): Promise<void> {
    google.maps.event.clearInstanceListeners(entity.circle);
    entity.circle.setMap(null);
  }
}
