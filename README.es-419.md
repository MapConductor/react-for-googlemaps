[English](https://github.com/MapConductor/react-for-googlemaps/blob/main/README.md) | [日本語](https://github.com/MapConductor/react-for-googlemaps/blob/main/README.ja.md) | Español (Latinoamérica)

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

![](https://raw.githubusercontent.com/mapconductor/react-for-googlemaps/docs/images/hello-map.jpg)

## Tutorial Hello Map

La aplicación de mapa más sencilla posible, creada con MapConductor + Google Maps: haz clic en el marcador y aparecerá un globo "Hello, MapConductor". Puedes crear este mapa en los 5 pasos siguientes. Google Maps requiere una clave de API, así que solo añade tu propia clave de API de Google Maps y funciona.

### Paso 1: Crea un proyecto React

Crea un proyecto React + TypeScript con Vite.

```shell
npm create vite@latest hello-map -- --template react-ts
cd hello-map
npm install
npm run dev
```

### Paso 2: Instala MapConductor (Google Maps)

Instala el paquete necesario para mostrar un mapa. Aquí usamos Google Maps, pero también puedes usar otros módulos de mapas.

```shell
npm install @mapconductor/react-for-googlemaps
```

- `@mapconductor/react-for-googlemaps` — componentes / hooks para Google Maps
- `@mapconductor/js-sdk-react` / `@mapconductor/js-sdk-core` se instalan
  automáticamente como dependencias.
- También necesitarás una clave de API de la
  [consola de Google Cloud](https://console.cloud.google.com/google/maps-apis),
  configurada como la variable de entorno `GOOGLE_MAPS_API_KEY`.

### Paso 3: Muestra el mapa

Crea el estado del mapa con `useGoogleMapViewState` y renderízalo con `<GoogleMapView2D>`. Da una altura al elemento externo para que ocupe toda la pantalla.

```tsx
import {
  GoogleMapDesign,
  GoogleMapView2D,
  useGoogleMapViewState,
} from '@mapconductor/react-for-googlemaps';
import { createGeoPoint, createMapCameraPosition } from '@mapconductor/js-sdk-core';

// Tu propia clave. Léela del entorno con el mecanismo de tu herramienta de
// compilación y mantenla fuera del control de versiones.
const GOOGLE_MAPS_API_KEY = '…';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });
const INITIAL_CAMERA = createMapCameraPosition({ position: TOKYO, zoom: 14 });

export default function App() {
  const mapViewState = useGoogleMapViewState({
    apiKey: GOOGLE_MAPS_API_KEY,
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

Usa `GoogleMapView` en lugar de `GoogleMapView2D` para la vista de mapa 3D fotorrealista.

### Paso 4: Coloca un marcador

Crea el estado del marcador con `createMarkerState` y regístralo con `<Marker>`. Escribe las superposiciones como **elementos hijos** del componente del mapa.

```tsx
import { useMemo } from 'react';
import { createMarkerState } from '@mapconductor/js-sdk-core';
import { Marker } from '@mapconductor/js-sdk-react';

// ...dentro de App...
const marker = useMemo(
  () => createMarkerState({ id: 'hello', position: TOKYO }),
  [],
);

// ...dentro de return...
<GoogleMapView2D state={mapViewState}>
  <Marker state={marker} />
</GoogleMapView2D>
```

### Paso 5: Muestra un InfoBubble al hacer clic

Guarda el estado de selección con `useState`, ponlo en true en el `onClick` del marcador y renderiza `<InfoBubble>` solo mientras está seleccionado. Este es el resultado final.

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

// Tu propia clave. Léela del entorno con el mecanismo de tu herramienta de
// compilación y mantenla fuera del control de versiones.
const GOOGLE_MAPS_API_KEY = '…';

const TOKYO = createGeoPoint({ latitude: 35.6812, longitude: 139.7671 });
const INITIAL_CAMERA = createMapCameraPosition({ position: TOKYO, zoom: 14 });

export default function App() {
  const mapViewState = useGoogleMapViewState({
    apiKey: GOOGLE_MAPS_API_KEY,
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

### Puntos clave

- Las coordenadas, cámaras y marcadores se crean con funciones de `js-sdk-core`
  (**independiente del proveedor**).
- El componente del mapa y los hooks vienen de `react-for-googlemaps`
  (**específico del proveedor**).
- Escribe las superposiciones como **elementos hijos** del componente del mapa.
- Controla mostrar / ocultar con `useState` de React.

## Paquetes relacionados

- [`@mapconductor/js-sdk-core`](https://github.com/mapconductor/js-sdk-core) — primitivas de geometría, cámara y estado
- [`@mapconductor/js-sdk-react`](https://github.com/mapconductor/js-sdk-react) — `Marker`, `Markers`, formas y burbujas de información compartidos
