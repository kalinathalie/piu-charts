// Map of song id -> bundled cover thumbnail. Metro needs static require() paths,
// so this list is generated/maintained per song that has an image in assets/thumbs.
// (Test set — extend to all songs once the look is approved.)
export const THUMBS: Record<string, number> = {
  nxde: require("../assets/thumbs/nxde.png"),
  boca: require("../assets/thumbs/boca.png"),
  bee: require("../assets/thumbs/bee.png"),
  beethoven_virus: require("../assets/thumbs/beethoven_virus.png"),
};
