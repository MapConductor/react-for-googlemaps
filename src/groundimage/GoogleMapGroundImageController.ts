/// <reference types="google.maps" />
import {
  createGroundImageEntity,
  type GroundImageEvent,
  type GroundImageState,
  type OnGroundImageEventHandler,
} from '@mapconductor/js-sdk-core';
import { mouseEventToGeoPoint } from '../helpers';
import { GoogleMapGroundImageOverlayRenderer } from './GoogleMapGroundImageOverlayRenderer';
import { GoogleMapGroundImageOverlayRenderer2D } from './GoogleMapGroundImageOverlayRenderer2D';

export class GoogleMapGroundImageController {
  private readonly groundImages = new Map<string, google.maps.GroundOverlay>();
  private readonly states = new Map<string, GroundImageState>();
  ;

  private clickListener: OnGroundImageEventHandler | null = null;

  constructor(readonly renderer: GoogleMapGroundImageOverlayRenderer | GoogleMapGroundImageOverlayRenderer2D) {  }

  composition(data: GroundImageState[]): void {
    const newIds = new Set(data.map((s) => s.id));
    for (const id of [...this.groundImages.keys()]) {
      if (!newIds.has(id)) void this.removeById(id);
    }
    for (const state of data) void this.upsert(state);
  }

  update(state: GroundImageState): void {
    void this.upsert(state);
  }

  has(state: GroundImageState): boolean {
    return this.groundImages.has(state.id);
  }

  setOnClickListener(listener: OnGroundImageEventHandler | null): void {
    this.clickListener = listener;
  }

  clear(): void {
    for (const id of [...this.groundImages.keys()]) void this.removeById(id);
  }

  private async upsert(state: GroundImageState): Promise<void> {
    const existing = this.groundImages.get(state.id);
    const prev = this.states.get(state.id);

    let groundOverlay: google.maps.GroundOverlay;
    if (!existing) {
      const created = await this.renderer.createGroundImage(state);
      if (!created) return;
      groundOverlay = created;
    } else if (prev) {
      const updated = await this.renderer.updateGroundImageProperties({
        groundImage: existing,
        current: createGroundImageEntity({ groundImage: existing, state }),
        prev: createGroundImageEntity({ groundImage: existing, state: prev }),
      });
      if (!updated) return;
      groundOverlay = updated;
    } else {
      return;
    }

    this.groundImages.set(state.id, groundOverlay);
    this.states.set(state.id, state);

    groundOverlay.addListener('click', (e: google.maps.MapMouseEvent) => {
      const event: GroundImageEvent = { state, clicked: mouseEventToGeoPoint(e) };
      state.onClick?.(event);
      this.clickListener?.(event);
    });
  }

  private async removeById(id: string): Promise<void> {
    const groundImage = this.groundImages.get(id);
    const state = this.states.get(id);
    if (!groundImage || !state) return;
    await this.renderer.removeGroundImage(createGroundImageEntity({ groundImage, state }));
    this.groundImages.delete(id);
    this.states.delete(id);
  }
}
