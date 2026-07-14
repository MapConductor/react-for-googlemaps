/// <reference types="google.maps" />
import {
  createGeoPoint,
  PolygonController,
  PolygonManager,
  type OnPolygonEventHandler,
  type PolygonEntity,
  type PolygonEvent,
  type PolygonState,
} from '@mapconductor/js-sdk-core';
import { mouseEventToGeoPoint } from '../helpers';
import { GoogleMapActualPolygon } from '../GoogleMapTypeAlias';
import { GoogleMapPolygonOverlayRenderer } from './GoogleMapPolygonOverlayRenderer';
import { GoogleMapPolygonOverlayRenderer2D } from './GoogleMapPolygonOverlayRenderer2D';

type GoogleMapPolygonRenderer =
  | GoogleMapPolygonOverlayRenderer
  | GoogleMapPolygonOverlayRenderer2D;

export class GoogleMapPolygonController extends PolygonController<GoogleMapActualPolygon> {
  declare readonly renderer: GoogleMapPolygonRenderer;

  private readonly clickCleanups = new Map<string, () => void>();

  constructor(renderer: GoogleMapPolygonRenderer) {
    super({
      polygonManager: new PolygonManager<GoogleMapActualPolygon>(),
      renderer,
    });
  }

  async composition(data: PolygonState[]): Promise<void> {
    await this.add(data);
  }

  override async add(data: PolygonState[]): Promise<void> {
    const newIds = new Set(data.map((state) => state.id));
    for (const entity of this.polygonManager.allEntities()) {
      if (!newIds.has(entity.state.id)) {
        this.clearClickHandler(entity.state.id, entity.polygon);
      }
    }

    await super.add(data);

    for (const entity of this.polygonManager.allEntities()) {
      this.setClickHandler(entity);
    }
  }

  override async update(state: PolygonState): Promise<void> {
    await super.update(state);
    const entity = this.polygonManager.getEntity(state.id);
    if (entity) this.setClickHandler(entity);
  }

  has(state: PolygonState): boolean {
    return this.polygonManager.hasEntity(state.id);
  }

  setOnClickListener(listener: OnPolygonEventHandler | null): void {
    this.clickListener = listener;
  }

  override async clear(): Promise<void> {
    for (const entity of this.polygonManager.allEntities()) {
      this.clearClickHandler(entity.state.id, entity.polygon);
    }
    await super.clear();
  }

  private setClickHandler(entity: PolygonEntity<GoogleMapActualPolygon>): void {
    const { polygon, state } = entity;
    this.clearClickHandler(state.id, polygon);

    if (polygon instanceof HTMLElement) {
      const listener = (event: Event) => {
        const position = (event as google.maps.maps3d.LocationClickEvent).position;
        if (!position) return;
        this.dispatchClick({
          state,
          clicked: createGeoPoint({
            latitude: position.lat,
            longitude: position.lng,
            altitude: position.altitude ?? 0,
          }),
        });
      };
      polygon.addEventListener('gmp-click', listener);
      this.clickCleanups.set(
        state.id,
        () => polygon.removeEventListener('gmp-click', listener),
      );
      return;
    }

    google.maps.event.clearInstanceListeners(polygon);
    polygon.addListener('click', (event: google.maps.MapMouseEvent) => {
      const clicked = mouseEventToGeoPoint(event);
      if (!clicked) return;
      const polygonEvent: PolygonEvent = { state, clicked };
      this.dispatchClick(polygonEvent);
    });
  }

  private clearClickHandler(id: string, polygon: GoogleMapActualPolygon): void {
    this.clickCleanups.get(id)?.();
    this.clickCleanups.delete(id);
    if (!(polygon instanceof HTMLElement)) {
      google.maps.event.clearInstanceListeners(polygon);
    }
  }
}
