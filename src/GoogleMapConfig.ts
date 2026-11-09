import { GeoRectBounds, MapConfig, MarkerTilingOptions, PolylineTilingOptions } from "@mapconductor/js-sdk-core";

export interface GoogleMapConfig2D extends GoogleMapConfigBase {
  mapDesignType?: string;
  /**
   * When to draw polylines as raster tiles; {@link PolylineTilingOptions.Default} if omitted.
   * The controller's `setPolylineTilingOptions` replaces it later.
   */
  polylineTilingOptions?: PolylineTilingOptions;
}

export interface GoogleMapConfig extends GoogleMapConfigBase {
  mapDesignType?: 'ROADMAP' | 'HYBRID' | 'SATELLITE';
}

interface GoogleMapConfigBase extends MapConfig {
  apiKey: string;
  version?: string;
  libraries?: string[];
  mapId?: string;
  mapDesignType?: string;
  markerTilingOptions?: MarkerTilingOptions;
  minZoom?: number;
  maxZoom?: number;
  /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
  restrictBounds?: GeoRectBounds;
}
