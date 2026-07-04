/// <reference types="google.maps" />
import {
  MapViewHolderBase,
  createGeoPoint,
  type GeoPoint,
  type GeoPointInterface,
  type Offset,
} from '@mapconductor/js-sdk-core';
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
    const height = rect.height;

    if (width <= 0 || height <= 0) return null;

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
    const vectorDiff = this.sub(centerEcef, cameraEcef);
    if (this.norm(vectorDiff) === 0) return null;
    const forward = this.normalize(vectorDiff);

    // heading から「画面右」方向を作る。
    // heading=0 なら screen right は東。
    const { east, north } = this.enuBasisAt(cameraPosCenter);
    const bearingRad = degToRad(bearing);
    let right = this.normalize(this.add(this.mul(east, Math.cos(bearingRad)), this.mul(north, -Math.sin(bearingRad))));

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

  fromScreenOffsetSync(offset: Offset): GeoPoint | null {
    const rect = this.map.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    if (width <= 0 || height <= 0) return null;

    const center = this.map.center;
    const cameraPosition = this.map.cameraPosition;
    if (!center || !cameraPosition) return null;

    const bearing = this.map.heading ?? 0;
    const roll = this.map.roll ?? 0;
    const verticalFov = this.map.fov ?? 35;
    const cameraPosCenter = latLngAltToGeoPoint(center);

    const cameraEcef = this.geoPontToEcef(latLngAltToGeoPoint(cameraPosition));
    const centerEcef = this.geoPontToEcef(cameraPosCenter);

    // toScreenOffset と同じ camera 基底を作る（同じ射影モデルでないと相互変換が破綻する）
    const vectorDiff = this.sub(centerEcef, cameraEcef);
    if (this.norm(vectorDiff) === 0) return null;
    const forward = this.normalize(vectorDiff);

    const { east, north } = this.enuBasisAt(cameraPosCenter);
    const bearingRad = degToRad(bearing);
    let right = this.normalize(this.add(this.mul(east, Math.cos(bearingRad)), this.mul(north, -Math.sin(bearingRad))));
    let up = this.normalize(this.cross(this.mul(forward, -1), right));

    const rollRad = degToRad(roll);
    right = this.normalize(this.rotateAroundAxis(right, forward, rollRad));
    up = this.normalize(this.rotateAroundAxis(up, forward, rollRad));

    const fovY = degToRad(verticalFov);
    const tanY = Math.tan(fovY / 2);
    const tanX = tanY * (width / height);

    // screen px -> NDC（toScreenOffset の逆写像）
    const ndcX = (offset.x / width) * 2 - 1;
    const ndcY = 1 - (offset.y / height) * 2;

    // camera から screen 上の点を通る視線 ray（ECEF）
    const dir = this.normalize(
      this.add(
        this.add(this.mul(right, ndcX * tanX), this.mul(up, ndcY * tanY)),
        forward,
      ),
    );

    // 地形・建物は考慮せず WGS84 楕円体表面（標高 0）との交点を返す
    const hit = this.intersectEllipsoid(cameraEcef, dir);
    if (!hit) return null;
    return this.ecefToGeoPoint(hit);
  }

  /**
   * origin から dir 方向の ray と WGS84 楕円体の交点（camera に近い側）。
   * z 軸を a/b 倍して球に変形してから球との交点を解く。
   */
  private intersectEllipsoid(origin: Vec3, dir: Vec3): Vec3 | null {
    const b = WGS84_A * Math.sqrt(1 - WGS84_E2);
    const scaleZ = WGS84_A / b;

    const o: Vec3 = [origin[0], origin[1], origin[2] * scaleZ];
    const d: Vec3 = [dir[0], dir[1], dir[2] * scaleZ];

    const A = this.dot(d, d);
    const B = 2 * this.dot(o, d);
    const C = this.dot(o, o) - WGS84_A * WGS84_A;

    const disc = B * B - 4 * A * C;
    if (disc < 0) return null;

    const sqrtDisc = Math.sqrt(disc);
    const t1 = (-B - sqrtDisc) / (2 * A);
    const t2 = (-B + sqrtDisc) / (2 * A);
    // camera が楕円体外なら t1（手前側）、内側にいる場合は t2 を採用
    const t = t1 > 0 ? t1 : t2;
    if (t <= 0) return null;

    return this.add(origin, this.mul(dir, t));
  }

  private ecefToGeoPoint(p: Vec3): GeoPoint {
    // Bowring の近似式。表面上の点（標高 ~0）には十分な精度。
    const [x, y, z] = p;
    const b = WGS84_A * Math.sqrt(1 - WGS84_E2);
    const ep2 = (WGS84_A * WGS84_A - b * b) / (b * b);

    const hypXY = Math.hypot(x, y);
    const theta = Math.atan2(z * WGS84_A, hypXY * b);
    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    const lat = Math.atan2(
      z + ep2 * b * sinTheta * sinTheta * sinTheta,
      hypXY - WGS84_E2 * WGS84_A * cosTheta * cosTheta * cosTheta,
    );
    const lng = Math.atan2(y, x);

    return createGeoPoint({
      latitude: (lat * 180) / Math.PI,
      longitude: (lng * 180) / Math.PI,
    });
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
