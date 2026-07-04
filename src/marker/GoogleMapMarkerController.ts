/// <reference types="google.maps" />
import {
  createDefaultIcon,
  createMarkerEntity,
  createRasterLayerState,
  LocalTileServer,
  MARKER_HIT_RADIUS_MOUSE_PX,
  MarkerTileRenderer,
  MarkerTilingOptions,
  RasterLayerSource,
  type AddParams,
  type ChangeParams,
  type GeoPoint,
  type MarkerEntity,
  type MarkerState,
  type OnMarkerEventHandler,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapActualMarker } from '../GoogleMapsTypeAlias';
import { GoogleMapMarkerRenderer } from './GoogleMapMarkerRenderer';

export class GoogleMapMarkerController {
  private readonly entities = new Map<string, MarkerEntity<GoogleMapActualMarker>>();

  private clickListener: OnMarkerEventHandler | null = null;

  // ── Tile rendering ────────────────────────────────────────────────────────
  private tileRenderer: MarkerTileRenderer<MarkerState> | null = null;
  private tileRouteId: string | null = null;
  private tileVersion = 0;
  // Bumped on every syncTiledOverlay()/removeTileOverlay() call. syncTiledOverlay
  // awaits SW round-trips, so a later call (or clear()/destroy()) can finish first;
  // an earlier call resuming afterward must not clobber the newer result.
  private tileGeneration = 0;

  /** Called by GoogleMapViewController when RasterLayerState changes. */
  onRasterLayerUpdate: ((state: RasterLayerState | null) => Promise<void>) | null = null;

  constructor(
    private readonly renderer: GoogleMapMarkerRenderer,
    private readonly tilingOptions: MarkerTilingOptions = MarkerTilingOptions.Default) {
  }

  composition(data: MarkerState[]): void {
    const totalCount = data.length;
    const tilingEnabled =
      this.tilingOptions.enabled &&
      totalCount >= this.tilingOptions.minMarkerCount;

    const newIds = new Set(data.map((s) => s.id));

    // Remove entities no longer in data
    const toRemove: MarkerEntity<GoogleMapActualMarker>[] = [];
    for (const [id, entity] of this.entities) {
      if (!newIds.has(id)) {
        toRemove.push(entity);
        this.entities.delete(id);
      }
    }
    const rendererRemove = toRemove.filter((entity) => entity.marker !== null);
    if (rendererRemove.length > 0) {
      void this.renderer.onRemove(rendererRemove);
    }

    const toAdd: AddParams[] = [];
    const toChange: ChangeParams<GoogleMapActualMarker>[] = [];
    let hasTiled = false;

    for (const state of data) {
      const wantsTile =
        tilingEnabled && !state.draggable && state.getAnimation() == null;
      const bitmapIcon = state.icon?.toBitmapIcon() ?? createDefaultIcon().toBitmapIcon();
      const existing = this.entities.get(state.id);

      if (wantsTile) {
        hasTiled = true;
        if (existing && existing.marker !== null) {
          // Transition: regular → tiled — remove the actual marker from the map
          void this.renderer.onRemove([existing]);
        }
        this.entities.set(
          state.id,
          createMarkerEntity<GoogleMapActualMarker>({ marker: null, state, isRendered: true, visible: true }),
        );
      } else {
        if (existing?.marker === null) {
          // Transition: tiled → regular — need to add to map
          toAdd.push({ state, bitmapIcon });
        } else if (existing) {
          toChange.push({
            current: createMarkerEntity({ marker: existing.marker, state }),
            prev: existing,
            bitmapIcon,
          });
        } else {
          toAdd.push({ state, bitmapIcon });
        }
      }
    }

    if (hasTiled) {
      void this.syncTiledOverlay();
    } else {
      void this.removeTileOverlay();
    }

    void this.processAdd(toAdd);
    void this.processChange(toChange);
    void this.renderer.onPostProcess();
  }

  update(state: MarkerState): void {
    const bitmapIcon = state.icon?.toBitmapIcon() ?? createDefaultIcon().toBitmapIcon();
    const existing = this.entities.get(state.id);
    if (existing) {
      void this.processChange([{
        current: createMarkerEntity({ marker: existing.marker, state }),
        prev: existing,
        bitmapIcon,
      }]);
    } else {
      void this.processAdd([{ state, bitmapIcon }]);
    }
    void this.renderer.onPostProcess();
  }

  has(state: MarkerState): boolean {
    return this.entities.has(state.id);
  }

  setOnClickListener(listener: OnMarkerEventHandler | null): void {
    this.clickListener = listener;
  }

  setOnDragStart(_listener: OnMarkerEventHandler | null): void {
    
  }

  setOnDrag(_listener: OnMarkerEventHandler | null): void {
    
  }

  setOnDragEnd(_listener: OnMarkerEventHandler | null): void {
    
  }

  clear(): void {
    const all = [...this.entities.values()];
    this.entities.clear();
    const rendered = all.filter((e) => e.marker !== null);
    if (rendered.length > 0) void this.renderer.onRemove(rendered);
    void this.removeTileOverlay();
  }

  /**
   * Find the nearest tiled marker to `position` for click hit-testing.
   * Returns null if tile rendering is inactive or no marker is within the hit radius.
   */
  findTiled(position: GeoPoint, zoom: number): MarkerEntity<GoogleMapActualMarker> | null {
    if (!this.tileRenderer) return null;
    const found = this.tileRenderer.findNearest(position, MARKER_HIT_RADIUS_MOUSE_PX, zoom);
    if (!found) return null;
    return this.entities.get(found.id) ?? null;
  }

  dispatchClick(state: MarkerState): void {
    state.onClick?.(state);
    this.clickListener?.(state);
  }

  // ── Tile overlay ─────────────────────────────────────────────────────────

  private async syncTiledOverlay(): Promise<void> {
    const generation = ++this.tileGeneration;

    const tiledStates = [...this.entities.values()]
      .filter((e) => e.marker === null)
      .map((e) => e.state);

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

    // A newer sync (or clear()/destroy(), which unregisters our route and
    // bumps the generation) already ran while we were awaiting the SW
    // round-trip. Applying our (stale) result now would either resurrect a
    // removed overlay or overwrite a newer one — bail out.
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

  /**
   * ImageMapType.getTileUrl must return synchronously, so icons need to be
   * fully decoded before this template is used (renderTileDataUrl() skips
   * markers whose icon isn't decoded yet, which would flash empty on first
   * paint otherwise).
   */
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

  // ── Private helpers ───────────────────────────────────────────────────────

  private async processAdd(params: AddParams[]): Promise<void> {
    if (params.length === 0) return;
    const markers = await this.renderer.onAdd(params);
    for (let i = 0; i < params.length; i++) {
      const marker = markers[i];
      if (!marker) continue;
      const { state } = params[i];
      const entity = createMarkerEntity({ marker, state, isRendered: true });
      this.entities.set(state.id, entity);
      this.attachListeners(marker, state);
    }
  }

  private async processChange(params: ChangeParams<GoogleMapActualMarker>[]): Promise<void> {
    if (params.length === 0) return;
    const markers = await this.renderer.onChange(params);
    for (let i = 0; i < params.length; i++) {
      const marker = markers[i];
      if (!marker) continue;
      const { state } = params[i].current;
      const entity = createMarkerEntity({ marker, state, isRendered: true });
      this.entities.set(state.id, entity);
    }
  }

  private attachListeners(marker: GoogleMapActualMarker, _state: MarkerState): void {
    google.maps.event.clearInstanceListeners(marker);
    // marker.addListener('click', () => {
    //   state.onClick?.(state);
    //   this.clickListener?.(state);
    // });
    // marker.addListener('dragstart', () => {
    //   this.renderer.syncPositionToState(marker, state);
    //   state.onDragStart?.(state);
    //   this.dragStartListener?.(state);
    // });
    // marker.addListener('drag', () => {
    //   this.renderer.syncPositionToState(marker, state);
    //   state.onDrag?.(state);
    //   this.dragListener?.(state);
    // });
    // marker.addListener('dragend', () => {
    //   this.renderer.syncPositionToState(marker, state);
    //   state.onDragEnd?.(state);
    //   this.dragEndListener?.(state);
    // });
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}
