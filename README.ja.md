[English](https://github.com/MapConductor/react-for-googlemaps/README.md) | 日本語 | [Español (Latinoamérica)](https://github.com/MapConductor/react-for-googlemaps/README.es-419.md)

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

![](https://raw.githubusercontent.com/mapconductor/react-for-googlemaps/docs/images/hello-map.jpg)

## Hello Map チュートリアル

MapConductor + Google Maps で作る、いちばん簡単な地図アプリです。マーカーをクリックすると「Hello, MapConductor」の吹き出しが出ます。この地図は、次の 5 ステップで作れます。Google Maps は API キーが必要なので、自分の Google Maps API キーを用意すれば動きます。

### ステップ 1: React プロジェクトを作る

Vite で React + TypeScript のプロジェクトを作成します。

```shell
npm create vite@latest hello-map -- --template react-ts
cd hello-map
npm install
npm run dev
```

### ステップ 2: MapConductor（Google Maps）をインストール

地図表示に必要なパッケージを入れます。ここでは Google Maps を使いますが、他の地図モジュールを使うこともできます。

```shell
npm install @mapconductor/react-for-googlemaps
```

- `@mapconductor/react-for-googlemaps` — Google Maps 用のコンポーネント/フック
- `@mapconductor/js-sdk-react` / `@mapconductor/js-sdk-core` は依存関係として自動的にインストールされます。
- [Google Cloud コンソール](https://console.cloud.google.com/google/maps-apis)で取得した API キーも必要です。環境変数 `VITE_GOOGLE_MAPS_API_KEY` に設定してください。

### ステップ 3: 地図を表示する

`useGoogleMapViewState` で地図の状態を作り、`<GoogleMapView2D>` で描画します。外側の要素に高さを与えると全画面になります。

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

フォトリアリスティックな 3D マップビューを使う場合は `GoogleMapView2D` の代わりに `GoogleMapView` を使用します。

### ステップ 4: マーカーを置く

`createMarkerState` でマーカーの状態を作り、`<Marker>` で登録します。オーバーレイは地図コンポーネントの**子要素**として書きます。

```tsx
import { useMemo } from 'react';
import { createMarkerState } from '@mapconductor/js-sdk-core';
import { Marker } from '@mapconductor/js-sdk-react';

// ...App の中...
const marker = useMemo(
  () => createMarkerState({ id: 'hello', position: TOKYO }),
  [],
);

// ...return の中...
<GoogleMapView2D state={mapViewState}>
  <Marker state={marker} />
</GoogleMapView2D>
```

### ステップ 5: クリックで InfoBubble を表示する

選択中かどうかを `useState` で持ち、マーカーの `onClick` で true にします。選択中のときだけ `<InfoBubble>` を描画します。これが完成形です。

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

### ポイント

- 座標・カメラ・マーカーは `js-sdk-core` の関数で作る(**プロバイダー非依存**)
- 地図コンポーネントとフックは `react-for-googlemaps` から来る(**プロバイダー固有**)
- オーバーレイは地図コンポーネントの**子要素**として書く
- 表示・非表示は React の `useState` で制御する

## 関連パッケージ

- [`@mapconductor/js-sdk-core`](https://github.com/mapconductor/js-sdk-core) — ジオメトリ・カメラ・状態のプリミティブ
- [`@mapconductor/js-sdk-react`](https://github.com/mapconductor/js-sdk-react) — 共有の `Marker`・`Markers`・シェイプ・インフォバブル
