package com.mapconductor.react.googlemaps

import android.content.Context
import android.widget.FrameLayout
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.ComposeView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.events.Event
import com.mapconductor.compose.marker.Markers
import com.mapconductor.core.ResourceProvider
import com.mapconductor.core.features.GeoPoint
import com.mapconductor.core.map.MapCameraPosition
import com.mapconductor.core.marker.MarkerAnimation
import com.mapconductor.core.marker.MarkerState
import com.mapconductor.googlemaps.GoogleMapView
import com.mapconductor.googlemaps.GoogleMapViewState
import com.mapconductor.googlemaps.circle.GoogleMapCircleControllerInterface
import com.mapconductor.googlemaps.groundimage.GoogleMapGroundImageControllerInterface
import com.mapconductor.googlemaps.marker.GoogleMapMarkerControllerInterface
import com.mapconductor.googlemaps.polygon.GoogleMapPolygonControllerInterface
import com.mapconductor.googlemaps.polyline.GoogleMapPolylineControllerInterface
import com.mapconductor.googlemaps.raster.GoogleMapRasterLayerControllerInterface
import com.mapconductor.react.googlemaps.marker.ReactNativeMarkerIcon
import com.mapconductor.react.googlemaps.marker.fromReadableMap
import com.mapconductor.react.googlemaps.marker.toMarkerIcon
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.UUID
import com.mapconductor.googlemaps.GoogleMapDesign as ComposeGoogleMapDesign

class GoogleMapViewWrapper(context: Context) :
    FrameLayout(context) {

    private val mainCoroutine: CoroutineScope = CoroutineScope(Dispatchers.Main)

    private val composeView = ComposeView(context)
    private val mapViewState = GoogleMapViewState(
        id = "googlemap-${UUID.randomUUID()}",
        mapDesignType = ComposeGoogleMapDesign.Normal
    )

    private var markerController: GoogleMapMarkerControllerInterface? = null
    private var circleController: GoogleMapCircleControllerInterface? = null
    private var polylineController: GoogleMapPolylineControllerInterface? = null
    private var polylgonController: GoogleMapPolygonControllerInterface? = null
    private var groundImageController: GoogleMapGroundImageControllerInterface? = null
    private var rasterLayerController: GoogleMapRasterLayerControllerInterface? = null
    private var markerStates by mutableStateOf<List<MarkerState>>(emptyList())
    private var infoBubblePositions: List<InfoBubblePosition> = emptyList()

    init {
        ResourceProvider.init(context)

        addView(
            composeView,
            LayoutParams(
                LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT
            )
        )

        composeView.setContent {
            GoogleMapView(
                state = mapViewState,
                modifier = Modifier.fillMaxSize(),
                onMapLoaded = {
                    mapViewState.getControllers()?.entries?.forEach { (key, value) ->
                        when(key) {
                            "marker" -> markerController = value as GoogleMapMarkerControllerInterface?
                            "circle" -> circleController = value as GoogleMapCircleControllerInterface?
                            "polyline" -> polylineController = value as GoogleMapPolylineControllerInterface?
                            "polygon" -> polylgonController = value as GoogleMapPolygonControllerInterface?
                            "ground_image" -> groundImageController = value as GoogleMapGroundImageControllerInterface?
                            "raster_layer" -> rasterLayerController = value as GoogleMapRasterLayerControllerInterface?
                        }
                    }
                    emit("topMapLoaded", Arguments.createMap())
                    emitMarkerScreenPositions()
                    emitInfoBubbleScreenPositions()
                },
                onMapClick = {
                    emitPointEvent("topMapClick", it)
                },
                onMapLongClick = {
                    emitPointEvent("topMapLongClick", it)
                },
                onCameraMoveStart = {
                    emitCameraEvent("topCameraMoveStart", it)
                    emitMarkerScreenPositions()
                    emitInfoBubbleScreenPositions()
                },
                onCameraMove = {
                    emitCameraEvent("topCameraMove", it)
                    emitMarkerScreenPositions()
                    emitInfoBubbleScreenPositions()
                },
                onCameraMoveEnd = {
                    emitCameraEvent("topCameraMoveEnd", it)
                    emitMarkerScreenPositions()
                    emitInfoBubbleScreenPositions()
                },
            ) {
                Markers(states = markerStates)
            }
        }
    }

    fun setCameraPosition(cameraPosition: ReadableMap?) {
        mapViewState.moveCameraTo(MapCameraPosition.fromReadableMap(cameraPosition), null)
    }

    fun setMapDesignType(mapDesignType: String?) {
        val id = GoogleMapDesign.from(mapDesignType)
        mapViewState.mapDesignType = ComposeGoogleMapDesign.toMapDesignType(id)
    }

    fun moveCamera(cameraPosition: ReadableMap?) {
        mapViewState.moveCameraTo(MapCameraPosition.fromReadableMap(cameraPosition), null)
    }

    fun animateCamera(
        cameraPosition: ReadableMap?,
        durationMillis: Int,
    ) {
        mapViewState.moveCameraTo(MapCameraPosition.fromReadableMap(cameraPosition), durationMillis.toLong())
    }

    fun fitBounds(
        bounds: ReadableMap?,
        padding: Int,
    ) {
        mapViewState.fitBounds(geoRectBoundsFromReadableMap(bounds), padding)
    }

    fun setInfoBubblePositions(positions: ReadableArray?) {
        infoBubblePositions =
            (0 until (positions?.size() ?: 0)).mapNotNull { index ->
                val position = positions?.getMap(index) ?: return@mapNotNull null
                val id = position.getStringOrNull("id") ?: return@mapNotNull null
                val point = GeoPoint.fromReadableMap(position) ?: return@mapNotNull null
                InfoBubblePosition(id = id, point = point)
            }
        emitInfoBubbleScreenPositions()
    }

    fun clearOverlays() {}

    fun compositionMarkers(markers: ReadableArray?) {
        markerStates = markerStatesFromReadableArray(markers, context, markerStates.associateBy { it.id })
            .onEach(::attachMarkerCallbacks)
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    fun updateMarker(marker: ReadableMap?) {
        val id = marker?.getStringOrNull("id") ?: return
        val existing = markerStates.firstOrNull { it.id == id }
        if (existing == null) {
            markerStateFromReadableMap(marker, context)?.let { state ->
                attachMarkerCallbacks(state)
                markerStates = markerStates + state
                emitMarkerScreenPositions()
                emitInfoBubbleScreenPositions()
            }
            return
        }

        existing.applyReadableMap(marker, context)
        attachMarkerCallbacks(existing)
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    fun onDropViewInstance() {}

    override fun onLayout(
        changed: Boolean,
        left: Int,
        top: Int,
        right: Int,
        bottom: Int,
    ) {
        super.onLayout(changed, left, top, right, bottom)
        composeView.layout(0, 0, right - left, bottom - top)
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    private fun attachMarkerCallbacks(state: MarkerState) {
        state.onClick = {
            emit("topMarkerClick", Arguments.createMap().apply { putString("markerId", it.id) })
        }
    }

    private fun emitCameraEvent(
        eventName: String,
        camera: MapCameraPosition,
    ) {
        emit(eventName, Arguments.createMap().apply { putMap("cameraPosition", camera.toWritableMap()) })
    }

    private fun emitPointEvent(
        eventName: String,
        point: GeoPoint,
    ) {
        emit(eventName, Arguments.createMap().apply { putMap("point", point.toWritableMap()) })
    }

    private fun emitMarkerScreenPositions() {
        mainCoroutine.launch {
            val density = ResourceProvider.getDensity()
            val holder = mapViewState.getMapViewHolder() ?: return@launch
            val array =
                Arguments.createArray().apply {
                    markerStates.forEach { marker ->
                        val offset = holder.toScreenOffset(marker.position) ?: return@forEach
                        pushMap(
                            Arguments.createMap().apply {
                                putString("markerId", marker.id)
                                putDouble("x", offset.x.toDouble() / density)
                                putDouble("y", offset.y.toDouble() / density)
                            },
                        )
                    }
                }
            emit("topMarkerScreenPositions", Arguments.createMap().apply { putArray("positions", array) })
        }
    }

    private fun emitInfoBubbleScreenPositions() {
        mainCoroutine.launch {
            val density = ResourceProvider.getDensity()
            val holder = mapViewState.getMapViewHolder() ?: return@launch
            val array =
                Arguments.createArray().apply {
                    infoBubblePositions.forEach { position ->
                        val offset = holder.toScreenOffset(position.point) ?: return@forEach
                        pushMap(
                            Arguments.createMap().apply {
                                putString("id", position.id)
                                putDouble("x", offset.x.toDouble() / density)
                                putDouble("y", offset.y.toDouble() / density)
                            },
                        )
                    }
                }
            emit("topInfoBubbleScreenPositions", Arguments.createMap().apply { putArray("positions", array) })
        }
    }

    private fun emit(
        eventName: String,
        event: WritableMap,
    ) {
        val reactContext = context as? ReactContext ?: return
        val surfaceId = UIManagerHelper.getSurfaceId(this)
        UIManagerHelper.getEventDispatcher(reactContext)
            ?.dispatchEvent(GoogleMapViewWrapperEvent(surfaceId, id, eventName, event))
    }
}

private data class InfoBubblePosition(
    val id: String,
    val point: GeoPoint,
)

private fun markerStatesFromReadableArray(
    array: ReadableArray?,
    context: Context,
    previousStates: Map<String, MarkerState> = emptyMap(),
): List<MarkerState> {
    if (array == null) return emptyList()
    return buildList {
        for (index in 0 until array.size()) {
            val marker = array.getMap(index) ?: continue
            val id = marker.getStringOrNull("id")
            val existing = id?.let(previousStates::get)
            if (existing != null) {
                existing.applyReadableMap(marker, context)
                add(existing)
            } else {
                markerStateFromReadableMap(marker, context)?.let(::add)
            }
        }
    }
}

private fun markerStateFromReadableMap(
    map: ReadableMap?,
    context: Context,
): MarkerState? {
    if (map == null) return null
    val id = if (map.hasKey("id") && !map.isNull("id")) map.getString("id") else null
    val position = GeoPoint.fromReadableMap(map.getMap("position"))
    if (id == null || position == null) return null
    return MarkerState(
        id = id,
        position = position,
        clickable = if (map.hasKey("clickable") && !map.isNull("clickable")) map.getBoolean("clickable") else true,
        draggable = if (map.hasKey("draggable") && !map.isNull("draggable")) map.getBoolean("draggable") else false,
        zIndex = map.getDoubleOrNull("zIndex")?.toInt(),
        icon = ReactNativeMarkerIcon.fromReadableMap(if (map.hasKey("icon") && !map.isNull("icon")) map.getMap("icon") else null)
            ?.toMarkerIcon(context),
        animation = if (map.hasKey("animation") && !map.isNull("animation")) {
            runCatching { MarkerAnimation.valueOf(map.getString("animation") ?: "") }.getOrNull()
        } else {
            null
        },
    )
}

private fun MarkerState.applyReadableMap(
    map: ReadableMap,
    context: Context,
) {
    GeoPoint.fromReadableMap(map.getMapOrNull("position"))?.let { position = it }
    clickable = if (map.hasKey("clickable") && !map.isNull("clickable")) map.getBoolean("clickable") else true
    draggable = if (map.hasKey("draggable") && !map.isNull("draggable")) map.getBoolean("draggable") else false
    zIndex = map.getDoubleOrNull("zIndex")?.toInt()
    icon = ReactNativeMarkerIcon.fromReadableMap(map.getMapOrNull("icon"))?.toMarkerIcon(context)

    markerAnimationFromReadableMap(map)?.let { animation ->
        animate(animation)
    }
}

private fun markerAnimationFromReadableMap(map: ReadableMap): MarkerAnimation? =
    if (map.hasKey("animation") && !map.isNull("animation")) {
        runCatching { MarkerAnimation.valueOf(map.getString("animation") ?: "") }.getOrNull()
    } else {
        null
    }

private fun ReadableMap.getStringOrNull(key: String): String? =
    if (hasKey(key) && !isNull(key)) getString(key) else null

private fun ReadableMap.getMapOrNull(key: String): ReadableMap? =
    if (hasKey(key) && !isNull(key)) getMap(key) else null

private class GoogleMapViewWrapperEvent(
    surfaceId: Int,
    viewTag: Int,
    private val name: String,
    private val payload: WritableMap,
) : Event<GoogleMapViewWrapperEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = name

    override fun canCoalesce(): Boolean = false

    override fun getEventData(): WritableMap = payload
}
