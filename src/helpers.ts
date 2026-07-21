/// <reference types="google.maps" />
import { createGeoPoint, type GeoPoint, type GeoRectBounds } from '@mapconductor/js-sdk-core';


export function geoPointToLatLng(point: GeoPoint): google.maps.LatLngLiteral {
  return {
    lat: point.latitude,
    lng: point.longitude,
  };
}
export function geoPointToLatLngAlt(point: GeoPoint): google.maps.LatLngAltitudeLiteral {
  return {
    lat: point.latitude,
    lng: point.longitude,
    altitude: point.altitude || 0,
  };
}

export function latLngToGeoPoint(latLng: google.maps.LatLng | google.maps.LatLngLiteral): GeoPoint {
  if (latLng instanceof google.maps.LatLng) {
    return createGeoPoint({
      latitude: latLng.lat(),
      longitude: latLng.lng(),
    });
  } else {
    return createGeoPoint({
      latitude: latLng.lat,
      longitude: latLng.lng,
    });
  }
}

export function latLngAltToGeoPoint(latLngAlt: google.maps.LatLngAltitude | google.maps.LatLngAltitudeLiteral): GeoPoint {
  return createGeoPoint({
    latitude: latLngAlt.lat,
    longitude: latLngAlt.lng,
    altitude: latLngAlt.altitude,
  });
}

export function mouseEventToGeoPoint(event: google.maps.MapMouseEvent): GeoPoint | null {
  if (!event.latLng) return null;
  return latLngToGeoPoint(event.latLng);
}

// google.maps.Polygon fills holes using winding direction, not an even-odd
// rule: a hole ring must wind OPPOSITE to the outer ring or it renders as
// solid fill (confirmed empirically — same winding produces no cutout at
// all, not even a rendering glitch). Points carry {lat,lng}; the shoelace
// formula is computed in (lng, lat) order so "clockwise" matches the usual
// screen-space sense (lng=x increasing right, lat=y increasing up).
function signedAreaLngLat(ring: { lat: number; lng: number }[]): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += a.lng * b.lat - b.lng * a.lat;
  }
  return sum / 2;
}

export function ensureClockwise<T extends { lat: number; lng: number }>(ring: T[]): T[] {
  return signedAreaLngLat(ring) < 0 ? ring : [...ring].reverse();
}

export function ensureCounterClockwise<T extends { lat: number; lng: number }>(ring: T[]): T[] {
  return signedAreaLngLat(ring) > 0 ? ring : [...ring].reverse();
}

export function geoRectToLatLngBounds(
  bounds: GeoRectBounds,
): google.maps.LatLngBoundsLiteral | null {
  if (!bounds.southWest || !bounds.northEast) return null;
  return {
    south: bounds.southWest.latitude,
    west: bounds.southWest.longitude,
    north: bounds.northEast.latitude,
    east: bounds.northEast.longitude,
  };
}
