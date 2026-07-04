/// <reference types="google.maps" />
import {
  createGeoPoint,
  MapViewHolderBase,
  type GeoPoint,
  type GeoPointInterface,
  type Offset,
} from '@mapconductor/js-sdk-core';
import { GoogleMapActualMap2D } from './GoogleMapsTypeAlias';

export class GoogleMapViewHolder2D extends MapViewHolderBase<HTMLElement, GoogleMapActualMap2D> {
  constructor(
    readonly mapView: HTMLElement,
    readonly map: GoogleMapActualMap2D,
  ) {
    super();
  }

  toScreenOffset(position: GeoPointInterface): Offset | null {
    const projection = this.map.getProjection();
    if (!projection) return null;
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    if (!center || zoom === undefined) return null;

    const point = projection.fromLatLngToPoint({ lat: position.latitude, lng: position.longitude });
    const centerPoint = projection.fromLatLngToPoint(center);
    if (!point || !centerPoint) return null;

    const scale = Math.pow(2, zoom);
    return {
      x: (point.x - centerPoint.x) * scale + this.mapView.offsetWidth / 2,
      y: (point.y - centerPoint.y) * scale + this.mapView.offsetHeight / 2,
    };
  }

  async fromScreenOffset(offset: Offset): Promise<GeoPoint | null> {
    return this.fromScreenOffsetSync(offset);
  }

  fromScreenOffsetSync(offset: Offset): GeoPoint | null {
    const projection = this.map.getProjection();
    if (!projection) return null;
    const center = this.map.getCenter();
    const zoom = this.map.getZoom();
    if (!center || zoom === undefined) return null;

    const centerPoint = projection.fromLatLngToPoint(center);
    if (!centerPoint) return null;

    const scale = Math.pow(2, zoom);
    const worldX = (offset.x - this.mapView.offsetWidth / 2) / scale + centerPoint.x;
    const worldY = (offset.y - this.mapView.offsetHeight / 2) / scale + centerPoint.y;
    const latLng = projection.fromPointToLatLng(new google.maps.Point(worldX, worldY));
    if (!latLng) return null;
    return createGeoPoint({ latitude: latLng.lat(), longitude: latLng.lng() });
  }
}
