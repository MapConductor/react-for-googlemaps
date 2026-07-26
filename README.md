English | [日本語](https://github.com/MapConductor/react-for-googlemaps/blob/main/README.ja.md) | [Español (Latinoamérica)](https://github.com/MapConductor/react-for-googlemaps/blob/main/README.es-419.md)

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

![](https://raw.githubusercontent.com/mapconductor/react-for-googlemaps/docs/images/hello-map.jpg)

## Hello Map tutorial

The simplest possible map app, built with MapConductor + Google Maps: click the
marker and a "Hello, MapConductor" bubble pops up. You can build it in the 5
steps below. Google Maps requires an API key, so just add your own Google Maps
API key and it works.

### Step 1: Create a React project

Create a React + TypeScript project with Vite.

```shell
npm create vite@latest hello-map -- --template react-ts
cd hello-map
npm install
npm run dev
```

### Step 2: Install MapConductor (Google Maps)

Install the package needed to show a map. We use Google Maps here, but you can
use other map modules too.

```shell
npm install @mapconductor/react-for-googlemaps
```

- `@mapconductor/react-for-googlemaps` — components / hooks for Google Maps
- `@mapconductor/js-sdk-react` / `@mapconductor/js-sdk-core` are installed
  automatically as dependencies.
- You'll also need an API key from the
  [Google Cloud console](https://console.cloud.google.com/google/maps-apis),
  set as the `VITE_GOOGLE_MAPS_API_KEY` environment variable.

### Step 3: Show the map

Create the map state with `useGoogleMapViewState` and render it with
`<GoogleMapView2D>`. Give the outer element a height to make it full-screen.

```tsx
import {
  GoogleMapDesign,
  GoogleMapView2D,
  useGoogleMapViewState,
} from '@mapconductor/react-for-googlemaps';
import { createGeoPoint, createMapCameraPosition } from '@mapconductor/js-sdk-core';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });
const INITIAL_CAMERA = createMapCameraPosition({ position: TOKYO, zoom: 14 });

export default function App() {
  const mapViewState = useGoogleMapViewState({
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    mapDesignType: GoogleMapDesign.Normal,
    cameraPosition: INITIAL_CAMERA,
  });

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GoogleMapView2D state={mapViewState} />
    </div>
  );
}
```

Use `GoogleMapView` instead of `GoogleMapView2D` for the photorealistic 3D map view.

### Step 4: Place a marker

Create the marker state with `createMarkerState` and register it with
`<Marker>`. Write overlays as **child elements** of the map component.

```tsx
import { useMemo } from 'react';
import { createMarkerState } from '@mapconductor/js-sdk-core';
import { Marker } from '@mapconductor/js-sdk-react';

// ...inside App...
const marker = useMemo(
  () => createMarkerState({ id: 'hello', position: TOKYO }),
  [],
);

// ...inside return...
<GoogleMapView2D state={mapViewState}>
  <Marker state={marker} />
</GoogleMapView2D>
```

### Step 5: Show an InfoBubble on click

Track the selected state with `useState`, set it to true in the marker's
`onClick`, and render `<InfoBubble>` only while selected. This is the finished
app.

```tsx
import { useMemo, useState } from 'react';
import {
  GoogleMapDesign,
  GoogleMapView2D,
  useGoogleMapViewState,
} from '@mapconductor/react-for-googlemaps';
import {
  createGeoPoint,
  createMapCameraPosition,
  createMarkerState,
} from '@mapconductor/js-sdk-core';
import { InfoBubble, Marker } from '@mapconductor/js-sdk-react';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });
const INITIAL_CAMERA = createMapCameraPosition({ position: TOKYO, zoom: 14 });

export default function App() {
  const mapViewState = useGoogleMapViewState({
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    mapDesignType: GoogleMapDesign.Normal,
    cameraPosition: INITIAL_CAMERA,
  });

  const [selected, setSelected] = useState(false);

  const marker = useMemo(
    () => createMarkerState({
      id: 'hello',
      position: TOKYO,
      onClick: () => setSelected(true),
    }),
    [],
  );

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <GoogleMapView2D state={mapViewState} onMapClick={() => setSelected(false)}>
        <Marker state={marker} />
        {selected && (
          <InfoBubble marker={marker}>
            <div style={{ padding: '8px 12px', fontWeight: 600 }}>
              Hello, MapConductor
            </div>
          </InfoBubble>
        )}
      </GoogleMapView2D>
    </div>
  );
}
```

### Key points

- Coordinates, cameras and markers are created with `js-sdk-core` functions
  (**provider-independent**).
- The map component and hooks come from `react-for-googlemaps`
  (**provider-specific**).
- Write overlays as **child elements** of the map component.
- Control show / hide with React `useState`.

## Related packages

- [`@mapconductor/js-sdk-core`](https://github.com/mapconductor/js-sdk-core) — geometry, camera, and state primitives
- [`@mapconductor/js-sdk-react`](https://github.com/mapconductor/js-sdk-react) — shared `Marker`, `Markers`, shapes, and info bubbles
