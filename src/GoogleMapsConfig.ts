import { MapConfig, MarkerTilingOptions } from "@mapconductor/core";

export interface GoogleMapsConfig2D extends GoogleMapsConfigBase {
  mapDesignType?: string;
}

export interface GoogleMapsConfig extends GoogleMapsConfigBase {
  mapDesignType?: 'ROADMAP' | 'HYBRID' | 'SATELLITE';
}

interface GoogleMapsConfigBase extends MapConfig {
  apiKey: string;
  version?: string;
  libraries?: string[];
  mapId?: string;
  mapDesignType?: string;
  markerTilingOptions?: MarkerTilingOptions;
}
