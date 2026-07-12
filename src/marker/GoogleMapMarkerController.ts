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
  type MarkerAnimationOverlayHost,
  type MarkerEntity,
  type MarkerState,
  type OnMarkerEventHandler,
  type RasterLayerState,
} from '@mapconductor/js-sdk-core';
import { GoogleMapActualMarker } from '../GoogleMapTypeAlias';
import { GoogleMapMarkerRenderer } from './GoogleMapMarkerRenderer';

export class GoogleMapMarkerController {
  private readonly entities = new Map<string, MarkerEntity<GoogleMapActualMarker>>();

  private clickListener: OnMarkerEventHandler | null = null;
  private dragStartListener: OnMarkerEventHandler | null = null;
  private dragListener: OnMarkerEventHandler | null = null;
  private dragEndListener: OnMarkerEventHandler | null = null;
  private animateStartListener: OnMarkerEventHandler | null = null;
  private animateEndListener: OnMarkerEventHandler | null = null;

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
    this.renderer.animateStartListener = (state) => this.dispatchAnimateStart(state);
    this.renderer.animateEndListener = (state) => this.dispatchAnimateEnd(state);
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
    void this.processChange(toChange).then(() => {
      for (const { current } of toChange) {
        if (current.state.getAnimation() == null) continue;
        const entity = this.entities.get(current.state.id);
        if (entity) void this.renderer.onAnimate(entity);
      }
    });
    void this.renderer.onPostProcess();
  }

  update(state: MarkerState): void {
    const bitmapIcon = state.icon?.toBitmapIcon() ?? createDefaultIcon().toBitmapIcon();
    const existing = this.entities.get(state.id);
    if (existing) {
      const prevAnimation = existing.state.getAnimation();
      void this.processChange([{
        current: createMarkerEntity({ marker: existing.marker, state }),
        prev: existing,
        bitmapIcon,
      }]).then(() => {
        if (prevAnimation !== state.getAnimation() && state.getAnimation() != null) {
          const entity = this.entities.get(state.id);
          if (entity) void this.renderer.onAnimate(entity);
        }
      });
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

  setMarkerAnimationOverlayHost(host: MarkerAnimationOverlayHost | null): void {
    this.renderer.animationOverlayHost = host;
  }

  private dispatchAnimateStart(state: MarkerState): void {
    state.onAnimateStart?.(state);
    this.animateStartListener?.(state);
  }

  private dispatchAnimateEnd(state: MarkerState): void {
    state.onAnimateEnd?.(state);
    this.animateEndListener?.(state);
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
      if (state.getAnimation() != null) {
        void this.renderer.onAnimate(entity);
      }
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

  private attachListeners(marker: GoogleMapActualMarker, state: MarkerState): void {
    google.maps.event.clearInstanceListeners(marker);
    if (!(marker instanceof HTMLElement)) return;
    const source = (marker as HTMLElement).firstElementChild;
    const DRAG_THRESHOLD_PX = 5;
    const CLICK_MAX_MS = 1000;
    let mousedownStartTime = 0;
    let downX = 0;
    let downY = 0;
    let dragging = false;

    // Pointer position relative to the map container — the coordinate space
    // that fromScreenOffsetSync() expects.
    const toMapOffset = (event: MouseEvent) => {
      const rect = this.renderer.holder.map.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onWindowMouseMove = (event: MouseEvent) => {
      if (!dragging) {
        // Ignore jitter within the threshold so a sloppy click doesn't become a drag.
        if (Math.hypot(event.clientX - downX, event.clientY - downY) < DRAG_THRESHOLD_PX) return;
        dragging = true;
        state.onDragStart?.(state);
        this.dragStartListener?.(state);
      }
      event.preventDefault();
      const position = this.renderer.holder.fromScreenOffsetSync(toMapOffset(event));
      if (position) {
        state.setPosition(position);
        state.onDrag?.(state);
        this.dragListener?.(state);
      }
    };

    const onWindowMouseUp = (event: MouseEvent) => {
      window.removeEventListener('mousemove', onWindowMouseMove, true);
      window.removeEventListener('mouseup', onWindowMouseUp, true);
      if (dragging) {
        dragging = false;
        event.stopPropagation();
        state.onDragEnd?.(state);
        this.dragEndListener?.(state);
        return;
      }
      const moved = Math.hypot(event.clientX - downX, event.clientY - downY) >= DRAG_THRESHOLD_PX;
      if (!moved && Date.now() - mousedownStartTime < CLICK_MAX_MS) {
        // Fire a 'fake' click event.
        event.stopPropagation();
        this.dispatchClick(state);
      }
    };

    source?.addEventListener('mousedown', (event) => {
      // Keep the map from treating this as a camera pan, and suppress
      // text selection / native image drag.
      event.stopPropagation();
      event.preventDefault();
      mousedownStartTime = Date.now();
      downX = (event as MouseEvent).clientX;
      downY = (event as MouseEvent).clientY;
      dragging = false;
      // The icon is small: track the rest of the gesture on window so the
      // drag survives the pointer outrunning the marker element.
      if (state.draggable) {
        window.addEventListener('mousemove', onWindowMouseMove, true);
      }
      window.addEventListener('mouseup', onWindowMouseUp, true);
    });


    // if (this.renderer.clickEventName) {
    //   marker.addEventListener(this.renderer.clickEventName, (event: Event) => {
    //     event.stopPropagation();
    //     state.onClick?.(state);
    //     this.clickListener?.(state);
    //   });
    // }
    // if (this.renderer.dragstartEventName) {
    //   marker.addEventListener(this.renderer.dragstartEventName, () => {
    //     this.renderer.syncPositionToState(marker, state);
    //     state.onDragStart?.(state);
    //     this.dragStartListener?.(state);
    //   });
    // }
    // if (this.renderer.dragEventName) {
    //   marker.addEventListener(this.renderer.dragEventName, () => {
    //     this.renderer.syncPositionToState(marker, state);
    //     state.onDrag?.(state);
    //     this.dragListener?.(state);
    //   });
    // }
    // if (this.renderer.dragendEventName) {
    //   marker.addEventListener(this.renderer.dragendEventName, () => {
    //     this.renderer.syncPositionToState(marker, state);
    //     state.onDragEnd?.(state);
    //     this.dragEndListener?.(state);
    //   });
    // }
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}
