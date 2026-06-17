/**
 * Expo config plugin: pin the Gradle wrapper version.
 *
 * React Native 0.85 ships AGP 8.12 + Kotlin 2.1.20 (which reference
 * JvmVendorSpec.IBM_SEMERU, removed in Gradle 9), but `expo prebuild` writes a
 * Gradle 9.3.1 wrapper — causing a build failure. This rewrites the wrapper to a
 * Gradle 8.x version on every prebuild so the fix survives regeneration.
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const GRADLE_VERSION = "8.13";

module.exports = function withGradleVersion(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const file = path.join(
        cfg.modRequest.platformProjectRoot,
        "gradle",
        "wrapper",
        "gradle-wrapper.properties",
      );
      if (fs.existsSync(file)) {
        const url = `https\\://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip`;
        const next = fs
          .readFileSync(file, "utf8")
          .replace(/distributionUrl=.*/m, `distributionUrl=${url}`);
        fs.writeFileSync(file, next);
      }
      return cfg;
    },
  ]);
};
