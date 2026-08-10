/// <reference types="google.maps" />
import {
  BaseMapViewController,
  createGeoRectBounds,
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
  type VisibleRegion,
  MapUISettingsDiagnostics,
  type MapUISettings,
  type CameraRestriction,
  isEmptyCameraRestriction,
  type GeoPoint,
} from '@mapconductor/js-sdk-core';
import { latLngToGeoPoint, geoPointToLatLng } from './helpers';
import { GoogleMapCircleController } from './circle/GoogleMapCircleController';
import { GoogleMapPolylineController } from './polyline/GoogleMapPolylineController';
import { GoogleMapPolygonController } from './polygon/GoogleMapPolygonController';
import { GoogleMapGroundImageController } from './groundimage/GoogleMapGroundImageController';
import { GoogleMapRasterLayerController } from './raster/GoogleMapRasterLayerController';
import { GoogleMapViewHolder2D } from './GoogleMapViewHolder2D';
import { GoogleMapActualMap2D } from './GoogleMapTypeAlias';
import { GoogleMapMarkerController2D } from './marker/GoogleMapMarkerController2D';
import { toGoogleMapsCameraPosition } from './GoogleMapCameraPosition';

export class GoogleMapViewController2D
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
  private readonly mapListeners: google.maps.MapsEventListener[] = [];
  private initialized = false;

  constructor(
    readonly holder: GoogleMapViewHolder2D,
    private readonly markerController: GoogleMapMarkerController2D,
    private readonly circleController: GoogleMapCircleController,
    private readonly polylineController: GoogleMapPolylineController,
    private readonly polygonController: GoogleMapPolygonController,
    private readonly groundImageController: GoogleMapGroundImageController,
    private readonly rasterLayerController: GoogleMapRasterLayerController,
  ) {
    super();
    this.markerController.onRasterLayerUpdate = async (state) => {
      if (state) {
        await this.rasterLayerController.updateInternal(state);
      } else {
        await this.rasterLayerController.removeInternal('mc-marker-tiles');
      }
    };
    this.setupEventListeners();
  }

  getMap(): GoogleMapActualMap2D {
    return this.holder.map;
  }

  /** The map's own `gestureHandling`, restored when gestures are re-enabled. */
  private baseGestureHandling: string | null = null;

  /**
   * `draggable` and `scrollwheel` cover mouse pan and wheel zoom, but touch
   * pinch-zoom is only reachable through `gestureHandling: 'none'`, which stops
   * panning too. So the map is dropped to `'none'` only when both are off, and a
   * touch pinch survives a zoom-only block — warned about below.
   *
   * `headingInteractionEnabled` / `tiltInteractionEnabled` are vector-map
   * options; a raster map has no rotate or tilt gesture to begin with.
   */
  applyUISettings(settings: MapUISettings): void {
    const map = this.holder.map;
    if (this.baseGestureHandling === null) {
      this.baseGestureHandling = (map.get('gestureHandling') as string | undefined) ?? 'auto';
    }
    const interactive = settings.scrollGesture || settings.zoomGesture;

    map.setOptions({
      gestureHandling: interactive ? this.baseGestureHandling : 'none',
      draggable: settings.scrollGesture,
      scrollwheel: settings.zoomGesture,
      disableDoubleClickZoom: !settings.zoomGesture,
      headingInteractionEnabled: settings.rotateGesture,
      tiltInteractionEnabled: settings.tiltGesture,
    });

    if (!settings.zoomGesture && settings.scrollGesture) {
      MapUISettingsDiagnostics.warnIfRequested(
        false, 'zoom', 'GoogleMaps',
        'a touch pinch can only be blocked together with panning, so pinch zoom stays available while panning is enabled',
      );
    }
  }

  private setupEventListeners(): void {
    let isMoving = false;

    this.mapListeners.push(
      this.holder.map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const point = latLngToGeoPoint(e.latLng);
        // Google Maps のオーバーレイ（Polygon / Polyline / Circle / GroundOverlay）は
        // ネイティブの clickable で自分のクリックを受け、当たったときは map click が
        // そもそも飛んでこない。よってここへ来るのは「どのオーバーレイにも当たらなかった」
        // タップだけ。marker → ... → map の一本道はコアの dispatchTap が持つ。
        this.dispatchTap(point);
      }),
      this.holder.map.addListener('rightclick', (e: google.maps.MapMouseEvent) => {
        if (e.latLng) {
          this.notifyMapLongClick(latLngToGeoPoint(e.latLng));
        }
      }),
      this.holder.map.addListener('bounds_changed', () => {
        const camera = this.getCameraPosition();
        if (!camera) return;
        if (!isMoving) {
          isMoving = true;
          this.notifyCameraMoveStart(camera);
        }
        this.notifyCameraMove(camera);
      }),
      this.holder.map.addListener('idle', () => {
        isMoving = false;
        const camera = this.getCameraPosition();
        if (camera) this.notifyCameraMoveEnd(camera);
      }),
      google.maps.event.addListenerOnce(this.holder.map, 'tilesloaded', () => {
        this.initialized = true;
        this.notifyMapInitialized();
      }),
    );
  }

  override setMapInitializedListener(listener: OnMapInitializedHandler | null): void {
    super.setMapInitializedListener(listener);
    if (listener && this.initialized) this.notifyMapInitialized();
  }

  moveCamera(position: MapCameraPosition): Promise<boolean> {
    const camera = toGoogleMapsCameraPosition(position);
    return new Promise((resolve) => {
      const idleListener = this.holder.map.addListener('idle', () => {
        google.maps.event.removeListener(idleListener);
        resolve(true);
      });
      this.holder.map.setCenter(geoPointToLatLng(camera.center));
      this.holder.map.setZoom(camera.zoom);
      this.holder.map.setHeading(camera.bearing);
      this.holder.map.setTilt(camera.tilt);
    });
  }

  animateCamera(position: MapCameraPosition, _durationMillis: number): Promise<boolean> {
    const camera = toGoogleMapsCameraPosition(position);
    return new Promise((resolve) => {
      const idleListener = this.holder.map.addListener('idle', () => {
        google.maps.event.removeListener(idleListener);
        resolve(true);
      });
      this.holder.map.panTo(geoPointToLatLng(camera.center));
      this.holder.map.setZoom(camera.zoom);
      this.holder.map.setHeading(camera.bearing);
      this.holder.map.setTilt(camera.tilt);
    });
  }

  fitBounds(bounds: GeoRectBounds, padding: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!bounds.southWest || !bounds.northEast) {
        resolve(false);
        return;
      }
      const idleListener = this.holder.map.addListener('idle', () => {
        google.maps.event.removeListener(idleListener);
        resolve(true);
      });
      const googleBounds = new google.maps.LatLngBounds(
        geoPointToLatLng(bounds.southWest),
        geoPointToLatLng(bounds.northEast),
      );
      this.holder.map.fitBounds(googleBounds, padding);
    });
  }

  getCameraPosition(): MapCameraPosition | null {
    const center = this.holder.map.getCenter();
    const zoom = this.holder.map.getZoom();
    if (!center || zoom === undefined) return null;
    return createMapCameraPosition({
      position: latLngToGeoPoint(center),
      zoom,
      bearing: this.holder.map.getHeading() ?? 0,
      tilt: this.holder.map.getTilt() ?? 0,
      // Matches Android: the visible region rides on cameraPosition so that
      // mapViewState.cameraPosition.visibleRegion works without the controller.
      visibleRegion: this.getVisibleRegion(),
    });
  }

  /**
   * Projects the four screen corners of the map viewport back to geo
   * coordinates via `fromScreenOffsetSync` and extends a bounds from them,
   * instead of `map.getBounds()`'s axis-aligned box — this stays correct
   * when the map is rotated (heading != 0). Mirrors Android's
   * `GoogleMapViewController.getMapCameraPosition()`.
   */
  private getVisibleRegion(): VisibleRegion | null {
    const width = this.holder.mapView.offsetWidth;
    const height = this.holder.mapView.offsetHeight;
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
    this.markerController.clear();
    this.circleController.clear();
    this.polylineController.clear();
    this.polygonController.clear();
    this.groundImageController.clear();
    this.rasterLayerController.clear();
  }

  /**
   * Google Maps JS API は `setOptions({restriction, minZoom, maxZoom})` で
   * ランタイム変更できるので直接適用する。ズームは統一ズームと同一体系。
   */
  override setCameraRestriction(restriction: CameraRestriction | null): void {
    // super は呼ばない。基底クラスに保持させるとカメラ停止時のクランプ補正まで走ってしまう。
    // ネイティブ API 側で既に制限されているので二重適用になる（android-sdk と同じ振り分け）。
    const effective = isEmptyCameraRestriction(restriction) ? null : restriction;

    const sw = effective?.bounds?.southWest ?? null;
    const ne = effective?.bounds?.northEast ?? null;
    this.getMap().setOptions({
      restriction:
        sw != null && ne != null
          ? {
              latLngBounds: {
                south: sw.latitude,
                west: sw.longitude,
                north: ne.latitude,
                east: ne.longitude,
              },
              strictBounds: false,
            }
          : null,
      minZoom: effective?.minZoom ?? null,
      maxZoom: effective?.maxZoom ?? null,
    });
  }

  destroy(): void {
    super.destroy();
    void this.clearOverlays();
    for (const listener of this.mapListeners) {
      google.maps.event.removeListener(listener);
    }
    this.mapListeners.length = 0;
  }

  /**
   * マーカーのヒットテストと配送。カスケードの先頭。
   *
   * 通常のマーカーは自前のリスナーでクリックを受けるので、ここで見るのは
   * タイル方式のマーカー（ラスターオーバーレイに描かれ、リスナーを持たない）だけ。
   */
  protected override dispatchMarkerTap(point: GeoPoint): boolean {
    const zoom = this.holder.map.getZoom() ?? 10;
    const tiled = this.markerController.findTiled(point, zoom);
    if (!tiled?.state.clickable) return false;
    this.markerController.dispatchClick(tiled.state);
    return true;
  }
}
