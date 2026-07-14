import type React from 'react';
import { findNodeHandle, UIManager } from 'react-native';
import {
  BaseMapViewController,
  type CameraOptions,
  type GeoPoint,
  type GeoRectBounds,
  type MarkerAnimationOverlayHost,
  type MarkerCapable,
  type MarkerState,
  type MapCameraPosition,
  type MapViewControllerInterface,
  type OnMarkerEventHandler,
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
    MarkerCapable,
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
  private readonly rasterLayerStates = new Map<string, RasterLayerState>();
  private pendingRasterLayers: Array<ReturnType<typeof rasterLayerStateToNative>> | null = null;
  private markerClickListener: OnMarkerEventHandler | null = null;
  private markerDragStartListener: OnMarkerEventHandler | null = null;
  private markerDragListener: OnMarkerEventHandler | null = null;
  private markerDragEndListener: OnMarkerEventHandler | null = null;
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
    this.rasterLayerStates.clear();
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
