[English](./README.md) | [日本語](./README.ja.md) | Español (Latinoamérica)

# @mapconductor/react-for-googlemaps

Proveedor de Google Maps para el SDK de React de MapConductor. Renderiza un mapa de Google a través de la API de cámara, marcadores y superposiciones independiente del proveedor de MapConductor, de modo que el mismo código de aplicación también puede ejecutarse en MapLibre, Mapbox, Leaflet, OpenLayers, ArcGIS, Cesium o HERE.

## Instalación

```shell
npm install @mapconductor/react-for-googlemaps
```

`@mapconductor/js-sdk-core` y `@mapconductor/js-sdk-react` (usados para marcadores y otros componentes compartidos) se instalan automáticamente como dependencias. Tu código importa directamente de ambos, así que con el `node_modules` estricto (aislado) de pnpm — o siempre que prefieras declarar todo lo que importas — instálalos explícitamente:

```shell
npm install @mapconductor/react-for-googlemaps @mapconductor/js-sdk-core @mapconductor/js-sdk-react
```

La Maps JavaScript API se carga en tiempo de ejecución mediante `@googlemaps/js-api-loader`; solo necesitas una clave de API de la [consola de Google Cloud](https://console.cloud.google.com/google/maps-apis).

## Inicio rápido

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

Usa `GoogleMapView` en lugar de `GoogleMapView2D` para la vista de mapa 3D fotorrealista. Pasa `mapId` a `useGoogleMapViewState` cuando tu estilo de mapa lo requiera.

## Diseños de mapa

`GoogleMapDesign` expone `Normal` (roadmap) y `Satellite`. Cambia en tiempo de ejecución asignando `state.mapDesignType = ...`.

## Paquetes relacionados

- [`@mapconductor/js-sdk-core`](../js-sdk-core) — primitivas de geometría, cámara y estado
- [`@mapconductor/js-sdk-react`](../js-sdk-react) — `Marker`, `Markers`, formas y burbujas de información compartidos
