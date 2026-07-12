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
} from '@mapconductor/js-sdk-core';
import { markerIconToNative } from '@mapconductor/js-sdk-react/native';
import { GoogleMapMapViewHolder } from './GoogleMapMapViewHolder.native';
import type { GoogleMapViewRef } from './GoogleMapTypeAlias.native';

export class GoogleMapViewController
  extends BaseMapViewController
  implements MapViewControllerInterface, MarkerCapable
{
  readonly holder: GoogleMapMapViewHolder;
  private cameraPosition: MapCameraPosition;
  private readonly markerStates = new Map<string, MarkerState>();
  private markerClickListener: OnMarkerEventHandler | null = null;
  private markerDragStartListener: OnMarkerEventHandler | null = null;
  private markerDragListener: OnMarkerEventHandler | null = null;
  private markerDragEndListener: OnMarkerEventHandler | null = null;

  constructor(
    private readonly nativeRef: React.RefObject<GoogleMapViewRef | null>,
    cameraPosition: MapCameraPosition
  ) {
    super();
    this.cameraPosition = cameraPosition;
    this.holder = new GoogleMapMapViewHolder(nativeRef);
  }

  async clearOverlays(): Promise<void> {
    this.markerStates.clear();
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
    this.markerStates.clear();
    data.forEach((state) => this.markerStates.set(state.id, state));
    this.dispatchCommand('compositionMarkers', [data.map(markerStateToNative)]);
  }

  async updateMarker(state: MarkerState): Promise<void> {
    this.markerStates.set(state.id, state);
    this.dispatchCommand('updateMarker', [markerStateToNative(state)]);
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

  destroy(): void {
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
    this.notifyMapInitialized();
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
