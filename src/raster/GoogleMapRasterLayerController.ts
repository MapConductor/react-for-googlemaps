/// <reference types="google.maps" />
import { type RasterLayerState } from '@mapconductor/js-sdk-core';
import { GoogleMapRasterLayerOverlayRenderer } from './GoogleMapRasterLayerOverlayRenderer';
import { GoogleMapRasterLayerOverlayRenderer2D } from './GoogleMapRasterLayerOverlayRenderer2D';

export class GoogleMapRasterLayerController {
  private readonly rasterLayers = new Map<string, google.maps.ImageMapType>();
  private readonly internalLayerIds = new Set<string>();

  constructor(readonly renderer: GoogleMapRasterLayerOverlayRenderer | GoogleMapRasterLayerOverlayRenderer2D) {
  }

  composition(data: RasterLayerState[]): void {
    const newIds = new Set(data.map((s) => s.id));
    for (const id of [...this.rasterLayers.keys()]) {
      if (this.internalLayerIds.has(id)) continue;
      if (!newIds.has(id)) this.removeById(id);
    }
    for (const state of data) this.upsert(state);
  }

  update(state: RasterLayerState): void {
    this.upsert(state);
  }

  has(state: RasterLayerState): boolean {
    return this.rasterLayers.has(state.id);
  }

  clear(): void {
    for (const id of [...this.rasterLayers.keys()]) this.removeById(id);
  }

  updateInternal(state: RasterLayerState): void {
    this.internalLayerIds.add(state.id);
    this.upsert(state);
  }

  removeInternal(id: string): void {
    this.internalLayerIds.delete(id);
    this.removeById(id);
  }

  private upsert(state: RasterLayerState): void {
    this.removeById(state.id);
    if (!state.visible) return;

    const imageMapType = this.renderer.create(state);
    if (!imageMapType) return;

    this.rasterLayers.set(state.id, imageMapType);
  }

  private removeById(id: string): void {
    const imageMapType = this.rasterLayers.get(id);
    if (!imageMapType) return;
    this.renderer.remove(imageMapType);
    this.rasterLayers.delete(id);
  }
}
