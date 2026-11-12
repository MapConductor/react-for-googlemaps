/// <reference types="google.maps" />
import {
  BaseMapViewController,
  AbstractZoomAltitudeConverter,
  type GeoPointInterface,
  MapPaddings,
  paddedCameraCenter,
  paddedCameraTarget,
  createGeoPoint,
  createMapCameraPosition,
  type CircleCapable,
  type GeoRectBounds,
  type GroundImageCapable,
  type MapCameraPosition,
  type OnMapInitializedHandler,
  type MapViewControllerInterface,
  type MarkerAnimationOverlayHost,
  type MarkerCapable,
  type OnMarkerEventHandler,
  type PolygonCapable,
  type PolylineCapable,
  type RasterLayerCapable,
  createGeoRectBounds,
  type VisibleRegion,
  MapUISettingsDiagnostics,
  type MapUISettings,
  type CameraRestriction,
  isEmptyCameraRestriction, bearingFromNativeHeading, computeFitBoundsCameraPosition, } from '@mapconductor/js-sdk-core';
import { GoogleMapMarkerController } from './marker/GoogleMapMarkerController';
import { GoogleMapCircleController } from './circle/GoogleMapCircleController';
import { GoogleMapPolylineController } from './polyline/GoogleMapPolylineController';
import { GoogleMapPolygonController } from './polygon/GoogleMapPolygonController';
import { GoogleMapGroundImageController } from './groundimage/GoogleMapGroundImageController';
import { GoogleMapRasterLayerController } from './raster/GoogleMapRasterLayerController';
import { GoogleMapViewHolder } from './GoogleMapViewHolder';
import { GoogleMapActualMap } from './GoogleMapTypeAlias';
import { latLngAltToGeoPoint } from './helpers';
import type { GoogleMapDesignType } from './GoogleMapDesign';

/** Map3DElement の `fov` の既定値（Google のリファレンスに記載の 35°）。 */
const GOOGLE_MAPS_3D_DEFAULT_VERTICAL_FOV_DEGREES = 35;

export class GoogleMapViewController
  extends BaseMapViewController
  implements
    MapViewControllerInterface,
    MarkerCapable,
    CircleCapable,
    PolylineCapable,
    PolygonCapable,
    GroundImageCapable,
    RasterLayerCapable
{
  private readonly eventCleanup: (() => void)[] = [];
  private initialized = false;
  /**
   * 最後に動かしたときの `MapCameraPosition.paddings`。Map3DElement にカメラの
   * パディングは無いので、中心をずらして再現し、読み戻しで元に戻す。
   */
  private cameraPaddings: MapPaddings | null = null;

  constructor(
    readonly holder: GoogleMapViewHolder,
    private readonly markerController: GoogleMapMarkerController,
    private readonly circleController: GoogleMapCircleController,
    private readonly polylineController: GoogleMapPolylineController,
    private readonly polygonController: GoogleMapPolygonController,
    private readonly groundImageController: GoogleMapGroundImageController,
    private readonly rasterLayerController: GoogleMapRasterLayerController,
  ) {
    super();

    // Capable ファサードの既定実装がここから kind で引く。

    // **登録を忘れると composition が黙って捨てられる。**

    this.registerOverlayController(this.markerController);

    this.registerOverlayController(this.circleController);

    this.registerOverlayController(this.polylineController);

    this.registerOverlayController(this.polygonController);

    this.registerOverlayController(this.groundImageController);

    this.registerOverlayController(this.rasterLayerController);
    this.setupEventListeners();
  }

  getMap(): GoogleMapActualMap {
    return this.holder.map;
  }

  /**
   * Swaps `Map3DElement.mode` in place. The same three modes the element
   * accepts at creation, and the same error for anything else -- there is
   * no blank mode on the 3D map. Called by the view state's `mapDesignType`
   * setter.
   */
  setMapDesignType(design: GoogleMapDesignType): void {
    const mode = design.getValue().toUpperCase();
    if (mode !== 'ROADMAP' && mode !== 'HYBRID' && mode !== 'SATELLITE') {
      throw new Error(`Map3D supports only following mapDesignTypes: ROADMAP, HYBRID, and SATELLITE.`);
    }
    this.holder.map.mode = mode as google.maps.maps3d.MapModeString;
  }

  /**
   * `Map3DElement` exposes only `gestureHandling` (auto / cooperative / greedy)
   * — there is no switch for an individual gesture, so nothing can be applied
   * here. `GoogleMapView2D` does support the flags.
   */
  applyUISettings(settings: MapUISettings): void {
    const reason = 'Map3DElement has no per-gesture switch; use GoogleMapView2D to gate gestures';
    MapUISettingsDiagnostics.warnIfRequested(settings.scrollGesture, 'scroll', 'GoogleMaps3D', reason);
    MapUISettingsDiagnostics.warnIfRequested(settings.zoomGesture, 'zoom', 'GoogleMaps3D', reason);
    MapUISettingsDiagnostics.warnIfRequested(settings.rotateGesture, 'rotate', 'GoogleMaps3D', reason);
    MapUISettingsDiagnostics.warnIfRequested(settings.tiltGesture, 'tilt', 'GoogleMaps3D', reason);
  }

  private setupEventListeners(): void {
    let isMoving = false;

    const handleCenterChange = () => {
      const camera = this.getCameraPosition();
      if (!camera) return;
      if (!isMoving) {
        isMoving = true;
        this.notifyCameraMoveStart(camera);
        return;
      }
      this.notifyCameraMove(camera);
    };

    const handleSteadyChange = (event: Event) => {
      const e = event as google.maps.maps3d.SteadyChangeEvent;
      if (e.isSteady) {
        isMoving = false;
        const camera = this.getCameraPosition();
        if (camera) this.notifyCameraMoveEnd(camera);
      }
    };

    const handleClick = (event: Event) => {
      const e = event as google.maps.maps3d.LocationClickEvent;
      if (e.position) {
        const point = createGeoPoint({ latitude: e.position.lat, longitude: e.position.lng });
        // marker → circle → groundImage → polyline → polygon → map の一本道。
        // 3D の Map3DElement はオーバーレイのネイティブクリックを持たないので、
        // 判定はすべてコアの幾何ヒットテストで行う。
        this.dispatchTap(point);
      }
    };

    const handleLoad = () => {
      this.initialized = true;
      this.notifyMapInitialized();
    };

    this.holder.map.addEventListener('gmp-camerapositionchange', handleCenterChange);
    this.holder.map.addEventListener('gmp-steadychange', handleSteadyChange);
    this.holder.map.addEventListener('gmp-click', handleClick);
    this.holder.map.addEventListener('gmp-load', handleLoad, { once: true });

    this.eventCleanup.push(
      () => this.holder.map.removeEventListener('gmp-camerapositionchange', handleCenterChange),
      () => this.holder.map.removeEventListener('gmp-steadychange', handleSteadyChange),
      () => this.holder.map.removeEventListener('gmp-click', handleClick),
    );
  }

  override setMapInitializedListener(listener: OnMapInitializedHandler | null): void {
    super.setMapInitializedListener(listener);
    if (listener && this.initialized) this.notifyMapInitialized();
  }

  moveCamera(position: MapCameraPosition): Promise<boolean> {
    const cameraOptions = this.withPaddedCenter(this.holder.zoomConverter.mapCameraPositionToCameraOptions(position), position);
    if (!cameraOptions) return Promise.resolve(false);
    this.holder.map.center = cameraOptions.center;
    this.holder.map.range = cameraOptions.range;
    this.holder.map.tilt = cameraOptions.tilt;
    this.holder.map.heading = cameraOptions.heading;
    return Promise.resolve(true);
  }

  async animateCamera(position: MapCameraPosition, durationMillis: number): Promise<boolean> {
    const cameraOptions = this.withPaddedCenter(this.holder.zoomConverter.mapCameraPositionToCameraOptions(position), position);
    if (!cameraOptions) return Promise.resolve(false);

    this.holder.map.flyCameraTo({
      endCamera: cameraOptions,
      durationMillis: durationMillis ?? 1000,
    });
    return new Promise((resolve) => {
      this.holder.map.addEventListener('gmp-animationend', () => resolve(true), {
        once: true,
      });
    })
  }

  // Map3DElement has no fitBounds of its own. The core computes center + zoom
  // from the bounds and the padded viewport; the current heading and tilt are
  // kept. The range is set from the fractional fit zoom directly — going
  // through moveCamera would snap it to an integer and lose `padding`.
  fitBounds(bounds: GeoRectBounds, padding: number): Promise<boolean> {
    if (!bounds.southWest || !bounds.northEast) return Promise.resolve(false);
    const rect = this.holder.map.getBoundingClientRect();
    const heading = this.holder.map.heading ?? 0;
    const fit = computeFitBoundsCameraPosition({
      bounds,
      viewportWidthPx: rect.width,
      viewportHeightPx: rect.height,
      padding,
      bearing: bearingFromNativeHeading(heading),
    });
    if (!fit) return Promise.resolve(false);
    this.holder.map.center = { lat: fit.center.latitude, lng: fit.center.longitude, altitude: 0 };
    this.holder.map.range = this.holder.zoomConverter.zoomLevelToDistance({
      zoomLevel: fit.zoom,
      latitude: fit.center.latitude,
    });
    return Promise.resolve(true);
  }

  getCameraPosition(): MapCameraPosition | null {
    // Oblique semantics (uniform across providers): position is the ground
    // point at screen center (map.center), tilt is the orbit angle from nadir,
    // and zoom derives from the camera-to-center distance (map.range) — not
    // from the camera's own location/altitude (bird's-eye semantics).
    const center = this.holder.map.center;
    if (!center) return null;

    const range = this.holder.map.range;
    if (range == null) return null;

    const zoom = this.holder.zoomConverter.distanceToZoomLevel({
      distance: range,
      latitude: center.lat,
    });
    const bearing = bearingFromNativeHeading(this.holder.map.heading ?? 0);
    const tilt = this.holder.map.tilt ?? 0;
    const live = latLngAltToGeoPoint(center);
    return createMapCameraPosition({
      position: this.cameraPaddings
        ? paddedCameraTarget(live, this.paddingParams(this.cameraPaddings, range, live.latitude, tilt, bearing))
        : live,
      zoom,
      bearing,
      tilt,
      paddings: this.cameraPaddings ?? MapPaddings.Zeros,
      fov: this.verticalFov(),
      // Matches Android: the visible region rides on cameraPosition so that
      // mapViewState.cameraPosition.visibleRegion works without the controller.
      visibleRegion: this.getVisibleRegion(),
    });
  }

  /** Map3DElement の上下視野角（度）。未設定なら Google の既定 35°。 */
  private verticalFov(): number {
    return this.holder.map.fov ?? GOOGLE_MAPS_3D_DEFAULT_VERTICAL_FOV_DEGREES;
  }

  /**
   * パディングのずらし量の計算に渡す値。3D はカメラまでの距離（range）と視野角で
   * 画面中央の縮尺が決まるので、そこから縮尺の等しい zoom を逆算して渡す。
   */
  private paddingParams(paddings: MapPaddings, range: number, latitude: number, tilt: number, bearing: number) {
    const rect = this.holder.map.getBoundingClientRect();
    const fov = this.verticalFov();
    const focal = rect.height / 2 / Math.tan((fov * Math.PI) / 360);
    const metersPerPixel = range / focal;
    const cosLat = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01);
    const zoom = Math.log2((AbstractZoomAltitudeConverter.WEB_MERCATOR_INITIAL_MPP_256 * cosLat) / metersPerPixel);
    return { zoom, tilt, bearing, paddings, fov, viewport: { width: rect.width, height: rect.height } };
  }

  /** パディングを除いた領域の中央に target が来るよう、送るカメラの中心をずらす。 */
  private withPaddedCenter(
    cameraOptions: google.maps.maps3d.CameraOptions | null,
    requested: MapCameraPosition,
  ): google.maps.maps3d.CameraOptions | null {
    const paddings = requested.paddings ?? this.cameraPaddings;
    this.cameraPaddings = paddings;
    if (!cameraOptions || !paddings || cameraOptions.range == null) return cameraOptions;
    const literal = cameraOptions.center as google.maps.LatLngAltitudeLiteral | null | undefined;
    if (!literal) return cameraOptions;
    const target: GeoPointInterface = { latitude: literal.lat, longitude: literal.lng };
    const center = paddedCameraCenter(
      target,
      this.paddingParams(paddings, cameraOptions.range, target.latitude, cameraOptions.tilt ?? 0, requested.bearing),
    );
    return { ...cameraOptions, center: { ...literal, lat: center.latitude, lng: center.longitude } };
  }

  /**
   * Projects the four screen corners of the 3D scene view back to geo
   * coordinates via `fromScreenOffsetSync` (ray/ellipsoid intersection) and
   * extends a bounds from them. Returns null if any corner points off the
   * globe (e.g. camera tilted toward the horizon/sky). Mirrors ArcGIS's
   * `SceneView`-based `getMapCameraPosition()` in the Android SDK — the
   * closest existing analogue for a 3D/globe camera.
   */
  private getVisibleRegion(): VisibleRegion | null {
    const rect = this.holder.map.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return null;

    const nearLeft = this.holder.fromScreenOffsetSync({ x: 0, y: height });
    const nearRight = this.holder.fromScreenOffsetSync({ x: width, y: height });
    const farLeft = this.holder.fromScreenOffsetSync({ x: 0, y: 0 });
    const farRight = this.holder.fromScreenOffsetSync({ x: width, y: 0 });
    if (!nearLeft || !nearRight || !farLeft || !farRight) return null;

    const bounds = createGeoRectBounds();
    bounds.extend(nearLeft);
    bounds.extend(nearRight);
    bounds.extend(farLeft);
    bounds.extend(farRight);

    return { bounds, nearLeft, nearRight, farLeft, farRight };
  }

  // --- Marker ---

  setOnMarkerClickListener(listener: OnMarkerEventHandler | null): void {
    this.markerController.setOnClickListener(listener);
  }

  setOnMarkerDragStart(listener: OnMarkerEventHandler | null): void {
    this.markerController.setOnDragStart(listener);
  }

  setOnMarkerDrag(listener: OnMarkerEventHandler | null): void {
    this.markerController.setOnDrag(listener);
  }

  setOnMarkerDragEnd(listener: OnMarkerEventHandler | null): void {
    this.markerController.setOnDragEnd(listener);
  }

  setOnMarkerAnimateStart(listener: OnMarkerEventHandler | null): void {
    this.markerController.setOnAnimateStart(listener);
  }

  setOnMarkerAnimateEnd(listener: OnMarkerEventHandler | null): void {
    this.markerController.setOnAnimateEnd(listener);
  }

  setMarkerAnimationOverlayHost(host: MarkerAnimationOverlayHost | null): void {
    this.markerController.setMarkerAnimationOverlayHost(host);
  }

  // --- Circle ---

  // --- Polyline ---

  // --- Polygon ---

  // --- GroundImage ---

  // --- RasterLayer ---

  // --- Lifecycle ---

  async clearOverlays(): Promise<void> {
    await this.clearOverlayControllers([
      this.markerController,
      this.circleController,
      this.polylineController,
      this.polygonController,
      this.groundImageController,
      this.rasterLayerController,
    ]);
  }

  /**
   * `Map3DElement` は `bounds` / `minAltitude` / `maxAltitude` を実行時に差し替えられる。
   * 統一ズーム（Google 準拠）を高度へ変換して適用する。GoogleMapProvider の生成時と同じく、
   * 高度変換は緯度依存なので単一の基準緯度で行う（現在のカメラ緯度を使う）。
   *
   * 高度はズームと逆向き（ズームが大きいほど低い）なので、minZoom→maxAltitude /
   * maxZoom→minAltitude と入れ替わることに注意。
   */
  override setCameraRestriction(restriction: CameraRestriction | null): void {
    // super は呼ばない。基底クラスに保持させるとカメラ停止時のクランプ補正まで走ってしまう。
    // ネイティブ API 側で既に制限されているので二重適用になる（android-sdk と同じ振り分け）。
    const effective = isEmptyCameraRestriction(restriction) ? null : restriction;

    const map = this.getMap() as unknown as {
      bounds?: unknown;
      minAltitude?: number | null;
      maxAltitude?: number | null;
    };

    const sw = effective?.bounds?.southWest ?? null;
    const ne = effective?.bounds?.northEast ?? null;
    map.bounds =
      sw != null && ne != null
        ? { south: sw.latitude, west: sw.longitude, north: ne.latitude, east: ne.longitude }
        : null;

    const referenceLatitude = this.getCameraPosition()?.position.latitude ?? 0;
    const toAltitude = (zoomLevel: number): number =>
      this.holder.zoomConverter.zoomLevelToAltitude({ zoomLevel, latitude: referenceLatitude, tilt: 0 });
    map.minAltitude = effective?.maxZoom == null ? null : toAltitude(effective.maxZoom);
    map.maxAltitude = effective?.minZoom == null ? null : toAltitude(effective.minZoom);
  }

  destroy(): void {
    super.destroy();
    void this.clearOverlays();
    for (const fn of this.eventCleanup) fn();
    this.eventCleanup.length = 0;
  }
}
