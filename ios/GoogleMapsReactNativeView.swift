import Combine
import MapConductorCore
import MapConductorForGoogleMaps
import MapConductorReactMarkerClustering
import MapConductorReactNativeCore
import SwiftUI
import UIKit

@objc(MCGoogleMapsReactNativeView)
public final class GoogleMapsReactNativeView: UIView {
    @objc public var eventHandler: ((String, [String: Any]) -> Void)?

    private let model = ReactNativeGoogleMapModel()
    private lazy var hostingController = UIHostingController(
        rootView: ReactNativeGoogleMapRoot(model: model, extensionHost: model.extensionHost)
    )

    private var markersById: [String: MarkerState] = [:]
    private var compositionGeneration: Int?
    private var pendingMarkers: [MarkerState] = []
    private var infoBubblePositions: [(id: String, point: GeoPoint)] = []
    private var emittedEmptyMarkerScreenPositions = false
    private var emittedEmptyInfoBubbleScreenPositions = false

    public override init(frame: CGRect) {
        super.init(frame: frame)
        if let apiKey = Bundle.main.object(forInfoDictionaryKey: "GMSApiKey") as? String {
            configure(apiKey: apiKey)
        }
        hostingController.view.backgroundColor = .clear
        addSubview(hostingController.view)
        model.emit = { [weak self] name, body in self?.eventHandler?(name, body) }
        model.localExtensionFactory = { type, extensionId, eventSink in
            guard type == "marker-clustering" else { return nil }
            return MarkerClusterExtensionRenderer<GoogleMapActualMarker>(extensionId: extensionId, eventSink: eventSink)
        }
        model.onCameraMoveStart = { [weak self] camera in
            self?.eventHandler?("cameraMoveStart", ["cameraPosition": mcCameraPayload(camera)])
            self?.emitMarkerScreenPositions()
            self?.emitInfoBubbleScreenPositions()
        }
        model.onCameraMove = { [weak self] camera in
            self?.eventHandler?("cameraMove", ["cameraPosition": mcCameraPayload(camera)])
            self?.emitMarkerScreenPositions()
            self?.emitInfoBubbleScreenPositions()
        }
        model.onCameraMoveEnd = { [weak self] camera in
            self?.eventHandler?("cameraMoveEnd", ["cameraPosition": mcCameraPayload(camera)])
            self?.emitMarkerScreenPositions()
            self?.emitInfoBubbleScreenPositions()
        }
    }

    public required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    deinit {
        model.extensionHost.dispose()
    }

    public override func layoutSubviews() {
        super.layoutSubviews()
        hostingController.view.frame = bounds
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    // MARK: - Camera / design

    @objc public func setCameraPosition(_ payload: [String: Any]) {
        if let camera = mcCameraPosition(payload) { model.state.moveCameraTo(cameraPosition: camera) }
    }

    @objc public func setApiKey(_ value: String?) {
        guard let value else { return }
        configure(apiKey: value)
    }

    @objc public func setMapDesignType(_ value: String?) {
        switch value {
        case "satellite": model.state.mapDesignType = GoogleMapDesign.Satellite
        case "terrain": model.state.mapDesignType = GoogleMapDesign.Terrain
        case "hybrid": model.state.mapDesignType = GoogleMapDesign.Hybrid
        case "none": model.state.mapDesignType = GoogleMapDesign.None
        default: model.state.mapDesignType = GoogleMapDesign.Normal
        }
    }

    @objc public func moveCamera(_ payload: [String: Any], duration: Double) {
        if let camera = mcCameraPosition(payload) {
            model.state.moveCameraTo(cameraPosition: camera, durationMillis: Int64(duration))
        }
    }

    @objc public func fitBounds(_ bounds: [String: Any], padding: Int) {
        model.state.fitBounds(bounds: mcGeoRectBounds(bounds), padding: padding)
    }

    // MARK: - Overlays

    @objc public func clearOverlays() {
        pendingMarkers.removeAll()
        markersById.removeAll()
        model.markers = []
        model.circles = []
        model.polygons = []
        model.polylines = []
        model.groundImages = []
        model.rasterLayers = []
        infoBubblePositions = []
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    @objc public func setMarkerTilingOptions(_ payload: [String: Any]?) {
        model.markerTilingOptions = MarkerTilingOptions(
            enabled: mcBool(payload?["enabled"], default: true),
            debugTileOverlay: mcBool(payload?["debugTileOverlay"], default: false),
            minMarkerCount: mcInt(payload?["minMarkerCount"], default: 2000),
            cacheSize: mcInt(payload?["cacheSize"], default: 8 * 1024 * 1024)
        )
    }

    @objc public func beginMarkerComposition(_ value: Int, icons: [[String: Any]]) {
        compositionGeneration = value
        pendingMarkers.removeAll(keepingCapacity: true)
    }

    @objc public func appendMarkerComposition(_ value: Int, sequence: Int, payload: [String: Any]) {
        guard compositionGeneration == value else { return }
        pendingMarkers.append(contentsOf: mcMarkerStatesFromBatch(
            payload,
            previousStates: markersById,
            onEvent: { [weak self] name, marker in self?.emitMarkerEvent(name, marker) }
        ))
        eventHandler?("markerCompositionBatchProcessed", ["generation": value, "sequence": sequence])
    }

    @objc public func commitMarkerComposition(_ value: Int) {
        guard compositionGeneration == value else { return }
        model.markers = pendingMarkers
        markersById = Dictionary(uniqueKeysWithValues: pendingMarkers.map { ($0.id, $0) })
        pendingMarkers.removeAll()
        compositionGeneration = nil
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    @objc public func updateMarker(_ payload: [String: Any]) {
        guard let id = payload["id"] as? String else { return }
        if let existing = markersById[id] {
            mcApplyMarkerUpdate(payload, to: existing)
            model.markers = model.markers
        } else if let state = mcMarkerState(payload, onEvent: { [weak self] name, marker in self?.emitMarkerEvent(name, marker) }) {
            markersById[state.id] = state
            model.markers.append(state)
        }
        emitMarkerScreenPositions()
        emitInfoBubbleScreenPositions()
    }

    @objc public func compositionCircles(_ payload: [[String: Any]]) {
        model.circles = mcCircleStates(payload, onClick: { [weak self] id, event in
            self?.eventHandler?("circleClick", ["circleId": id, "point": mcPointPayload(event.clicked)])
        })
    }

    @objc public func updateCircle(_ payload: [String: Any]) {
        guard let state = mcCircleState(payload, onClick: { [weak self] id, event in
            self?.eventHandler?("circleClick", ["circleId": id, "point": mcPointPayload(event.clicked)])
        }) else { return }
        var circles = model.circles
        if let index = circles.firstIndex(where: { $0.id == state.id }) { circles[index] = state } else { circles.append(state) }
        model.circles = circles
    }

    @objc public func compositionPolygons(_ payload: [[String: Any]]) {
        model.polygons = mcPolygonStates(payload, onClick: { [weak self] id, event in
            self?.eventHandler?("polygonClick", ["polygonId": id, "point": mcPointPayload(event.clicked)])
        })
    }

    @objc public func updatePolygon(_ payload: [String: Any]) {
        guard let state = mcPolygonState(payload, onClick: { [weak self] id, event in
            self?.eventHandler?("polygonClick", ["polygonId": id, "point": mcPointPayload(event.clicked)])
        }) else { return }
        var polygons = model.polygons
        if let index = polygons.firstIndex(where: { $0.id == state.id }) { polygons[index] = state } else { polygons.append(state) }
        model.polygons = polygons
    }

    @objc public func compositionPolylines(_ payload: [[String: Any]]) {
        model.polylines = mcPolylineStates(payload, onClick: { [weak self] id, event in
            self?.eventHandler?("polylineClick", ["polylineId": id, "point": mcPointPayload(event.clicked)])
        })
    }

    @objc public func updatePolyline(_ payload: [String: Any]) {
        guard let state = mcPolylineState(payload, onClick: { [weak self] id, event in
            self?.eventHandler?("polylineClick", ["polylineId": id, "point": mcPointPayload(event.clicked)])
        }) else { return }
        var polylines = model.polylines
        if let index = polylines.firstIndex(where: { $0.id == state.id }) { polylines[index] = state } else { polylines.append(state) }
        model.polylines = polylines
    }

    @objc public func compositionGroundImages(_ payload: [[String: Any]]) {
        model.groundImages = mcGroundImageStates(payload, onClick: { [weak self] id, event in
            guard let clicked = event.clicked else { return }
            self?.eventHandler?("groundImageClick", ["groundImageId": id, "point": mcPointPayload(clicked)])
        })
    }

    @objc public func updateGroundImage(_ payload: [String: Any]) {
        guard let state = mcGroundImageState(payload, onClick: { [weak self] id, event in
            guard let clicked = event.clicked else { return }
            self?.eventHandler?("groundImageClick", ["groundImageId": id, "point": mcPointPayload(clicked)])
        }) else { return }
        var groundImages = model.groundImages
        if let index = groundImages.firstIndex(where: { $0.id == state.id }) { groundImages[index] = state } else { groundImages.append(state) }
        model.groundImages = groundImages
    }

    @objc public func compositionRasterLayers(_ payload: [[String: Any]]) {
        model.rasterLayers = mcRasterLayerStates(payload)
    }

    @objc public func updateRasterLayer(_ payload: [String: Any]) {
        guard let state = mcRasterLayerState(payload) else { return }
        var rasterLayers = model.rasterLayers
        if let index = rasterLayers.firstIndex(where: { $0.id == state.id }) { rasterLayers[index] = state } else { rasterLayers.append(state) }
        model.rasterLayers = rasterLayers
    }

    @objc public func setInfoBubblePositions(_ positions: [[String: Any]]) {
        infoBubblePositions = positions.compactMap { entry in
            guard let id = entry["id"] as? String, let point = mcGeoPoint(entry) else { return nil }
            return (id: id, point: point)
        }
        emitInfoBubbleScreenPositions()
    }

    @objc public func upsertNativeMapExtension(_ extensionId: String, type: String, payload: [String: Any]) {
        model.extensionHost.upsert(extensionId: extensionId, type: type, payload: payload)
    }

    @objc public func removeNativeMapExtension(_ extensionId: String) {
        model.extensionHost.remove(extensionId: extensionId)
    }

    // MARK: - Events

    private func configure(apiKey value: String) {
        let apiKey = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !apiKey.isEmpty else { return }
        let selector = NSSelectorFromString("provideAPIKey:")
        _ = (NSClassFromString("GMSServices") as AnyObject?)?.perform(selector, with: apiKey)
        model.isConfigured = true
    }

    private func emitMarkerEvent(_ name: String, _ marker: MarkerState) {
        switch name {
        case "markerClick", "markerAnimateStart", "markerAnimateEnd":
            eventHandler?(name, ["markerId": marker.id])
        case "markerDragStart", "markerDrag", "markerDragEnd":
            eventHandler?(name, ["markerId": marker.id, "point": mcPointPayload(GeoPoint.from(position: marker.position))])
        default:
            break
        }
    }

    private func emitMarkerScreenPositions() {
        let tilingActive = model.markers.count >= model.markerTilingOptions.minMarkerCount
        if tilingActive || model.markers.isEmpty {
            if emittedEmptyMarkerScreenPositions { return }
            emittedEmptyMarkerScreenPositions = true
            eventHandler?("markerScreenPositions", ["positions": []])
            return
        }
        emittedEmptyMarkerScreenPositions = false
        guard let holder = model.state.getMapViewHolder() else { return }
        let positions: [[String: Any]] = model.markers.compactMap { marker in
            guard let offset = holder.toScreenOffset(position: marker.position) else { return nil }
            return ["markerId": marker.id, "x": offset.x, "y": offset.y]
        }
        eventHandler?("markerScreenPositions", ["positions": positions])
    }

    private func emitInfoBubbleScreenPositions() {
        if infoBubblePositions.isEmpty {
            if emittedEmptyInfoBubbleScreenPositions { return }
            emittedEmptyInfoBubbleScreenPositions = true
            eventHandler?("infoBubbleScreenPositions", ["positions": []])
            return
        }
        emittedEmptyInfoBubbleScreenPositions = false
        guard let holder = model.state.getMapViewHolder() else { return }
        let positions: [[String: Any]] = infoBubblePositions.compactMap { entry in
            guard let offset = holder.toScreenOffset(position: entry.point) else { return nil }
            return ["id": entry.id, "x": offset.x, "y": offset.y]
        }
        eventHandler?("infoBubbleScreenPositions", ["positions": positions])
    }
}

final class ReactNativeGoogleMapModel: ObservableObject {
    let state = GoogleMapViewState()
    @Published var markers: [MarkerState] = []
    @Published var circles: [CircleState] = []
    @Published var polygons: [PolygonState] = []
    @Published var polylines: [PolylineState] = []
    @Published var groundImages: [GroundImageState] = []
    @Published var rasterLayers: [RasterLayerState] = []
    @Published var markerTilingOptions: MarkerTilingOptions = .Default
    @Published var isConfigured = false

    var emit: (String, [String: Any]) -> Void = { _, _ in }
    var onCameraMoveStart: (MapCameraPosition) -> Void = { _ in }
    var onCameraMove: (MapCameraPosition) -> Void = { _ in }
    var onCameraMoveEnd: (MapCameraPosition) -> Void = { _ in }
    var localExtensionFactory: NativeMapExtensionLocalFactory?

    lazy var extensionHost = NativeMapExtensionHost(
        eventSink: { [weak self] extensionId, eventName, payload in
            self?.emit("nativeMapExtensionEvent", ["extensionId": extensionId, "eventName": eventName, "payload": payload])
        },
        localFactory: { [weak self] type, extensionId, eventSink in
            self?.localExtensionFactory?(type, extensionId, eventSink)
        }
    )
}

struct ReactNativeGoogleMapRoot: View {
    @ObservedObject var model: ReactNativeGoogleMapModel
    @ObservedObject var extensionHost: NativeMapExtensionHost

    var body: some View {
        if !model.isConfigured {
            Text("Google Maps API key is not configured. Set GMSApiKey in Info.plist.")
                .multilineTextAlignment(.center)
                .padding()
        } else {
            GoogleMapView(
                state: model.state,
                onMapLoaded: { _ in model.emit("mapLoaded", [:]) },
                onMapClick: { model.emit("mapClick", ["point": mcPointPayload($0)]) },
                onMapLongClick: { model.emit("mapLongClick", ["point": mcPointPayload($0)]) },
                onCameraMoveStart: { model.onCameraMoveStart($0) },
                onCameraMove: { model.onCameraMove($0) },
                onCameraMoveEnd: { model.onCameraMoveEnd($0) },
                content: {
                    var content = MapViewContent()
                    content.markers = model.markers.map(Marker.init(state:))
                    content.circles = model.circles.map(Circle.init(state:))
                    content.polygons = model.polygons.map(Polygon.init(state:))
                    content.polylines = model.polylines.map(Polyline.init(state:))
                    content.groundImages = model.groundImages.map(GroundImage.init(state:))
                    content.rasterLayers = model.rasterLayers.map(RasterLayer.init(state:))
                    content.markerTilingOptions = model.markerTilingOptions
                    let extensionContent = extensionHost.content
                    content.markers.append(contentsOf: extensionContent.markers)
                    content.polylines.append(contentsOf: extensionContent.polylines)
                    content.polygons.append(contentsOf: extensionContent.polygons)
                    content.circles.append(contentsOf: extensionContent.circles)
                    content.groundImages.append(contentsOf: extensionContent.groundImages)
                    content.rasterLayers.append(contentsOf: extensionContent.rasterLayers)
                    content.views.append(contentsOf: extensionContent.views)
                    return content
                })
        }
    }
}
