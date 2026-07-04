/// <reference types="google.maps" />
import {
  createCircleEntity,
  type CircleEvent,
  type CircleState,
  type OnCircleEventHandler,
} from '@mapconductor/js-sdk-core';
import { mouseEventToGeoPoint } from '../helpers';
import { GoogleMapCircleOverlayRenderer } from './GoogleMapCircleOverlayRenderer';
import { GoogleMapCircleOverlayRenderer2D } from './GoogleMapCircleOverlayRenderer2D';

export class GoogleMapCircleController {
  private readonly circles = new Map<string, google.maps.Circle>();
  private readonly states = new Map<string, CircleState>();
  private readonly pendingCreates = new Set<string>();

  private clickListener: OnCircleEventHandler | null = null;

  constructor(readonly renderer: GoogleMapCircleOverlayRenderer | GoogleMapCircleOverlayRenderer2D) { }

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

    let circle: google.maps.Circle;
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

    google.maps.event.clearInstanceListeners(circle);
    circle.addListener('click', (e: google.maps.MapMouseEvent) => {
      const clicked = mouseEventToGeoPoint(e);
      if (!clicked) return;
      const event: CircleEvent = { state, clicked };
      state.onClick?.(event);
      this.clickListener?.(event);
    });
  }

  private async removeById(id: string): Promise<void> {
    const circle = this.circles.get(id);
    const state = this.states.get(id);
    if (!circle || !state) return;
    await this.renderer.removeCircle(createCircleEntity({ circle, state }));
    this.circles.delete(id);
    this.states.delete(id);
  }
}
