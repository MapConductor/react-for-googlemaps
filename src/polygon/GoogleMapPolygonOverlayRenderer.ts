/// <reference types="google.maps" />
import {
  AbstractPolygonOverlayRenderer,
  type PolygonEntity,
  type PolygonState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapActualPolygon } from '../GoogleMapsTypeAlias';
import { GoogleMapViewHolder } from '../GoogleMapViewHolder';
import { loadLibrary } from '../LibraryLoader';
import { buildPolygonInnerPaths, buildPolygonPath } from '../overlay3d';

export class GoogleMapPolygonOverlayRenderer extends AbstractPolygonOverlayRenderer<
  GoogleMapViewHolder,
  GoogleMapActualPolygon
> {
  constructor(holder: GoogleMapViewHolder) {
    super(holder);
  }

  async createPolygon(state: PolygonState): Promise<GoogleMapActualPolygon | null> {
    const { Polygon3DElement, AltitudeMode } =
      await loadLibrary<google.maps.Maps3DLibrary>('maps3d');
    const innerPaths = buildPolygonInnerPaths(state);
    const polygon = new Polygon3DElement({
      path: buildPolygonPath(state.points, state.geodesic),
      ...(innerPaths.length > 0 ? { innerPaths } : {}),
      strokeColor: state.strokeColor,
      strokeWidth: state.strokeWidth,
      fillColor: state.fillColor,
      geodesic: state.geodesic,
      zIndex: state.zIndex,
      altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
    });
    this.holder.map.append(polygon);
    return polygon;
  }

  async updatePolygonProperties({
    polygon,
    current,
  }: {
    polygon: GoogleMapActualPolygon;
    current: PolygonEntity<GoogleMapActualPolygon>;
    prev: PolygonEntity<GoogleMapActualPolygon>;
  }): Promise<GoogleMapActualPolygon | null> {
    if (!(polygon instanceof HTMLElement)) return polygon;
    polygon.path = buildPolygonPath(current.state.points, current.state.geodesic);
    const innerPaths = buildPolygonInnerPaths(current.state);
    polygon.innerPaths = innerPaths.length > 0 ? innerPaths : null;
    polygon.strokeColor = current.state.strokeColor;
    polygon.strokeWidth = current.state.strokeWidth;
    polygon.fillColor = current.state.fillColor;
    polygon.geodesic = current.state.geodesic;
    polygon.zIndex = current.state.zIndex;
    return polygon;
  }

  async removePolygon(entity: PolygonEntity<GoogleMapActualPolygon>): Promise<void> {
    if (entity.polygon instanceof HTMLElement) {
      entity.polygon.remove();
    }
  }
}
