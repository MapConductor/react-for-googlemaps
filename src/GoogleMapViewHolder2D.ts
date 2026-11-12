/// <reference types="google.maps" />
import {
  createGeoPoint,
  MapCoordinateSystem,
  MapViewHolderBase,
  ProjectedUnit,
  type GeoPoint,
  type GeoPointInterface,
  type Offset,
} from '@mapconductor/js-sdk-core';
import { GoogleMapActualMap2D } from './GoogleMapTypeAlias';

const BUILT_IN_MAP_TYPE_IDS = new Set<string>(['roadmap', 'satellite', 'hybrid', 'terrain']);

export class GoogleMapViewHolder2D extends MapViewHolderBase<HTMLElement, GoogleMapActualMap2D> {
  constructor(
    readonly mapView: HTMLElement,
    readonly map: GoogleMapActualMap2D,
  ) {
    super();
  }

  /**
   * The current map type's own projection, when it has one.
   *
   * Google's built-in map types are Mercator; an app can register
   * a custom `MapType` with a `projection` (Gall-Peters and the like), and the
   * map then lays itself out in it.
   *
   * @internal
   */
  private customProjection(): google.maps.Projection | null {
    const typeId = this.map.getMapTypeId();
    // The built-in types carry Google's Mercator projection in the registry too.
    if (!typeId || BUILT_IN_MAP_TYPE_IDS.has(typeId)) return null;
    const mapType = this.map.mapTypes?.get(typeId) as google.maps.MapType | undefined;
    return mapType?.projection ?? null;
  }

  /**
   * EPSG:3857 meters for the built-in map types. With a custom projection the
   * values are that projection's own world coordinates (`fromLatLngToPoint`,
   * 256 per world at zoom 0), which have no EPSG code.
   */
  override get coordinateSystem(): MapCoordinateSystem {
    return this.customProjection()
      ? { code: null, unit: ProjectedUnit.Other }
      : MapCoordinateSystem.WebMercator;
  }

  override toProjectedPoint(position: GeoPointInterface): Offset | null {
    const projection = this.customProjection();
    if (!projection) return super.toProjectedPoint(position);
    const point = projection.fromLatLngToPoint(new google.maps.LatLng(position.latitude, position.longitude));
    return point && Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x, y: point.y } : null;
  }

  override fromProjectedPoint(point: Offset): GeoPoint | null {
    const projection = this.customProjection();
    if (!projection) return super.fromProjectedPoint(point);
    const latLng = projection.fromPointToLatLng(new google.maps.Point(point.x, point.y));
    return latLng ? createGeoPoint({ latitude: latLng.lat(), longitude: latLng.lng() }) : null;
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

    // fromLatLngToPoint maps longitude into a wrapped [0, 256) world, so a point
    // and the center on opposite sides of the antimeridian differ by ~256 world
    // units even when they are geographically adjacent. Left unwrapped, a marker
    // just across the dateline projects ~360° off-screen and screen-space
    // overlays (marker drop/bounce animations, info bubbles) render off-view even
    // though Google draws the feature itself on the copy in view. Wrap the world-x
    // delta to the nearest copy (Google's world size is 256).
    const WORLD_SIZE = 256;
    let dx = point.x - centerPoint.x;
    dx -= WORLD_SIZE * Math.round(dx / WORLD_SIZE);

    const scale = Math.pow(2, zoom);
    return {
      x: dx * scale + this.mapView.offsetWidth / 2,
      y: (point.y - centerPoint.y) * scale + this.mapView.offsetHeight / 2,
    };
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
