require "json"

package = JSON.parse(File.read(File.join(__dir__, "..", "package.json")))

Pod::Spec.new do |s|
  s.name         = "MapConductorReactForGoogleMaps"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.license      = package["license"]
  s.author       = package["author"]
  s.homepage     = "https://github.com/mapconductor/react-sdk"
  s.source       = { :path => "." }
  s.platforms    = { :ios => "13.4" }
  s.source_files = "*.{h,m,mm,swift}"

  s.dependency "React-Core"
end
