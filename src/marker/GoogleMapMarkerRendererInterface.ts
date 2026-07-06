import { AddParams, ChangeParams, GeoPoint, MarkerAnimationOverlayHost, MarkerEntity, MarkerState, OnMarkerEventHandler } from "@mapconductor/js-sdk-core";

export interface GoogleMapMarkerRendererInterface<MarkerType> {
    clickEventName: string | null;
    dragstartEventName: string | null;
    dragEventName: string | null;
    dragendEventName: string | null;

  animateStartListener: OnMarkerEventHandler | null;
  animateEndListener: OnMarkerEventHandler | null;

  /** Set by the controller to route Drop/Bounce animations to a screen-space overlay. */
  animationOverlayHost: MarkerAnimationOverlayHost | null;

  onAdd(data: AddParams[]): Promise<(MarkerType | null)[]>

  onChange(data: ChangeParams<MarkerType>[]): Promise<(MarkerType | null)[]>

  onRemove(_data: MarkerEntity<MarkerType>[]): Promise<void>

  onAnimate(entity: MarkerEntity<MarkerType>): Promise<void>

  onPostProcess(): Promise<void>

  setMarkerPosition(_entity: MarkerEntity<MarkerType>, _position: GeoPoint): void

  setMarkerVisible(entity: MarkerEntity<MarkerType>, visible: boolean): void

  syncPositionToState(_marker: MarkerType, _state: MarkerState): void
}