import {
  useState } from 'react';
import {
  MapViewState,
  type MapViewStateInterface,
  type MapCameraPosition,
  MapCameraPosition as MapCameraPositionNS,
  MapPaddings,
  createRandomId,
} from '@mapconductor/js-sdk-core';
import { GoogleMapDesign, type GoogleMapDesignType } from './GoogleMapDesign';

export interface GoogleMapViewStateInterface
  extends MapViewStateInterface<GoogleMapDesignType> {
  readonly apiKey: string;
}

export interface GoogleMapViewStateParams {
  id?: string;
  apiKey?: string;
  mapId?: string;
  mapDesignType?: GoogleMapDesignType;
  cameraPosition?: MapCameraPosition;
}

export class GoogleMapViewState extends MapViewState<GoogleMapDesignType>
  implements GoogleMapViewStateInterface {
  readonly apiKey: string;
  readonly mapId: string | null;
  private _mapDesignType: GoogleMapDesignType;
  private _padding: MapPaddings = MapPaddings.Zeros;

  constructor({
    id = createRandomId(),
    apiKey = '',
    mapId = undefined,
    mapDesignType = GoogleMapDesign.Normal,
    cameraPosition = MapCameraPositionNS.Default,
  }: GoogleMapViewStateParams = {}) {
    super({ id, cameraPosition });
    this.apiKey = apiKey;
    this.mapId = mapId ?? null;
    this._mapDesignType = mapDesignType;
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

  // Called by GoogleMapView when controller is initialized

  setPadding(paddings: MapPaddings): void {
    this._padding = paddings;
  }

  // Called by GoogleMapView when camera position changes

  // If zoom/bearing/tilt are all 0, treat as position-only update (matches Android/iOS behavior)
}

export function useGoogleMapViewState({
  id = createRandomId(),
  apiKey = '',
  mapId = undefined,
  mapDesignType = GoogleMapDesign.Normal,
  cameraPosition = MapCameraPositionNS.Default,
}: GoogleMapViewStateParams = {}): GoogleMapViewState {
  const [state] = useState(() => new GoogleMapViewState({
    id,
    apiKey,
    mapId,
    mapDesignType,
    cameraPosition,
  }));
  return state;
}
