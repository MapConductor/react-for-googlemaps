import { useState } from 'react';
import {
  MapViewState,
  type MapViewStateInterface,
  type GeoPoint,
  type MapCameraPosition,
  type MapViewControllerInterface,
  type MapViewHolder,
  MapCameraPosition as MapCameraPositionNS,
  MapPaddings,
  createRandomId,
} from '@mapconductor/core';
import { GoogleMapDesign, type GoogleMapDesignType } from './GoogleMapDesign';
import type { GoogleMapViewHolder } from './GoogleMapViewHolder';

export interface GoogleMapViewStateInterface
  extends MapViewStateInterface<GoogleMapDesignType> {}

export interface GoogleMapViewStateParams {
  id?: string;
  mapId?: string;
  mapDesignType?: GoogleMapDesignType;
  cameraPosition?: MapCameraPosition;
}

export class GoogleMapViewState extends MapViewState<GoogleMapDesignType>
  implements GoogleMapViewStateInterface {
  readonly id: string;
  readonly mapId: string | null;
  private _cameraPosition: MapCameraPosition;
  private _mapDesignType: GoogleMapDesignType;
  private _controller: MapViewControllerInterface | null = null;
  private _padding: MapPaddings = MapPaddings.Zeros;
  private _holder: GoogleMapViewHolder | null = null;
  private _cameraPositionChangeListener: ((camera: MapCameraPosition) => void) | null = null;

  constructor({
    id = createRandomId(),
    mapId = undefined,
    mapDesignType = GoogleMapDesign.Normal,
    cameraPosition = MapCameraPositionNS.Default,
  }: GoogleMapViewStateParams = {}) {
    super();
    this.id = id;
    this.mapId = mapId ?? null;
    this._cameraPosition = cameraPosition;
    this._mapDesignType = mapDesignType;
  }

  override get cameraPosition(): MapCameraPosition {
    return this._cameraPosition;
  }

  override get mapDesignType(): GoogleMapDesignType {
    return this._mapDesignType;
  }

  get padding(): MapPaddings {
    return this._padding;
  }

  override set mapDesignType(value: GoogleMapDesignType) {
    this._mapDesignType = value;
  }

  override moveCameraTo(position: GeoPoint, durationMillis?: number): void;
  override moveCameraTo(cameraPosition: MapCameraPosition, durationMillis?: number): void;
  override moveCameraTo(positionOrCamera: GeoPoint | MapCameraPosition, durationMillis?: number): void {
    const newPosition = 'zoom' in positionOrCamera
      ? this.resolveCameraPosition(positionOrCamera as MapCameraPosition)
      : this._cameraPosition.copy({ position: positionOrCamera as GeoPoint });

    const ctrl = this._controller;
    if (!ctrl) {
      this._cameraPosition = newPosition;
      return;
    }

    if (!durationMillis || durationMillis === 0) {
      ctrl.moveCamera(newPosition);
    } else {
      void ctrl.animateCamera(newPosition, { duration: durationMillis });
    }
    this._cameraPosition = newPosition;
    this._cameraPositionChangeListener?.(newPosition);
  }

  override getMapViewHolder(): MapViewHolder<unknown, unknown> | null {
    return this._holder;
  }

  // Called by GoogleMapsView when controller is initialized
  setController(ctrl: MapViewControllerInterface | null): void {
    this._controller = ctrl;
    if (ctrl) ctrl.moveCamera(this._cameraPosition);
  }

  setPadding(paddings: MapPaddings): void {
    this._padding = paddings;
  }

  // Called by GoogleMapsView when map view holder is available
  setMapViewHolder(holder: GoogleMapViewHolder | null): void {
    this._holder = holder;
  }

  // Called by GoogleMapsView when camera position changes
  updateCameraPosition(camera: MapCameraPosition): void {
    this._cameraPosition = camera;
    this._cameraPositionChangeListener?.(camera);
  }

  setCameraPositionChangeListener(listener: ((camera: MapCameraPosition) => void) | null): void {
    this._cameraPositionChangeListener = listener;
  }

  // If zoom/bearing/tilt are all 0, treat as position-only update (matches Android/iOS behavior)
  private resolveCameraPosition(target: MapCameraPosition): MapCameraPosition {
    const isUnspecified = target.zoom === 0 && target.bearing === 0 && target.tilt === 0;
    if (isUnspecified) return this._cameraPosition.copy({ position: target.position });
    return target;
  }
}

export function useGoogleMapViewState({
  id = createRandomId(),
  mapId = undefined,
  mapDesignType = GoogleMapDesign.Normal,
  cameraPosition = MapCameraPositionNS.Default,
}: GoogleMapViewStateParams = {}): GoogleMapViewState {
  const [state] = useState(() => new GoogleMapViewState({
    id,
    mapId,
    mapDesignType,
    cameraPosition,
  }));
  return state;
}
