/// <reference types="google.maps" />
import {
  AbstractCircleOverlayRenderer,
  circleToRing,
  closeRing,
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
    // Circle polygon from the shared core geometry (circleToRing), replacing
    // google.maps.Circle so the circle shape definition (geodesic vs planar)
    // is unified across providers (the 3D renderer already draws the same
    // ring). The vertices are dense (128 segments), so Google's own per-
    // segment rendering keeps the ring smooth without the geodesic flag.
    return new google.maps.Polygon({
      paths: this.buildRing(state),
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
    const circle2D = circle as google.maps.Polygon;
    const fill = toGoogleMapFillStyle(current.state.fillColor);
    circle2D.setOptions({
      paths: this.buildRing(current.state),
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
    const circle = entity.circle as google.maps.Polygon;
    google.maps.event.clearInstanceListeners(circle);
    circle.setMap(null);
  }

  private buildRing(state: CircleState): google.maps.LatLngLiteral[] {
    return closeRing(
      circleToRing(state.center, state.radiusMeters, state.geodesic),
    ).map(geoPointToLatLng);
  }
}
