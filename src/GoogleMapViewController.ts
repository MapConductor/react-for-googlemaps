/// <reference types="google.maps" />
import {
  BaseMapViewController,
  createGeoPoint,
  createMapCameraPosition,
  type CameraOptions,
  type CircleCapable,
  type CircleState,
  type GeoRectBounds,
  type GroundImageCapable,
  type GroundImageState,
  type MapCameraPosition,
  type OnMapInitializedHandler,
  type MapViewControllerInterface,
  type MarkerCapable,
  type MarkerState,
  type OnCircleEventHandler,
  type OnGroundImageEventHandler,
  type OnMarkerEventHandler,
  type OnPolygonEventHandler,
  type OnPolylineEventHandler,
  type PolygonCapable,
  type PolygonState,
  type PolylineCapable,
  type PolylineState,
  type RasterLayerCapable,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapMarkerController } from './marker/GoogleMapMarkerController';
import { GoogleMapCircleController } from './circle/GoogleMapCircleController';
import { GoogleMapPolylineController } from './polyline/GoogleMapPolylineController';
import { GoogleMapPolygonController } from './polygon/GoogleMapPolygonController';
import { GoogleMapGroundImageController } from './groundimage/GoogleMapGroundImageController';
import { GoogleMapRasterLayerController } from './raster/GoogleMapRasterLayerController';
import { GoogleMapViewHolder } from './GoogleMapViewHolder';
import { GoogleMapActualMap } from './GoogleMapsTypeAlias';
import { latLngAltToGeoPoint } from './helpers';

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
    this.setupEventListeners();
  }

  getMap(): GoogleMapActualMap {
    return this.holder.map;
  }

  private setupEventListeners(): void {
    let isMoving = false;

    const handleCenterChange = () => {
      const camera = this.getCameraPosition();
      if (!camera) return;
      if (!isMoving) {
        isMoving = true;
        this.notifyCameraMoveStart(camera);
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
        this.notifyMapClick(point);
      }
    };

    const handleLoad = () => {
      this.initialized = true;
      this.notifyMapInitialized();
    };

    this.holder.map.addEventListener('gmp-centerchange', handleCenterChange);
    this.holder.map.addEventListener('gmp-steadychange', handleSteadyChange);
    this.holder.map.addEventListener('gmp-click', handleClick);
    this.holder.map.addEventListener('gmp-load', handleLoad, { once: true });

    this.eventCleanup.push(
      () => this.holder.map.removeEventListener('gmp-centerchange', handleCenterChange),
      () => this.holder.map.removeEventListener('gmp-steadychange', handleSteadyChange),
      () => this.holder.map.removeEventListener('gmp-click', handleClick),
    );
  }

  override setMapInitializedListener(listener: OnMapInitializedHandler | null): void {
    super.setMapInitializedListener(listener);
    if (listener && this.initialized) this.notifyMapInitialized();
  }

  moveCamera(position: MapCameraPosition): Promise<boolean> {
    const cameraOptions = this.holder.zoomConverter.mapCameraPositionToCameraOptions(position);
    if (!cameraOptions) return Promise.resolve(false);
    this.holder.map.center = cameraOptions.center;
    this.holder.map.range = cameraOptions.range;
    this.holder.map.tilt = cameraOptions.tilt;
    this.holder.map.heading = cameraOptions.heading;
    return Promise.resolve(true);
  }

  async animateCamera(position: MapCameraPosition, options?: CameraOptions): Promise<boolean> {
    const cameraOptions = this.holder.zoomConverter.mapCameraPositionToCameraOptions(position);
    if (!cameraOptions) return Promise.resolve(false);

    this.holder.map.flyCameraTo({
      endCamera: cameraOptions,
      durationMillis: options?.duration ?? 1000,
    });
    return new Promise((resolve) => {
      this.holder.map.addEventListener('gmp-animationend', () => resolve(true), {
        once: true,
      });
    })
  }

  fitBounds(_bounds: GeoRectBounds, _options?: CameraOptions): Promise<boolean> {
    return Promise.resolve(false);
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
    return createMapCameraPosition({
      position: latLngAltToGeoPoint(center),
      zoom,
      bearing: this.holder.map.heading ?? 0,
      tilt: this.holder.map.tilt ?? 0,
    });
  }

  getBounds(): GeoRectBounds | null {
    return null;
  }

  // --- Marker ---

  async compositionMarkers(data: MarkerState[]): Promise<void> {
    this.markerController.composition(data);
  }

  async updateMarker(state: MarkerState): Promise<void> {
    this.markerController.update(state);
  }

  hasMarker(state: MarkerState): boolean {
    return this.markerController.has(state);
  }

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

  setOnMarkerAnimateStart(_listener: OnMarkerEventHandler | null): void {}

  setOnMarkerAnimateEnd(_listener: OnMarkerEventHandler | null): void {}

  // --- Circle ---

  async compositionCircles(data: CircleState[]): Promise<void> {
    this.circleController.composition(data);
  }

  async updateCircle(state: CircleState): Promise<void> {
    this.circleController.update(state);
  }

  hasCircle(state: CircleState): boolean {
    return this.circleController.has(state);
  }

  setOnCircleClickListener(listener: OnCircleEventHandler | null): void {
    this.circleController.setOnClickListener(listener);
  }

  // --- Polyline ---

  async compositionPolylines(data: PolylineState[]): Promise<void> {
    this.polylineController.composition(data);
  }

  async updatePolyline(state: PolylineState): Promise<void> {
    this.polylineController.update(state);
  }

  hasPolyline(state: PolylineState): boolean {
    return this.polylineController.has(state);
  }

  setOnPolylineClickListener(listener: OnPolylineEventHandler | null): void {
    this.polylineController.setOnClickListener(listener);
  }

  // --- Polygon ---

  async compositionPolygons(data: PolygonState[]): Promise<void> {
    this.polygonController.composition(data);
  }

  async updatePolygon(state: PolygonState): Promise<void> {
    this.polygonController.update(state);
  }

  hasPolygon(state: PolygonState): boolean {
    return this.polygonController.has(state);
  }

  setOnPolygonClickListener(listener: OnPolygonEventHandler | null): void {
    this.polygonController.setOnClickListener(listener);
  }

  // --- GroundImage ---

  async compositionGroundImages(data: GroundImageState[]): Promise<void> {
    this.groundImageController.composition(data);
  }

  async updateGroundImage(state: GroundImageState): Promise<void> {
    this.groundImageController.update(state);
  }

  hasGroundImage(state: GroundImageState): boolean {
    return this.groundImageController.has(state);
  }

  setOnGroundImageClickListener(listener: OnGroundImageEventHandler | null): void {
    this.groundImageController.setOnClickListener(listener);
  }

  // --- RasterLayer ---

  async compositionRasterLayers(data: RasterLayerState[]): Promise<void> {
    this.rasterLayerController.composition(data);
  }

  async updateRasterLayer(state: RasterLayerState): Promise<void> {
    this.rasterLayerController.update(state);
  }

  hasRasterLayer(state: RasterLayerState): boolean {
    return this.rasterLayerController.has(state);
  }

  // --- Lifecycle ---

  async clearOverlays(): Promise<void> {
    this.markerController.clear();
    this.circleController.clear();
    this.polylineController.clear();
    this.polygonController.clear();
    this.groundImageController.clear();
    this.rasterLayerController.clear();
  }

  destroy(): void {
    void this.clearOverlays();
    for (const fn of this.eventCleanup) fn();
    this.eventCleanup.length = 0;
  }
}
