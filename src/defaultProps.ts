import type {
  WallpaperBoolProperty,
  WallpaperColorProperty,
  WallpaperSliderProperty,
  // WallpaperDividerProperty,
} from "wallpaper-engine";
import {
  boolProperty,
  colorProperty,
  sliderProperty,
  // dividerProperty,
} from "wallpaper-engine/plugin";

export type DefaultWEProps = {
  // audioprocessing is optional because it will never be passed
  // to applyUserProperties if supportsaudioprocessing == false
  audioprocessing?: WallpaperBoolProperty; // Audio recording
  schemecolor: WallpaperColorProperty; // Scheme color
  alignmentfliph: WallpaperBoolProperty; // Flip
  wec_e: WallpaperBoolProperty; // Show color options
  wec_brs: WallpaperSliderProperty; // Brightness
  wec_con: WallpaperSliderProperty; // Contrast
  wec_sa: WallpaperSliderProperty; // Saturation
  wec_hue: WallpaperSliderProperty; // Hue shift
  // _d0: WallpaperDividerProperty;
};

export const DefaultWEProps: DefaultWEProps = {
  // audioprocessing: boolProperty({
  //   icon: "fa-microphone",
  //   order: -21,
  //   text: "ui_browse_properties_audio_recording",
  //   value: true,
  // }),
  schemecolor: colorProperty({
    // @ts-ignore
    icon: "fa-palette",
    order: -20,
    text: "ui_browse_properties_scheme_color",
    value: "0 0 0",
  }),
  alignmentfliph: boolProperty({
    // @ts-ignore
    icon: "fa-exchange",
    order: -12,
    text: "ui_browse_properties_alignment_flip_horizontally",
    value: false,
  }),
  wec_e: boolProperty({
    order: -8,
    text: "ui_browse_properties_show_color_options",
    value: false,
  }),
  wec_brs: sliderProperty({
    condition: "wec_e.value",
    // @ts-ignore
    icon: "fa-sun",
    max: 100,
    min: 0,
    order: -7,
    text: "ui_browse_properties_brightness",
    value: 50,
  }),
  wec_con: sliderProperty({
    condition: "wec_e.value",
    // @ts-ignore
    icon: "fa-adjust",
    max: 100,
    min: 0,
    order: -6,
    text: "ui_browse_properties_contrast",
    value: 50,
  }),
  wec_sa: sliderProperty({
    condition: "wec_e.value",
    // @ts-ignore
    icon: "fa-tint",
    max: 100,
    min: 0,
    order: -5,
    text: "ui_browse_properties_saturation",
    value: 50,
  }),
  wec_hue: sliderProperty({
    condition: "wec_e.value",
    // @ts-ignore
    icon: "fa-palette",
    max: 100,
    min: 0,
    order: -4,
    text: "ui_browse_properties_hue_shift",
    value: 50,
  }),
  // _d0: dividerProperty({ order: 0 }),
};
