import React, { useEffect, useMemo, useRef, useState } from 'react';
import { findNodeHandle, StyleSheet, View } from 'react-native';
import { GeoPoint, MapCameraPosition } from '@mapconductor/js-sdk-core';
import type { MarkerTilingOptions } from '@mapconductor/js-sdk-core';
import {
  InfoBubbleLayer,
  MapContext,
  MapViewScope,
  MapViewScopeProvider,
  registerIconScaleCallback,
  unregisterIconScaleCallback,
  type InfoBubblePositionRequest,
  type InfoBubbleScreenPositionMap,
  type MapViewBaseProps,
  type MarkerScreenPositionMap,
  useCollectAndRenderOverlays,
} from '@mapconductor/js-sdk-react/native';
import type { GoogleMapViewState } from './GoogleMapViewState';
import { GoogleMapViewController } from './GoogleMapViewController.native';
import NativeGoogleMapView, {
  toNativeCameraPosition,
  toNativeMarkerTilingOptions,
} from './GoogleMapViewNativeComponent';

export interface GoogleMapViewProps extends Omit<MapViewBaseProps<GoogleMapViewState>, 'state'> {
  state?: GoogleMapViewState;
  apiKey?: string;
  mapId?: string;
  markerTilingOptions?: MarkerTilingOptions;
  className?: string;
  onError?: (error: Error) => void;
}

export function GoogleMapView({
  style,
  state,
  onMapLoaded,
  onMapClick,
  onMapLongClick,
  onCameraMoveStart,
  onCameraMove,
  onCameraMoveEnd,
  markerTilingOptions,
  children,
}: GoogleMapViewProps) {
  const nativeRef = useRef<React.ComponentRef<typeof NativeGoogleMapView> | null>(null);
  const scope = useMemo(() => new MapViewScope(), []);
  const registry = useMemo(() => scope.buildRegistry(), [scope]);
  const initialCameraPositionRef = useRef(state?.cameraPosition);
  const onMapLoadedRef = useRef(onMapLoaded);
  const onMapClickRef = useRef(onMapClick);
  const onMapLongClickRef = useRef(onMapLongClick);
  const onCameraMoveStartRef = useRef(onCameraMoveStart);
  const onCameraMoveRef = useRef(onCameraMove);
  const onCameraMoveEndRef = useRef(onCameraMoveEnd);
  const [controller] = useState(() =>
    state ? new GoogleMapViewController(nativeRef, state.cameraPosition) : null
  );
  const [markerScreenPositions, setMarkerScreenPositions] = useState<MarkerScreenPositionMap>(
    () => new Map()
  );
  const [infoBubblePositions, setInfoBubblePositions] = useState<InfoBubblePositionRequest[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [infoBubbleScreenPositions, setInfoBubbleScreenPositions] =
    useState<InfoBubbleScreenPositionMap>(() => new Map());

  useCollectAndRenderOverlays(registry, controller);

  useEffect(() => {
    const iconScaleCallback = markerTilingOptions?.iconScaleCallback;
    if (!iconScaleCallback) return;
    const viewId = findNodeHandle(nativeRef.current);
    if (viewId == null) return;
    registerIconScaleCallback(viewId, iconScaleCallback, (markerId) =>
      scope.markerCollector.get(markerId)
    );
    return () => unregisterIconScaleCallback(viewId);
  }, [markerTilingOptions?.iconScaleCallback, scope]);

  useEffect(() => {
    if (!controller) return undefined;

    scope.markerCollector.setUpdateHandler((marker) => {
      if (controller.hasMarker(marker)) {
        void controller.updateMarker(marker);
      }
    });
    scope.circleCollector.setUpdateHandler((circle) => {
      if (controller.hasCircle(circle)) {
        void controller.updateCircle(circle);
      }
    });
    scope.groundImageCollector.setUpdateHandler((groundImage) => {
      if (controller.hasGroundImage(groundImage)) {
        void controller.updateGroundImage(groundImage);
      }
    });
    scope.polylineCollector.setUpdateHandler((polyline) => {
      if (controller.hasPolyline(polyline)) {
        void controller.updatePolyline(polyline);
      }
    });
    scope.polygonCollector.setUpdateHandler((polygon) => {
      if (controller.hasPolygon(polygon)) {
        void controller.updatePolygon(polygon);
      }
    });
    scope.rasterLayerCollector.setUpdateHandler((rasterLayer) => {
      if (controller.hasRasterLayer(rasterLayer)) {
        void controller.updateRasterLayer(rasterLayer);
      }
    });

    return () => {
      scope.markerCollector.setUpdateHandler(null);
      scope.circleCollector.setUpdateHandler(null);
      scope.groundImageCollector.setUpdateHandler(null);
      scope.polylineCollector.setUpdateHandler(null);
      scope.polygonCollector.setUpdateHandler(null);
      scope.rasterLayerCollector.setUpdateHandler(null);
    };
  }, [controller, scope]);

  onMapLoadedRef.current = onMapLoaded;
  onMapClickRef.current = onMapClick;
  onMapLongClickRef.current = onMapLongClick;
  onCameraMoveStartRef.current = onCameraMoveStart;
  onCameraMoveRef.current = onCameraMove;
  onCameraMoveEndRef.current = onCameraMoveEnd;

  useEffect(() => {
    if (!state || !controller) return undefined;

    state.setController(controller);
    state.setMapViewHolder(controller.holder);

    controller.setMapInitializedListener(() => onMapLoadedRef.current?.(state));
    controller.setMapClickListener((point) => onMapClickRef.current?.(point));
    controller.setMapLongClickListener((point) => onMapLongClickRef.current?.(point));
    controller.setCameraMoveStartListener((camera) => {
      state.updateCameraPosition(camera);
      onCameraMoveStartRef.current?.(camera);
    });
    controller.setCameraMoveListener((camera) => {
      state.updateCameraPosition(camera);
      onCameraMoveRef.current?.(camera);
    });
    controller.setCameraMoveEndListener((camera) => {
      state.updateCameraPosition(camera);
      onCameraMoveEndRef.current?.(camera);
    });

    return () => {
      state.setController(null);
      state.setMapViewHolder(null);
      controller.destroy();
    };
  }, [controller, state]);

  return (
    <MapContext.Provider value={{ controller, isReady }}>
      <MapViewScopeProvider scope={scope}>
      <View style={style ?? styles.container}>
        <NativeGoogleMapView
          ref={nativeRef}
          style={StyleSheet.absoluteFill}
          cameraPosition={toNativeCameraPosition(initialCameraPositionRef.current)}
          mapDesignType={state?.mapDesignType.id}
          markerTilingOptions={toNativeMarkerTilingOptions(markerTilingOptions)}
          infoBubblePositions={infoBubblePositions}
          onCameraMoveStart={(event) => {
            const camera = MapCameraPosition.from(event.nativeEvent.cameraPosition);
            controller?.onNativeCameraMoveStart(camera);
          }}
          onCameraMove={(event) => {
            const camera = MapCameraPosition.from(event.nativeEvent.cameraPosition);
            controller?.onNativeCameraMove(camera);
          }}
          onCameraMoveEnd={(event) => {
            const camera = MapCameraPosition.from(event.nativeEvent.cameraPosition);
            controller?.onNativeCameraMoveEnd(camera);
          }}
          onMapClick={(event) =>
            controller?.onNativeMapClick(GeoPoint.from(event.nativeEvent.point))
          }
          onMapLongClick={(event) =>
            controller?.onNativeMapLongClick(GeoPoint.from(event.nativeEvent.point))
          }
          onMapLoaded={() => {
            setIsReady(true);
            controller?.onNativeMapLoaded();
          }}
          onMarkerCompositionBatchProcessed={(event) =>
            controller?.onNativeMarkerCompositionBatchProcessed(
              event.nativeEvent.generation,
              event.nativeEvent.sequence
            )
          }
          onMarkerClick={(event) => controller?.onNativeMarkerClick(event.nativeEvent.markerId)}
          onCircleClick={(event) =>
            controller?.onNativeCircleClick(
              event.nativeEvent.circleId,
              GeoPoint.from(event.nativeEvent.point)
            )
          }
          onGroundImageClick={(event) =>
            controller?.onNativeGroundImageClick(
              event.nativeEvent.groundImageId,
              GeoPoint.from(event.nativeEvent.point)
            )
          }
          onPolylineClick={(event) =>
            controller?.onNativePolylineClick(
              event.nativeEvent.polylineId,
              GeoPoint.from(event.nativeEvent.point)
            )
          }
          onPolygonClick={(event) =>
            controller?.onNativePolygonClick(
              event.nativeEvent.polygonId,
              GeoPoint.from(event.nativeEvent.point)
            )
          }
          onMarkerDragStart={(event) =>
            controller?.onNativeMarkerDragStart(
              event.nativeEvent.markerId,
              GeoPoint.from(event.nativeEvent.point)
            )
          }
          onMarkerDrag={(event) =>
            controller?.onNativeMarkerDrag(
              event.nativeEvent.markerId,
              GeoPoint.from(event.nativeEvent.point)
            )
          }
          onMarkerDragEnd={(event) =>
            controller?.onNativeMarkerDragEnd(
              event.nativeEvent.markerId,
              GeoPoint.from(event.nativeEvent.point)
            )
          }
          onMarkerAnimateStart={(event) =>
            controller?.onNativeMarkerAnimateStart(event.nativeEvent.markerId)
          }
          onMarkerAnimateEnd={(event) =>
            controller?.onNativeMarkerAnimateEnd(event.nativeEvent.markerId)
          }
          onMarkerScreenPositions={(event) => {
            const positions = event.nativeEvent.positions;
            setMarkerScreenPositions((previous) => {
              // Keeping the previous (empty) Map lets React bail out of the
              // re-render that an identical-but-new Map would trigger.
              if (previous.size === 0 && positions.length === 0) return previous;
              return new Map(
                positions.map((position) => [position.markerId, { x: position.x, y: position.y }])
              );
            });
          }}
          onInfoBubbleScreenPositions={(event) => {
            const positions = event.nativeEvent.positions;
            setInfoBubbleScreenPositions((previous) => {
              if (previous.size === 0 && positions.length === 0) return previous;
              return new Map(
                positions.map((position) => [position.id, { x: position.x, y: position.y }])
              );
            });
          }}
          onNativeMapExtensionEvent={(event) =>
            controller?.onNativeMapExtensionEvent(event.nativeEvent)
          }
        />
        <InfoBubbleLayer
          scope={scope}
          markerScreenPositions={markerScreenPositions}
          infoBubbleScreenPositions={infoBubbleScreenPositions}
          onPositionRequestsChange={setInfoBubblePositions}
        />
        {children}
      </View>
      </MapViewScopeProvider>
    </MapContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
