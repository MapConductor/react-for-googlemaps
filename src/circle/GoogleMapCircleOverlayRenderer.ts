/// <reference types="google.maps" />
import {
  AbstractCircleOverlayRenderer,
  type CircleEntity,
  type CircleState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapViewHolder } from '../GoogleMapViewHolder';

export class GoogleMapCircleOverlayRenderer extends AbstractCircleOverlayRenderer<
  GoogleMapViewHolder,
  google.maps.Circle
> {
  constructor(holder: GoogleMapViewHolder) {
    super(holder);
  }

  async createCircle(_state: CircleState): Promise<google.maps.Circle | null> {
    // return new google.maps.Circle({
    //   center: latLngFromGeoPoint(state.center),
    //   radius: state.radiusMeters,
    //   strokeColor: state.strokeColor,
    //   strokeWeight: state.strokeWidth,
    //   fillColor: state.fillColor,
    //   zIndex: state.zIndex,
    //   clickable: state.clickable,
    //   map: this.holder.map,
    // });
    return null;
  }

  async updateCircleProperties({
    circle,
  }: {
    circle: google.maps.Circle;
    current: CircleEntity<google.maps.Circle>;
    prev: CircleEntity<google.maps.Circle>;
  }): Promise<google.maps.Circle | null> {
    // circle.setOptions({
    //   center: latLngFromGeoPoint(current.state.center),
    //   radius: current.state.radiusMeters,
    //   strokeColor: current.state.strokeColor,
    //   strokeWeight: current.state.strokeWidth,
    //   fillColor: current.state.fillColor,
    //   zIndex: current.state.zIndex,
    //   clickable: current.state.clickable,
    //   map: this.holder.map,
    // });
    return circle;
  }

  async removeCircle(entity: CircleEntity<google.maps.Circle>): Promise<void> {
    google.maps.event.clearInstanceListeners(entity.circle);
    entity.circle.setMap(null);
  }
}
