package com.mapconductor.react.googlemaps.circle

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import com.mapconductor.core.circle.CircleEvent
import com.mapconductor.core.circle.CircleState
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.react.googlemaps.fromReadableMap

fun circleStatesFromReadableArray(
    array: ReadableArray?,
    onClick: (String, CircleEvent) -> Unit,
): List<CircleState> =
    (0 until (array?.size() ?: 0)).mapNotNull { index ->
        circleStateFromReadableMap(array?.getMap(index), onClick)
    }

fun circleStateFromReadableMap(
    map: ReadableMap?,
    onClick: (String, CircleEvent) -> Unit,
): CircleState? {
    if (map == null) return null
    val id = map.stringOrNull("id") ?: return null
    val center = GeoPoint.fromReadableMap(map.mapOrNull("center") ?: return null) ?: return null

    return CircleState(
        id = id,
        center = center,
        radiusMeters = map.doubleOrNull("radiusMeters") ?: return null,
        clickable = map.booleanOrNull("clickable") ?: true,
        geodesic = map.booleanOrNull("geodesic") ?: true,
        strokeColor = Color(map.colorOrDefault("strokeColor", android.graphics.Color.RED)),
        strokeWidth = (map.doubleOrNull("strokeWidth") ?: 1.0).toFloat().dp,
        fillColor = Color(map.colorOrDefault("fillColor", 0x7FFFFFFF)),
        zIndex = map.doubleOrNull("zIndex")?.toInt(),
        onClick = { event -> onClick(id, event) },
    )
}

private fun ReadableMap.stringOrNull(key: String): String? =
    if (hasKey(key) && !isNull(key)) getString(key) else null

private fun ReadableMap.mapOrNull(key: String): ReadableMap? =
    if (hasKey(key) && !isNull(key)) getMap(key) else null

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
