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
