import { AddParams, ChangeParams, GeoPoint, MarkerEntity, MarkerState } from "@mapconductor/js-sdk-core";

export interface GoogleMapMarkerRendererInterface<MarkerType> {
    clickEventName: string | null;
    dragstartEventName: string | null;
    dragEventName: string | null;
    dragendEventName: string | null;

  onAdd(data: AddParams[]): Promise<(MarkerType | null)[]>

  onChange(data: ChangeParams<MarkerType>[]): Promise<(MarkerType | null)[]>

  onRemove(_data: MarkerEntity<MarkerType>[]): Promise<void>

  onPostProcess(): Promise<void>

  setMarkerPosition(_entity: MarkerEntity<MarkerType>, _position: GeoPoint): void

  syncPositionToState(_marker: MarkerType, _state: MarkerState): void
}