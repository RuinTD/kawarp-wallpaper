import {
  colorProperty,
  comboProperty,
  fileProperty,
  sliderProperty,
  groupProperty,
  boolProperty,
} from "wallpaper-engine/plugin";

const isCustomGradient = "fallback.value == 'gradient'";

export const myProperties = {
  artGroup: groupProperty({ text: "Artwork Settings" }),
  fallback: comboProperty({
    text: "Default Background",
    value: "presets/mountains.jpg",
    options: [
      { label: "Mountains", value: "presets/mountains.jpg" },
      { label: "Ocean", value: "presets/ocean.jpg" },
      { label: "Forest", value: "presets/forest.jpg" },
      { label: "Sunset", value: "presets/sunset.jpg" },
      { label: "Aurora", value: "presets/aurora.jpg" },
      { label: "Desert", value: "presets/desert.jpg" },
      { label: "Pride Flag", value: "pride" },
      { label: "Custom Image", value: "custom" },
      { label: "Custom Gradient", value: "gradient" },
    ],
  }),
  pridePreset: comboProperty({
    text: "Pride Flag",
    condition: "fallback.value == 'pride'",
    value: "pride/rainbow.png",
    options: [
      { label: "Rainbow", value: "pride/rainbow.png" },
      { label: "Progress", value: "pride/progress.png" },
      { label: "Aromantic", value: "pride/aromantic.png" },
      { label: "Asexual", value: "pride/asexual.png" },
      { label: "Bisexual", value: "pride/bisexual.png" },
      { label: "Gay Man", value: "pride/gaymen.png" },
      { label: "Intersex", value: "pride/intersex.png" },
      { label: "Lesbian", value: "pride/lesbian.png" },
      { label: "Non-Binary", value: "pride/nonbinary.png" },
      { label: "Pansexual", value: "pride/pansexual.png" },
      { label: "Transgender", value: "pride/transgender.png" },
    ],
  }),
  customImg: fileProperty({
    text: "Custom BG",
    value: "",
    fileType: "image",
    condition: "fallback.value == 'custom'",
  }),
  gradientSteps: sliderProperty({
    text: "# of Gradient Colors",
    value: 7,
    min: 2,
    max: 10,
    condition: isCustomGradient,
  }),
  gradientColor1: colorProperty({
    text: "Color 1",
    value: "#ff0000",
    condition: `${isCustomGradient} && gradientSteps.value >= 1`,
  }),
  gradientColor2: colorProperty({
    text: "Color 2",
    value: "#ff8000",
    condition: `${isCustomGradient} && gradientSteps.value >= 2`,
  }),
  gradientColor3: colorProperty({
    text: "Color 3",
    value: "#ffff00",
    condition: `${isCustomGradient} && gradientSteps.value >= 3`,
  }),
  gradientColor4: colorProperty({
    text: "Color 4",
    value: "#00ff00",
    condition: `${isCustomGradient} && gradientSteps.value >= 4`,
  }),
  gradientColor5: colorProperty({
    text: "Color 5",
    value: "#00ffff",
    condition: `${isCustomGradient} && gradientSteps.value >= 5`,
  }),
  gradientColor6: colorProperty({
    text: "Color 6",
    value: "#0000ff",
    condition: `${isCustomGradient} && gradientSteps.value >= 6`,
  }),
  gradientColor7: colorProperty({
    text: "Color 7",
    value: "#8000ff",
    condition: `${isCustomGradient} && gradientSteps.value >= 7`,
  }),
  gradientColor8: colorProperty({
    text: "Color 8",
    value: "#000000",
    condition: `${isCustomGradient} && gradientSteps.value >= 8`,
  }),
  gradientColor9: colorProperty({
    text: "Color 9",
    value: "#000000",
    condition: `${isCustomGradient} && gradientSteps.value >= 9`,
  }),
  gradientColor10: colorProperty({
    text: "Color 10",
    value: "#000000",
    condition: `${isCustomGradient} && gradientSteps.value >= 10`,
  }),
  useAlbumArt: comboProperty({
    text: "Use Media Art",
    value: "playing",
    options: [
      { label: "Never", value: "never" },
      { label: "While Playing", value: "playing" },
      { label: "Playing or Paused", value: "playorpause" },
    ],
  }),
  artDetectMusic: boolProperty({
    text: "Detect Music",
    value: true,
    condition: "useAlbumArt.value != 'never'",
  }),
  artDetectVideo: boolProperty({
    text: "Detect Videos",
    value: true,
    condition: "useAlbumArt.value != 'never'",
  }),
  artDetectImage: boolProperty({
    text: "Detect Images",
    value: true,
    condition: "useAlbumArt.value != 'never'",
  }),

  kuwarpGroup: groupProperty({ text: "Kuwarp Settings" }),
  warpIntensity: sliderProperty({
    text: "Warp Intensity",
    value: 1,
    min: 0,
    max: 1,
    fraction: true,
    precision: 2,
  }),
  blurPasses: sliderProperty({
    text: "Blur Passes",
    value: 8,
    min: 1,
    max: 40,
  }),
  animationSpeed: sliderProperty({
    text: "Animation Speed",
    value: 1,
    min: 0.1,
    max: 2,
    fraction: true,
    precision: 1,
  }),
  transitionDuration: sliderProperty({
    text: "Transition Duration (Seconds)",
    value: 1,
    min: 0,
    max: 3,
    fraction: true,
    precision: 1,
  }),
  // WE already has a saturation slider
  // saturation: sliderProperty({
  //   text: "Saturation",
  //   value: 1.5,
  //   min: 0,
  //   max: 2,
  //   fraction: true,
  //   precision: 2,
  //   // @ts-expect-error - https://github.com/ShadowNineX/wallpaper-engine/issues/3
  //   step: 0.01,
  // }),
  dithering: sliderProperty({
    text: "Dithering",
    value: 8,
    min: 0,
    max: 100,
  }),

  audioGroup: groupProperty({
    text: "Audio Responsive Settings",
    condition: "audioprocessing.value == true",
  }),
  audioMethod: comboProperty({
    text: "Scaling Method",
    condition: "audioprocessing.value == true",
    value: "beat",
    options: [
      { label: "Beat Detection", value: "beat" },
      { label: "Average Volume", value: "average" },
    ],
  }),
  audioSpeedMult: sliderProperty({
    text: "Speed Multiplier",
    condition: "audioprocessing.value == true",
    value: 4,
    min: 2,
    max: 8,
    fraction: true,
    precision: 1,
  }),
  audioScaleBoost: sliderProperty({
    text: "Scale Boost",
    condition: "audioprocessing.value == true",
    value: 2,
    min: 0,
    max: 10,
    fraction: true,
    precision: 1,
  }),
};
