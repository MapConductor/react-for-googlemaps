import React from "react";
import { MapViewBaseProps, MarkerTilingOptions } from "@mapconductor/js-sdk-core";
import { GoogleMapViewState } from "./GoogleMapViewState";

export interface GoogleMapsViewProps extends MapViewBaseProps<GoogleMapViewState> {
  apiKey: string;

  // Web-specific
  mapId?: string;
  markerTilingOptions?: MarkerTilingOptions;
  style?: React.CSSProperties;
  version?: string;
  onError?: (error: Error) => void;
  children?: React.ReactNode;
  libraries?: string;
}
