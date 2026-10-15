/**
 * รองรับ UIScene lifecycle — แอปที่ build ด้วย SDK iOS 27 จะถูกปิดทันทีบน iOS 27
 * ถ้ายังใช้ AppDelegate สร้าง window เอง (UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption)
 *
 * - Info.plist: เพิ่ม UIApplicationSceneManifest ชี้ไปที่ SceneDelegate
 * - AppDelegate.swift: ไม่สร้าง window ใน didFinishLaunching แต่เก็บ launchOptions ไว้
 * - SceneDelegate: สร้าง window จาก UIWindowScene แล้วเริ่ม React Native
 */
const { withInfoPlist, withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARK = '// @scene-lifecycle';

const SCENE_DELEGATE = `
${MARK}
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene,
          let appDelegate = UIApplication.shared.delegate as? AppDelegate,
          let factory = appDelegate.reactNativeFactory else { return }
    let window = UIWindow(windowScene: windowScene)
    self.window = window
    appDelegate.window = window
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: appDelegate.launchOptions)
    if let url = connectionOptions.urlContexts.first?.url {
      _ = RCTLinkingManager.application(UIApplication.shared, open: url, options: [:])
    }
  }

  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    for context in URLContexts {
      _ = RCTLinkingManager.application(UIApplication.shared, open: context.url, options: [:])
    }
  }

  func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
    _ = RCTLinkingManager.application(UIApplication.shared, continue: userActivity, restorationHandler: { _ in })
  }
}
`;

function patchAppDelegate(src) {
  if (src.includes(MARK)) return src;
  // เก็บ launchOptions ไว้ให้ SceneDelegate
  src = src.replace(
    '  var reactNativeFactory: RCTReactNativeFactory?\n',
    '  var reactNativeFactory: RCTReactNativeFactory?\n  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?\n',
  );
  // ไม่สร้าง window ที่ AppDelegate (SceneDelegate ทำแทน)
  src = src.replace(
    /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n/,
    '    self.launchOptions = launchOptions\n',
  );
  return src + SCENE_DELEGATE;
}

module.exports = (config) => {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, cfg.modRequest.projectName, 'AppDelegate.swift');
      if (fs.existsSync(file)) fs.writeFileSync(file, patchAppDelegate(fs.readFileSync(file, 'utf8')));
      return cfg;
    },
  ]);
};
