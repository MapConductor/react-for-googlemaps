export type GoogleMapActualMarker2D = google.maps.Marker | google.maps.marker.AdvancedMarkerElement;
export type GoogleMapActualMap2D = google.maps.Map;
export type GoogleMapActualMarker = google.maps.maps3d.MarkerElement;
export type GoogleMapActualMap = google.maps.maps3d.Map3DElement;
// 2D circles are rendered as a core-geometry polygon ring (circleToRing), not
// google.maps.Circle, so the circle shape definition (geodesic vs planar) is
// unified across providers (3D already draws a Polygon3DInteractiveElement
// from the same ring).
export type GoogleMapActualCircle =
  google.maps.Polygon | google.maps.maps3d.Polygon3DInteractiveElement;
export type GoogleMapActualPolyline =
  google.maps.Polyline | google.maps.maps3d.Polyline3DInteractiveElement;
export type GoogleMapActualPolygon =
  google.maps.Polygon | google.maps.maps3d.Polygon3DInteractiveElement;
