import React from "react";
import { GeoRectBounds, MapViewBaseProps, MarkerTilingOptions, PolylineTilingOptions } from "@mapconductor/js-sdk-core";
import type { GoogleMapViewStateInterface } from "./GoogleMapViewState";

export interface GoogleMapViewProps extends MapViewBaseProps<GoogleMapViewStateInterface> {
  // Web-specific
  mapId?: string;
  markerTilingOptions?: MarkerTilingOptions;
  /**
   * When the 2D map draws polylines as raster tiles ({@link PolylineTilingOptions.Default} if
   * omitted). Read when the map is created; a later value applies from the next time the
   * polylines are handed to the map. The 3D map draws every polyline itself.
   */
  polylineTilingOptions?: PolylineTilingOptions;
  style?: React.CSSProperties;
  version?: string;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
  libraries?: string;
  minZoom?: number;
  maxZoom?: number;
  /** Restricts panning/zooming so the viewport cannot leave this rectangle. */
  restrictBounds?: GeoRectBounds;
}
