/// <reference types="google.maps" />
import {
  createPolylineEntity,
  type OnPolylineEventHandler,
  type PolylineEvent,
  type PolylineState,
} from '@mapconductor/core';
import { mouseEventToGeoPoint } from '../helpers';
import { GoogleMapPolylineOverlayRenderer } from './GoogleMapPolylineOverlayRenderer';
import { GoogleMapPolylineOverlayRenderer2D } from './GoogleMapPolylineOverlayRenderer2D';

export class GoogleMapPolylineController {
  private readonly polylines = new Map<string, google.maps.Polyline>();
  private readonly states = new Map<string, PolylineState>();

  private clickListener: OnPolylineEventHandler | null = null;

  constructor(readonly renderer: GoogleMapPolylineOverlayRenderer | GoogleMapPolylineOverlayRenderer2D) { }

  composition(data: PolylineState[]): void {
    const newIds = new Set(data.map((s) => s.id));
    for (const id of [...this.polylines.keys()]) {
      if (!newIds.has(id)) void this.removeById(id);
    }
    for (const state of data) void this.upsert(state);
  }

  update(state: PolylineState): void {
    void this.upsert(state);
  }

  has(state: PolylineState): boolean {
    return this.polylines.has(state.id);
  }

  setOnClickListener(listener: OnPolylineEventHandler | null): void {
    this.clickListener = listener;
  }

  clear(): void {
    for (const id of [...this.polylines.keys()]) void this.removeById(id);
  }

  private async upsert(state: PolylineState): Promise<void> {
    const existing = this.polylines.get(state.id);
    const prev = this.states.get(state.id);

    let polyline: google.maps.Polyline;
    if (!existing) {
      const created = await this.renderer.createPolyline(state);
      if (!created) return;
      polyline = created;
      this.polylines.set(state.id, polyline);
    } else {
      polyline = existing;
      if (prev) {
        await this.renderer.updatePolylineProperties({
          polyline,
          current: createPolylineEntity({ polyline, state }),
          prev: createPolylineEntity({ polyline, state: prev }),
        });
      }
    }
    this.states.set(state.id, state);

    google.maps.event.clearInstanceListeners(polyline);
    polyline.addListener('click', (e: google.maps.MapMouseEvent) => {
      const clicked = mouseEventToGeoPoint(e);
      if (!clicked) return;
      const event: PolylineEvent = { state, clicked };
      state.onClick?.(event);
      this.clickListener?.(event);
    });
  }

  private async removeById(id: string): Promise<void> {
    const polyline = this.polylines.get(id);
    const state = this.states.get(id);
    if (!polyline || !state) return;
    await this.renderer.removePolyline(createPolylineEntity({ polyline, state }));
    this.polylines.delete(id);
    this.states.delete(id);
  }
}
