#import "MapConductorGoogleMapViewManager.h"
#import <React/RCTBridge.h>
#import <React/RCTUIManager.h>

@interface MCGoogleMapsReactNativeView : UIView
@property(nonatomic, copy) void (^eventHandler)(NSString *, NSDictionary *);
- (void)setCameraPosition:(NSDictionary *)payload;
- (void)setApiKey:(NSString *)value;
- (void)setMapDesignType:(NSString *)value;
- (void)setMarkerTilingOptions:(NSDictionary *)payload;
- (void)setInfoBubblePositions:(NSArray *)positions;
- (void)moveCamera:(NSDictionary *)payload duration:(double)duration;
- (void)fitBounds:(NSDictionary *)bounds padding:(NSInteger)padding;
- (void)clearOverlays;
- (void)beginMarkerComposition:(NSInteger)generation icons:(NSArray *)icons;
- (void)appendMarkerComposition:(NSInteger)generation sequence:(NSInteger)sequence payload:(NSDictionary *)payload;
- (void)commitMarkerComposition:(NSInteger)generation;
- (void)updateMarker:(NSDictionary *)payload;
- (void)compositionCircles:(NSArray *)payload;
- (void)updateCircle:(NSDictionary *)payload;
- (void)compositionGroundImages:(NSArray *)payload;
- (void)updateGroundImage:(NSDictionary *)payload;
- (void)compositionPolygons:(NSArray *)payload;
- (void)updatePolygon:(NSDictionary *)payload;
- (void)compositionPolylines:(NSArray *)payload;
- (void)updatePolyline:(NSDictionary *)payload;
- (void)compositionRasterLayers:(NSArray *)payload;
- (void)updateRasterLayer:(NSDictionary *)payload;
- (void)upsertNativeMapExtension:(NSString *)extensionId type:(NSString *)type payload:(NSDictionary *)payload;
- (void)removeNativeMapExtension:(NSString *)extensionId;
@end

@interface MapConductorGoogleMapsContainerView : UIView
@property(nonatomic, strong) MCGoogleMapsReactNativeView *mapView;
@property(nonatomic, copy) RCTDirectEventBlock onMapLoaded;
@property(nonatomic, copy) RCTDirectEventBlock onMarkerCompositionBatchProcessed;
@property(nonatomic, copy) RCTDirectEventBlock onMapClick;
@property(nonatomic, copy) RCTDirectEventBlock onMapLongClick;
@property(nonatomic, copy) RCTDirectEventBlock onCameraMoveStart;
@property(nonatomic, copy) RCTDirectEventBlock onCameraMove;
@property(nonatomic, copy) RCTDirectEventBlock onCameraMoveEnd;
@property(nonatomic, copy) RCTDirectEventBlock onMarkerClick;
@property(nonatomic, copy) RCTDirectEventBlock onCircleClick;
@property(nonatomic, copy) RCTDirectEventBlock onGroundImageClick;
@property(nonatomic, copy) RCTDirectEventBlock onPolylineClick;
@property(nonatomic, copy) RCTDirectEventBlock onPolygonClick;
@property(nonatomic, copy) RCTDirectEventBlock onMarkerDragStart;
@property(nonatomic, copy) RCTDirectEventBlock onMarkerDrag;
@property(nonatomic, copy) RCTDirectEventBlock onMarkerDragEnd;
@property(nonatomic, copy) RCTDirectEventBlock onMarkerAnimateStart;
@property(nonatomic, copy) RCTDirectEventBlock onMarkerAnimateEnd;
@property(nonatomic, copy) RCTDirectEventBlock onMarkerScreenPositions;
@property(nonatomic, copy) RCTDirectEventBlock onInfoBubbleScreenPositions;
@property(nonatomic, copy) RCTDirectEventBlock onNativeMapExtensionEvent;
@end

@implementation MapConductorGoogleMapsContainerView

- (instancetype)init
{
  if ((self = [super init])) {
    Class mapViewClass = NSClassFromString(@"MCGoogleMapsReactNativeView");
    NSAssert(mapViewClass != Nil, @"MapConductorForGoogleMaps XCFramework is not linked");
    _mapView = [[mapViewClass alloc] initWithFrame:CGRectZero];
    [self addSubview:_mapView];
    __weak typeof(self) weakSelf = self;
    _mapView.eventHandler = ^(NSString *name, NSDictionary *body) {
      [weakSelf emit:name body:body];
    };
  }
  return self;
}

- (void)layoutSubviews
{
  [super layoutSubviews];
  self.mapView.frame = self.bounds;
}

- (void)emit:(NSString *)name body:(NSDictionary *)body
{
  if ([name isEqualToString:@"mapLoaded"] && self.onMapLoaded) self.onMapLoaded(body);
  else if ([name isEqualToString:@"markerCompositionBatchProcessed"] && self.onMarkerCompositionBatchProcessed) self.onMarkerCompositionBatchProcessed(body);
  else if ([name isEqualToString:@"mapClick"] && self.onMapClick) self.onMapClick(body);
  else if ([name isEqualToString:@"mapLongClick"] && self.onMapLongClick) self.onMapLongClick(body);
  else if ([name isEqualToString:@"cameraMoveStart"] && self.onCameraMoveStart) self.onCameraMoveStart(body);
  else if ([name isEqualToString:@"cameraMove"] && self.onCameraMove) self.onCameraMove(body);
  else if ([name isEqualToString:@"cameraMoveEnd"] && self.onCameraMoveEnd) self.onCameraMoveEnd(body);
  else if ([name isEqualToString:@"markerClick"] && self.onMarkerClick) self.onMarkerClick(body);
  else if ([name isEqualToString:@"circleClick"] && self.onCircleClick) self.onCircleClick(body);
  else if ([name isEqualToString:@"groundImageClick"] && self.onGroundImageClick) self.onGroundImageClick(body);
  else if ([name isEqualToString:@"polylineClick"] && self.onPolylineClick) self.onPolylineClick(body);
  else if ([name isEqualToString:@"polygonClick"] && self.onPolygonClick) self.onPolygonClick(body);
  else if ([name isEqualToString:@"markerDragStart"] && self.onMarkerDragStart) self.onMarkerDragStart(body);
  else if ([name isEqualToString:@"markerDrag"] && self.onMarkerDrag) self.onMarkerDrag(body);
  else if ([name isEqualToString:@"markerDragEnd"] && self.onMarkerDragEnd) self.onMarkerDragEnd(body);
  else if ([name isEqualToString:@"markerAnimateStart"] && self.onMarkerAnimateStart) self.onMarkerAnimateStart(body);
  else if ([name isEqualToString:@"markerAnimateEnd"] && self.onMarkerAnimateEnd) self.onMarkerAnimateEnd(body);
  else if ([name isEqualToString:@"markerScreenPositions"] && self.onMarkerScreenPositions) self.onMarkerScreenPositions(body);
  else if ([name isEqualToString:@"infoBubbleScreenPositions"] && self.onInfoBubbleScreenPositions) self.onInfoBubbleScreenPositions(body);
  else if ([name isEqualToString:@"nativeMapExtensionEvent"] && self.onNativeMapExtensionEvent) self.onNativeMapExtensionEvent(body);
}

@end

// `RCT_EXPORT_MODULE` already generates a `+load` (to call `RCTRegisterModule`), so this uses a
// separate `__attribute__((constructor))` function rather than a second `+load` (which would be a
// duplicate-method compile error). `GoogleMapView` isn't a Codegen'd Fabric component (it predates
// codegen adoption in this repo), so it needs this explicit legacy-interop registration to avoid
// "View config not found for component `GoogleMapView`" under bridgeless New Architecture.
// Resolved dynamically (no `#import <React/RCTLegacyViewManagerInteropComponentView.h>`) so this
// pod doesn't take on React-RCTFabric's transitive C++/Yoga header dependency just to reach one
// registration call.
__attribute__((constructor))
static void MCGoogleMapRegisterLegacyViewManagerInterop(void)
{
  Class cls = NSClassFromString(@"RCTLegacyViewManagerInteropComponentView");
  SEL selector = NSSelectorFromString(@"supportLegacyViewManagerWithName:");
  if (cls && [cls respondsToSelector:selector]) {
#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Warc-performSelector-leaks"
    [cls performSelector:selector withObject:@"GoogleMapView"];
#pragma clang diagnostic pop
  }
}

@implementation MapConductorGoogleMapViewManager

RCT_EXPORT_MODULE(GoogleMapView)

- (UIView *)view
{
  return [MapConductorGoogleMapsContainerView new];
}

RCT_EXPORT_VIEW_PROPERTY(onMapLoaded, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMarkerCompositionBatchProcessed, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMapClick, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMapLongClick, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onCameraMoveStart, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onCameraMove, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onCameraMoveEnd, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMarkerClick, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onCircleClick, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onGroundImageClick, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPolylineClick, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPolygonClick, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMarkerDragStart, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMarkerDrag, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMarkerDragEnd, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMarkerAnimateStart, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMarkerAnimateEnd, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMarkerScreenPositions, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onInfoBubbleScreenPositions, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onNativeMapExtensionEvent, RCTDirectEventBlock)

RCT_CUSTOM_VIEW_PROPERTY(cameraPosition, NSDictionary, MapConductorGoogleMapsContainerView)
{
  if (json) [view.mapView setCameraPosition:json];
}

RCT_CUSTOM_VIEW_PROPERTY(apiKey, NSString, MapConductorGoogleMapsContainerView)
{
  [view.mapView setApiKey:json];
}

RCT_CUSTOM_VIEW_PROPERTY(mapDesignType, NSString, MapConductorGoogleMapsContainerView)
{
  [view.mapView setMapDesignType:json];
}

RCT_CUSTOM_VIEW_PROPERTY(markerTilingOptions, NSDictionary, MapConductorGoogleMapsContainerView)
{
  [view.mapView setMarkerTilingOptions:json];
}

RCT_CUSTOM_VIEW_PROPERTY(infoBubblePositions, NSArray, MapConductorGoogleMapsContainerView)
{
  [view.mapView setInfoBubblePositions:json ?: @[]];
}

- (void)withView:(NSNumber *)reactTag block:(void (^)(MCGoogleMapsReactNativeView *))block
{
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *manager, NSDictionary<NSNumber *, UIView *> *registry) {
    UIView *view = registry[reactTag];
    if (![view isKindOfClass:[MapConductorGoogleMapsContainerView class]]) return;
    block(((MapConductorGoogleMapsContainerView *)view).mapView);
  }];
}

RCT_EXPORT_METHOD(clearOverlays:(nonnull NSNumber *)reactTag)
{
  [self withView:reactTag block:^(MCGoogleMapsReactNativeView *view) { [view clearOverlays]; }];
}

RCT_EXPORT_METHOD(moveCamera:(nonnull NSNumber *)reactTag position:(nonnull NSDictionary *)position)
{
  [self withView:reactTag block:^(MCGoogleMapsReactNativeView *view) { [view moveCamera:position duration:0]; }];
}

RCT_EXPORT_METHOD(animateCamera:(nonnull NSNumber *)reactTag position:(nonnull NSDictionary *)position duration:(double)duration)
{
  [self withView:reactTag block:^(MCGoogleMapsReactNativeView *view) { [view moveCamera:position duration:duration]; }];
}

RCT_EXPORT_METHOD(fitBounds:(nonnull NSNumber *)reactTag bounds:(nonnull NSDictionary *)bounds padding:(NSInteger)padding)
{
  [self withView:reactTag block:^(MCGoogleMapsReactNativeView *view) { [view fitBounds:bounds padding:padding]; }];
}

RCT_EXPORT_METHOD(beginMarkerComposition:(nonnull NSNumber *)reactTag generation:(NSInteger)generation icons:(nonnull NSArray *)icons)
{
  [self withView:reactTag block:^(MCGoogleMapsReactNativeView *view) { [view beginMarkerComposition:generation icons:icons]; }];
}

RCT_EXPORT_METHOD(appendMarkerComposition:(nonnull NSNumber *)reactTag generation:(NSInteger)generation sequence:(NSInteger)sequence payload:(nonnull NSDictionary *)payload)
{
  [self withView:reactTag block:^(MCGoogleMapsReactNativeView *view) {
    [view appendMarkerComposition:generation sequence:sequence payload:payload];
  }];
}

RCT_EXPORT_METHOD(commitMarkerComposition:(nonnull NSNumber *)reactTag generation:(NSInteger)generation)
{
  [self withView:reactTag block:^(MCGoogleMapsReactNativeView *view) { [view commitMarkerComposition:generation]; }];
}

RCT_EXPORT_METHOD(updateMarker:(nonnull NSNumber *)reactTag payload:(nonnull NSDictionary *)payload)
{
  [self withView:reactTag block:^(MCGoogleMapsReactNativeView *view) { [view updateMarker:payload]; }];
}

#define MC_EXPORT_ARRAY_COMMAND(command) \
RCT_EXPORT_METHOD(command:(nonnull NSNumber *)reactTag payload:(nonnull NSArray *)payload) \
{ \
  [self withView:reactTag block:^(MCGoogleMapsReactNativeView *view) { \
    if ([view respondsToSelector:@selector(command:)]) [view command:payload]; \
  }]; \
}

#define MC_EXPORT_OBJECT_COMMAND(command) \
RCT_EXPORT_METHOD(command:(nonnull NSNumber *)reactTag payload:(nonnull NSDictionary *)payload) \
{ \
  [self withView:reactTag block:^(MCGoogleMapsReactNativeView *view) { \
    if ([view respondsToSelector:@selector(command:)]) [view command:payload]; \
  }]; \
}

MC_EXPORT_ARRAY_COMMAND(compositionCircles)
MC_EXPORT_OBJECT_COMMAND(updateCircle)
MC_EXPORT_ARRAY_COMMAND(compositionGroundImages)
MC_EXPORT_OBJECT_COMMAND(updateGroundImage)
MC_EXPORT_ARRAY_COMMAND(compositionPolygons)
MC_EXPORT_OBJECT_COMMAND(updatePolygon)
MC_EXPORT_ARRAY_COMMAND(compositionPolylines)
MC_EXPORT_OBJECT_COMMAND(updatePolyline)
MC_EXPORT_ARRAY_COMMAND(compositionRasterLayers)
MC_EXPORT_OBJECT_COMMAND(updateRasterLayer)

RCT_EXPORT_METHOD(upsertNativeMapExtension:(nonnull NSNumber *)reactTag
                  extensionId:(nonnull NSString *)extensionId
                  type:(nonnull NSString *)type
                  payload:(nonnull NSDictionary *)payload)
{
  [self withView:reactTag block:^(MCGoogleMapsReactNativeView *view) {
    if ([view respondsToSelector:@selector(upsertNativeMapExtension:type:payload:)]) {
      [view upsertNativeMapExtension:extensionId type:type payload:payload];
    }
  }];
}

RCT_EXPORT_METHOD(removeNativeMapExtension:(nonnull NSNumber *)reactTag extensionId:(nonnull NSString *)extensionId)
{
  [self withView:reactTag block:^(MCGoogleMapsReactNativeView *view) {
    if ([view respondsToSelector:@selector(removeNativeMapExtension:)]) {
      [view removeNativeMapExtension:extensionId];
    }
  }];
}

#undef MC_EXPORT_ARRAY_COMMAND
#undef MC_EXPORT_OBJECT_COMMAND

@end
