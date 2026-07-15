package com.mapconductor.react.googlemaps.polygon

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.polygon.PolygonEvent
import com.mapconductor.core.polygon.PolygonState
import com.mapconductor.react.googlemaps.fromReadableMap

fun polygonStatesFromReadableArray(
    array: ReadableArray?,
    onClick: (String, PolygonEvent) -> Unit,
): List<PolygonState> =
    (0 until (array?.size() ?: 0)).mapNotNull { index ->
        polygonStateFromReadableMap(array?.getMap(index), onClick)
    }

fun polygonStateFromReadableMap(
    map: ReadableMap?,
    onClick: (String, PolygonEvent) -> Unit,
): PolygonState? {
    if (map == null) return null
    val id = map.stringOrNull("id") ?: return null
    val points = geoPointsFromReadableArray(map.arrayOrNull("points") ?: return null)
    val holesArray = map.arrayOrNull("holes")
    val holes =
        (0 until (holesArray?.size() ?: 0)).mapNotNull { index ->
            holesArray?.getArray(index)?.let(::geoPointsFromReadableArray)
        }

    return PolygonState(
        id = id,
        points = points,
        holes = holes,
        strokeColor = Color(map.colorOrDefault("strokeColor", android.graphics.Color.BLACK)),
        strokeWidth = (map.doubleOrNull("strokeWidth") ?: 1.0).toFloat().dp,
        fillColor = Color(map.colorOrDefault("fillColor", android.graphics.Color.TRANSPARENT)),
        geodesic = map.booleanOrNull("geodesic") ?: false,
        zIndex = (map.doubleOrNull("zIndex") ?: 0.0).toInt(),
        onClick = { event -> onClick(id, event) },
    )
}

private fun geoPointsFromReadableArray(array: ReadableArray): List<GeoPoint> =
    (0 until array.size()).mapNotNull { index -> GeoPoint.fromReadableMap(array.getMap(index)) }

private fun ReadableMap.stringOrNull(key: String): String? =
    if (hasKey(key) && !isNull(key)) getString(key) else null

private fun ReadableMap.arrayOrNull(key: String): ReadableArray? =
    if (hasKey(key) && !isNull(key)) getArray(key) else null

private fun ReadableMap.doubleOrNull(key: String): Double? =
    if (hasKey(key) && !isNull(key)) getDouble(key) else null

private fun ReadableMap.booleanOrNull(key: String): Boolean? =
    if (hasKey(key) && !isNull(key)) getBoolean(key) else null

private fun ReadableMap.colorOrDefault(key: String, fallback: Int): Int {
    if (!hasKey(key) || isNull(key)) return fallback
    return when (getType(key)) {
        ReadableType.Number -> getInt(key)
        ReadableType.String ->
            runCatching { android.graphics.Color.parseColor(getString(key)) }.getOrDefault(fallback)
        else -> fallback
    }
}
