/// <reference types="google.maps" />
import {
  AbstractPolygonOverlayRenderer,
  type PolygonEntity,
  type PolygonState,
} from '@mapconductor/js-sdk-core';
import { toGoogleMapFillStyle } from '../color';
import { ensureClockwise, ensureCounterClockwise, geoPointToLatLng } from '../helpers';
import { GoogleMapActualPolygon } from '../GoogleMapTypeAlias';
import { GoogleMapViewHolder2D } from '../GoogleMapViewHolder2D';

export class GoogleMapPolygonOverlayRenderer2D extends AbstractPolygonOverlayRenderer<
  GoogleMapViewHolder2D,
  GoogleMapActualPolygon
> {
  constructor(holder: GoogleMapViewHolder2D) {
    super(holder);
  }

  async createPolygon(state: PolygonState): Promise<GoogleMapActualPolygon | null> {
    const fill = toGoogleMapFillStyle(state.fillColor);
    return new google.maps.Polygon({
      paths: this.buildPaths(state),
      strokeColor: state.strokeColor,
      strokeWeight: state.strokeWidth,
      fillColor: fill.color,
      fillOpacity: fill.opacity,
      geodesic: state.geodesic,
      zIndex: state.zIndex,
      clickable: true,
      map: this.holder.map,
    });
  }

  async updatePolygonProperties({
    polygon,
    current,
  }: {
    polygon: GoogleMapActualPolygon;
    current: PolygonEntity<GoogleMapActualPolygon>;
    prev: PolygonEntity<GoogleMapActualPolygon>;
  }): Promise<GoogleMapActualPolygon | null> {
    const polygon2D = polygon as google.maps.Polygon;
    const fill = toGoogleMapFillStyle(current.state.fillColor);
    polygon2D.setOptions({
      paths: this.buildPaths(current.state),
      strokeColor: current.state.strokeColor,
      strokeWeight: current.state.strokeWidth,
      fillColor: fill.color,
      fillOpacity: fill.opacity,
      geodesic: current.state.geodesic,
      zIndex: current.state.zIndex,
      clickable: true,
      map: this.holder.map,
    });
    return polygon2D;
  }

  async removePolygon(entity: PolygonEntity<GoogleMapActualPolygon>): Promise<void> {
    const polygon = entity.polygon as google.maps.Polygon;
    google.maps.event.clearInstanceListeners(polygon);
    polygon.setMap(null);
  }

  private buildPaths(state: PolygonState): google.maps.LatLngLiteral[][] {
    // google.maps.Polygon requires holes to wind opposite the outer ring to
    // render as a cutout (same winding fills solid — see helpers.ts).
    const outer = ensureClockwise(state.points.map(geoPointToLatLng));
    const holes = state.holes
      .map((hole) => hole.map(geoPointToLatLng))
      .filter((ring) => ring.length >= 3)
      .map(ensureCounterClockwise);
    return [outer, ...holes];
  }
}
