/// <reference types="google.maps" />
import {
  AbstractPolygonOverlayRenderer,
  type PolygonEntity,
  type PolygonState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapActualPolygon } from '../GoogleMapTypeAlias';
import { GoogleMapViewHolder } from '../GoogleMapViewHolder';
import { loadLibrary } from '../LibraryLoader';
import {
  LatLngAltitudeInterpolationCache,
  adaptiveMaxSegmentLengthMeters,
  buildPolygonPath,
  interpolationCacheKey,
} from '../overlay3d';

export class GoogleMapPolygonOverlayRenderer extends AbstractPolygonOverlayRenderer<
  GoogleMapViewHolder,
  GoogleMapActualPolygon
> {
  private readonly interpolationCache = new LatLngAltitudeInterpolationCache(64);

  constructor(holder: GoogleMapViewHolder) {
    super(holder);
  }

  async createPolygon(state: PolygonState): Promise<GoogleMapActualPolygon | null> {
    const { Polygon3DInteractiveElement } =
      await loadLibrary<google.maps.Maps3DLibrary>('maps3d');
    const innerPaths = this.buildInnerPaths(state);
    const polygon = new Polygon3DInteractiveElement({
      path: this.buildPath(state.points, state.geodesic),
      ...(innerPaths.length > 0 ? { innerPaths } : {}),
      strokeColor: state.strokeColor,
      strokeWidth: state.strokeWidth,
      fillColor: state.fillColor,
      geodesic: false,
      zIndex: state.zIndex,
    });
    this.holder.map.append(polygon);
    return polygon;
  }

  async updatePolygonProperties({
    polygon,
    current,
    prev,
  }: {
    polygon: GoogleMapActualPolygon;
    current: PolygonEntity<GoogleMapActualPolygon>;
    prev: PolygonEntity<GoogleMapActualPolygon>;
  }): Promise<GoogleMapActualPolygon | null> {
    if (!(polygon instanceof HTMLElement)) return polygon;
    const innerPaths = this.buildInnerPaths(current.state);
    if (innerPaths.length === 0 && prev.state.holes.length > 0) {
      await this.removePolygon(prev);
      return this.createPolygon(current.state);
    }

    polygon.path = this.buildPath(current.state.points, current.state.geodesic);
    // if (innerPaths.length > 0) polygon.innerPaths = innerPaths;
    polygon.strokeColor = current.state.strokeColor;
    polygon.strokeWidth = current.state.strokeWidth;
    polygon.fillColor = current.state.fillColor;
    polygon.geodesic = false;
    polygon.zIndex = current.state.zIndex;
    return polygon;
  }

  async removePolygon(entity: PolygonEntity<GoogleMapActualPolygon>): Promise<void> {
    if (entity.polygon instanceof HTMLElement) {
      entity.polygon.remove();
    }
  }

  private buildPath(points: PolygonState['points'], geodesic: boolean): google.maps.LatLngAltitudeLiteral[] {
    if (!geodesic) return buildPolygonPath(points, false);

    const maxSegmentLengthMeters = this.maxSegmentLengthMeters();
    const key = interpolationCacheKey(points, maxSegmentLengthMeters);
    const cached = this.interpolationCache.get(key);
    if (cached) return cached;

    const path = buildPolygonPath(points, true, maxSegmentLengthMeters);
    this.interpolationCache.put(key, path);
    return path;
  }

  private buildInnerPaths(state: PolygonState): google.maps.LatLngAltitudeLiteral[][] {
    return state.holes
      .map((hole) => this.buildPath(hole, state.geodesic))
      .filter((hole) => hole.length >= 3);
  }

  private maxSegmentLengthMeters(): number {
    const center = this.holder.map.center;
    const range = this.holder.map.range;
    if (!center || range == null) return 10000.0;

    const zoom = this.holder.zoomConverter.distanceToZoomLevel({
      distance: range,
      latitude: center.lat,
    });
    return adaptiveMaxSegmentLengthMeters({ zoom, latitude: center.lat });
  }
}
