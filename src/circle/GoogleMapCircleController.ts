/// <reference types="google.maps" />
import {
  createCircleEntity,
  createGeoPoint,
  type CircleEntity,
  type CircleEvent,
  type CircleState,
  type OnCircleEventHandler,
} from '@mapconductor/js-sdk-core';
import { mouseEventToGeoPoint } from '../helpers';
import { GoogleMapActualCircle } from '../GoogleMapsTypeAlias';
import { GoogleMapCircleOverlayRenderer } from './GoogleMapCircleOverlayRenderer';
import { GoogleMapCircleOverlayRenderer2D } from './GoogleMapCircleOverlayRenderer2D';

interface CircleRenderer {
  createCircle(state: CircleState): Promise<GoogleMapActualCircle | null>;
  updateCircleProperties(params: {
    circle: GoogleMapActualCircle;
    current: CircleEntity<GoogleMapActualCircle>;
    prev: CircleEntity<GoogleMapActualCircle>;
  }): Promise<GoogleMapActualCircle | null>;
  removeCircle(entity: CircleEntity<GoogleMapActualCircle>): Promise<void>;
}

export class GoogleMapCircleController {
  private readonly circles = new Map<string, GoogleMapActualCircle>();
  private readonly states = new Map<string, CircleState>();
  private readonly pendingCreates = new Set<string>();
  private readonly clickCleanups = new Map<string, () => void>();
  private readonly renderer: CircleRenderer;

  private clickListener: OnCircleEventHandler | null = null;

  constructor(renderer: GoogleMapCircleOverlayRenderer | GoogleMapCircleOverlayRenderer2D) {
    this.renderer = renderer as unknown as CircleRenderer;
  }

  composition(data: CircleState[]): void {
    const newIds = new Set(data.map((s) => s.id));
    for (const id of [...this.circles.keys()]) {
      if (!newIds.has(id)) void this.removeById(id);
    }
    for (const state of data) void this.upsert(state);
  }

  update(state: CircleState): void {
    void this.upsert(state);
  }

  has(state: CircleState): boolean {
    return this.circles.has(state.id);
  }

  setOnClickListener(listener: OnCircleEventHandler | null): void {
    this.clickListener = listener;
  }

  clear(): void {
    for (const id of [...this.circles.keys()]) void this.removeById(id);
  }

  private async upsert(state: CircleState): Promise<void> {
    const existing = this.circles.get(state.id);
    const prev = this.states.get(state.id);

    let circle: GoogleMapActualCircle;
    if (!existing) {
      if (this.pendingCreates.has(state.id)) return;
      this.pendingCreates.add(state.id);
      const created = await this.renderer.createCircle(state);
      this.pendingCreates.delete(state.id);
      if (!created) return;
      if (this.circles.has(state.id)) return;
      circle = created;
      this.circles.set(state.id, circle);
    } else {
      circle = existing;
      if (prev) {
        await this.renderer.updateCircleProperties({
          circle,
          current: createCircleEntity({ circle, state }),
          prev: createCircleEntity({ circle, state: prev }),
        });
      }
    }
    this.states.set(state.id, state);

    this.setClickHandler(circle, state);
  }

  private async removeById(id: string): Promise<void> {
    const circle = this.circles.get(id);
    const state = this.states.get(id);
    if (!circle || !state) return;
    this.clearClickHandler(id, circle);
    await this.renderer.removeCircle(createCircleEntity({ circle, state }));
    this.circles.delete(id);
    this.states.delete(id);
  }

  private setClickHandler(circle: GoogleMapActualCircle, state: CircleState): void {
    this.clearClickHandler(state.id, circle);

    if (circle instanceof HTMLElement) {
      const listener = (event: Event) => {
        if (!state.clickable) return;
        const e = event as google.maps.maps3d.LocationClickEvent;
        const position = e.position;
        if (!position) return;
        const circleEvent: CircleEvent = {
          state,
          clicked: createGeoPoint({
            latitude: position.lat,
            longitude: position.lng,
            altitude: position.altitude ?? 0,
          }),
        };
        state.onClick?.(circleEvent);
        this.clickListener?.(circleEvent);
      };
      circle.addEventListener('gmp-click', listener);
      this.clickCleanups.set(state.id, () => circle.removeEventListener('gmp-click', listener));
      return;
    }

    google.maps.event.clearInstanceListeners(circle);
    circle.addListener('click', (e: google.maps.MapMouseEvent) => {
      const clicked = mouseEventToGeoPoint(e);
      if (!clicked) return;
      const event: CircleEvent = { state, clicked };
      state.onClick?.(event);
      this.clickListener?.(event);
    });
  }

  private clearClickHandler(id: string, circle: GoogleMapActualCircle): void {
    this.clickCleanups.get(id)?.();
    this.clickCleanups.delete(id);
    if (!(circle instanceof HTMLElement)) {
      google.maps.event.clearInstanceListeners(circle);
    }
  }
}
