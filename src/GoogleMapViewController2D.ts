/// <reference types="google.maps" />
import {
  BaseMapViewController,
  createGeoRectBounds,
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
import { latLngToGeoPoint, geoPointToLatLng } from './helpers';
import { GoogleMapCircleController } from './circle/GoogleMapCircleController';
import { GoogleMapPolylineController } from './polyline/GoogleMapPolylineController';
import { GoogleMapPolygonController } from './polygon/GoogleMapPolygonController';
import { GoogleMapGroundImageController } from './groundimage/GoogleMapGroundImageController';
import { GoogleMapRasterLayerController } from './raster/GoogleMapRasterLayerController';
import { GoogleMapViewHolder2D } from './GoogleMapViewHolder2D';
import { GoogleMapActualMap2D } from './GoogleMapsTypeAlias';
import { GoogleMapMarkerController2D } from './marker/GoogleMapMarkerController2D';

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
        this.rasterLayerController.updateInternal(state);
      } else {
        this.rasterLayerController.removeInternal('mc-marker-tiles');
      }
    };
    this.setupEventListeners();
  }

  getMap(): GoogleMapActualMap2D {
    return this.holder.map;
  }

  private setupEventListeners(): void {
    let isMoving = false;

    this.mapListeners.push(
      this.holder.map.addListener('click', (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const point = latLngToGeoPoint(e.latLng);
        // Check tiled markers first (regular markers handle their own clicks via listeners)
        const zoom = this.holder.map.getZoom() ?? 10;
        const tiledEntity = this.markerController.findTiled(point, zoom);
        if (tiledEntity?.state.clickable) {
          this.markerController.dispatchClick(tiledEntity.state);
          return;
        }
        this.notifyMapClick(point);
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
    return new Promise((resolve) => {
      const idleListener = this.holder.map.addListener('idle', () => {
        google.maps.event.removeListener(idleListener);
        resolve(true);
      });
      this.holder.map.setCenter(geoPointToLatLng(position.center));
      this.holder.map.setZoom(position.zoom);
      if (position.bearing !== undefined) this.holder.map.setHeading(position.bearing);
      if (position.pitch !== undefined) this.holder.map.setTilt(position.pitch);
    });
  }

  animateCamera(position: MapCameraPosition, _options?: CameraOptions): Promise<boolean> {
    return new Promise((resolve) => {
      const idleListener = this.holder.map.addListener('idle', () => {
        google.maps.event.removeListener(idleListener);
        resolve(true);
      });
      this.holder.map.panTo(geoPointToLatLng(position.center));
      this.holder.map.setZoom(position.zoom);
      if (position.bearing !== undefined) this.holder.map.setHeading(position.bearing);
      if (position.pitch !== undefined) this.holder.map.setTilt(position.pitch);
    });
  }

  fitBounds(bounds: GeoRectBounds, options?: CameraOptions): Promise<boolean> {
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
      this.holder.map.fitBounds(googleBounds, options?.padding ?? options?.paddings);
    });
  }

  getCameraPosition(): MapCameraPosition | null {
    const center = this.holder.map.getCenter();
    const zoom = this.holder.map.getZoom();
    if (!center || zoom === undefined) return null;
    const bounds = this.getBounds();
    return createMapCameraPosition({
      position: latLngToGeoPoint(center),
      zoom,
      bearing: this.holder.map.getHeading() ?? 0,
      tilt: this.holder.map.getTilt() ?? 0,
      // Matches Android: the visible region rides on cameraPosition so that
      // mapViewState.cameraPosition.visibleRegion works without the controller.
      visibleRegion: bounds
        ? { bounds, nearLeft: null, nearRight: null, farLeft: null, farRight: null }
        : null,
    });
  }

  getBounds(): GeoRectBounds | null {
    const bounds = this.holder.map.getBounds();
    if (!bounds) return null;
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return createGeoRectBounds({
      southWest: latLngToGeoPoint(sw),
      northEast: latLngToGeoPoint(ne),
    });
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
    for (const listener of this.mapListeners) {
      google.maps.event.removeListener(listener);
    }
    this.mapListeners.length = 0;
  }
}
