import type React from 'react';
import type { HostComponent, NativeMethods } from 'react-native';
import type { NativeGoogleMapViewProps } from './GoogleMapViewNativeComponent';

export type GoogleMapViewRef =
  React.ComponentRef<HostComponent<NativeGoogleMapViewProps>> & NativeMethods;
export type GoogleMapMapView = GoogleMapViewRef | null;
export type GoogleMapMap = null;
