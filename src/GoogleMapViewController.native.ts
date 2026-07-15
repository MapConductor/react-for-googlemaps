import type React from 'react';
import { findNodeHandle, processColor, UIManager } from 'react-native';
import {
  BaseMapViewController,
  type CameraOptions,
  type CircleCapable,
  type CircleState,
  type GeoPoint,
  type GeoRectBounds,
  type MarkerAnimationOverlayHost,
  type MarkerCapable,
  type MarkerState,
  type MapCameraPosition,
  type MapViewControllerInterface,
  type OnMarkerEventHandler,
  type OnCircleEventHandler,
  type OnPolygonEventHandler,
  type OnPolylineEventHandler,
  type PolygonCapable,
  type PolygonState,
  type PolylineCapable,
  type PolylineState,
  type RasterLayerCapable,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import {
  createNativeMarkerIconRegistry,
  encodeMarkerBatch,
  markerIconToNative,
  NATIVE_MARKER_BATCH_SIZE,
} from '@mapconductor/js-sdk-react/native';
import type {
  NativeMapExtensionCapable,
  NativeMapExtensionDescriptor,
  NativeMapExtensionEvent,
  NativeMapExtensionEventHandler,
} from '@mapconductor/js-sdk-react/native';
import { GoogleMapMapViewHolder } from './GoogleMapMapViewHolder.native';
import type { GoogleMapViewRef } from './GoogleMapTypeAlias.native';

export class GoogleMapViewController
  extends BaseMapViewController
  implements
    MapViewControllerInterface,
    CircleCapable,
    MarkerCapable,
    PolygonCapable,
    PolylineCapable,
    RasterLayerCapable,
    NativeMapExtensionCapable
{
  readonly holder: GoogleMapMapViewHolder;
  private cameraPosition: MapCameraPosition;
  private mapLoaded = false;
  private markerCompositionGeneration = 0;
  private activeMarkerComposition: number | null = null;
  private pendingMarkerComposition: MarkerState[] | null = null;
  private markerBatchAck: MarkerBatchAck | null = null;
  private readonly pendingMarkerUpdates = new Set<string>();
  private readonly markerStates = new Map<string, MarkerState>();
  private readonly circleStates = new Map<string, CircleState>();
  private readonly polygonStates = new Map<string, PolygonState>();
  private readonly polylineStates = new Map<string, PolylineState>();
  private readonly rasterLayerStates = new Map<string, RasterLayerState>();
  private pendingPolygons: Array<ReturnType<typeof polygonStateToNative>> | null = null;
  private pendingCircles: Array<ReturnType<typeof circleStateToNative>> | null = null;
  private pendingPolylines: Array<ReturnType<typeof polylineStateToNative>> | null = null;
  private pendingRasterLayers: Array<ReturnType<typeof rasterLayerStateToNative>> | null = null;
  private markerClickListener: OnMarkerEventHandler | null = null;
  private circleClickListener: OnCircleEventHandler | null = null;
  private markerDragStartListener: OnMarkerEventHandler | null = null;
  private markerDragListener: OnMarkerEventHandler | null = null;
  private markerDragEndListener: OnMarkerEventHandler | null = null;
  private polygonClickListener: OnPolygonEventHandler | null = null;
  private polylineClickListener: OnPolylineEventHandler | null = null;
  private readonly nativeMapExtensionEventHandlers = new Map<
    string,
    NativeMapExtensionEventHandler
  >();

  constructor(
    private readonly nativeRef: React.RefObject<GoogleMapViewRef | null>,
    cameraPosition: MapCameraPosition
  ) {
    super();
    this.cameraPosition = cameraPosition;
    this.holder = new GoogleMapMapViewHolder(nativeRef);
  }

  async clearOverlays(): Promise<void> {
    this.cancelMarkerComposition();
    this.pendingMarkerUpdates.clear();
    this.markerStates.clear();
    this.circleStates.clear();
    this.polygonStates.clear();
    this.polylineStates.clear();
    this.rasterLayerStates.clear();
    this.pendingPolygons = this.mapLoaded ? null : [];
    this.pendingCircles = this.mapLoaded ? null : [];
    this.pendingPolylines = this.mapLoaded ? null : [];
    this.pendingRasterLayers = this.mapLoaded ? null : [];
    this.dispatchCommand('clearOverlays', []);
  }

  async moveCamera(position: MapCameraPosition): Promise<boolean> {
    this.cameraPosition = position;
    this.dispatchCommand('moveCamera', [position]);
    return true;
  }

  async animateCamera(position: MapCameraPosition, options: CameraOptions = {}): Promise<boolean> {
    this.cameraPosition = position;
    this.dispatchCommand('animateCamera', [position, options.duration ?? 0]);
    return true;
  }

  async fitBounds(_bounds: GeoRectBounds, _options: CameraOptions = {}): Promise<boolean> {
    return false;
  }

  getCameraPosition(): MapCameraPosition | null {
    return this.cameraPosition;
  }

  getBounds(): GeoRectBounds | null {
    return null;
  }

  async compositionMarkers(data: MarkerState[]): Promise<void> {
    const generation = ++this.markerCompositionGeneration;
    this.cancelMarkerBatchAck();
    this.activeMarkerComposition = null;
    this.pendingMarkerComposition = data;
    this.pendingMarkerUpdates.clear();
    this.markerStates.clear();
    data.forEach((state) => this.markerStates.set(state.id, state));
    if (this.mapLoaded) {
      await this.startPendingMarkerComposition(generation);
    }
  }

  async updateMarker(state: MarkerState): Promise<void> {
    this.markerStates.set(state.id, state);
    if (this.pendingMarkerComposition !== null || this.activeMarkerComposition !== null) {
      this.pendingMarkerUpdates.add(state.id);
      return;
    }
    this.dispatchCommand('updateMarker', [markerStateToNative(state)]);
  }

  async compositionPolylines(data: PolylineState[]): Promise<void> {
    this.polylineStates.clear();
    data.forEach((state) => this.polylineStates.set(state.id, state));
    const payload = data.map(polylineStateToNative);
    if (!this.mapLoaded) {
      this.pendingPolylines = payload;
      return;
    }
    this.dispatchCommand('compositionPolylines', [payload]);
  }

  async compositionCircles(data: CircleState[]): Promise<void> {
    this.circleStates.clear();
    data.forEach((state) => this.circleStates.set(state.id, state));
    const payload = data.map(circleStateToNative);
    if (!this.mapLoaded) {
      this.pendingCircles = payload;
      return;
    }
    this.dispatchCommand('compositionCircles', [payload]);
  }

  async updateCircle(state: CircleState): Promise<void> {
    this.circleStates.set(state.id, state);
    if (!this.mapLoaded) {
      this.pendingCircles = Array.from(this.circleStates.values()).map(circleStateToNative);
      return;
    }
    this.dispatchCommand('updateCircle', [circleStateToNative(state)]);
  }

  hasCircle(state: CircleState): boolean {
    return this.circleStates.has(state.id);
  }

  setOnCircleClickListener(listener: OnCircleEventHandler | null): void {
    this.circleClickListener = listener;
  }

  async compositionPolygons(data: PolygonState[]): Promise<void> {
    this.polygonStates.clear();
    data.forEach((state) => this.polygonStates.set(state.id, state));
    const payload = data.map(polygonStateToNative);
    if (!this.mapLoaded) {
      this.pendingPolygons = payload;
      return;
    }
    this.dispatchCommand('compositionPolygons', [payload]);
  }

  async updatePolygon(state: PolygonState): Promise<void> {
    this.polygonStates.set(state.id, state);
    if (!this.mapLoaded) {
      this.pendingPolygons = Array.from(this.polygonStates.values()).map(polygonStateToNative);
      return;
    }
    this.dispatchCommand('updatePolygon', [polygonStateToNative(state)]);
  }

  hasPolygon(state: PolygonState): boolean {
    return this.polygonStates.has(state.id);
  }

  setOnPolygonClickListener(listener: OnPolygonEventHandler | null): void {
    this.polygonClickListener = listener;
  }

  async updatePolyline(state: PolylineState): Promise<void> {
    this.polylineStates.set(state.id, state);
    if (!this.mapLoaded) {
      this.pendingPolylines = Array.from(this.polylineStates.values()).map(polylineStateToNative);
      return;
    }
    this.dispatchCommand('updatePolyline', [polylineStateToNative(state)]);
  }

  hasPolyline(state: PolylineState): boolean {
    return this.polylineStates.has(state.id);
  }

  setOnPolylineClickListener(listener: OnPolylineEventHandler | null): void {
    this.polylineClickListener = listener;
  }

  async compositionRasterLayers(data: RasterLayerState[]): Promise<void> {
    this.rasterLayerStates.clear();
    data.forEach((state) => this.rasterLayerStates.set(state.id, state));
    const payload = data.map(rasterLayerStateToNative);
    if (!this.mapLoaded) {
      this.pendingRasterLayers = payload;
      return;
    }
    this.dispatchCommand('compositionRasterLayers', [payload]);
  }

  async updateRasterLayer(state: RasterLayerState): Promise<void> {
    this.rasterLayerStates.set(state.id, state);
    if (!this.mapLoaded) {
      this.pendingRasterLayers = Array.from(this.rasterLayerStates.values()).map(
        rasterLayerStateToNative
      );
      return;
    }
    this.dispatchCommand('updateRasterLayer', [rasterLayerStateToNative(state)]);
  }

  hasRasterLayer(state: RasterLayerState): boolean {
    return this.rasterLayerStates.has(state.id);
  }

  upsertNativeMapExtension(
    extension: NativeMapExtensionDescriptor,
    eventHandler?: NativeMapExtensionEventHandler | null
  ): void {
    if (eventHandler) {
      this.nativeMapExtensionEventHandlers.set(extension.id, eventHandler);
    } else {
      this.nativeMapExtensionEventHandlers.delete(extension.id);
    }
    this.dispatchCommand('upsertNativeMapExtension', [
      extension.id,
      extension.type,
      extension.payload,
    ]);
  }

  removeNativeMapExtension(extensionId: string): void {
    this.nativeMapExtensionEventHandlers.delete(extensionId);
    this.dispatchCommand('removeNativeMapExtension', [extensionId]);
  }

  onNativeMapExtensionEvent(event: NativeMapExtensionEvent): void {
    this.nativeMapExtensionEventHandlers.get(event.extensionId)?.(event);
  }

  hasMarker(state: MarkerState): boolean {
    return this.markerStates.has(state.id);
  }

  setOnMarkerClickListener(listener: OnMarkerEventHandler | null): void {
    this.markerClickListener = listener;
  }

  setOnMarkerDragStart(listener: OnMarkerEventHandler | null): void {
    this.markerDragStartListener = listener;
  }

  setOnMarkerDrag(listener: OnMarkerEventHandler | null): void {
    this.markerDragListener = listener;
  }

  setOnMarkerDragEnd(listener: OnMarkerEventHandler | null): void {
    this.markerDragEndListener = listener;
  }

  setOnMarkerAnimateStart(listener: OnMarkerEventHandler | null): void {
    void listener;
  }

  setOnMarkerAnimateEnd(listener: OnMarkerEventHandler | null): void {
    void listener;
  }

  setMarkerAnimationOverlayHost(_host: MarkerAnimationOverlayHost | null): void {}

  override setMapInitializedListener(listener: (() => void) | null): void {
    super.setMapInitializedListener(listener);
    if (listener && this.mapLoaded) listener();
  }

  destroy(): void {
    this.cancelMarkerComposition();
    this.pendingMarkerUpdates.clear();
    this.circleStates.clear();
    this.pendingCircles = null;
    this.circleClickListener = null;
    this.polygonStates.clear();
    this.pendingPolygons = null;
    this.polygonClickListener = null;
    this.polylineStates.clear();
    this.pendingPolylines = null;
    this.polylineClickListener = null;
    this.nativeMapExtensionEventHandlers.clear();
    this.setCameraMoveStartListener(null);
    this.setCameraMoveListener(null);
    this.setCameraMoveEndListener(null);
    this.setMapClickListener(null);
    this.setMapLongClickListener(null);
    this.setMapInitializedListener(null);
  }

  onNativeCameraMoveStart(camera: MapCameraPosition): void {
    this.cameraPosition = camera;
    this.notifyCameraMoveStart(camera);
  }

  onNativeCameraMove(camera: MapCameraPosition): void {
    this.cameraPosition = camera;
    this.notifyCameraMove(camera);
  }

  onNativeCameraMoveEnd(camera: MapCameraPosition): void {
    this.cameraPosition = camera;
    this.notifyCameraMoveEnd(camera);
  }

  onNativeMapLoaded(): void {
    this.mapLoaded = true;
    if (this.pendingCircles) {
      this.dispatchCommand('compositionCircles', [this.pendingCircles]);
      this.pendingCircles = null;
    }
    if (this.pendingPolygons) {
      this.dispatchCommand('compositionPolygons', [this.pendingPolygons]);
      this.pendingPolygons = null;
    }
    if (this.pendingPolylines) {
      this.dispatchCommand('compositionPolylines', [this.pendingPolylines]);
      this.pendingPolylines = null;
    }
    if (this.pendingRasterLayers) {
      this.dispatchCommand('compositionRasterLayers', [this.pendingRasterLayers]);
      this.pendingRasterLayers = null;
    }
    this.notifyMapInitialized();
    void this.startPendingMarkerComposition(this.markerCompositionGeneration);
  }

  onNativeMarkerCompositionBatchProcessed(generation: number, sequence: number): void {
    const ack = this.markerBatchAck;
    if (!ack || ack.generation !== generation || ack.sequence !== sequence) return;
    clearTimeout(ack.timeout);
    this.markerBatchAck = null;
    ack.resolve(true);
  }

  onNativeMapClick(point: GeoPoint): void {
    this.notifyMapClick(point);
  }

  onNativeMapLongClick(point: GeoPoint): void {
    this.notifyMapLongClick(point);
  }

  onNativeMarkerClick(markerId: string): void {
    const state = this.markerStates.get(markerId);
    if (!state) return;
    state.onClick?.(state);
    this.markerClickListener?.(state);
  }

  onNativeCircleClick(circleId: string, clicked: GeoPoint): void {
    const state = this.circleStates.get(circleId);
    if (!state) return;
    const event = { state, clicked };
    state.onClick?.(event);
    this.circleClickListener?.(event);
  }

  onNativePolylineClick(polylineId: string, clicked: GeoPoint): void {
    const state = this.polylineStates.get(polylineId);
    if (!state) return;
    const event = { state, clicked };
    state.onClick?.(event);
    this.polylineClickListener?.(event);
  }

  onNativePolygonClick(polygonId: string, clicked: GeoPoint): void {
    const state = this.polygonStates.get(polygonId);
    if (!state) return;
    const event = { state, clicked };
    state.onClick?.(event);
    this.polygonClickListener?.(event);
  }

  onNativeMarkerDragStart(markerId: string, point: GeoPoint): void {
    const state = this.markerStates.get(markerId);
    if (!state) return;
    state.position = point;
    state.onDragStart?.(state);
    this.markerDragStartListener?.(state);
  }

  onNativeMarkerDrag(markerId: string, point: GeoPoint): void {
    const state = this.markerStates.get(markerId);
    if (!state) return;
    state.position = point;
    state.onDrag?.(state);
    this.markerDragListener?.(state);
  }

  onNativeMarkerDragEnd(markerId: string, point: GeoPoint): void {
    const state = this.markerStates.get(markerId);
    if (!state) return;
    state.position = point;
    state.onDragEnd?.(state);
    this.markerDragEndListener?.(state);
  }

  private dispatchCommand(commandName: string, args: unknown[]): void {
    const node = findNodeHandle(this.nativeRef.current);
    if (!node) return;
    UIManager.dispatchViewManagerCommand(node, commandName, args);
  }

  private flushPendingMarkerUpdates(): void {
    this.pendingMarkerUpdates.forEach((id) => {
      const state = this.markerStates.get(id);
      if (state) this.dispatchCommand('updateMarker', [markerStateToNative(state)]);
    });
    this.pendingMarkerUpdates.clear();
  }

  private async startPendingMarkerComposition(generation: number): Promise<void> {
    if (!this.mapLoaded || generation !== this.markerCompositionGeneration) return;
    const data = this.pendingMarkerComposition;
    if (!data) return;
    this.pendingMarkerComposition = null;
    this.activeMarkerComposition = generation;
    const iconRegistry = createNativeMarkerIconRegistry(data);
    this.dispatchCommand('beginMarkerComposition', [generation, iconRegistry.icons]);

    let sequence = 0;
    for (let offset = 0; offset < data.length; offset += NATIVE_MARKER_BATCH_SIZE) {
      if (generation !== this.markerCompositionGeneration) return;
      const batch = data.slice(offset, offset + NATIVE_MARKER_BATCH_SIZE);
      const payload = encodeMarkerBatch(batch, iconRegistry);
      const ack = this.waitForMarkerBatchAck(generation, sequence);
      this.dispatchCommand('appendMarkerComposition', [generation, sequence, payload]);
      if (!(await ack)) return;
      sequence++;
    }

    if (generation !== this.markerCompositionGeneration) return;
    this.dispatchCommand('commitMarkerComposition', [generation]);
    this.activeMarkerComposition = null;
    this.flushPendingMarkerUpdates();
  }

  private waitForMarkerBatchAck(generation: number, sequence: number): Promise<boolean> {
    this.cancelMarkerBatchAck();
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (this.markerBatchAck?.generation !== generation) return;
        this.markerBatchAck = null;
        resolve(false);
      }, MARKER_BATCH_ACK_TIMEOUT_MS);
      this.markerBatchAck = { generation, sequence, timeout, resolve };
    });
  }

  private cancelMarkerBatchAck(): void {
    const ack = this.markerBatchAck;
    if (!ack) return;
    clearTimeout(ack.timeout);
    this.markerBatchAck = null;
    ack.resolve(false);
  }

  private cancelMarkerComposition(): void {
    this.markerCompositionGeneration++;
    this.activeMarkerComposition = null;
    this.pendingMarkerComposition = null;
    this.cancelMarkerBatchAck();
  }
}

const MARKER_BATCH_ACK_TIMEOUT_MS = 30_000;

interface MarkerBatchAck {
  generation: number;
  sequence: number;
  timeout: ReturnType<typeof setTimeout>;
  resolve: (processed: boolean) => void;
}

function markerStateToNative(state: MarkerState) {
  return {
    id: state.id,
    position: state.position,
    clickable: state.clickable,
    draggable: state.draggable,
    zIndex: state.zIndex,
    icon: markerIconToNative(state.icon),
    animation: state.animation,
  };
}

function rasterLayerStateToNative(state: RasterLayerState) {
  return {
    id: state.id,
    source: state.source,
    opacity: state.opacity,
    visible: state.visible,
    zIndex: state.zIndex,
    userAgent: state.userAgent,
    debug: state.debug,
    extraHeaders: state.extraHeaders,
  };
}

function polylineStateToNative(state: PolylineState) {
  return {
    id: state.id,
    points: state.points,
    strokeColor: processColor(state.strokeColor) ?? processColor('#000000'),
    strokeWidth: state.strokeWidth,
    geodesic: state.geodesic,
    zIndex: state.zIndex,
  };
}

function polygonStateToNative(state: PolygonState) {
  return {
    id: state.id,
    points: state.points,
    holes: state.holes,
    strokeColor: processColor(state.strokeColor) ?? processColor('#000000'),
    strokeWidth: state.strokeWidth,
    fillColor: processColor(state.fillColor) ?? processColor('transparent'),
    geodesic: state.geodesic,
    zIndex: state.zIndex,
  };
}

function circleStateToNative(state: CircleState) {
  return {
    id: state.id,
    center: state.center,
    radiusMeters: state.radiusMeters,
    clickable: state.clickable,
    geodesic: state.geodesic,
    strokeColor: processColor(state.strokeColor) ?? processColor('#FF0000'),
    strokeWidth: state.strokeWidth,
    fillColor: processColor(state.fillColor) ?? processColor('rgba(255,255,255,0.5)'),
    zIndex: state.zIndex,
  };
}
