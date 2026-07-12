package com.mapconductor.react.googlemaps

import androidx.compose.ui.geometry.Offset
import com.mapconductor.core.features.GeoPointInterface
import com.mapconductor.core.map.MapCameraPosition
import com.mapconductor.core.map.VisibleRegion
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ln
import kotlin.math.sin

/**
 * Fast screen projection from the latest visible region.
 *
 * This avoids GoogleMap.getProjection().toScreenLocation() while the camera is moving.
 * The latest visibleRegion corners define a homography between screen space and
 * WGS84/Web Mercator space, so this also tracks tilted cameras.
 */
class Wms84Projection(
    private val cameraPosition: MapCameraPosition,
    private val width: Int,
    private val height: Int,
) {
    private val homographyProjection: HomographyProjection? =
        cameraPosition.visibleRegion?.let(::buildInverseHomography)

    fun toScreenOffset(position: GeoPointInterface): Offset? {
        if (width <= 0 || height <= 0) return null
        val projection = homographyProjection ?: return null
        val point = mercatorPoint(position, originX = projection.originX)
        val screen = applyHomography(projection.inverseHomography, point.x, point.y) ?: return null

        val xRatio = screen.x.coerceIn(0.0, 1.0)
        val yRatio = screen.y.coerceIn(0.0, 1.0)

        return Offset(
            x = (xRatio * width).toFloat(),
            y = (yRatio * height).toFloat(),
        )
    }

    private companion object {
        private const val WORLD_SIZE = 256.0
        private const val MAX_MERCATOR_LAT = 85.05112878

        private data class PointD(
            val x: Double,
            val y: Double,
        )

        private data class HomographyProjection(
            val inverseHomography: DoubleArray,
            val originX: Double,
        )

        private fun buildInverseHomography(region: VisibleRegion): HomographyProjection? {
            val farLeft = region.farLeft ?: return null
            val farRight = region.farRight ?: return null
            val nearLeft = region.nearLeft ?: return null
            val nearRight = region.nearRight ?: return null
            if (farLeft.latitude == farRight.latitude && farLeft.longitude == farRight.longitude) return null

            val farLeftPoint = mercatorPoint(farLeft, originX = null)
            val originX = farLeftPoint.x / WORLD_SIZE
            val farRightPoint = mercatorPoint(farRight, originX = originX)
            val nearRightPoint = mercatorPoint(nearRight, originX = originX)
            val nearLeftPoint = mercatorPoint(nearLeft, originX = originX)

            val homography =
                calcHomographyMatrix(
                    farLeftPoint,
                    farRightPoint,
                    nearRightPoint,
                    nearLeftPoint,
                ) ?: return null
            return HomographyProjection(invertMatrix(homography) ?: return null, originX)
        }

        private fun calcHomographyMatrix(
            farLeftPx: PointD,
            farRightPx: PointD,
            nearRightPx: PointD,
            nearLeftPx: PointD,
        ): DoubleArray? {
            val x00 = farLeftPx.x
            val y00 = farLeftPx.y
            val x01 = nearLeftPx.x
            val y01 = nearLeftPx.y
            val x10 = farRightPx.x
            val y10 = farRightPx.y
            val x11 = nearRightPx.x
            val y11 = nearRightPx.y
            val a = x10 - x11
            val b = x01 - x11
            val c = x00 - x01 - x10 + x11
            val d = y10 - y11
            val e = y01 - y11
            val f = y00 - y01 - y10 + y11
            val denom32 = b * d - a * e
            val denom31 = a * e - b * d
            if (abs(denom32) < 1e-12 || abs(denom31) < 1e-12) return null
            val h32 = (c * d - a * f) / denom32
            val h31 = (c * e - b * f) / denom31
            val h11 = x10 - x00 + h31 * x10
            val h12 = x01 - x00 + h32 * x01
            val h21 = y10 - y00 + h31 * y10
            val h22 = y01 - y00 + h32 * y01
            return doubleArrayOf(h11, h12, x00, h21, h22, y00, h31, h32, 1.0)
        }

        private fun invertMatrix(mat: DoubleArray): DoubleArray? {
            val a = mat[0]
            val b = mat[1]
            val c = mat[2]
            val d = mat[3]
            val e = mat[4]
            val f = mat[5]
            val g = mat[6]
            val h = mat[7]
            val i = mat[8]
            val det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
            if (abs(det) < 1e-12) return null
            val invDet = 1.0 / det
            return doubleArrayOf(
                (e * i - f * h) * invDet,
                (c * h - b * i) * invDet,
                (b * f - c * e) * invDet,
                (f * g - d * i) * invDet,
                (a * i - c * g) * invDet,
                (c * d - a * f) * invDet,
                (d * h - e * g) * invDet,
                (b * g - a * h) * invDet,
                (a * e - b * d) * invDet,
            )
        }

        private fun applyHomography(
            matrix: DoubleArray,
            x: Double,
            y: Double,
        ): PointD? {
            val denominator = matrix[6] * x + matrix[7] * y + matrix[8]
            if (abs(denominator) < 1e-12) return null
            return PointD(
                x = (matrix[0] * x + matrix[1] * y + matrix[2]) / denominator,
                y = (matrix[3] * x + matrix[4] * y + matrix[5]) / denominator,
            )
        }

        private fun mercatorPoint(
            point: GeoPointInterface,
            originX: Double?,
        ): PointD {
            val x = normalizeMercatorX(mercatorX(point.longitude), originX) * WORLD_SIZE
            val y = mercatorY(point.latitude) * WORLD_SIZE
            return PointD(x, y)
        }

        private fun mercatorX(longitude: Double): Double =
            longitude / 360.0 + 0.5

        private fun mercatorY(latitude: Double): Double {
            val lat = latitude.coerceIn(-MAX_MERCATOR_LAT, MAX_MERCATOR_LAT)
            val siny = sin(lat * PI / 180.0).coerceIn(-0.9999, 0.9999)
            return 0.5 - ln((1.0 + siny) / (1.0 - siny)) / (4.0 * PI)
        }

        private fun normalizeMercatorX(
            x: Double,
            origin: Double?,
        ): Double {
            if (origin == null) return x
            var normalized = x
            while (normalized - origin > 0.5) normalized -= 1.0
            while (normalized - origin < -0.5) normalized += 1.0
            return normalized
        }
    }
}
