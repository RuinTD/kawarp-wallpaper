// deno-lint-ignore-file no-window
import "wallpaper-engine";
import { Kawarp } from "@kawarp/core";
import type { WallpaperUserPropertiesOf } from "wallpaper-engine/plugin";
import { myProperties } from "./properties.ts";
import {
  toFileUrl,
  wallpaperColorToHex,
  getMediaPlaybackStatus,
  createAudioAnalyzer,
  createFpsLimiter,
} from "wallpaper-engine/helpers";
import { mapValues } from "es-toolkit/object";
import "./style.css";
import type {
  WallpaperMediaPlaybackState,
  WallpaperMediaPropertiesEvent,
  WallpaperMediaThumbnailEvent,
} from "wallpaper-engine";
import { isEqual, throttle } from "es-toolkit";
import { assert } from "@std/assert";
import { DefaultWEProps } from "./defaultProps.ts";
import type { Simplify } from "type-fest";

const canvas = document.querySelector("canvas");
assert(canvas);
canvas.height = window.innerHeight;
canvas.width = window.innerWidth;
const kawarp = new Kawarp(canvas);

const SCALE_LERP_UP = 0.5;
const SCALE_LERP_DOWN = 0.12;
const SCALE_THRESHOLD = 0.001;

const SPEED_LERP_UP = 0.05;
const SPEED_LERP_DOWN = 0.03;
const SPEED_THRESHOLD = 0.001;

let currentScale = 1;
let currentSpeed = 1;
const loop = createFpsLimiter((_dt) => {
  const speedBoost = props.audioSpeedMult;
  const scaleBoost = props.audioScaleBoost;

  let speedMult = 1;
  let scaleMult = 1;
  switch (props.audioMethod) {
    case "beat":
      console.log("beat", analyzer.beat);
      if (analyzer.beat) {
        speedMult = speedBoost;
        scaleMult = 1 + scaleBoost / 100;
      }
      break;
    case "average": {
      const vol = analyzer.rmsVolume;
      const peak = analyzer.decayingPeakVolume;
      const ratio = peak > 0 ? vol / peak : 0;
      // console.log("avg vol", ratio, vol, peak);

      speedMult = 1 + ratio * speedBoost;
      scaleMult = 1 + (ratio * scaleBoost) / 100;
      break;
    }
  }

  const scaleDiff = scaleMult - currentScale;
  if (Math.abs(scaleDiff) >= SCALE_THRESHOLD) {
    const lerpFactor = scaleDiff > 0 ? SCALE_LERP_UP : SCALE_LERP_DOWN;
    currentScale += scaleDiff * lerpFactor;
  } else currentScale = scaleMult;
  kawarp.scale = currentScale;

  const speedDiff = speedMult - currentSpeed;
  if (Math.abs(speedDiff) >= SPEED_THRESHOLD) {
    const lerpFactor = speedDiff > 0 ? SPEED_LERP_UP : SPEED_LERP_DOWN;
    currentSpeed += speedDiff * lerpFactor;
  } else currentSpeed = speedMult;
  kawarp.animationSpeed = props.animationSpeed * currentSpeed;

  // console.log(
  //   { audioAvg, audioPeak },
  //   { speedMultiplier: speedMult, scaleMultiplier: scaleMult },
  //   { currentSpeed, currentScale },
  //   { kawarpAnimationSpeed: kawarp.animationSpeed, kawarpScale: kawarp.scale },
  // );

  kawarp.renderFrame();
});

type MyProps = Simplify<
  DefaultWEProps & WallpaperUserPropertiesOf<typeof myProperties>
>;
type MyPropValues = {
  [K in keyof MyProps]: NonNullable<MyProps[K]>["value"];
};
let props = mapValues(
  { ...DefaultWEProps, ...myProperties },
  (v) => v?.value,
) as MyPropValues;
window.wallpaperPropertyListener = {
  applyUserProperties(_props: Partial<MyProps>) {
    props = {
      ...props,
      ...(mapValues(_props, (v) => v!.value) as Partial<MyPropValues>),
    };
    console.log("props", _props, props);
    if (_props.transitionDuration)
      _useThumbnail = throttle(__useThumbnail, props.transitionDuration * 1000);
    useThumbnail();

    kawarp.warpIntensity = props.warpIntensity;
    kawarp.blurPasses = props.blurPasses;
    // kawarp.animationSpeed = props.animationSpeed;
    kawarp.transitionDuration = props.transitionDuration * 1000;
    // kawarp.saturation = props.saturation;
    kawarp.dithering = props.dithering / 1000;
  },
  applyGeneralProperties(properties) {
    if (properties.fps !== undefined) loop.setLimit(properties.fps);
  },
  setPaused(paused) {
    if (paused) loop.stop();
    else loop.start();
  },
};

addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  kawarp.resize();
});

const defaultImg = "presets/mountains.jpg";
let lastThumbnail: string | string[] = "";
function getThumbnail(): string | string[] | undefined {
  const thumbnail: string | undefined = media.artwork?.thumbnail;
  const state = getMediaPlaybackStatus(media.playback);

  const isPlaybackActive =
    (props.useAlbumArt == "playing" && state == "playing") ||
    (props.useAlbumArt == "playorpause" && state != "stopped");
  const artDetectionMap = {
    music: props.artDetectMusic,
    video: props.artDetectVideo,
    image: props.artDetectImage,
  };
  const isContentAllowed =
    media.properties?.contentType &&
    artDetectionMap[media.properties.contentType];
  const shouldShowArt =
    isPlaybackActive &&
    isContentAllowed &&
    thumbnail &&
    thumbnail.slice(thumbnail.indexOf(",") + 1);

  if (shouldShowArt) return thumbnail;
  else if (props.fallback == "gradient") {
    const colors = [];
    for (let i = 1; i <= props.gradientSteps; i++) {
      // @ts-ignore will be a string
      const color: string = props[`gradientColor${i}`];
      // console.log(color, wallpaperColorToHex(color));
      colors.push(wallpaperColorToHex(color));
    }
    return colors;
  } else {
    switch (props.fallback) {
      case "custom":
        if (props.customImg) return toFileUrl(props.customImg);
        break;
      case "pride":
        return props.pridePreset;
      default:
        return props.fallback;
    }
  }
}

async function __useThumbnail(thumbnail: string | string[]) {
  // console.log("thumbnail", thumbnail);
  if (Array.isArray(thumbnail)) kawarp.loadGradient(thumbnail);
  else await kawarp.loadImage(thumbnail);
}
let _useThumbnail = throttle(__useThumbnail, 0);
function useThumbnail() {
  const newThumbnail = getThumbnail() || defaultImg;
  if (isEqual(lastThumbnail, newThumbnail)) return;
  lastThumbnail = newThumbnail;
  _useThumbnail(newThumbnail);
}

interface MediaState {
  enabled: boolean;
  properties?: WallpaperMediaPropertiesEvent;
  artwork?: WallpaperMediaThumbnailEvent;
  playback: WallpaperMediaPlaybackState;
  position: number;
  duration: number;
}

const media: MediaState = {
  enabled: false,
  playback: window.wallpaperMediaIntegration.PLAYBACK_STOPPED,
  position: 0,
  duration: 0,
};

window.wallpaperRegisterMediaStatusListener((event) => {
  media.enabled = event.enabled;
  if (event.enabled) return;
  media.properties = undefined;
  media.artwork = undefined;
  media.playback = window.wallpaperMediaIntegration.PLAYBACK_STOPPED;
  media.position = 0;
  media.duration = 0;
});
window.wallpaperRegisterMediaPropertiesListener((event) => {
  media.properties = event;
});
window.wallpaperRegisterMediaThumbnailListener((event) => {
  media.artwork = event;
  // console.log("thumbnail", media);
  useThumbnail();
});
window.wallpaperRegisterMediaPlaybackListener((event) => {
  media.playback = event.state;
  useThumbnail();
});
window.wallpaperRegisterMediaTimelineListener((event) => {
  media.position = Math.max(0, event.position);
  media.duration = Math.max(0, event.duration);
});

const analyzer = createAudioAnalyzer();
let previousAudioTime: number | undefined;

window.wallpaperRegisterAudioListener((samples) => {
  const now = performance.now();
  const deltaSeconds =
    previousAudioTime === undefined
      ? undefined
      : (now - previousAudioTime) / 1_000;
  previousAudioTime = now;

  analyzer.process(samples, deltaSeconds);
});

useThumbnail();
loop.start();
