[English](./README.md) | 日本語 | [Español (Latinoamérica)](./README.es-419.md)

# @mapconductor/react-for-googlemaps

MapConductor React SDK の Google Maps プロバイダです。MapConductor のプロバイダ非依存なカメラ・マーカー・オーバーレイ API を通じて Google マップを描画するため、同じアプリケーションコードが MapLibre、Mapbox、Leaflet、OpenLayers、ArcGIS、Cesium、HERE でもそのまま動作します。

## インストール

```shell
npm install @mapconductor/react-for-googlemaps
```

`@mapconductor/js-sdk-core` と `@mapconductor/js-sdk-react`(マーカーなどの共有コンポーネントで使用)は依存関係として自動的にインストールされます。ただしアプリケーションコードはこの2つから直接 import するため、pnpm の strict(isolated)な `node_modules` を使う場合や、import するものをすべて明示的に宣言したい場合は、次のように明示的にインストールしてください:

```shell
npm install @mapconductor/react-for-googlemaps @mapconductor/js-sdk-core @mapconductor/js-sdk-react
```

Maps JavaScript API は `@googlemaps/js-api-loader` により実行時にロードされます。[Google Cloud コンソール](https://console.cloud.google.com/google/maps-apis)で取得した API キーだけ用意してください。

## クイックスタート

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

フォトリアリスティックな 3D マップビューを使う場合は `GoogleMapView2D` の代わりに `GoogleMapView` を使用します。マップスタイルが必要とする場合は `useGoogleMapViewState` に `mapId` を渡してください。

## マップデザイン

`GoogleMapDesign` は `Normal`(roadmap)と `Satellite` を提供します。実行時に切り替えるには `state.mapDesignType = ...` を代入します。

## 関連パッケージ

- [`@mapconductor/js-sdk-core`](../js-sdk-core) — ジオメトリ・カメラ・状態のプリミティブ
- [`@mapconductor/js-sdk-react`](../js-sdk-react) — 共有の `Marker`・`Markers`・シェイプ・インフォバブル
