Pod::Spec.new do |s|
  s.name           = 'BackgroundAudio'
  s.version        = '1.0.0'
  s.summary        = 'Background audio module for iOS'
  s.description    = 'Native iOS module for background audio playback using AVAudioPlayer. Enables background execution for the Igloo threshold signer.'
  s.author         = 'FROSTR-ORG'
  s.homepage       = 'https://github.com/FROSTR-ORG/igloo-ios'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.0'
  s.source         = { :git => 'https://github.com/FROSTR-ORG/igloo-ios.git', :tag => s.version.to_s }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift}'
end
