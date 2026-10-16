Pod::Spec.new do |s|
  s.name           = 'CardDetect'
  s.version        = '1.0.0'
  s.summary        = 'Detect ID-card rectangles with Apple Vision'
  s.author         = 'MhoBhaanChueamJai'
  s.homepage       = 'https://github.com/MhoBhaanChueamJai/Mho-Bhaan-Chueam-Jai'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
  s.frameworks = 'Vision'
end
