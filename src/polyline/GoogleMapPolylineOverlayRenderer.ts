/// <reference types="google.maps" />
import {
  AbstractPolylineOverlayRenderer,
  type PolylineEntity,
  type PolylineState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapActualPolyline } from '../GoogleMapsTypeAlias';
import { GoogleMapViewHolder } from '../GoogleMapViewHolder';
import { loadLibrary } from '../LibraryLoader';
import { buildPolylinePath } from '../overlay3d';

export class GoogleMapPolylineOverlayRenderer extends AbstractPolylineOverlayRenderer<
  GoogleMapViewHolder,
  GoogleMapActualPolyline
> {
  constructor(holder: GoogleMapViewHolder) {
    super(holder);
  }

  async createPolyline(state: PolylineState): Promise<GoogleMapActualPolyline | null> {
    const { Polyline3DInteractiveElement, AltitudeMode } =
      await loadLibrary<google.maps.Maps3DLibrary>('maps3d');
    const polyline = new Polyline3DInteractiveElement({
      path: buildPolylinePath(state),
      strokeColor: state.strokeColor,
      strokeWidth: state.strokeWidth,
      geodesic: state.geodesic,
      zIndex: state.zIndex,
      altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
    });
    this.holder.map.append(polyline);
    return polyline;
  }

  async updatePolylineProperties({
    polyline,
    current,
  }: {
    polyline: GoogleMapActualPolyline;
    current: PolylineEntity<GoogleMapActualPolyline>;
    prev: PolylineEntity<GoogleMapActualPolyline>;
  }): Promise<GoogleMapActualPolyline | null> {
    if (!(polyline instanceof HTMLElement)) return polyline;
    polyline.path = buildPolylinePath(current.state);
    polyline.strokeColor = current.state.strokeColor;
    polyline.strokeWidth = current.state.strokeWidth;
    polyline.geodesic = current.state.geodesic;
    polyline.zIndex = current.state.zIndex;
    return polyline;
  }

  async removePolyline(entity: PolylineEntity<GoogleMapActualPolyline>): Promise<void> {
    if (entity.polyline instanceof HTMLElement) {
      entity.polyline.remove();
    }
  }
}
