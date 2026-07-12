#import "MapConductorGoogleMapsViewManager.h"
#import <UIKit/UIKit.h>

@implementation MapConductorGoogleMapsViewManager

RCT_EXPORT_MODULE(GoogleMapView)

- (UIView *)view
{
  UILabel *label = [UILabel new];
  label.text = @"HelloWorld";
  label.textAlignment = NSTextAlignmentCenter;
  label.textColor = UIColor.blackColor;
  label.font = [UIFont systemFontOfSize:24 weight:UIFontWeightRegular];
  return label;
}

@end
