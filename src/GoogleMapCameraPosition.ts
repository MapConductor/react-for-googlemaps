import { computeOffset, type GeoPoint, type MapCameraPosition } from '@mapconductor/js-sdk-core';
import { ZoomAltitudeConverter } from './zoom/ZoomAltitudeConverter';

const converter = new ZoomAltitudeConverter(ZoomAltitudeConverter.DEFAULT_ZOOM0_ALTITUDE);
const MAX_GOOGLE_MAPS_TILT = 60;

export interface GoogleMapsCameraPosition {
  center: GeoPoint;
  zoom: number;
  bearing: number;
  tilt: number;
}

/**
 * Converts MapConductor's logical camera to a Google Maps 2D camera.
 *
 * Google Maps cannot render a negative tilt. For an upward-facing view, keep
 * the camera eye altitude implied by zoom and move the ground target forward
 * along the bearing, then render with the positive counterpart of the tilt.
 * This mirrors android-for-googlemaps MapCameraPosition.toCameraPosition().
 */
export function toGoogleMapsCameraPosition(position: MapCameraPosition): GoogleMapsCameraPosition {
  const tilt = Math.min(Math.max(position.tilt, -MAX_GOOGLE_MAPS_TILT), MAX_GOOGLE_MAPS_TILT);
  if (tilt >= 0) {
    return {
      center: position.center,
      zoom: position.zoom,
      bearing: position.bearing,
      tilt,
    };
  }

  const tiltAbs = Math.abs(tilt);
  const altitude = converter.zoomLevelToAltitude({
    zoomLevel: position.zoom,
    latitude: position.position.latitude,
    tilt: 0,
  });
  const center = computeOffset({
    origin: position.position,
    distance: altitude * Math.tan((tiltAbs * Math.PI) / 180),
    heading: position.bearing,
  });

  return {
    center,
    zoom: position.zoom,
    bearing: position.bearing,
    tilt: tiltAbs,
  };
}
