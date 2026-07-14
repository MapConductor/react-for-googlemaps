/// <reference types="google.maps" />
import {
  AbstractPolylineOverlayRenderer,
  type PolylineEntity,
  type PolylineState,
} from '@mapconductor/js-sdk-core';
import { geoPointToLatLng } from '../helpers';
import { GoogleMapActualPolyline } from '../GoogleMapTypeAlias';
import { GoogleMapViewHolder2D } from '../GoogleMapViewHolder2D';

export class GoogleMapPolylineOverlayRenderer2D extends AbstractPolylineOverlayRenderer<
  GoogleMapViewHolder2D,
  GoogleMapActualPolyline
> {
  constructor(holder: GoogleMapViewHolder2D) {
    super(holder);
  }

  async createPolyline(state: PolylineState): Promise<GoogleMapActualPolyline | null> {
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
    polyline: GoogleMapActualPolyline;
    current: PolylineEntity<GoogleMapActualPolyline>;
    prev: PolylineEntity<GoogleMapActualPolyline>;
  }): Promise<GoogleMapActualPolyline | null> {
    const polyline2D = polyline as google.maps.Polyline;
    polyline2D.setOptions({
      path: current.state.points.map(geoPointToLatLng),
      strokeColor: current.state.strokeColor,
      strokeWeight: current.state.strokeWidth,
      geodesic: current.state.geodesic,
      zIndex: current.state.zIndex,
      clickable: true,
      map: this.holder.map,
    });
    return polyline2D;
  }

  async removePolyline(entity: PolylineEntity<GoogleMapActualPolyline>): Promise<void> {
    const polyline = entity.polyline as google.maps.Polyline;
    google.maps.event.clearInstanceListeners(polyline);
    polyline.setMap(null);
  }
}
