import { useEffect, useRef, useState } from 'react';
import {
  MapContext,
  MapViewScope,
  MapViewScopeProvider,
  InfoBubbleOverlay,
  MarkerAnimationLayer,
  type InfoBubbleEntry,
} from '@mapconductor/js-sdk-react';
import type { MapCameraPosition, GeoPoint, MarkerAnimationOverlayEntry } from '@mapconductor/js-sdk-core';
import type { GoogleMapViewController2D } from './GoogleMapViewController2D';
import { GoogleMapViewProps } from '.';
import { GoogleMapProvider2D } from './GoogleMapProvider2D';
import { GoogleMapConfig2D } from './GoogleMapConfig';


/**
 * Google Maps React component
 */
export function GoogleMapView2D({
  state,
  apiKey,
  onMapLoaded,
  onMapClick,
  onMapLongClick,
  onCameraMoveStart,
  onCameraMove,
  onCameraMoveEnd,
  mapId,
  className,
  style,
  version,
  libraries,
  markerTilingOptions,
  onError,
  children,
}: GoogleMapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [provider] = useState(() => new GoogleMapProvider2D());
  const [scope] = useState(() => new MapViewScope());
  const [controller, setController] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const bridgeUnsubs = useRef<(() => void)[]>([]);
  const typedControllerRef = useRef<GoogleMapViewController2D | null>(null);
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
    let cancelled = false;
    const libraryList = libraries?.split(',') || [];

    const config: GoogleMapConfig2D = {
      container: containerRef.current,
      apiKey,
      mapId,
      initCameraPosition: state.cameraPosition,
      mapDesignType: state.mapDesignType.getValue(),
      markerTilingOptions,
      version,
      libraries: libraryList,
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
        typedControllerRef.current = ctrl as GoogleMapViewController2D;

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
