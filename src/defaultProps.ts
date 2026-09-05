import type {
  WallpaperBoolValue,
  WallpaperColorValue,
  WallpaperSliderValue,
} from "wallpaper-engine";

export type DefaultWEProps = {
  audioprocessing?: WallpaperBoolValue;
  schemecolor: WallpaperColorValue;
  alignmentfliph: WallpaperBoolValue;
  wec_e: WallpaperBoolValue; // Show color options
  wec_brs: WallpaperSliderValue; // Brightness
  wec_con: WallpaperSliderValue; // Contrast
  wec_sa: WallpaperSliderValue; // Saturation
  wec_hue: WallpaperSliderValue; // Hue shift
};

export const DefaultWEProps: DefaultWEProps = {
  schemecolor: { value: "0 0 0" },
  alignmentfliph: { value: false },
  wec_e: { value: false },
  wec_brs: { value: 50 },
  wec_con: { value: 50 },
  wec_sa: { value: 50 },
  wec_hue: { value: 50 },
};
