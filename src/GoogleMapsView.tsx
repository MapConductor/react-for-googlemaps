import { useEffect, useRef, useState } from 'react';
import {
  MapContext,
  MapViewScope,
  MapViewScopeProvider,
  InfoBubbleOverlay,
  MarkerAnimationLayer,
  type InfoBubbleEntry,
} from '@mapconductor/js-sdk-react';
import type {
  MapCameraPosition,
  GeoPoint,
  OverlayCollector,
  MarkerAnimationOverlayEntry,
} from '@mapconductor/js-sdk-core';
import type { GoogleMapViewController } from './GoogleMapViewController';
import { GoogleMapsViewProps } from './GoogleMapsViewProps';
import { GoogleMapsProvider } from './GoogleMapsProvider';
import { GoogleMapsConfig } from './GoogleMapsConfig';

/**
 * Google Maps React component
 */
export function GoogleMapsView({
  state,
  apiKey,
  mapId,
  className,
  style,
  version,
  markerTilingOptions,
  onError,
  onMapLoaded,
  onMapClick,
  onMapLongClick,
  onCameraMoveStart,
  onCameraMove,
  onCameraMoveEnd,
  children,
}: GoogleMapsViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [provider] = useState(() => new GoogleMapsProvider());
  const [scope] = useState(() => new MapViewScope());
  const [controller, setController] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const bridgeUnsubs = useRef<(() => void)[]>([]);
  const typedControllerRef = useRef<GoogleMapViewController | null>(null);
  const [bubbleEntries, setBubbleEntries] = useState<InfoBubbleEntry[]>([]);
  const [animationEntries, setAnimationEntries] = useState<MarkerAnimationOverlayEntry[]>([]);
  const [cameraTick, setCameraTick] = useState(0);

  // Keep latest callbacks in refs to avoid stale closures without re-running the effect
  const onMapLoadedRef = useRef(onMapLoaded);
  const onMapClickRef = useRef(onMapClick);
  const onMapLongClickRef = useRef(onMapLongClick);
  const onCameraMoveStartRef = useRef(onCameraMoveStart);
  const onCameraMoveRef = useRef(onCameraMove);
  const onCameraMoveEndRef = useRef(onCameraMoveEnd);
  onMapLoadedRef.current = onMapLoaded;
  onMapClickRef.current = onMapClick;
  onMapLongClickRef.current = onMapLongClick;
  onCameraMoveStartRef.current = onCameraMoveStart;
  onCameraMoveRef.current = onCameraMove;
  onCameraMoveEndRef.current = onCameraMoveEnd;

  useEffect(() => {
    if (!containerRef.current) return;
    const mapDesignType = state.mapDesignType.getValue().toUpperCase();
    if (mapDesignType !== 'ROADMAP' && mapDesignType !== 'HYBRID' && mapDesignType !== 'SATELLITE') {
      throw new Error(`Map3D supports only following mapDesignTypes: ROADMAP, HYBRID, and SATELLITE.`);
    }

    let cancelled = false;

    const config: GoogleMapsConfig = {
      container: containerRef.current,
      apiKey,
      mapId,
      initCameraPosition: state.cameraPosition,
      mapDesignType: mapDesignType,
      markerTilingOptions,
      version,
    };

    provider
      .initialize(config)
      .then((ctrl) => {
        if (cancelled) return;

        state.setController(ctrl);
        state.setCameraPositionChangeListener(() => {
          setCameraTick(t => t + 1);
        });
        setController(ctrl);
        typedControllerRef.current = ctrl as GoogleMapViewController;

        ctrl.setCameraMoveStartListener((camera: MapCameraPosition) => {
          state.updateCameraPosition(camera);
          onCameraMoveStartRef.current?.(camera);
        });
        ctrl.setCameraMoveListener((camera: MapCameraPosition) => {
          state.updateCameraPosition(camera);
          onCameraMoveRef.current?.(camera);
          setCameraTick(t => t + 1);
        });
        ctrl.setCameraMoveEndListener((camera: MapCameraPosition) => {
          state.updateCameraPosition(camera);
          onCameraMoveEndRef.current?.(camera);
          setCameraTick(t => t + 1);
        });
        ctrl.setMapClickListener((point: GeoPoint) => onMapClickRef.current?.(point));
        ctrl.setMapLongClickListener((point: GeoPoint) => onMapLongClickRef.current?.(point));
        // Force bubble position recalculation once the map is fully ready (projection available).
        // getProjection() may return null right after new Map() — this listener fires after
        // tilesloaded, at which point the projection is guaranteed to be available.
        ctrl.setMapInitializedListener(() => {
          onMapLoadedRef.current?.(state);
          setCameraTick(t => t + 1);
        });

        const registry = scope.buildRegistry();
        for (const overlay of registry.getAll()) {
          const unsub = overlay.subscribe((data) => {
            overlay.render(data, ctrl).catch(console.error);
          });
          bridgeUnsubs.current.push(unsub);
        }

        const bubbleUnsub = scope.bubbleCollector.subscribe((map) => {
          setBubbleEntries(Array.from(map.values()));
        });
        bridgeUnsubs.current.push(bubbleUnsub);

        // Route Drop/Bounce animations to the screen-space overlay instead of
        // interpolating geo coordinates. Mirrors Android's
        // setMarkerAnimationOverlayHost wiring in MapViewBase.kt.
        typedControllerRef.current.setMarkerAnimationOverlayHost(scope.markerAnimationStore.start);
        bridgeUnsubs.current.push(() => typedControllerRef.current?.setMarkerAnimationOverlayHost(null));
        const animationUnsub = scope.markerAnimationStore.subscribe(setAnimationEntries);
        bridgeUnsubs.current.push(animationUnsub);

        // Route per-state changes (e.g. setPosition during a drag) to the
        // targeted update*() methods. Mirrors MapLibreView / Android's
        // MapViewBase.kt DisposableEffect(controller) block; without this,
        // MarkerState.setPosition() never reaches the marker controller.
        const c = ctrl as unknown as Record<string, (s: never) => unknown>;
        const setupUpdateHandler = <S extends { id: string }>(
          collector: OverlayCollector<S>,
          hasMethod: string,
          updateMethod: string,
          onUpdated?: () => void,
        ) => {
          collector.setUpdateHandler((state) => {
            if ((c[hasMethod] as (s: S) => boolean)?.(state)) {
              void (c[updateMethod] as (s: S) => Promise<void>)?.(state);
              onUpdated?.();
            }
          });
          bridgeUnsubs.current.push(() => collector.setUpdateHandler(null));
        };

        // The marker handler also bumps cameraTick so open InfoBubbles
        // re-project while their marker is being dragged.
        setupUpdateHandler(scope.markerCollector, 'hasMarker', 'updateMarker', () => setCameraTick(t => t + 1));
        setupUpdateHandler(scope.circleCollector, 'hasCircle', 'updateCircle');
        setupUpdateHandler(scope.polylineCollector, 'hasPolyline', 'updatePolyline');
        setupUpdateHandler(scope.polygonCollector, 'hasPolygon', 'updatePolygon');
        setupUpdateHandler(scope.groundImageCollector, 'hasGroundImage', 'updateGroundImage');
        setupUpdateHandler(scope.rasterLayerCollector, 'hasRasterLayer', 'updateRasterLayer');

        setIsReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to initialize Google Maps:', error);
        onError?.(error);
      });

    return () => {
      cancelled = true;
      state.setCameraPositionChangeListener(null);
      state.setController(null);
      typedControllerRef.current = null;
      bridgeUnsubs.current.forEach((unsub) => unsub());
      bridgeUnsubs.current = [];
      provider.destroy();
    };
  }, [apiKey, mapId, state.mapDesignType.id]);

  // cameraTick is read here only to force a re-render when the camera moves,
  // so that toScreenOffset() recalculates bubble positions.
  void cameraTick;

  return (
    <MapContext.Provider value={{ controller, isReady }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          ...style,
        }}
      >
        <div
          ref={containerRef}
          className={className}
          style={{ width: '100%', height: '100%' }}
        />
        {animationEntries.length > 0 && typedControllerRef.current && (
          <MarkerAnimationLayer
            entries={animationEntries}
            resolveScreenOffset={(entry) => typedControllerRef.current!.holder.toScreenOffset(entry.state.position)}
          />
        )}
        {bubbleEntries.length > 0 && typedControllerRef.current && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
            {bubbleEntries.map(entry => {
              const holder = typedControllerRef.current!.holder;
              const pos = entry.positionProvider();
              const screenOffset = holder.toScreenOffset(pos);
              if (!screenOffset) return null;
              const icon = entry.icon;
              const iconPixelSize = icon ? icon.iconSize * icon.scale : 0;
              return (
                <InfoBubbleOverlay
                  key={entry.id}
                  positionOffset={screenOffset}
                  iconSize={{ width: iconPixelSize, height: iconPixelSize }}
                  iconOffset={icon ? icon.anchor : { x: 0.5, y: 0.5 }}
                  infoAnchorOffset={icon ? icon.infoAnchor : { x: 0.5, y: 0.5 }}
                  tailOffset={entry.tailOffset}
                  style={{ pointerEvents: 'auto' }}
                >
                  {entry.content as any}
                </InfoBubbleOverlay>
              );
            })}
          </div>
        )}
      </div>
      <MapViewScopeProvider scope={scope}>
        {children}
      </MapViewScopeProvider>
    </MapContext.Provider>
  );
}
