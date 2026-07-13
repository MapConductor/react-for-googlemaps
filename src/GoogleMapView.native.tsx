import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GeoPoint, MapCameraPosition } from '@mapconductor/js-sdk-core';
import type { MarkerTilingOptions } from '@mapconductor/js-sdk-core';
import {
  InfoBubbleLayer,
  MapContext,
  MapViewScope,
  MapViewScopeProvider,
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
    if (!controller) return undefined;

    scope.markerCollector.setUpdateHandler((marker) => {
      if (controller.hasMarker(marker)) {
        void controller.updateMarker(marker);
      }
    });
    scope.rasterLayerCollector.setUpdateHandler((rasterLayer) => {
      if (controller.hasRasterLayer(rasterLayer)) {
        void controller.updateRasterLayer(rasterLayer);
      }
    });

    return () => {
      scope.markerCollector.setUpdateHandler(null);
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
          onMarkerClick={(event) => controller?.onNativeMarkerClick(event.nativeEvent.markerId)}
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
          onMarkerScreenPositions={(event) => {
            setMarkerScreenPositions(
              new Map(
                event.nativeEvent.positions.map((position) => [
                  position.markerId,
                  { x: position.x, y: position.y },
                ])
              )
            );
          }}
          onInfoBubbleScreenPositions={(event) => {
            setInfoBubbleScreenPositions(
              new Map(
                event.nativeEvent.positions.map((position) => [
                  position.id,
                  { x: position.x, y: position.y },
                ])
              )
            );
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
