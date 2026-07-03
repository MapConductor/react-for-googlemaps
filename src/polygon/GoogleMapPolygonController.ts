/// <reference types="google.maps" />
import {
  createPolygonEntity,
  type OnPolygonEventHandler,
  type PolygonEvent,
  type PolygonState,
} from '@mapconductor/core';
import { mouseEventToGeoPoint } from '../helpers';
import { GoogleMapPolygonOverlayRenderer } from './GoogleMapPolygonOverlayRenderer';
import { GoogleMapPolygonOverlayRenderer2D } from './GoogleMapPolygonOverlayRenderer2D';

export class GoogleMapPolygonController {
  private readonly polygons = new Map<string, google.maps.Polygon>();
  private readonly states = new Map<string, PolygonState>();

  private clickListener: OnPolygonEventHandler | null = null;

  constructor(readonly renderer: GoogleMapPolygonOverlayRenderer | GoogleMapPolygonOverlayRenderer2D) {  }

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

    let polygon: google.maps.Polygon;
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

    google.maps.event.clearInstanceListeners(polygon);
    polygon.addListener('click', (e: google.maps.MapMouseEvent) => {
      const clicked = mouseEventToGeoPoint(e);
      if (!clicked) return;
      const event: PolygonEvent = { state, clicked };
      state.onClick?.(event);
      this.clickListener?.(event);
    });
  }

  private async removeById(id: string): Promise<void> {
    const polygon = this.polygons.get(id);
    const state = this.states.get(id);
    if (!polygon || !state) return;
    await this.renderer.removePolygon(createPolygonEntity({ polygon, state }));
    this.polygons.delete(id);
    this.states.delete(id);
  }
}
