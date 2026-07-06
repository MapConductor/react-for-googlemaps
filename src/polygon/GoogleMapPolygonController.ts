/// <reference types="google.maps" />
import {
  createGeoPoint,
  createPolygonEntity,
  type PolygonEntity,
  type OnPolygonEventHandler,
  type PolygonEvent,
  type PolygonState,
} from '@mapconductor/js-sdk-core';
import { mouseEventToGeoPoint } from '../helpers';
import { GoogleMapActualPolygon } from '../GoogleMapsTypeAlias';
import { GoogleMapPolygonOverlayRenderer } from './GoogleMapPolygonOverlayRenderer';
import { GoogleMapPolygonOverlayRenderer2D } from './GoogleMapPolygonOverlayRenderer2D';

interface PolygonRenderer {
  createPolygon(state: PolygonState): Promise<GoogleMapActualPolygon | null>;
  updatePolygonProperties(params: {
    polygon: GoogleMapActualPolygon;
    current: PolygonEntity<GoogleMapActualPolygon>;
    prev: PolygonEntity<GoogleMapActualPolygon>;
  }): Promise<GoogleMapActualPolygon | null>;
  removePolygon(entity: PolygonEntity<GoogleMapActualPolygon>): Promise<void>;
}

export class GoogleMapPolygonController {
  private readonly polygons = new Map<string, GoogleMapActualPolygon>();
  private readonly states = new Map<string, PolygonState>();
  private readonly clickCleanups = new Map<string, () => void>();
  private readonly renderer: PolygonRenderer;

  private clickListener: OnPolygonEventHandler | null = null;

  constructor(renderer: GoogleMapPolygonOverlayRenderer | GoogleMapPolygonOverlayRenderer2D) {
    this.renderer = renderer as unknown as PolygonRenderer;
  }

  composition(data: PolygonState[]): void {
    const newIds = new Set(data.map((s) => s.id));
    for (const id of [...this.polygons.keys()]) {
      if (!newIds.has(id)) void this.removeById(id);
    }
    for (const state of data) void this.upsert(state);
  }

  update(state: PolygonState): void {
    void this.upsert(state);
  }

  has(state: PolygonState): boolean {
    return this.polygons.has(state.id);
  }

  setOnClickListener(listener: OnPolygonEventHandler | null): void {
    this.clickListener = listener;
  }

  clear(): void {
    for (const id of [...this.polygons.keys()]) void this.removeById(id);
  }

  private async upsert(state: PolygonState): Promise<void> {
    const existing = this.polygons.get(state.id);
    const prev = this.states.get(state.id);

    let polygon: GoogleMapActualPolygon;
    if (!existing) {
      const created = await this.renderer.createPolygon(state);
      if (!created) return;
      polygon = created;
      this.polygons.set(state.id, polygon);
    } else {
      polygon = existing;
      if (prev) {
        await this.renderer.updatePolygonProperties({
          polygon,
          current: createPolygonEntity({ polygon, state }),
          prev: createPolygonEntity({ polygon, state: prev }),
        });
      }
    }
    this.states.set(state.id, state);

    this.setClickHandler(polygon, state);
  }

  private async removeById(id: string): Promise<void> {
    const polygon = this.polygons.get(id);
    const state = this.states.get(id);
    if (!polygon || !state) return;
    this.clearClickHandler(id, polygon);
    await this.renderer.removePolygon(createPolygonEntity({ polygon, state }));
    this.polygons.delete(id);
    this.states.delete(id);
  }

  private setClickHandler(polygon: GoogleMapActualPolygon, state: PolygonState): void {
    this.clearClickHandler(state.id, polygon);

    if (polygon instanceof HTMLElement) {
      const listener = (event: Event) => {
        const e = event as google.maps.maps3d.LocationClickEvent;
        const position = e.position;
        if (!position) return;
        const polygonEvent: PolygonEvent = {
          state,
          clicked: createGeoPoint({
            latitude: position.lat,
            longitude: position.lng,
            altitude: position.altitude ?? 0,
          }),
        };
        state.onClick?.(polygonEvent);
        this.clickListener?.(polygonEvent);
      };
      polygon.addEventListener('gmp-click', listener);
      this.clickCleanups.set(state.id, () => polygon.removeEventListener('gmp-click', listener));
      return;
    }

    google.maps.event.clearInstanceListeners(polygon);
    polygon.addListener('click', (e: google.maps.MapMouseEvent) => {
      const clicked = mouseEventToGeoPoint(e);
      if (!clicked) return;
      const event: PolygonEvent = { state, clicked };
      state.onClick?.(event);
      this.clickListener?.(event);
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
