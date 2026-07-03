/// <reference types="google.maps" />
import {
  MapViewHolderBase,
  type GeoPoint,
  type GeoPointInterface,
  type Offset,
} from '@mapconductor/core';
import { latLngAltToGeoPoint } from './helpers';
import { ZoomAltitudeConverter } from './zoom';

type Vec3 = [number, number, number];

// type ScreenProjection = {
//   x: number;        // element 左上からの px
//   y: number;        // element 左上からの px
//   depth: number;    // camera 前方距離。<=0 なら背面
//   visible: boolean;
// };

const WGS84_A = 6378137.0;
const WGS84_E2 = 6.69437999014e-3;

const degToRad = (deg: number) => (deg * Math.PI) / 180;

export class GoogleMapViewHolder extends MapViewHolderBase<HTMLElement, google.maps.maps3d.Map3DElement> {
  constructor(
    readonly mapView: HTMLElement,
    readonly map: google.maps.maps3d.Map3DElement,
    readonly zoomConverter: ZoomAltitudeConverter,
  ) {
    super();
  }

  toScreenOffset(position: GeoPointInterface): Offset | null {
    const rect = this.map.getBoundingClientRect();
    const width = rect.width;

    if (width <= 0 || rect.height <= 0) return null;

    const center = this.map.center;
    const cameraPosition = this.map.cameraPosition;

    if (!center || !cameraPosition) {
      // cameraPosition は現行 API では出力プロパティとして取得可能です。
      // gmp-load / gmp-steadychange 後に呼ぶと安定しやすいです。
      return null;
    }

    const bearing = this.map.heading ?? 0;
    const tilt = this.map.roll ?? 0;
    const verticalFov = this.map.fov ?? 35;
    const cameraPosCenter = latLngAltToGeoPoint(center);

    const cameraEcef = this.geoPontToEcef(latLngAltToGeoPoint(cameraPosition));
    const centerEcef = this.geoPontToEcef(cameraPosCenter);
    const targetEcef = this.geoPontToEcef(position);

    // camera -> center が視線方向
    const forward = this.normalize(this.sub(centerEcef, cameraEcef));

    // heading から「画面右」方向を作る。
    // heading=0 なら screen right は東。
    const { east, north } = this.enuBasisAt(cameraPosCenter);
    const height = degToRad(bearing);
    let right = this.normalize(this.add(this.mul(east, Math.cos(height)), this.mul(north, -Math.sin(height))));

    // camera up。screen y は下向きなので、後段で符号反転する。
    let up = this.normalize(this.cross(this.mul(forward, -1), right));

    // roll を反映。向きが逆に感じる場合は `roll` を `-roll` にしてください。
    const rollRad = degToRad(tilt);
    right = this.normalize(this.rotateAroundAxis(right, forward, rollRad));
    up = this.normalize(this.rotateAroundAxis(up, forward, rollRad));

    const rel = this.sub(targetEcef, cameraEcef);

    const cx = this.dot(rel, right);
    const cy = this.dot(rel, up);
    const cz = this.dot(rel, forward);

    if (cz <= 0) {
      return null;
      // return {
      //   x: NaN,
      //   y: NaN,
      //   depth: cz,
      //   visible: false,
      // };
    }

    const fovY = degToRad(verticalFov);
    const aspect = width / height;
    const tanY = Math.tan(fovY / 2);
    const tanX = tanY * aspect;

    const ndcX = cx / (cz * tanX);
    const ndcY = cy / (cz * tanY);

    const x = (ndcX * 0.5 + 0.5) * width;
    const y = (0.5 - ndcY * 0.5) * height;
    const visible = ndcX >= -1 && ndcX <= 1 && ndcY >= -1 && ndcY <= 1;
    if (!visible) return null;

    return {
      x,
      y,
    };
    // return {
    //   x,
    //   y,
    //   depth: cz,
    //   
    // };
  }

  async fromScreenOffset(offset: Offset): Promise<GeoPoint | null> {
    return this.fromScreenOffsetSync(offset);
  }

  fromScreenOffsetSync(_offset: Offset): GeoPoint | null {
    return null;
    // const projection = this.map.getProjection();
    // if (!projection) return null;
    // const center = this.map.getCenter();
    // const zoom = this.map.getZoom();
    // if (!center || zoom === undefined) return null;

    // const centerPoint = projection.fromLatLngToPoint(center);
    // if (!centerPoint) return null;

    // const scale = Math.pow(2, zoom);
    // const worldX = (offset.x - this.mapView.offsetWidth / 2) / scale + centerPoint.x;
    // const worldY = (offset.y - this.mapView.offsetHeight / 2) / scale + centerPoint.y;
    // const latLng = projection.fromPointToLatLng(new google.maps.Point(worldX, worldY));
    // if (!latLng) return null;
    // return createGeoPoint({ latitude: latLng.lat(), longitude: latLng.lng() });
  }

  private add(a: Vec3, b: Vec3): Vec3 {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  }

  private sub(a: Vec3, b: Vec3): Vec3 {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  private  mul(a: Vec3, s: number): Vec3 {
    return [a[0] * s, a[1] * s, a[2] * s];
  }

  private  dot(a: Vec3, b: Vec3): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  private  cross(a: Vec3, b: Vec3): Vec3 {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  private  norm(a: Vec3): number {
    return Math.hypot(a[0], a[1], a[2]);
  }

  private  normalize(a: Vec3): Vec3 {
    const n = this.norm(a);
    if (n === 0) throw new Error("zero-length vector");
    return [a[0] / n, a[1] / n, a[2] / n];
  }

  private  rotateAroundAxis(v: Vec3, axis: Vec3, angleRad: number): Vec3 {
    // Rodrigues' rotation formula
    const k = this.normalize(axis);
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    return this.add(
      this.add(this.mul(v, c), this.mul(this.cross(k, v), s)),
      this.mul(k, this.dot(k, v) * (1 - c)),
    );
  }

  private geoPontToEcef(p: GeoPointInterface): Vec3 {
    const lat = degToRad(p.latitude);
    const lng = degToRad(p.longitude);
    const h = p.altitude ?? 0;

    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    const sinLng = Math.sin(lng);
    const cosLng = Math.cos(lng);

    const n = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinLat * sinLat);

    return [
      (n + h) * cosLat * cosLng,
      (n + h) * cosLat * sinLng,
      (n * (1 - WGS84_E2) + h) * sinLat,
    ];
  }

  private enuBasisAt(p: GeoPointInterface): { east: Vec3; north: Vec3; up: Vec3 } {
    const lat = degToRad(p.latitude);
    const lng = degToRad(p.longitude);

    const sinLat = Math.sin(lat);
    const cosLat = Math.cos(lat);
    const sinLng = Math.sin(lng);
    const cosLng = Math.cos(lng);

    return {
      east: [-sinLng, cosLng, 0],
      north: [-sinLat * cosLng, -sinLat * sinLng, cosLat],
      up: [cosLat * cosLng, cosLat * sinLng, sinLat],
    };
  }

  // private deriveCameraPositionFromCenter(
  //   center: GeoPointInterface,
  //   headingDeg: number,
  //   tiltDeg: number,
  //   rangeMeters: number,
  // ): GeoPointInterface {
  //   // 簡易的に ECEF 上のローカル ENU で camera を置く。
  //   // heading=0: camera は center の南側、北向きに見る想定。
  //   const centerEcef = this.geoPontToEcef(center);
  //   const { east, north, up } = this.enuBasisAt(center);

  //   const heading = degToRad(headingDeg);
  //   const tilt = degToRad(tiltDeg);

  //   const horizontal = rangeMeters * Math.sin(tilt);
  //   const vertical = rangeMeters * Math.cos(tilt);

  //   const offset = this.add(
  //     this.add(
  //       this.mul(east, -Math.sin(heading) * horizontal),
  //       this.mul(north, -Math.cos(heading) * horizontal),
  //     ),
  //     this.mul(up, vertical),
  //   );

  //   const camEcef = this.add(centerEcef, offset);

  //   // ECEF -> lat/lng/alt は厳密逆変換が必要ですが、
  //   // この関数の戻り値は下で再度 ECEF 化するだけなので、
  //   // 実運用では cameraPosition が取れない場合だけこの近似を使います。
  //   // ここでは直接 ECEF を返せるよう、別関数側で扱うのが理想です。
  //   throw new Error(
  //     "Prefer map.cameraPosition. If cameraPosition is unavailable, adapt the code to use camEcef directly.",
  //   );
  // }
}
