package com.mapconductor.react.googlemaps.marker

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.drawable.BitmapDrawable
import android.net.Uri
import android.util.Base64
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facebook.react.bridge.ReadableMap
import com.mapconductor.core.marker.DrawableDefaultIcon
import com.mapconductor.core.marker.ImageIcon
import com.mapconductor.core.marker.MarkerIconInterface

data class ReactNativeMarkerIcon(
    val type: String,
    val uri: String,
    val iconSize: Float = DEFAULT_ICON_SIZE,
    val scale: Float = 1f,
    val anchor: Offset = Offset(0.5f, 0.5f),
    val infoAnchor: Offset = Offset(0.5f, 0.5f),
    val debug: Boolean = false,
    val strokeColor: Color = Color.White,
    val strokeWidth: Float = 1f,
    val label: String? = null,
    val labelTextColor: Color? = Color.Black,
    val labelTextSize: Float = 18f,
    val labelStrokeColor: Color = Color.White,
) {
    companion object
}

fun ReactNativeMarkerIcon.Companion.fromReadableMap(map: ReadableMap?): ReactNativeMarkerIcon? {
    if (map == null) return null
    val type = if (map.hasKey("type") && !map.isNull("type")) map.getString("type") else null
    if (type != "image" && type != "imageDefault") return null
    val uri = if (map.hasKey("uri") && !map.isNull("uri")) map.getString("uri") else null
    if (uri.isNullOrBlank()) return null
    return ReactNativeMarkerIcon(
        type = type,
        uri = uri,
        iconSize = if (map.hasKey("iconSize") && !map.isNull("iconSize")) map.getDouble("iconSize").toFloat() else DEFAULT_ICON_SIZE,
        scale = if (map.hasKey("scale") && !map.isNull("scale")) map.getDouble("scale").toFloat() else 1f,
        anchor = offsetFromReadableMap(if (map.hasKey("anchor") && !map.isNull("anchor")) map.getMap("anchor") else null, Offset(0.5f, 0.5f)),
        infoAnchor = offsetFromReadableMap(if (map.hasKey("infoAnchor") && !map.isNull("infoAnchor")) map.getMap("infoAnchor") else null, Offset(0.5f, 0.5f)),
        debug = if (map.hasKey("debug") && !map.isNull("debug")) map.getBoolean("debug") else false,
        strokeColor = colorFromReadableMap(map, "strokeColor", Color.White) ?: Color.White,
        strokeWidth = if (map.hasKey("strokeWidth") && !map.isNull("strokeWidth")) map.getDouble("strokeWidth").toFloat() else 1f,
        label = if (map.hasKey("label") && !map.isNull("label")) map.getString("label") else null,
        labelTextColor = colorFromReadableMap(map, "labelTextColor", Color.Black),
        labelTextSize = if (map.hasKey("labelTextSize") && !map.isNull("labelTextSize")) map.getDouble("labelTextSize").toFloat() else 18f,
        labelStrokeColor = colorFromReadableMap(map, "labelStrokeColor", Color.White) ?: Color.White,
    )
}

private const val DEFAULT_ICON_SIZE = 48f

fun ReactNativeMarkerIcon.toMarkerIcon(context: Context): MarkerIconInterface? {
    val bitmap = loadBitmap(context) ?: return null
    if (type == "imageDefault") {
        return DrawableDefaultIcon(
            backgroundDrawable = BitmapDrawable(context.resources, bitmap),
            strokeColor = strokeColor,
            strokeWidth = strokeWidth.dp,
            scale = scale,
            label = label,
            labelTextColor = labelTextColor,
            labelTextSize = labelTextSize.sp,
            labelStrokeColor = labelStrokeColor,
            infoAnchor = infoAnchor,
            iconSize = iconSize.dp,
            debug = debug,
        )
    }
    return ImageIcon(
        image = BitmapDrawable(context.resources, bitmap),
        iconSize = iconSize.dp,
        scale = scale,
        anchor = anchor,
        infoAnchor = infoAnchor,
        debug = debug,
    )
}

private fun ReactNativeMarkerIcon.loadBitmap(context: Context): Bitmap? =
    when {
        uri.startsWith("data:image") -> {
            val base64 = uri.substringAfter("base64,", missingDelimiterValue = "")
            if (base64.isBlank()) null else {
                val bytes = Base64.decode(base64, Base64.DEFAULT)
                BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
            }
        }
        uri.startsWith("file:") || uri.startsWith("content:") || uri.startsWith("android.resource:") ->
            context.contentResolver.openInputStream(Uri.parse(uri))?.use { BitmapFactory.decodeStream(it) }
        else -> null
    }

private fun offsetFromReadableMap(
    map: ReadableMap?,
    fallback: Offset,
): Offset {
    if (map == null) return fallback
    val x = if (map.hasKey("x") && !map.isNull("x")) map.getDouble("x").toFloat() else fallback.x
    val y = if (map.hasKey("y") && !map.isNull("y")) map.getDouble("y").toFloat() else fallback.y
    return Offset(x, y)
}

private fun colorFromReadableMap(
    map: ReadableMap,
    key: String,
    fallback: Color?,
): Color? {
    if (!map.hasKey(key) || map.isNull(key)) return fallback
    val value = map.getString(key) ?: return fallback
    return try {
        Color(android.graphics.Color.parseColor(value))
    } catch (_: IllegalArgumentException) {
        fallback
    }
}
