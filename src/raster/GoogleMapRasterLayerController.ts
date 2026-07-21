/// <reference types="google.maps" />
import {
  RasterLayerController,
  RasterLayerManager,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapRasterLayerOverlayRenderer } from './GoogleMapRasterLayerOverlayRenderer';
import { GoogleMapRasterLayerOverlayRenderer2D } from './GoogleMapRasterLayerOverlayRenderer2D';

type GoogleMapRasterLayerRenderer =
  | GoogleMapRasterLayerOverlayRenderer
  | GoogleMapRasterLayerOverlayRenderer2D;

export class GoogleMapRasterLayerController extends RasterLayerController<google.maps.ImageMapType> {
  declare readonly renderer: GoogleMapRasterLayerRenderer;

  constructor(renderer: GoogleMapRasterLayerRenderer) {
    super({
      rasterLayerManager: new RasterLayerManager<google.maps.ImageMapType>(),
      renderer,
    });
  }

  async composition(data: RasterLayerState[]): Promise<void> {
    await this.add(data);
    this.removeInvisibleEntities(data);
  }

  override async update(state: RasterLayerState): Promise<void> {
    await super.update(state);
    if (!state.visible) {
      this.rasterLayerManager.removeEntity(state.id);
    }
  }

  async updateInternal(state: RasterLayerState): Promise<void> {
    await this.upsert(state);
    if (!state.visible) {
      this.rasterLayerManager.removeEntity(state.id);
    }
  }

  async removeInternal(id: string): Promise<void> {
    await this.removeById(id);
  }

  private removeInvisibleEntities(data: RasterLayerState[]): void {
    for (const state of data) {
      if (!state.visible) {
        this.rasterLayerManager.removeEntity(state.id);
      }
    }
  }
}
