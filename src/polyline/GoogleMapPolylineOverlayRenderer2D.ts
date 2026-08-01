/// <reference types="google.maps" />
import {
  AbstractPolylineOverlayRenderer,
  buildUnwrappedPolylinePath,
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
      path: buildPath(state),
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
      path: buildPath(current.state),
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

function buildPath(state: PolylineState): google.maps.LatLngLiteral[] {
  // Geodesic polylines keep the raw vertices — google.maps renders great-circle
  // segments natively via the `geodesic` flag. Non-geodesic polylines are
  // densified with the core linear lat/lng interpolation (Android's
  // straight-in-lat/lng semantics); without it Google draws straight lines in
  // projected Mercator space, which bows away from the lat/lng straight line.
  if (state.geodesic) return state.points.map(geoPointToLatLng);
  return buildUnwrappedPolylinePath(state.points, false).map(geoPointToLatLng);
}
