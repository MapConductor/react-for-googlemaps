/// <reference types="google.maps" />
import {
  createGeoPoint,
  PolylineController,
  PolylineManager,
  type OnPolylineEventHandler,
  type PolylineEntity,
  type PolylineEvent,
  type PolylineState,
} from '@mapconductor/js-sdk-core';
import { mouseEventToGeoPoint } from '../helpers';
import { GoogleMapActualPolyline } from '../GoogleMapTypeAlias';
import { GoogleMapPolylineOverlayRenderer } from './GoogleMapPolylineOverlayRenderer';
import { GoogleMapPolylineOverlayRenderer2D } from './GoogleMapPolylineOverlayRenderer2D';

type GoogleMapPolylineRenderer =
  | GoogleMapPolylineOverlayRenderer
  | GoogleMapPolylineOverlayRenderer2D;

export class GoogleMapPolylineController extends PolylineController<GoogleMapActualPolyline> {
  declare readonly renderer: GoogleMapPolylineRenderer;

  private readonly clickCleanups = new Map<string, () => void>();

  constructor(renderer: GoogleMapPolylineRenderer) {
    super({
      polylineManager: new PolylineManager<GoogleMapActualPolyline>(),
      renderer,
    });
  }

  async composition(data: PolylineState[]): Promise<void> {
    await this.add(data);
  }

  override async add(data: PolylineState[]): Promise<void> {
    const newIds = new Set(data.map((state) => state.id));
    for (const entity of this.polylineManager.allEntities()) {
      if (!newIds.has(entity.state.id)) {
        this.clearClickHandler(entity.state.id, entity.polyline);
      }
    }

    await super.add(data);

    for (const entity of this.polylineManager.allEntities()) {
      this.setClickHandler(entity);
    }
  }

  override async update(state: PolylineState): Promise<void> {
    await super.update(state);
    const entity = this.polylineManager.getEntity(state.id);
    if (entity) this.setClickHandler(entity);
  }

  has(state: PolylineState): boolean {
    return this.polylineManager.hasEntity(state.id);
  }

  setOnClickListener(listener: OnPolylineEventHandler | null): void {
    this.clickListener = listener;
  }

  override async clear(): Promise<void> {
    for (const entity of this.polylineManager.allEntities()) {
      this.clearClickHandler(entity.state.id, entity.polyline);
    }
    await super.clear();
  }

  private setClickHandler(entity: PolylineEntity<GoogleMapActualPolyline>): void {
    const { polyline, state } = entity;
    this.clearClickHandler(state.id, polyline);

    if (polyline instanceof HTMLElement) {
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
      polyline.addEventListener('gmp-click', listener);
      this.clickCleanups.set(
        state.id,
        () => polyline.removeEventListener('gmp-click', listener),
      );
      return;
    }

    google.maps.event.clearInstanceListeners(polyline);
    polyline.addListener('click', (event: google.maps.MapMouseEvent) => {
      const clicked = mouseEventToGeoPoint(event);
      if (!clicked) return;
      const polylineEvent: PolylineEvent = { state, clicked };
      this.dispatchClick(polylineEvent);
    });
  }

  private clearClickHandler(id: string, polyline: GoogleMapActualPolyline): void {
    this.clickCleanups.get(id)?.();
    this.clickCleanups.delete(id);
    if (!(polyline instanceof HTMLElement)) {
      google.maps.event.clearInstanceListeners(polyline);
    }
  }
}
