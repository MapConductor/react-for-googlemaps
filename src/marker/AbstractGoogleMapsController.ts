import {
  AbstractMarkerController,
  createRasterLayerState,
  LocalTileServer,
  MARKER_HIT_RADIUS_MOUSE_PX,
  MarkerManager,
  MarkerTileRenderer,
  MarkerTilingOptions,
  RasterLayerSource,
  tilePixelRatio,
  type GeoPoint,
  type MarkerEntity,
  type MarkerState,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import { localTileUrlTemplate } from '../raster/localTileUrl';
import { GoogleMapMarkerRendererInterface } from './GoogleMapMarkerRendererInterface';

export abstract class AbstractGoogleMapsController<
  ActualMarker,
  Renderer extends GoogleMapMarkerRendererInterface<ActualMarker> = GoogleMapMarkerRendererInterface<ActualMarker>,
> extends AbstractMarkerController<ActualMarker> {
  declare readonly renderer: Renderer;

  private tileRenderer: MarkerTileRenderer<MarkerState> | null = null;
  private tileRouteId: string | null = null;
  private tileVersion = 0;
  /** Device pixels per CSS pixel the current tiles are drawn at. */
  private tilePixelRatio = 1;
  // Bumped on every syncTiledOverlay()/removeTileOverlay() call. syncTiledOverlay
  // awaits SW round-trips, so an earlier call must not overwrite a newer result.
  private tileGeneration = 0;

  /** Called by GoogleMapViewController when RasterLayerState changes. */
  onRasterLayerUpdate: ((state: RasterLayerState | null) => Promise<void>) | null = null;

  constructor(
    renderer: Renderer,
    private readonly tilingOptions: MarkerTilingOptions = MarkerTilingOptions.Default,
  ) {
    super({
      markerManager: MarkerManager.defaultManager<ActualMarker>(
        null,
        tilingOptions.minMarkerCount,
      ),
      renderer,
    });
  }

  findTiled(position: GeoPoint, zoom: number): MarkerEntity<ActualMarker> | null {
    const found = this.tileRenderer?.findNearest(
      position,
      MARKER_HIT_RADIUS_MOUSE_PX,
      zoom,
    );
    return found ? this.markerManager.getEntity(found.id) : null;
  }

  override async clear(): Promise<void> {
    await super.clear();
    await this.removeTileOverlay();
  }

  protected override shouldTile(state: MarkerState, totalCount: number): boolean {
    return (
      this.tilingOptions.enabled &&
      totalCount >= this.tilingOptions.minMarkerCount &&
      !state.draggable &&
      state.getAnimation() == null
    );
  }

  protected override async onTiledMarkersChanged(): Promise<void> {
    await this.syncTiledOverlay();
  }

  protected override onMarkerAdded(entity: MarkerEntity<ActualMarker>): void {
    if (entity.marker) {
      this.attachListeners(entity.marker, entity.state);
    }
  }

  protected abstract attachListeners(marker: ActualMarker, state: MarkerState): void;

  private async syncTiledOverlay(): Promise<void> {
    const generation = ++this.tileGeneration;
    const tiledStates = this.markerManager
      .allEntities()
      .filter(entity => entity.tiling)
      .map((entity) => entity.state);

    if (tiledStates.length === 0) {
      await this.removeTileOverlay();
      return;
    }

    if (!this.tileRouteId) {
      this.tileRouteId = `mc-tile-${generateId()}`;
    }

    const server = LocalTileServer.startServer();
    const { iconScaleCallback } = this.tilingOptions;
    // Tiles are laid out as 256 CSS pixels; drawing them at the display's ratio
    // keeps pins and labels sharp instead of stretching a 1x image.
    this.tilePixelRatio = tilePixelRatio();
    const tileRenderer = new MarkerTileRenderer<MarkerState>(
      tiledStates,
      256,
      iconScaleCallback ?? undefined,
      1.0,
      false,
      this.tilingOptions.declutterPx,
      this.tilePixelRatio,
    );
    this.tileRenderer = tileRenderer;
    this.tileVersion++;
    server.register(this.tileRouteId, tileRenderer);

    const template = LocalTileServer.isServiceWorkerSupported()
      ? await this.serviceWorkerTileTemplate(server, tileRenderer)
      : await this.localTileTemplate(tileRenderer);

    if (generation !== this.tileGeneration) return;

    const rasterState = createRasterLayerState({
      id: 'mc-marker-tiles',
      source: RasterLayerSource.UrlTemplate({
        template,
        tileSize: 256,
      }),
    });
    await this.onRasterLayerUpdate?.(rasterState);
  }

  private async serviceWorkerTileTemplate(
    server: LocalTileServer,
    tileRenderer: MarkerTileRenderer<MarkerState>,
  ): Promise<string> {
    server.startServiceWorker('/tile-sw.js');
    await server.waitForController();
    await server.sendSWRegisterAndWait(this.tileRouteId!, await tileRenderer.toSWData());
    return server.urlTemplate({
      routeId: this.tileRouteId!,
      tileSize: 256,
      cacheKey: String(this.tileVersion),
      pixelRatio: this.tilePixelRatio,
    });
  }

  private async localTileTemplate(tileRenderer: MarkerTileRenderer<MarkerState>): Promise<string> {
    await tileRenderer.preloadIcons();
    return localTileUrlTemplate({
      routeId: this.tileRouteId!,
      tileSize: 256,
      cacheKey: String(this.tileVersion),
      pixelRatio: this.tilePixelRatio,
    });
  }

  private async removeTileOverlay(): Promise<void> {
    this.tileGeneration++;
    if (!this.tileRouteId) return;
    LocalTileServer.startServer().unregister(this.tileRouteId);
    this.tileRenderer = null;
    this.tileRouteId = null;
    await this.onRasterLayerUpdate?.(null);
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}
