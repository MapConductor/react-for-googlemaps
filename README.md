English | [日本語](./README.ja.md) | [Español (Latinoamérica)](./README.es-419.md)

# @mapconductor/react-for-googlemaps

Google Maps provider for the MapConductor React SDK. Renders a Google Map
through MapConductor's provider-independent camera, marker, and overlay API, so
the same application code can also run on MapLibre, Mapbox, Leaflet,
OpenLayers, ArcGIS, Cesium, or HERE.

## Installation

```shell
npm install @mapconductor/react-for-googlemaps
```

`@mapconductor/js-sdk-core` and `@mapconductor/js-sdk-react` (used for markers and
other shared components) are installed automatically as dependencies. Your
code imports from both directly, so with pnpm's strict (isolated)
`node_modules` — or whenever you prefer to declare everything you import —
install them explicitly instead:

```shell
npm install @mapconductor/react-for-googlemaps @mapconductor/js-sdk-core @mapconductor/js-sdk-react
```

The Maps JavaScript API is loaded at runtime via `@googlemaps/js-api-loader`;
you only need an API key from the
[Google Cloud console](https://console.cloud.google.com/google/maps-apis).

## Quick start

```tsx
import { createGeoPoint, createMapCameraPosition } from '@mapconductor/js-sdk-core';
import { Marker } from '@mapconductor/js-sdk-react';
import {
  GoogleMapDesign,
  GoogleMapView2D,
  useGoogleMapViewState,
} from '@mapconductor/react-for-googlemaps';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });

export function App() {
  const state = useGoogleMapViewState({
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    mapDesignType: GoogleMapDesign.Normal,
    cameraPosition: createMapCameraPosition({ position: TOKYO, zoom: 12 }),
  });

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <GoogleMapView2D
        state={state}
        onMapClick={point => console.log('clicked', point.latitude, point.longitude)}
        onCameraMoveEnd={camera => console.log('zoom', camera.zoom)}
      >
        <Marker position={TOKYO} />
      </GoogleMapView2D>
    </div>
  );
}
```

Use `GoogleMapView` instead of `GoogleMapView2D` for the photorealistic 3D map
view. Pass `mapId` to `useGoogleMapViewState` when your map style requires one.

## Map designs

`GoogleMapDesign` exposes `Normal` (roadmap) and `Satellite`. Switch at runtime by assigning
`state.mapDesignType = ...`.

## Related packages

- [`@mapconductor/js-sdk-core`](../js-sdk-core) — geometry, camera, and state primitives
- [`@mapconductor/js-sdk-react`](../js-sdk-react) — shared `Marker`, `Markers`, shapes, and info bubbles
