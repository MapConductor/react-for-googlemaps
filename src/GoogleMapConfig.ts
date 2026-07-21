import { GeoRectBounds, MapConfig, MarkerTilingOptions } from "@mapconductor/js-sdk-core";

export interface GoogleMapConfig2D extends GoogleMapConfigBase {
  mapDesignType?: string;
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
