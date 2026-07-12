/// <reference types="google.maps" />
import {
  createGeoPoint,
  createPolylineEntity,
  type PolylineEntity,
  type OnPolylineEventHandler,
  type PolylineEvent,
  type PolylineState,
} from '@mapconductor/js-sdk-core';
import { mouseEventToGeoPoint } from '../helpers';
import { GoogleMapActualPolyline } from '../GoogleMapTypeAlias';
import { GoogleMapPolylineOverlayRenderer } from './GoogleMapPolylineOverlayRenderer';
import { GoogleMapPolylineOverlayRenderer2D } from './GoogleMapPolylineOverlayRenderer2D';

interface PolylineRenderer {
  createPolyline(state: PolylineState): Promise<GoogleMapActualPolyline | null>;
  updatePolylineProperties(params: {
    polyline: GoogleMapActualPolyline;
    current: PolylineEntity<GoogleMapActualPolyline>;
    prev: PolylineEntity<GoogleMapActualPolyline>;
  }): Promise<GoogleMapActualPolyline | null>;
  removePolyline(entity: PolylineEntity<GoogleMapActualPolyline>): Promise<void>;
}

export class GoogleMapPolylineController {
  private readonly polylines = new Map<string, GoogleMapActualPolyline>();
  private readonly states = new Map<string, PolylineState>();
  private readonly clickCleanups = new Map<string, () => void>();
  private readonly renderer: PolylineRenderer;

  private clickListener: OnPolylineEventHandler | null = null;

  constructor(renderer: GoogleMapPolylineOverlayRenderer | GoogleMapPolylineOverlayRenderer2D) {
    this.renderer = renderer as unknown as PolylineRenderer;
  }

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

    let polyline: GoogleMapActualPolyline;
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

    this.setClickHandler(polyline, state);
  }

  private async removeById(id: string): Promise<void> {
    const polyline = this.polylines.get(id);
    const state = this.states.get(id);
    if (!polyline || !state) return;
    this.clearClickHandler(id, polyline);
    await this.renderer.removePolyline(createPolylineEntity({ polyline, state }));
    this.polylines.delete(id);
    this.states.delete(id);
  }

  private setClickHandler(polyline: GoogleMapActualPolyline, state: PolylineState): void {
    this.clearClickHandler(state.id, polyline);

    if (polyline instanceof HTMLElement) {
      const listener = (event: Event) => {
        const e = event as google.maps.maps3d.LocationClickEvent;
        const position = e.position;
        if (!position) return;
        const polylineEvent: PolylineEvent = {
          state,
          clicked: createGeoPoint({
            latitude: position.lat,
            longitude: position.lng,
            altitude: position.altitude ?? 0,
          }),
        };
        state.onClick?.(polylineEvent);
        this.clickListener?.(polylineEvent);
      };
      polyline.addEventListener('gmp-click', listener);
      this.clickCleanups.set(state.id, () => polyline.removeEventListener('gmp-click', listener));
      return;
    }

    google.maps.event.clearInstanceListeners(polyline);
    polyline.addListener('click', (e: google.maps.MapMouseEvent) => {
      const clicked = mouseEventToGeoPoint(e);
      if (!clicked) return;
      const event: PolylineEvent = { state, clicked };
      state.onClick?.(event);
      this.clickListener?.(event);
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
