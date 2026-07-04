/// <reference types="google.maps" />
import {
  AbstractPolylineOverlayRenderer,
  type PolylineEntity,
  type PolylineState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapViewHolder } from '../GoogleMapViewHolder';

export class GoogleMapPolylineOverlayRenderer extends AbstractPolylineOverlayRenderer<
  GoogleMapViewHolder,
  google.maps.Polyline
> {
  constructor(holder: GoogleMapViewHolder) {
    super(holder);
  }

  async createPolyline(_state: PolylineState): Promise<google.maps.Polyline | null> {
    return null;
    // return new google.maps.Polyline({
    //   path: state.points.map(latLngFromGeoPoint),
    //   strokeColor: state.strokeColor,
    //   strokeWeight: state.strokeWidth,
    //   geodesic: state.geodesic,
    //   zIndex: state.zIndex,
    //   clickable: true,
    //   map: this.holder.map,
    // });
  }

  async updatePolylineProperties({
    polyline,
  }: {
    polyline: google.maps.Polyline;
    current: PolylineEntity<google.maps.Polyline>;
    prev: PolylineEntity<google.maps.Polyline>;
  }): Promise<google.maps.Polyline | null> {
    // polyline.setOptions({
    //   path: current.state.points.map(latLngFromGeoPoint),
    //   strokeColor: current.state.strokeColor,
    //   strokeWeight: current.state.strokeWidth,
    //   geodesic: current.state.geodesic,
    //   zIndex: current.state.zIndex,
    //   clickable: true,
    //   map: this.holder.map,
    // });
    return polyline;
  }

  async removePolyline(entity: PolylineEntity<google.maps.Polyline>): Promise<void> {
    google.maps.event.clearInstanceListeners(entity.polyline);
    entity.polyline.setMap(null);
  }
}
