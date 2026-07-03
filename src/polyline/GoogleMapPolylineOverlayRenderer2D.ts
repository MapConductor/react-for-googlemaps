/// <reference types="google.maps" />
import {
  AbstractPolylineOverlayRenderer,
  type PolylineEntity,
  type PolylineState,
} from '@mapconductor/core';
import { geoPointToLatLng } from '../helpers';
import { GoogleMapViewHolder2D } from '../GoogleMapViewHolder2D';

export class GoogleMapPolylineOverlayRenderer2D extends AbstractPolylineOverlayRenderer<
  GoogleMapViewHolder2D,
  google.maps.Polyline
> {
  constructor(holder: GoogleMapViewHolder2D) {
    super(holder);
  }

  async createPolyline(state: PolylineState): Promise<google.maps.Polyline | null> {
    return new google.maps.Polyline({
      path: state.points.map(geoPointToLatLng),
      strokeColor: state.strokeColor,
      strokeWeight: state.strokeWidth,
      geodesic: state.geodesic,
      zIndex: state.zIndex,
      clickable: true,
      map: this.holder.map,
    });
  }

  async updatePolylineProperties({
    polyline,
    current,
  }: {
    polyline: google.maps.Polyline;
    current: PolylineEntity<google.maps.Polyline>;
    prev: PolylineEntity<google.maps.Polyline>;
  }): Promise<google.maps.Polyline | null> {
    polyline.setOptions({
      path: current.state.points.map(geoPointToLatLng),
      strokeColor: current.state.strokeColor,
      strokeWeight: current.state.strokeWidth,
      geodesic: current.state.geodesic,
      zIndex: current.state.zIndex,
      clickable: true,
      map: this.holder.map,
    });
    return polyline;
  }

  async removePolyline(entity: PolylineEntity<google.maps.Polyline>): Promise<void> {
    google.maps.event.clearInstanceListeners(entity.polyline);
    entity.polyline.setMap(null);
  }
}
