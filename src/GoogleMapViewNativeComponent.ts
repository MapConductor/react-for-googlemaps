import type { HostComponent, ViewProps } from 'react-native';
import { codegenNativeComponent } from 'react-native';
import type { GeoPoint, MapCameraPosition, MarkerTilingOptions } from '@mapconductor/js-sdk-core';

export interface NativeGoogleMapViewEvent<T> {
  nativeEvent: T;
}

export interface NativeMarkerTilingOptions {
  enabled: boolean;
  debugTileOverlay: boolean;
  minMarkerCount: number;
  cacheSize: number;
}

export interface NativeGoogleMapViewProps extends ViewProps {
  cameraPosition?: {
    position: {
      latitude: number;
      longitude: number;
      altitude?: number | null;
    };
    zoom: number;
    bearing: number;
    tilt: number;
  };
  mapDesignType?: string;
  markerTilingOptions?: NativeMarkerTilingOptions;
  infoBubblePositions?: Array<{
    id: string;
    latitude: number;
    longitude: number;
    altitude?: number | null;
  }>;
  onMapLoaded?: () => void;
  onMapClick?: (event: NativeGoogleMapViewEvent<{ point: GeoPoint }>) => void;
  onMapLongClick?: (event: NativeGoogleMapViewEvent<{ point: GeoPoint }>) => void;
  onCameraMoveStart?: (
    event: NativeGoogleMapViewEvent<{ cameraPosition: MapCameraPosition }>
  ) => void;
  onCameraMove?: (
    event: NativeGoogleMapViewEvent<{ cameraPosition: MapCameraPosition }>
  ) => void;
  onCameraMoveEnd?: (
    event: NativeGoogleMapViewEvent<{ cameraPosition: MapCameraPosition }>
  ) => void;
  onMarkerClick?: (event: NativeGoogleMapViewEvent<{ markerId: string }>) => void;
  onMarkerDragStart?: (
    event: NativeGoogleMapViewEvent<{ markerId: string; point: GeoPoint }>
  ) => void;
  onMarkerDrag?: (event: NativeGoogleMapViewEvent<{ markerId: string; point: GeoPoint }>) => void;
  onMarkerDragEnd?: (event: NativeGoogleMapViewEvent<{ markerId: string; point: GeoPoint }>) => void;
  onMarkerScreenPositions?: (
    event: NativeGoogleMapViewEvent<{
      positions: Array<{ markerId: string; x: number; y: number }>;
    }>
  ) => void;
  onInfoBubbleScreenPositions?: (
    event: NativeGoogleMapViewEvent<{
      positions: Array<{ id: string; x: number; y: number }>;
    }>
  ) => void;
}

export function toNativeMarkerTilingOptions(
  markerTilingOptions: MarkerTilingOptions | undefined
): NativeMarkerTilingOptions | undefined {
  if (!markerTilingOptions) return undefined;
  return {
    enabled: markerTilingOptions.enabled,
    debugTileOverlay: markerTilingOptions.debugTileOverlay,
    minMarkerCount: markerTilingOptions.minMarkerCount,
    cacheSize: markerTilingOptions.cacheSize,
  };
}

export function toNativeCameraPosition(cameraPosition: MapCameraPosition | undefined) {
  if (!cameraPosition) return undefined;

  return {
    position: {
      latitude: cameraPosition.position.latitude,
      longitude: cameraPosition.position.longitude,
      altitude: cameraPosition.position.altitude ?? 0,
    },
    zoom: cameraPosition.zoom,
    bearing: cameraPosition.bearing,
    tilt: cameraPosition.tilt,
  };
}

export default codegenNativeComponent<NativeGoogleMapViewProps>(
  // Align to android/src/main/java/com/mapconductor/react/googlemaps/GoogleMapsViewManager.kt (REACT_CLASS)
  // and ios/MapConductorGoogleMapsViewManager.m (RCT_EXPORT_MODULE)
  'GoogleMapView'
) as HostComponent<NativeGoogleMapViewProps>;
