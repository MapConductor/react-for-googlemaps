import React from "react";
import { MapViewBaseProps, MarkerTilingOptions } from "@mapconductor/js-sdk-core";
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
}
