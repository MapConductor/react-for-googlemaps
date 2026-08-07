/// <reference types="google.maps" />
import {
  RasterLayerController,
  RasterLayerManager,
  type RasterLayerState,
  type RasterHeaderSupport,
} from '@mapconductor/js-sdk-core';
import { GoogleMapRasterLayerOverlayRenderer } from './GoogleMapRasterLayerOverlayRenderer';
import { GoogleMapRasterLayerOverlayRenderer2D } from './GoogleMapRasterLayerOverlayRenderer2D';

type GoogleMapRasterLayerRenderer =
  | GoogleMapRasterLayerOverlayRenderer
  | GoogleMapRasterLayerOverlayRenderer2D;

export class GoogleMapRasterLayerController extends RasterLayerController<google.maps.ImageMapType> {
  /**
   * ImageMapType は getTileUrl で URL を返すだけで、タイルの取得は Maps JS が img で行う。
   * リクエストに介入する口が無い。android / ios は自前でタイルを取りに行くので対応済み。
   *
   * userAgent はブラウザが上書きを許さないので、どのプロバイダでも web では効かない。
   */
  protected override get headerSupport(): RasterHeaderSupport {
    return { provider: 'Google Maps', extraHeaders: false };
  }

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
