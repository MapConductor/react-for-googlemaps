/// <reference types="google.maps" />
import {
  AbstractCircleOverlayRenderer,
  type CircleEntity,
  type CircleState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapActualCircle } from '../GoogleMapTypeAlias';
import { GoogleMapViewHolder } from '../GoogleMapViewHolder';
import { loadLibrary } from '../LibraryLoader';
import { buildCirclePath, calculateCircleZIndex } from '../overlay3d';

export class GoogleMapCircleOverlayRenderer extends AbstractCircleOverlayRenderer<
  GoogleMapViewHolder,
  GoogleMapActualCircle
> {
  constructor(holder: GoogleMapViewHolder) {
    super(holder);
  }

  async createCircle(state: CircleState): Promise<GoogleMapActualCircle | null> {
    const { Polygon3DInteractiveElement, AltitudeMode } =
      await loadLibrary<google.maps.Maps3DLibrary>('maps3d');
    const circle = new Polygon3DInteractiveElement({
      path: buildCirclePath(state),
      strokeColor: state.strokeColor,
      strokeWidth: state.strokeWidth,
      fillColor: state.fillColor,
      geodesic: state.geodesic,
      zIndex: state.zIndex ?? calculateCircleZIndex(state.center),
      altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
    });
    this.holder.map.append(circle);
    return circle;
  }

  async updateCircleProperties({
    circle,
    current,
  }: {
    circle: GoogleMapActualCircle;
    current: CircleEntity<GoogleMapActualCircle>;
    prev: CircleEntity<GoogleMapActualCircle>;
  }): Promise<GoogleMapActualCircle | null> {
    if (!(circle instanceof HTMLElement)) return circle;
    circle.path = buildCirclePath(current.state);
    circle.strokeColor = current.state.strokeColor;
    circle.strokeWidth = current.state.strokeWidth;
    circle.fillColor = current.state.fillColor;
    circle.geodesic = current.state.geodesic;
    circle.zIndex = current.state.zIndex ?? calculateCircleZIndex(current.state.center);
    return circle;
  }

  async removeCircle(entity: CircleEntity<GoogleMapActualCircle>): Promise<void> {
    if (entity.circle instanceof HTMLElement) {
      entity.circle.remove();
    }
  }
}
