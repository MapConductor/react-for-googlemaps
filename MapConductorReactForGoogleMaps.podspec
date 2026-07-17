require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name = "MapConductorReactForGoogleMaps"
  s.version = package["version"]
  s.summary = package["description"]
  s.license = package["license"]
  s.author = package["author"]
  s.homepage = "https://github.com/mapconductor/react-sdk"
  s.source = { :path => __dir__ }
  s.platforms = { :ios => "16.0" }
  s.source_files = "ios/*.{h,m,mm,swift}"
  s.vendored_frameworks = "ios/Frameworks/MapConductorForGoogleMaps.xcframework"
  s.resources = "ios/Frameworks/GoogleMaps.bundle"
  s.preserve_paths = "ios/Frameworks/GoogleMapsHeaders/**/*"
  s.pod_target_xcconfig = {
    "FRAMEWORK_SEARCH_PATHS" => "$(inherited) \"${PODS_TARGET_SRCROOT}/ios/Frameworks/GoogleMapsHeaders\""
  }
  s.dependency "React-Core"
  s.dependency "MapConductorReactNativeCore"
  s.dependency "MapConductorReactMarkerClustering"
end
