/// <reference types="google.maps" />
import {
  CircleController,
  CircleManager,
  createGeoPoint,
  type CircleEntity,
  type CircleEvent,
  type CircleState,
  type OnCircleEventHandler,
} from '@mapconductor/js-sdk-core';
import { mouseEventToGeoPoint } from '../helpers';
import { GoogleMapActualCircle } from '../GoogleMapTypeAlias';
import { GoogleMapCircleOverlayRenderer } from './GoogleMapCircleOverlayRenderer';
import { GoogleMapCircleOverlayRenderer2D } from './GoogleMapCircleOverlayRenderer2D';

type GoogleMapCircleRenderer =
  | GoogleMapCircleOverlayRenderer
  | GoogleMapCircleOverlayRenderer2D;

export class GoogleMapCircleController extends CircleController<GoogleMapActualCircle> {
  declare readonly renderer: GoogleMapCircleRenderer;

  private readonly clickCleanups = new Map<string, () => void>();

  constructor(renderer: GoogleMapCircleRenderer) {
    super({
      circleManager: new CircleManager<GoogleMapActualCircle>(),
      renderer,
    });
  }

  async composition(data: CircleState[]): Promise<void> {
    await this.add(data);
  }

  override async add(data: CircleState[]): Promise<void> {
    const newIds = new Set(data.map((state) => state.id));
    for (const entity of this.circleManager.allEntities()) {
      if (!newIds.has(entity.state.id)) {
        this.clearClickHandler(entity.state.id, entity.circle);
      }
    }

    await super.add(data);

    for (const entity of this.circleManager.allEntities()) {
      this.setClickHandler(entity);
    }
  }

  override async update(state: CircleState): Promise<void> {
    await super.update(state);
    const entity = this.circleManager.getEntity(state.id);
    if (entity) this.setClickHandler(entity);
  }

  has(state: CircleState): boolean {
    return this.circleManager.hasEntity(state.id);
  }

  setOnClickListener(listener: OnCircleEventHandler | null): void {
    this.clickListener = listener;
  }

  override async clear(): Promise<void> {
    for (const entity of this.circleManager.allEntities()) {
      this.clearClickHandler(entity.state.id, entity.circle);
    }
    await super.clear();
  }

  private setClickHandler(entity: CircleEntity<GoogleMapActualCircle>): void {
    const { circle, state } = entity;
    this.clearClickHandler(state.id, circle);

    if (circle instanceof HTMLElement) {
      const listener = (event: Event) => {
        if (!state.clickable) return;
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
      circle.addEventListener('gmp-click', listener);
      this.clickCleanups.set(
        state.id,
        () => circle.removeEventListener('gmp-click', listener),
      );
      return;
    }

    google.maps.event.clearInstanceListeners(circle);
    circle.addListener('click', (event: google.maps.MapMouseEvent) => {
      const clicked = mouseEventToGeoPoint(event);
      if (!clicked) return;
      const circleEvent: CircleEvent = { state, clicked };
      this.dispatchClick(circleEvent);
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
