import {
  createGeoPoint,
  createInterpolatePoints,
  createLinearInterpolatePoints,
  type CircleState,
  type GeoPoint,
  type PolygonState,
  type PolylineState,
} from '@mapconductor/js-sdk-core';
import { geoPointToLatLngAlt } from './helpers';

const CIRCLE_SEGMENTS = 64;
const CIRCLE_EARTH_RADIUS_METERS = 6371000.0;

export function calculateCircleZIndex(center: GeoPoint): number {
  return ((-center.latitude * 1_000_000 - center.longitude) | 0);
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

export function buildPolygonPath(points: GeoPoint[], geodesic: boolean): google.maps.LatLngAltitudeLiteral[] {
  const path = geodesic
    ? createInterpolatePoints(points)
    : createLinearInterpolatePoints(points);
  return toLatLngAltitudePath(path);
}

export function buildPolygonInnerPaths(state: PolygonState): google.maps.LatLngAltitudeLiteral[][] {
  return state.holes
    .map((hole) => buildPolygonPath(hole, state.geodesic))
    .filter((hole) => hole.length >= 3);
}

export function buildCirclePath(state: CircleState): google.maps.LatLngAltitudeLiteral[] {
  const center = state.center;
  const centerLatRad = toRadians(center.latitude);
  const centerLngRad = toRadians(center.longitude);
  const angularDistance = state.radiusMeters / CIRCLE_EARTH_RADIUS_METERS;
  const points: GeoPoint[] = [];

  for (let i = 0; i <= CIRCLE_SEGMENTS; i += 1) {
    const bearing = 2.0 * Math.PI * i / CIRCLE_SEGMENTS;

    if (state.geodesic) {
      const lat = Math.atan2(
        Math.sin(centerLatRad) * Math.cos(angularDistance) +
          Math.cos(centerLatRad) * Math.sin(angularDistance) * Math.cos(bearing),
        Math.sqrt(
          (
            Math.cos(centerLatRad) * Math.cos(angularDistance) -
              Math.sin(centerLatRad) * Math.sin(angularDistance) * Math.cos(bearing)
          ) *
            (
              Math.cos(centerLatRad) * Math.cos(angularDistance) -
                Math.sin(centerLatRad) * Math.sin(angularDistance) * Math.cos(bearing)
            ) +
            (Math.sin(angularDistance) * Math.sin(bearing)) *
              (Math.sin(angularDistance) * Math.sin(bearing)),
        ),
      );

      const lng = centerLngRad +
        Math.atan2(
          Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(centerLatRad),
          Math.cos(angularDistance) - Math.sin(centerLatRad) * Math.sin(lat),
        );

      points.push(createGeoPoint({
        latitude: toDegrees(lat),
        longitude: toDegrees(lng),
        altitude: center.altitude ?? 0,
      }));
    } else {
      const latDegreesPerMeter = 1.0 / (CIRCLE_EARTH_RADIUS_METERS * Math.PI / 180.0);
      const lngDegreesPerMeter = 1.0 / (
        CIRCLE_EARTH_RADIUS_METERS * Math.PI / 180.0 * Math.cos(centerLatRad)
      );
      const dx = state.radiusMeters * Math.cos(bearing);
      const dy = state.radiusMeters * Math.sin(bearing);

      points.push(createGeoPoint({
        latitude: center.latitude + dy * latDegreesPerMeter,
        longitude: center.longitude + dx * lngDegreesPerMeter,
        altitude: center.altitude ?? 0,
      }));
    }
  }

  return toLatLngAltitudePath(points);
}

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180.0;
}

function toDegrees(radians: number): number {
  return radians * 180.0 / Math.PI;
}
