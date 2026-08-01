import {
  circleToRing,
  closeRing,
  createInterpolatePoints,
  createLinearInterpolatePoints,
  type CircleState,
  type GeoPoint,
  type PolygonState,
  type PolylineState,
} from '@mapconductor/js-sdk-core';
import { geoPointToLatLngAlt } from './helpers';

const ADAPTIVE_EARTH_RADIUS_METERS = 6378137.0;
const ADAPTIVE_EARTH_CIRCUMFERENCE_METERS = 2.0 * Math.PI * ADAPTIVE_EARTH_RADIUS_METERS;
const ADAPTIVE_TILE_SIZE_PIXELS = 256.0;
const ADAPTIVE_TARGET_SEGMENT_PIXELS = 400.0;
const ADAPTIVE_MIN_SEGMENT_LENGTH_METERS = 50.0;
const ADAPTIVE_MAX_SEGMENT_LENGTH_METERS = 100000.0;
const FNV_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;

export function calculateCircleZIndex(center: GeoPoint): number {
  return Math.max(0, (-center.latitude * 1_000_000 - center.longitude) | 0);
}

export function toLatLngAltitudePath(points: GeoPoint[]): google.maps.LatLngAltitudeLiteral[] {
  return points.map(geoPointToLatLngAlt);
}

export function buildPolylinePath(state: PolylineState): google.maps.LatLngAltitudeLiteral[] {
  const points = state.geodesic
    ? createInterpolatePoints(state.points)
    : createLinearInterpolatePoints(state.points);
  return toLatLngAltitudePath(points);
}

export function buildPolygonPath(
  points: GeoPoint[],
  geodesic: boolean,
  maxSegmentLengthMeters: number = 10000.0,
): google.maps.LatLngAltitudeLiteral[] {
  const path = geodesic
    ? createInterpolatePoints(points, maxSegmentLengthMeters)
    : createLinearInterpolatePoints(points);
  return toLatLngAltitudePath(path);
}

export function buildPolygonInnerPaths(
  state: PolygonState,
  maxSegmentLengthMeters: number = 10000.0,
): google.maps.LatLngAltitudeLiteral[][] {
  return state.holes
    .map((hole) => buildPolygonPath(hole, state.geodesic, maxSegmentLengthMeters))
    .filter((hole) => hole.length >= 3);
}

export function adaptiveMaxSegmentLengthMeters({
  zoom,
  latitude,
}: {
  zoom: number;
  latitude: number;
}): number {
  const metersPerPixel =
    (ADAPTIVE_EARTH_CIRCUMFERENCE_METERS * Math.cos(toRadians(Math.abs(latitude)))) /
    (ADAPTIVE_TILE_SIZE_PIXELS * 2.0 ** zoom);
  return clamp(
    metersPerPixel * ADAPTIVE_TARGET_SEGMENT_PIXELS,
    ADAPTIVE_MIN_SEGMENT_LENGTH_METERS,
    ADAPTIVE_MAX_SEGMENT_LENGTH_METERS,
  );
}

export function interpolationCacheKey(points: GeoPoint[], maxSegmentLengthMeters: number): string {
  return `${pointsHash(points)}_${Math.round(maxSegmentLengthMeters)}`;
}

export class LatLngAltitudeInterpolationCache {
  private readonly cache = new Map<string, google.maps.LatLngAltitudeLiteral[]>();

  constructor(private readonly maxEntries: number) {}

  get(key: string): google.maps.LatLngAltitudeLiteral[] | null {
    const value = this.cache.get(key);
    if (!value) return null;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  put(key: string, value: google.maps.LatLngAltitudeLiteral[]): void {
    if (this.cache.has(key)) this.cache.delete(key);
    this.cache.set(key, value);
    while (this.cache.size > this.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
  }
}

export function buildCirclePath(state: CircleState): google.maps.LatLngAltitudeLiteral[] {
  // Closed circle ring from the shared core geometry (128 segments, consistent
  // earth radius across providers). The center altitude is applied to every
  // ring vertex, as before.
  const altitude = state.center.altitude ?? 0;
  return closeRing(circleToRing(state.center, state.radiusMeters, state.geodesic))
    .map((point): google.maps.LatLngAltitudeLiteral => ({
      lat: point.latitude,
      lng: point.longitude,
      altitude,
    }));
}

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180.0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function pointsHash(points: GeoPoint[]): string {
  let hash = FNV_OFFSET_BASIS;
  for (const point of points) {
    const lat = BigInt(Math.round(point.latitude * 1e6));
    const lng = BigInt(Math.round(point.longitude * 1e6));
    hash = BigInt.asUintN(64, (hash ^ lat) * FNV_PRIME);
    hash = BigInt.asUintN(64, (hash ^ lng) * FNV_PRIME);
  }
  hash = BigInt.asUintN(64, (hash ^ BigInt(points.length)) * FNV_PRIME);
  return hash.toString();
}
