import React from "react";
import { GeoRectBounds, MapViewBaseProps, MarkerTilingOptions } from "@mapconductor/js-sdk-core";
import type { GoogleMapViewStateInterface } from "./GoogleMapViewState";

export interface GoogleMapViewProps extends MapViewBaseProps<GoogleMapViewStateInterface> {
  // Web-specific
  mapId?: string;
  markerTilingOptions?: MarkerTilingOptions;
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
