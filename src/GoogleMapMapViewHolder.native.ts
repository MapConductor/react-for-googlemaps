import type React from 'react';
import type { GeoPoint, MapViewHolder, Offset } from '@mapconductor/js-sdk-core';
import type { GoogleMapViewRef } from './GoogleMapTypeAlias.native';

export class GoogleMapMapViewHolder
  implements MapViewHolder<GoogleMapViewRef | null, null>
{
  readonly map = null;

  constructor(private readonly nativeRef: React.RefObject<GoogleMapViewRef | null>) {}

  get mapView(): GoogleMapViewRef | null {
    return this.nativeRef.current;
  }

  toScreenOffset(_position: GeoPoint): null {
    return null;
  }

  async fromScreenOffset(_offset: Offset): Promise<GeoPoint | null> {
    return null;
  }

  fromScreenOffsetSync(_offset: Offset): GeoPoint | null {
    return null;
  }
}
