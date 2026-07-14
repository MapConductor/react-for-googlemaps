/// <reference types="google.maps" />
import {
  GroundImageController,
  GroundImageManager,
  type GroundImageEntity,
  type GroundImageEvent,
  type GroundImageState,
  type OnGroundImageEventHandler,
} from '@mapconductor/js-sdk-core';
import { mouseEventToGeoPoint } from '../helpers';
import { GoogleMapGroundImageOverlayRenderer } from './GoogleMapGroundImageOverlayRenderer';
import { GoogleMapGroundImageOverlayRenderer2D } from './GoogleMapGroundImageOverlayRenderer2D';

type GoogleMapGroundImageRenderer =
  | GoogleMapGroundImageOverlayRenderer
  | GoogleMapGroundImageOverlayRenderer2D;

export class GoogleMapGroundImageController extends GroundImageController<google.maps.GroundOverlay> {
  declare readonly renderer: GoogleMapGroundImageRenderer;

  constructor(renderer: GoogleMapGroundImageRenderer) {
    super({
      groundImageManager: new GroundImageManager<google.maps.GroundOverlay>(),
      renderer,
    });
  }

  async composition(data: GroundImageState[]): Promise<void> {
    await this.add(data);
  }

  override async add(data: GroundImageState[]): Promise<void> {
    await super.add(data);
    for (const entity of this.groundImageManager.allEntities()) {
      this.setClickHandler(entity);
    }
  }

  override async update(state: GroundImageState): Promise<void> {
    await super.update(state);
    const entity = this.groundImageManager.getEntity(state.id);
    if (entity) this.setClickHandler(entity);
  }

  has(state: GroundImageState): boolean {
    return this.groundImageManager.hasEntity(state.id);
  }

  setOnClickListener(listener: OnGroundImageEventHandler | null): void {
    this.clickListener = listener;
  }

  private setClickHandler(entity: GroundImageEntity<google.maps.GroundOverlay>): void {
    const { groundImage, state } = entity;
    google.maps.event.clearInstanceListeners(groundImage);
    groundImage.addListener('click', (event: google.maps.MapMouseEvent) => {
      const groundImageEvent: GroundImageEvent = {
        state,
        clicked: mouseEventToGeoPoint(event),
      };
      this.dispatchClick(groundImageEvent);
    });
  }
}
