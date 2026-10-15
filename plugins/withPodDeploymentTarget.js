// Xcode 26+ ปฏิเสธ pod ที่ตั้ง IPHONEOS_DEPLOYMENT_TARGET ต่ำกว่า 15 → ยกทุก pod ขึ้นเป็น 15.1
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARK = '# @suebsan pod deployment target';
const SNIPPET = `
    ${MARK}
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        if c.build_settings["IPHONEOS_DEPLOYMENT_TARGET"].to_f < 15.1
          c.build_settings["IPHONEOS_DEPLOYMENT_TARGET"] = "15.1"
        end
      end
    end`;

module.exports = (config) =>
  withDangerousMod(config, [
    'ios',
    (cfg) => {
      const file = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let src = fs.readFileSync(file, 'utf8');
      if (!src.includes(MARK)) {
        src = src.replace(/(post_install do \|installer\|\n\s*react_native_post_install\([\s\S]*?\n\s*\))/, `$1\n${SNIPPET}`);
        fs.writeFileSync(file, src);
      }
      return cfg;
    },
  ]);
