import {
  AbstractMarkerController,
  createRasterLayerState,
  LocalTileServer,
  MARKER_HIT_RADIUS_MOUSE_PX,
  MarkerManager,
  MarkerTileRenderer,
  MarkerTilingOptions,
  RasterLayerSource,
  type GeoPoint,
  type MarkerEntity,
  type MarkerState,
  type OnMarkerEventHandler,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapMarkerRendererInterface } from './GoogleMapMarkerRendererInterface';

export abstract class AbstractGoogleMapsController<
  ActualMarker,
  Renderer extends GoogleMapMarkerRendererInterface<ActualMarker> = GoogleMapMarkerRendererInterface<ActualMarker>,
> extends AbstractMarkerController<ActualMarker> {
  declare readonly renderer: Renderer;

  private tileRenderer: MarkerTileRenderer<MarkerState> | null = null;
  private tileRouteId: string | null = null;
  private tileVersion = 0;
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

  async composition(data: MarkerState[]): Promise<void> {
    await this.add(data);
  }

  has(state: MarkerState): boolean {
    return this.markerManager.hasEntity(state.id);
  }

  override find(position: GeoPoint): MarkerEntity<ActualMarker> | null {
    return this.markerManager.findNearest(position);
  }

  findTiled(position: GeoPoint, zoom: number): MarkerEntity<ActualMarker> | null {
    const found = this.tileRenderer?.findNearest(
      position,
      MARKER_HIT_RADIUS_MOUSE_PX,
      zoom,
    );
    return found ? this.markerManager.getEntity(found.id) : null;
  }

  setOnClickListener(listener: OnMarkerEventHandler | null): void {
    this.clickListener = listener;
  }

  setOnDragStart(listener: OnMarkerEventHandler | null): void {
    this.dragStartListener = listener;
  }

  setOnDrag(listener: OnMarkerEventHandler | null): void {
    this.dragListener = listener;
  }

  setOnDragEnd(listener: OnMarkerEventHandler | null): void {
    this.dragEndListener = listener;
  }

  setOnAnimateStart(listener: OnMarkerEventHandler | null): void {
    this.animateStartListener = listener;
  }

  setOnAnimateEnd(listener: OnMarkerEventHandler | null): void {
    this.animateEndListener = listener;
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
      .filter((entity) => entity.marker === null)
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
    const tileRenderer = new MarkerTileRenderer<MarkerState>(tiledStates, {
      tileSize: 256,
      iconScaleCallback: iconScaleCallback ?? undefined,
    });
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
    });
  }

  private async localTileTemplate(tileRenderer: MarkerTileRenderer<MarkerState>): Promise<string> {
    await tileRenderer.preloadIcons();
    return `mc-local-tile://${this.tileRouteId}/256/${this.tileVersion}/{z}/{x}/{y}.png`;
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
