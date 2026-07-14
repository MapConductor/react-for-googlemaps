/// <reference types="google.maps" />
import {
  AbstractCircleOverlayRenderer,
  type CircleEntity,
  type CircleState,
} from '@mapconductor/js-sdk-core';
import { toGoogleMapFillStyle } from '../color';
import { geoPointToLatLng } from '../helpers';
import { GoogleMapActualCircle } from '../GoogleMapTypeAlias';
import { GoogleMapViewHolder2D } from '../GoogleMapViewHolder2D';

export class GoogleMapCircleOverlayRenderer2D extends AbstractCircleOverlayRenderer<
  GoogleMapViewHolder2D,
  GoogleMapActualCircle
> {
  constructor(holder: GoogleMapViewHolder2D) {
    super(holder);
  }

  async createCircle(state: CircleState): Promise<GoogleMapActualCircle | null> {
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
    circle: GoogleMapActualCircle;
    current: CircleEntity<GoogleMapActualCircle>;
    prev: CircleEntity<GoogleMapActualCircle>;
  }): Promise<GoogleMapActualCircle | null> {
    const circle2D = circle as google.maps.Circle;
    const fill = toGoogleMapFillStyle(current.state.fillColor);
    circle2D.setOptions({
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
    return circle2D;
  }

  async removeCircle(entity: CircleEntity<GoogleMapActualCircle>): Promise<void> {
    const circle = entity.circle as google.maps.Circle;
    google.maps.event.clearInstanceListeners(circle);
    circle.setMap(null);
  }
}
