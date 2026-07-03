/// <reference types="google.maps" />
import { LocalTileServer, TileScheme, type RasterLayerState } from '@mapconductor/core';
import { GoogleMapViewHolder2D } from '../GoogleMapViewHolder2D';

const EMPTY_TILE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAASImBZsAAAAASUVORK5CYII=';

function parseLocalTileTemplate(template: string): { routeId: string; tileSize: number } | null {
  if (!template.startsWith('mc-local-tile://')) return null;
  const url = new URL(template);
  const tileSize = Number(url.pathname.split('/').filter(Boolean)[0]);
  if (!Number.isFinite(tileSize)) return null;
  return { routeId: url.hostname, tileSize };
}

export class GoogleMapRasterLayerOverlayRenderer2D {
  constructor(readonly holder: GoogleMapViewHolder2D) {}

  create(state: RasterLayerState): google.maps.ImageMapType | null {
    const mapType = this.mapTypeFromState(state);
    if (!mapType) return null;

    const insertIndex = Math.max(
      0,
      Math.min(state.zIndex, this.holder.map.overlayMapTypes.getLength()),
    );
    this.holder.map.overlayMapTypes.insertAt(insertIndex, mapType);
    return mapType;
  }

  remove(mapType: google.maps.ImageMapType): void {
    const index = this.holder.map.overlayMapTypes.getArray().indexOf(mapType);
    if (index >= 0) this.holder.map.overlayMapTypes.removeAt(index);
  }

  private mapTypeFromState(state: RasterLayerState): google.maps.ImageMapType | null {
    const { source } = state;

    switch (source.type) {
      case 'UrlTemplate': {
        const localTile = parseLocalTileTemplate(source.template);
        if (localTile) {
          return this.localTileImageMapType({
            routeId: localTile.routeId,
            tileSize: localTile.tileSize,
            opacity: state.opacity,
          });
        }

        const tileSize = source.tileSize ?? 256;
        return new google.maps.ImageMapType({
          getTileUrl: (coord, zoom) => {
            const y =
              source.scheme === TileScheme.TMS ? (1 << zoom) - 1 - coord.y : coord.y;
            return source.template
              .replace(/\{x\}/g, String(coord.x))
              .replace(/\{y\}/g, String(y))
              .replace(/\{-y\}/g, String(y))
              .replace(/\{z\}/g, String(zoom));
          },
          maxZoom: source.maxZoom ?? undefined,
          minZoom: source.minZoom ?? undefined,
          opacity: state.opacity,
          tileSize: new google.maps.Size(tileSize, tileSize),
        });
      }
      case 'ArcGisService': {
        const serviceUrl = source.serviceUrl.replace(/\/+$/, '');
        return new google.maps.ImageMapType({
          getTileUrl: (coord, zoom) => `${serviceUrl}/tile/${zoom}/${coord.y}/${coord.x}`,
          opacity: state.opacity,
          tileSize: new google.maps.Size(256, 256),
        });
      }
      case 'TileJson':
        return null;
    }
  }

  private localTileImageMapType({
    routeId,
    tileSize,
    opacity,
  }: {
    routeId: string;
    tileSize: number;
    opacity: number;
  }): google.maps.ImageMapType {
    return new google.maps.ImageMapType({
      getTileUrl: (coord, zoom) =>
        LocalTileServer.startServer().handleFetchDataUrl(routeId, {
          x: coord.x,
          y: coord.y,
          z: zoom,
        }) ?? EMPTY_TILE_DATA_URL,
      maxZoom: 22,
      minZoom: 0,
      opacity,
      tileSize: new google.maps.Size(tileSize, tileSize),
    });
  }
}
