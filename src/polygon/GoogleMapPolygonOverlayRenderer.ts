/// <reference types="google.maps" />
import {
  AbstractPolygonOverlayRenderer,
  type PolygonEntity,
  type PolygonState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapViewHolder } from '../GoogleMapViewHolder';

export class GoogleMapPolygonOverlayRenderer extends AbstractPolygonOverlayRenderer<
  GoogleMapViewHolder,
  google.maps.Polygon
> {
  constructor(holder: GoogleMapViewHolder) {
    super(holder);
  }

  async createPolygon(_state: PolygonState): Promise<google.maps.Polygon | null> {
    return null;
    // return new google.maps.Polygon({
    //   paths: this.buildPaths(state),
    //   strokeColor: state.strokeColor,
    //   strokeWeight: state.strokeWidth,
    //   fillColor: state.fillColor,
    //   geodesic: state.geodesic,
    //   zIndex: state.zIndex,
    //   clickable: true,
    //   map: this.holder.map,
    // });
  }

  async updatePolygonProperties({
    polygon,
  }: {
    polygon: google.maps.Polygon;
    current: PolygonEntity<google.maps.Polygon>;
    prev: PolygonEntity<google.maps.Polygon>;
  }): Promise<google.maps.Polygon | null> {
    // polygon.setOptions({
    //   paths: this.buildPaths(current.state),
    //   strokeColor: current.state.strokeColor,
    //   strokeWeight: current.state.strokeWidth,
    //   fillColor: current.state.fillColor,
    //   geodesic: current.state.geodesic,
    //   zIndex: current.state.zIndex,
    //   clickable: true,
    //   map: this.holder.map,
    // });
    return polygon;
  }

  async removePolygon(entity: PolygonEntity<google.maps.Polygon>): Promise<void> {
    google.maps.event.clearInstanceListeners(entity.polygon);
    entity.polygon.setMap(null);
  }

  // private buildPaths(state: PolygonState): google.maps.LatLngLiteral[][] {
  //   return [
  //     state.points.map(latLngFromGeoPoint),
  //     ...state.holes.map((hole) => hole.map(latLngFromGeoPoint)),
  //   ];
  // }
}
