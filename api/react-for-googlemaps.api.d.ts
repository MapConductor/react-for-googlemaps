import { MapConfig, MarkerTilingOptions, GeoRectBounds, MapProvider, MapViewControllerInterface, OnMarkerEventHandler, MarkerAnimationOverlayHost, AddParams, ChangeParams, MarkerEntity, GeoPoint, MarkerState, AbstractMarkerController, RasterLayerState, AbstractZoomAltitudeConverter, MapCameraPosition, MapViewHolderBase, GeoPointInterface, Offset, AbstractMarkerOverlayRenderer, AbstractCircleOverlayRenderer, CircleState, CircleEntity, CircleController, AbstractPolylineOverlayRenderer, PolylineState, PolylineEntity, PolylineController, AbstractPolygonOverlayRenderer, PolygonState, PolygonEntity, PolygonController, AbstractGroundImageOverlayRenderer, GroundImageState, GroundImageEntity, GroundImageController, RasterLayerAddParams, RasterLayerChangeParams, RasterLayerEntity, RasterLayerController, RasterHeaderSupport, BaseMapViewController, MarkerCapable, CircleCapable, PolylineCapable, PolygonCapable, GroundImageCapable, RasterLayerCapable, MapUISettings, OnMapInitializedHandler, OnCircleEventHandler, OnPolylineEventHandler, OnPolygonEventHandler, OnGroundImageEventHandler, CameraRestriction, MapDesignTypeInterface, AttributionRule, MapViewStateInterface, MapViewState, MapPaddings, MapViewBaseProps } from '@mapconductor/js-sdk-core';
import * as React from 'react';
import React__default from 'react';

interface GoogleMapConfig2D extends GoogleMapConfigBase {
    mapDesignType?: string;
}
interface GoogleMapConfig extends GoogleMapConfigBase {
    mapDesignType?: 'ROADMAP' | 'HYBRID' | 'SATELLITE';
}
interface GoogleMapConfigBase extends MapConfig {
    apiKey: string;
    version?: string;
    libraries?: string[];
    mapId?: string;
    mapDesignType?: string;
    markerTilingOptions?: MarkerTilingOptions;
    minZoom?: number;
    maxZoom?: number;
    /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
    restrictBounds?: GeoRectBounds;
}

/**
 * Google Maps provider implementation
 */
declare class GoogleMapProvider extends MapProvider {
    private resizeObserver;
    initialize(config: GoogleMapConfig): Promise<MapViewControllerInterface>;
    destroy(): void;
}

/**
 * Google Maps provider implementation
 */
declare class GoogleMapProvider2D extends MapProvider {
    initialize(config: GoogleMapConfig2D): Promise<MapViewControllerInterface>;
    destroy(): void;
}

type GoogleMapActualMarker2D = google.maps.Marker | google.maps.marker.AdvancedMarkerElement;
type GoogleMapActualMap2D = google.maps.Map;
type GoogleMapActualMarker = google.maps.maps3d.MarkerElement;
type GoogleMapActualMap = google.maps.maps3d.Map3DElement;
type GoogleMapActualCircle = google.maps.Polygon | google.maps.maps3d.Polygon3DInteractiveElement;
type GoogleMapActualPolyline = google.maps.Polyline | google.maps.maps3d.Polyline3DInteractiveElement;
type GoogleMapActualPolygon = google.maps.Polygon | google.maps.maps3d.Polygon3DInteractiveElement;

interface GoogleMapMarkerRendererInterface<MarkerType> {
    clickEventName: string | null;
    dragstartEventName: string | null;
    dragEventName: string | null;
    dragendEventName: string | null;
    animateStartListener: OnMarkerEventHandler | null;
    animateEndListener: OnMarkerEventHandler | null;
    /** Set by the controller to route Drop/Bounce animations to a screen-space overlay. */
    animationOverlayHost: MarkerAnimationOverlayHost | null;
    onAdd(data: AddParams[]): Promise<(MarkerType | null)[]>;
    onChange(data: ChangeParams<MarkerType>[]): Promise<(MarkerType | null)[]>;
    onRemove(_data: MarkerEntity<MarkerType>[]): Promise<void>;
    onAnimate(entity: MarkerEntity<MarkerType>): Promise<void>;
    onPostProcess(): Promise<void>;
    setMarkerPosition(_entity: MarkerEntity<MarkerType>, _position: GeoPoint): void;
    setMarkerVisible(entity: MarkerEntity<MarkerType>, visible: boolean): void;
    syncPositionToState(_marker: MarkerType, _state: MarkerState): void;
}

declare abstract class AbstractGoogleMapsController<ActualMarker, Renderer extends GoogleMapMarkerRendererInterface<ActualMarker> = GoogleMapMarkerRendererInterface<ActualMarker>> extends AbstractMarkerController<ActualMarker> {
    private readonly tilingOptions;
    readonly renderer: Renderer;
    private tileRenderer;
    private tileRouteId;
    private tileVersion;
    private tileGeneration;
    /** Called by GoogleMapViewController when RasterLayerState changes. */
    onRasterLayerUpdate: ((state: RasterLayerState | null) => Promise<void>) | null;
    constructor(renderer: Renderer, tilingOptions?: MarkerTilingOptions);
    findTiled(position: GeoPoint, zoom: number): MarkerEntity<ActualMarker> | null;
    clear(): Promise<void>;
    protected shouldTile(state: MarkerState, totalCount: number): boolean;
    protected onTiledMarkersChanged(): Promise<void>;
    protected onMarkerAdded(entity: MarkerEntity<ActualMarker>): void;
    protected abstract attachListeners(marker: ActualMarker, state: MarkerState): void;
    private syncTiledOverlay;
    private serviceWorkerTileTemplate;
    private localTileTemplate;
    private removeTileOverlay;
}

interface ZoomAltitudeViewportSize {
    width: number;
    height: number;
}
declare class ZoomAltitudeConverter extends AbstractZoomAltitudeConverter {
    private readonly viewportSizeProvider;
    static readonly REFERENCE_VIEWPORT_HEIGHT_PX = 540;
    constructor(zoom0Altitude?: number, viewportSizeProvider?: (() => ZoomAltitudeViewportSize | null) | null);
    private effectiveZoom0Altitude;
    private cosLatitudeFactor;
    private cosTiltFactor;
    zoomLevelToAltitude({ zoomLevel, latitude, tilt, }: {
        zoomLevel: number;
        latitude: number;
        tilt: number;
    }): number;
    altitudeToZoomLevel({ altitude, latitude, tilt, }: {
        altitude: number;
        latitude: number;
        tilt: number;
    }): number;
    /**
     * Camera-to-target distance for a Google-style zoom level.
     * Mirrors android-for-arcgis ZoomAltitudeConverter.zoomLevelToDistance.
     */
    zoomLevelToDistance({ zoomLevel, latitude, }: {
        zoomLevel: number;
        latitude: number;
    }): number;
    /** Inverse of zoomLevelToDistance. */
    distanceToZoomLevel({ distance, latitude, }: {
        distance: number;
        latitude: number;
    }): number;
    /**
     * Oblique (MapConductor) camera -> Map3DElement orbit camera.
     *
     * MapCameraPosition uses Google Maps 2D / MapLibre semantics: `position` is
     * the ground point at screen center and `tilt` is the camera's angle from
     * nadir while orbiting that point. Map3DElement's center/range/tilt model is
     * the same orbit, so the mapping is direct — the camera pose must never be
     * written via `cameraPosition` (that treats `position` as the camera's own
     * location, i.e. bird's-eye semantics, and shifts the visible center forward
     * of `position` whenever tilt > 0).
     *
     * Port of android-for-googlemaps MapCameraPosition.toCameraPosition() and
     * android-for-arcgis calculateCameraForOrbitParameters().
     */
    mapCameraPositionToCameraOptions(cameraPosition: MapCameraPosition | null): google.maps.maps3d.CameraOptions | null;
}

declare class GoogleMapViewHolder extends MapViewHolderBase<HTMLElement, google.maps.maps3d.Map3DElement> {
    readonly mapView: HTMLElement;
    readonly map: google.maps.maps3d.Map3DElement;
    readonly zoomConverter: ZoomAltitudeConverter;
    constructor(mapView: HTMLElement, map: google.maps.maps3d.Map3DElement, zoomConverter: ZoomAltitudeConverter);
    toScreenOffset(position: GeoPointInterface): Offset | null;
    fromScreenOffsetSync(offset: Offset): GeoPoint | null;
    /**
     * origin から dir 方向の ray と WGS84 楕円体の交点（camera に近い側）。
     * z 軸を a/b 倍して球に変形してから球との交点を解く。
     */
    private intersectEllipsoid;
    private ecefToGeoPoint;
    private add;
    private sub;
    private mul;
    private dot;
    private cross;
    private norm;
    private normalize;
    private rotateAroundAxis;
    private geoPontToEcef;
    private enuBasisAt;
}

declare class GoogleMapMarkerRenderer extends AbstractMarkerOverlayRenderer<GoogleMapViewHolder, GoogleMapActualMarker> implements GoogleMapMarkerRendererInterface<GoogleMapActualMarker> {
    constructor(holder: GoogleMapViewHolder);
    clickEventName: string | null;
    dragstartEventName: string | null;
    dragEventName: string | null;
    dragendEventName: string | null;
    onAdd(data: AddParams[]): Promise<(GoogleMapActualMarker | null)[]>;
    onChange(data: ChangeParams<GoogleMapActualMarker>[]): Promise<(GoogleMapActualMarker | null)[]>;
    onRemove(data: MarkerEntity<GoogleMapActualMarker>[]): Promise<void>;
    onPostProcess(): Promise<void>;
    setMarkerPosition(entity: MarkerEntity<GoogleMapActualMarker>, position: GeoPoint): void;
    setMarkerVisible(entity: MarkerEntity<GoogleMapActualMarker>, visible: boolean): void;
    syncPositionToState(marker: GoogleMapActualMarker, state: MarkerState): void;
}

declare class GoogleMapMarkerController extends AbstractGoogleMapsController<GoogleMapActualMarker, GoogleMapMarkerRenderer> {
    constructor(renderer: GoogleMapMarkerRenderer, tilingOptions?: MarkerTilingOptions);
    protected attachListeners(marker: GoogleMapActualMarker, state: MarkerState): void;
}

declare class GoogleMapCircleOverlayRenderer extends AbstractCircleOverlayRenderer<GoogleMapViewHolder, GoogleMapActualCircle> {
    constructor(holder: GoogleMapViewHolder);
    createCircle(state: CircleState): Promise<GoogleMapActualCircle | null>;
    updateCircleProperties({ circle, current, }: {
        circle: GoogleMapActualCircle;
        current: CircleEntity<GoogleMapActualCircle>;
        prev: CircleEntity<GoogleMapActualCircle>;
    }): Promise<GoogleMapActualCircle | null>;
    removeCircle(entity: CircleEntity<GoogleMapActualCircle>): Promise<void>;
}

declare class GoogleMapViewHolder2D extends MapViewHolderBase<HTMLElement, GoogleMapActualMap2D> {
    readonly mapView: HTMLElement;
    readonly map: GoogleMapActualMap2D;
    constructor(mapView: HTMLElement, map: GoogleMapActualMap2D);
    toScreenOffset(position: GeoPointInterface): Offset | null;
    fromScreenOffsetSync(offset: Offset): GeoPoint | null;
}

declare class GoogleMapCircleOverlayRenderer2D extends AbstractCircleOverlayRenderer<GoogleMapViewHolder2D, GoogleMapActualCircle> {
    constructor(holder: GoogleMapViewHolder2D);
    createCircle(state: CircleState): Promise<GoogleMapActualCircle | null>;
    updateCircleProperties({ circle, current, }: {
        circle: GoogleMapActualCircle;
        current: CircleEntity<GoogleMapActualCircle>;
        prev: CircleEntity<GoogleMapActualCircle>;
    }): Promise<GoogleMapActualCircle | null>;
    removeCircle(entity: CircleEntity<GoogleMapActualCircle>): Promise<void>;
    private buildRing;
}

type GoogleMapCircleRenderer = GoogleMapCircleOverlayRenderer | GoogleMapCircleOverlayRenderer2D;
declare class GoogleMapCircleController extends CircleController<GoogleMapActualCircle> {
    readonly renderer: GoogleMapCircleRenderer;
    private readonly clickCleanups;
    constructor(renderer: GoogleMapCircleRenderer);
    add(data: CircleState[]): Promise<void>;
    update(state: CircleState): Promise<void>;
    clear(): Promise<void>;
    private setClickHandler;
    private clearClickHandler;
}

declare class GoogleMapPolylineOverlayRenderer extends AbstractPolylineOverlayRenderer<GoogleMapViewHolder, GoogleMapActualPolyline> {
    constructor(holder: GoogleMapViewHolder);
    createPolyline(state: PolylineState): Promise<GoogleMapActualPolyline | null>;
    updatePolylineProperties({ polyline, current, }: {
        polyline: GoogleMapActualPolyline;
        current: PolylineEntity<GoogleMapActualPolyline>;
        prev: PolylineEntity<GoogleMapActualPolyline>;
    }): Promise<GoogleMapActualPolyline | null>;
    removePolyline(entity: PolylineEntity<GoogleMapActualPolyline>): Promise<void>;
}

declare class GoogleMapPolylineOverlayRenderer2D extends AbstractPolylineOverlayRenderer<GoogleMapViewHolder2D, GoogleMapActualPolyline> {
    constructor(holder: GoogleMapViewHolder2D);
    createPolyline(state: PolylineState): Promise<GoogleMapActualPolyline | null>;
    updatePolylineProperties({ polyline, current, }: {
        polyline: GoogleMapActualPolyline;
        current: PolylineEntity<GoogleMapActualPolyline>;
        prev: PolylineEntity<GoogleMapActualPolyline>;
    }): Promise<GoogleMapActualPolyline | null>;
    removePolyline(entity: PolylineEntity<GoogleMapActualPolyline>): Promise<void>;
}

type GoogleMapPolylineRenderer = GoogleMapPolylineOverlayRenderer | GoogleMapPolylineOverlayRenderer2D;
declare class GoogleMapPolylineController extends PolylineController<GoogleMapActualPolyline> {
    readonly renderer: GoogleMapPolylineRenderer;
    private readonly clickCleanups;
    constructor(renderer: GoogleMapPolylineRenderer);
    add(data: PolylineState[]): Promise<void>;
    update(state: PolylineState): Promise<void>;
    clear(): Promise<void>;
    private setClickHandler;
    private clearClickHandler;
}

declare class GoogleMapPolygonOverlayRenderer extends AbstractPolygonOverlayRenderer<GoogleMapViewHolder, GoogleMapActualPolygon> {
    private readonly interpolationCache;
    constructor(holder: GoogleMapViewHolder);
    createPolygon(state: PolygonState): Promise<GoogleMapActualPolygon | null>;
    updatePolygonProperties({ polygon, current, prev, }: {
        polygon: GoogleMapActualPolygon;
        current: PolygonEntity<GoogleMapActualPolygon>;
        prev: PolygonEntity<GoogleMapActualPolygon>;
    }): Promise<GoogleMapActualPolygon | null>;
    removePolygon(entity: PolygonEntity<GoogleMapActualPolygon>): Promise<void>;
    private buildPath;
    private buildInnerPaths;
    private maxSegmentLengthMeters;
}

declare class GoogleMapPolygonOverlayRenderer2D extends AbstractPolygonOverlayRenderer<GoogleMapViewHolder2D, GoogleMapActualPolygon> {
    constructor(holder: GoogleMapViewHolder2D);
    createPolygon(state: PolygonState): Promise<GoogleMapActualPolygon | null>;
    updatePolygonProperties({ polygon, current, }: {
        polygon: GoogleMapActualPolygon;
        current: PolygonEntity<GoogleMapActualPolygon>;
        prev: PolygonEntity<GoogleMapActualPolygon>;
    }): Promise<GoogleMapActualPolygon | null>;
    removePolygon(entity: PolygonEntity<GoogleMapActualPolygon>): Promise<void>;
    private buildPaths;
}

type GoogleMapPolygonRenderer = GoogleMapPolygonOverlayRenderer | GoogleMapPolygonOverlayRenderer2D;
declare class GoogleMapPolygonController extends PolygonController<GoogleMapActualPolygon> {
    readonly renderer: GoogleMapPolygonRenderer;
    private readonly clickCleanups;
    constructor(renderer: GoogleMapPolygonRenderer);
    add(data: PolygonState[]): Promise<void>;
    update(state: PolygonState): Promise<void>;
    clear(): Promise<void>;
    private setClickHandler;
    private clearClickHandler;
}

declare class GoogleMapGroundImageOverlayRenderer extends AbstractGroundImageOverlayRenderer<GoogleMapViewHolder, google.maps.GroundOverlay> {
    constructor(holder: GoogleMapViewHolder);
    createGroundImage(_state: GroundImageState): Promise<google.maps.GroundOverlay | null>;
    updateGroundImageProperties({ groundImage, current, prev, }: {
        groundImage: google.maps.GroundOverlay;
        current: GroundImageEntity<google.maps.GroundOverlay>;
        prev: GroundImageEntity<google.maps.GroundOverlay>;
    }): Promise<google.maps.GroundOverlay | null>;
    removeGroundImage(entity: GroundImageEntity<google.maps.GroundOverlay>): Promise<void>;
}

declare class GoogleMapGroundImageOverlayRenderer2D extends AbstractGroundImageOverlayRenderer<GoogleMapViewHolder2D, google.maps.GroundOverlay> {
    constructor(holder: GoogleMapViewHolder2D);
    createGroundImage(state: GroundImageState): Promise<google.maps.GroundOverlay | null>;
    updateGroundImageProperties({ groundImage, current, prev, }: {
        groundImage: google.maps.GroundOverlay;
        current: GroundImageEntity<google.maps.GroundOverlay>;
        prev: GroundImageEntity<google.maps.GroundOverlay>;
    }): Promise<google.maps.GroundOverlay | null>;
    removeGroundImage(entity: GroundImageEntity<google.maps.GroundOverlay>): Promise<void>;
}

type GoogleMapGroundImageRenderer = GoogleMapGroundImageOverlayRenderer | GoogleMapGroundImageOverlayRenderer2D;
declare class GoogleMapGroundImageController extends GroundImageController<google.maps.GroundOverlay> {
    readonly renderer: GoogleMapGroundImageRenderer;
    constructor(renderer: GoogleMapGroundImageRenderer);
    add(data: GroundImageState[]): Promise<void>;
    update(state: GroundImageState): Promise<void>;
    private setClickHandler;
}

declare class GoogleMapRasterLayerOverlayRenderer {
    readonly holder: GoogleMapViewHolder;
    constructor(holder: GoogleMapViewHolder);
    onAdd(data: RasterLayerAddParams[]): Promise<(google.maps.ImageMapType | null)[]>;
    onChange(data: RasterLayerChangeParams<google.maps.ImageMapType>[]): Promise<(google.maps.ImageMapType | null)[]>;
    onRemove(data: RasterLayerEntity<google.maps.ImageMapType>[]): Promise<void>;
    onCameraChanged(_mapCameraPosition: MapCameraPosition): Promise<void>;
    onPostProcess(): Promise<void>;
    create(state: RasterLayerState): google.maps.ImageMapType | null;
    remove(_mapType: google.maps.ImageMapType): void;
    private mapTypeFromState;
    private localTileImageMapType;
}

declare class GoogleMapRasterLayerOverlayRenderer2D {
    readonly holder: GoogleMapViewHolder2D;
    constructor(holder: GoogleMapViewHolder2D);
    onAdd(data: RasterLayerAddParams[]): Promise<(google.maps.ImageMapType | null)[]>;
    onChange(data: RasterLayerChangeParams<google.maps.ImageMapType>[]): Promise<(google.maps.ImageMapType | null)[]>;
    onRemove(data: RasterLayerEntity<google.maps.ImageMapType>[]): Promise<void>;
    onCameraChanged(_mapCameraPosition: MapCameraPosition): Promise<void>;
    onPostProcess(): Promise<void>;
    create(state: RasterLayerState): google.maps.ImageMapType | null;
    remove(mapType: google.maps.ImageMapType): void;
    private mapTypeFromState;
    private localTileImageMapType;
}

type GoogleMapRasterLayerRenderer = GoogleMapRasterLayerOverlayRenderer | GoogleMapRasterLayerOverlayRenderer2D;
declare class GoogleMapRasterLayerController extends RasterLayerController<google.maps.ImageMapType> {
    /**
     * ImageMapType は getTileUrl で URL を返すだけで、タイルの取得は Maps JS が img で行う。
     * リクエストに介入する口が無い。android / ios は自前でタイルを取りに行くので対応済み。
     *
     * userAgent はブラウザが上書きを許さないので、どのプロバイダでも web では効かない。
     */
    protected get headerSupport(): RasterHeaderSupport;
    readonly renderer: GoogleMapRasterLayerRenderer;
    constructor(renderer: GoogleMapRasterLayerRenderer);
    composition(data: RasterLayerState[]): Promise<void>;
    update(state: RasterLayerState): Promise<void>;
    updateInternal(state: RasterLayerState): Promise<void>;
    removeInternal(id: string): Promise<void>;
    private removeInvisibleEntities;
}

declare class GoogleMapViewController extends BaseMapViewController implements MapViewControllerInterface, MarkerCapable, CircleCapable, PolylineCapable, PolygonCapable, GroundImageCapable, RasterLayerCapable {
    readonly holder: GoogleMapViewHolder;
    private readonly markerController;
    private readonly circleController;
    private readonly polylineController;
    private readonly polygonController;
    private readonly groundImageController;
    private readonly rasterLayerController;
    private readonly eventCleanup;
    private initialized;
    constructor(holder: GoogleMapViewHolder, markerController: GoogleMapMarkerController, circleController: GoogleMapCircleController, polylineController: GoogleMapPolylineController, polygonController: GoogleMapPolygonController, groundImageController: GoogleMapGroundImageController, rasterLayerController: GoogleMapRasterLayerController);
    getMap(): GoogleMapActualMap;
    /**
     * `Map3DElement` exposes only `gestureHandling` (auto / cooperative / greedy)
     * — there is no switch for an individual gesture, so nothing can be applied
     * here. `GoogleMapView2D` does support the flags.
     */
    applyUISettings(settings: MapUISettings): void;
    private setupEventListeners;
    setMapInitializedListener(listener: OnMapInitializedHandler | null): void;
    moveCamera(position: MapCameraPosition): Promise<boolean>;
    animateCamera(position: MapCameraPosition, durationMillis: number): Promise<boolean>;
    fitBounds(_bounds: GeoRectBounds, _padding: number): Promise<boolean>;
    getCameraPosition(): MapCameraPosition | null;
    /**
     * Projects the four screen corners of the 3D scene view back to geo
     * coordinates via `fromScreenOffsetSync` (ray/ellipsoid intersection) and
     * extends a bounds from them. Returns null if any corner points off the
     * globe (e.g. camera tilted toward the horizon/sky). Mirrors ArcGIS's
     * `SceneView`-based `getMapCameraPosition()` in the Android SDK — the
     * closest existing analogue for a 3D/globe camera.
     */
    private getVisibleRegion;
    compositionMarkers(data: MarkerState[]): Promise<void>;
    updateMarker(state: MarkerState): Promise<void>;
    hasMarker(state: MarkerState): boolean;
    setOnMarkerClickListener(listener: OnMarkerEventHandler | null): void;
    setOnMarkerDragStart(listener: OnMarkerEventHandler | null): void;
    setOnMarkerDrag(listener: OnMarkerEventHandler | null): void;
    setOnMarkerDragEnd(listener: OnMarkerEventHandler | null): void;
    setOnMarkerAnimateStart(listener: OnMarkerEventHandler | null): void;
    setOnMarkerAnimateEnd(listener: OnMarkerEventHandler | null): void;
    setMarkerAnimationOverlayHost(host: MarkerAnimationOverlayHost | null): void;
    compositionCircles(data: CircleState[]): Promise<void>;
    updateCircle(state: CircleState): Promise<void>;
    hasCircle(state: CircleState): boolean;
    setOnCircleClickListener(listener: OnCircleEventHandler | null): void;
    compositionPolylines(data: PolylineState[]): Promise<void>;
    updatePolyline(state: PolylineState): Promise<void>;
    hasPolyline(state: PolylineState): boolean;
    setOnPolylineClickListener(listener: OnPolylineEventHandler | null): void;
    compositionPolygons(data: PolygonState[]): Promise<void>;
    updatePolygon(state: PolygonState): Promise<void>;
    hasPolygon(state: PolygonState): boolean;
    setOnPolygonClickListener(listener: OnPolygonEventHandler | null): void;
    compositionGroundImages(data: GroundImageState[]): Promise<void>;
    updateGroundImage(state: GroundImageState): Promise<void>;
    hasGroundImage(state: GroundImageState): boolean;
    setOnGroundImageClickListener(listener: OnGroundImageEventHandler | null): void;
    compositionRasterLayers(data: RasterLayerState[]): Promise<void>;
    updateRasterLayer(state: RasterLayerState): Promise<void>;
    hasRasterLayer(state: RasterLayerState): boolean;
    clearOverlays(): Promise<void>;
    /**
     * `Map3DElement` は `bounds` / `minAltitude` / `maxAltitude` を実行時に差し替えられる。
     * 統一ズーム（Google 準拠）を高度へ変換して適用する。GoogleMapProvider の生成時と同じく、
     * 高度変換は緯度依存なので単一の基準緯度で行う（現在のカメラ緯度を使う）。
     *
     * 高度はズームと逆向き（ズームが大きいほど低い）なので、minZoom→maxAltitude /
     * maxZoom→minAltitude と入れ替わることに注意。
     */
    setCameraRestriction(restriction: CameraRestriction | null): void;
    destroy(): void;
}

declare class GoogleMapMarkerController2D extends AbstractGoogleMapsController<GoogleMapActualMarker2D> {
    constructor(renderer: GoogleMapMarkerRendererInterface<GoogleMapActualMarker2D>, tilingOptions?: MarkerTilingOptions);
    protected attachListeners(marker: GoogleMapActualMarker2D, state: MarkerState): void;
}

declare class GoogleMapViewController2D extends BaseMapViewController implements MapViewControllerInterface, MarkerCapable, CircleCapable, PolylineCapable, PolygonCapable, GroundImageCapable, RasterLayerCapable {
    readonly holder: GoogleMapViewHolder2D;
    private readonly markerController;
    private readonly circleController;
    private readonly polylineController;
    private readonly polygonController;
    private readonly groundImageController;
    private readonly rasterLayerController;
    private readonly mapListeners;
    private initialized;
    constructor(holder: GoogleMapViewHolder2D, markerController: GoogleMapMarkerController2D, circleController: GoogleMapCircleController, polylineController: GoogleMapPolylineController, polygonController: GoogleMapPolygonController, groundImageController: GoogleMapGroundImageController, rasterLayerController: GoogleMapRasterLayerController);
    getMap(): GoogleMapActualMap2D;
    /** The map's own `gestureHandling`, restored when gestures are re-enabled. */
    private baseGestureHandling;
    /**
     * `draggable` and `scrollwheel` cover mouse pan and wheel zoom, but touch
     * pinch-zoom is only reachable through `gestureHandling: 'none'`, which stops
     * panning too. So the map is dropped to `'none'` only when both are off, and a
     * touch pinch survives a zoom-only block — warned about below.
     *
     * `headingInteractionEnabled` / `tiltInteractionEnabled` are vector-map
     * options; a raster map has no rotate or tilt gesture to begin with.
     */
    applyUISettings(settings: MapUISettings): void;
    private setupEventListeners;
    setMapInitializedListener(listener: OnMapInitializedHandler | null): void;
    moveCamera(position: MapCameraPosition): Promise<boolean>;
    animateCamera(position: MapCameraPosition, _durationMillis: number): Promise<boolean>;
    fitBounds(bounds: GeoRectBounds, padding: number): Promise<boolean>;
    getCameraPosition(): MapCameraPosition | null;
    /**
     * Projects the four screen corners of the map viewport back to geo
     * coordinates via `fromScreenOffsetSync` and extends a bounds from them,
     * instead of `map.getBounds()`'s axis-aligned box — this stays correct
     * when the map is rotated (heading != 0). Mirrors Android's
     * `GoogleMapViewController.getMapCameraPosition()`.
     */
    private getVisibleRegion;
    compositionMarkers(data: MarkerState[]): Promise<void>;
    updateMarker(state: MarkerState): Promise<void>;
    hasMarker(state: MarkerState): boolean;
    setOnMarkerClickListener(listener: OnMarkerEventHandler | null): void;
    setOnMarkerDragStart(listener: OnMarkerEventHandler | null): void;
    setOnMarkerDrag(listener: OnMarkerEventHandler | null): void;
    setOnMarkerDragEnd(listener: OnMarkerEventHandler | null): void;
    setOnMarkerAnimateStart(listener: OnMarkerEventHandler | null): void;
    setOnMarkerAnimateEnd(listener: OnMarkerEventHandler | null): void;
    setMarkerAnimationOverlayHost(host: MarkerAnimationOverlayHost | null): void;
    compositionCircles(data: CircleState[]): Promise<void>;
    updateCircle(state: CircleState): Promise<void>;
    hasCircle(state: CircleState): boolean;
    setOnCircleClickListener(listener: OnCircleEventHandler | null): void;
    compositionPolylines(data: PolylineState[]): Promise<void>;
    updatePolyline(state: PolylineState): Promise<void>;
    hasPolyline(state: PolylineState): boolean;
    setOnPolylineClickListener(listener: OnPolylineEventHandler | null): void;
    compositionPolygons(data: PolygonState[]): Promise<void>;
    updatePolygon(state: PolygonState): Promise<void>;
    hasPolygon(state: PolygonState): boolean;
    setOnPolygonClickListener(listener: OnPolygonEventHandler | null): void;
    compositionGroundImages(data: GroundImageState[]): Promise<void>;
    updateGroundImage(state: GroundImageState): Promise<void>;
    hasGroundImage(state: GroundImageState): boolean;
    setOnGroundImageClickListener(listener: OnGroundImageEventHandler | null): void;
    compositionRasterLayers(data: RasterLayerState[]): Promise<void>;
    updateRasterLayer(state: RasterLayerState): Promise<void>;
    hasRasterLayer(state: RasterLayerState): boolean;
    clearOverlays(): Promise<void>;
    /**
     * Google Maps JS API は `setOptions({restriction, minZoom, maxZoom})` で
     * ランタイム変更できるので直接適用する。ズームは統一ズームと同一体系。
     */
    setCameraRestriction(restriction: CameraRestriction | null): void;
    destroy(): void;
}

type GoogleMapDesignType = MapDesignTypeInterface<string>;
declare namespace GoogleMapDesign {
    const Normal: GoogleMapDesignType;
    const Satellite: GoogleMapDesignType;
    const Hybrid: GoogleMapDesignType;
    const Terrain: GoogleMapDesignType;
    const None: GoogleMapDesignType;
    function Create(id: string, attributionRules?: readonly AttributionRule[]): GoogleMapDesignType;
}

interface GoogleMapViewStateInterface extends MapViewStateInterface<GoogleMapDesignType> {
    readonly apiKey: string;
}
interface GoogleMapViewStateParams {
    id?: string;
    apiKey?: string;
    mapId?: string;
    mapDesignType?: GoogleMapDesignType;
    cameraPosition?: MapCameraPosition;
}
declare class GoogleMapViewState extends MapViewState<GoogleMapDesignType> implements GoogleMapViewStateInterface {
    readonly apiKey: string;
    readonly mapId: string | null;
    private _mapDesignType;
    private _padding;
    constructor({ id, apiKey, mapId, mapDesignType, cameraPosition, }?: GoogleMapViewStateParams);
    get mapDesignType(): GoogleMapDesignType;
    get padding(): MapPaddings;
    set mapDesignType(value: GoogleMapDesignType);
    setPadding(paddings: MapPaddings): void;
}
declare function useGoogleMapViewState({ id, apiKey, mapId, mapDesignType, cameraPosition, }?: GoogleMapViewStateParams): GoogleMapViewState;

interface GoogleMapViewProps extends MapViewBaseProps<GoogleMapViewStateInterface> {
    mapId?: string;
    markerTilingOptions?: MarkerTilingOptions;
    style?: React__default.CSSProperties;
    version?: string;
    onError?: (error: Error) => void;
    children?: React__default.ReactNode;
    libraries?: string;
    minZoom?: number;
    maxZoom?: number;
    /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
    restrictBounds?: GeoRectBounds;
}

/**
 * Google Maps React component
 */
declare function GoogleMapView({ state, mapId, className, style, version, markerTilingOptions, libraries, minZoom, maxZoom, restrictBounds, cameraRestriction, onError, onMapLoaded, onMapClick, onMapLongClick, onCameraMoveStart, onCameraMove, onCameraMoveEnd, children, }: GoogleMapViewProps): React.JSX.Element;

/**
 * Google Maps React component
 */
declare function GoogleMapView2D({ state, onMapLoaded, onMapClick, onMapLongClick, onCameraMoveStart, onCameraMove, onCameraMoveEnd, mapId, className, style, version, libraries, markerTilingOptions, minZoom, maxZoom, restrictBounds, cameraRestriction, onError, children, }: GoogleMapViewProps): React.JSX.Element;

export { type GoogleMapActualCircle, type GoogleMapActualMap, type GoogleMapActualMap2D, type GoogleMapActualMarker, type GoogleMapActualMarker2D, type GoogleMapActualPolygon, type GoogleMapActualPolyline, type GoogleMapConfig, GoogleMapDesign, type GoogleMapDesignType, GoogleMapProvider, GoogleMapProvider2D, GoogleMapView, GoogleMapView2D, GoogleMapViewController, GoogleMapViewController2D, type GoogleMapViewProps, GoogleMapViewState, type GoogleMapViewStateInterface, ZoomAltitudeConverter, type ZoomAltitudeViewportSize, useGoogleMapViewState };
