package com.mapconductor.react.googlemaps.polyline

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.polyline.PolylineEvent
import com.mapconductor.core.polyline.PolylineState
import com.mapconductor.react.googlemaps.fromReadableMap

fun polylineStatesFromReadableArray(
    array: ReadableArray?,
    onClick: (String, PolylineEvent) -> Unit,
): List<PolylineState> =
    (0 until (array?.size() ?: 0)).mapNotNull { index ->
        polylineStateFromReadableMap(array?.getMap(index), onClick)
    }

fun polylineStateFromReadableMap(
    map: ReadableMap?,
    onClick: (String, PolylineEvent) -> Unit,
): PolylineState? {
    if (map == null) return null
    val id = map.stringOrNull("id") ?: return null
    val pointsArray = map.arrayOrNull("points") ?: return null
    val points =
        (0 until pointsArray.size()).mapNotNull { index ->
            GeoPoint.fromReadableMap(pointsArray.getMap(index))
        }

    return PolylineState(
        id = id,
        points = points,
        strokeColor = Color(map.colorOrDefault("strokeColor", android.graphics.Color.BLACK)),
        strokeWidth = (map.doubleOrNull("strokeWidth") ?: 1.0).toFloat().dp,
        geodesic = map.booleanOrNull("geodesic") ?: false,
        zIndex = (map.doubleOrNull("zIndex") ?: 0.0).toInt(),
        onClick = { event -> onClick(id, event) },
    )
}

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
