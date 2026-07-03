/// <reference types="google.maps" />
import {
  AbstractPolygonOverlayRenderer,
  type PolygonEntity,
  type PolygonState,
} from '@mapconductor/core';
import { geoPointToLatLng } from '../helpers';
import { GoogleMapViewHolder2D } from '../GoogleMapViewHolder2D';

export class GoogleMapPolygonOverlayRenderer2D extends AbstractPolygonOverlayRenderer<
  GoogleMapViewHolder2D,
  google.maps.Polygon
> {
  constructor(holder: GoogleMapViewHolder2D) {
    super(holder);
  }

  async createPolygon(state: PolygonState): Promise<google.maps.Polygon | null> {
    return new google.maps.Polygon({
      paths: this.buildPaths(state),
      strokeColor: state.strokeColor,
      strokeWeight: state.strokeWidth,
      fillColor: state.fillColor,
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
    polygon: google.maps.Polygon;
    current: PolygonEntity<google.maps.Polygon>;
    prev: PolygonEntity<google.maps.Polygon>;
  }): Promise<google.maps.Polygon | null> {
    polygon.setOptions({
      paths: this.buildPaths(current.state),
      strokeColor: current.state.strokeColor,
      strokeWeight: current.state.strokeWidth,
      fillColor: current.state.fillColor,
      geodesic: current.state.geodesic,
      zIndex: current.state.zIndex,
      clickable: true,
      map: this.holder.map,
    });
    return polygon;
  }

  async removePolygon(entity: PolygonEntity<google.maps.Polygon>): Promise<void> {
    google.maps.event.clearInstanceListeners(entity.polygon);
    entity.polygon.setMap(null);
  }

  private buildPaths(state: PolygonState): google.maps.LatLngLiteral[][] {
    return [
      state.points.map(geoPointToLatLng),
      ...state.holes.map((hole) => hole.map(geoPointToLatLng)),
    ];
  }
}
