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
  WallpaperPropertyListenerOf,
} from "wallpaper-engine";
import { clamp, isEqual, throttle } from "es-toolkit";
import { assert } from "@std/assert";
import { DefaultWEProps } from "./defaultProps.ts";

const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

const canvas = $("canvas");
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

  if (props.debug) {
    let thumbnail = getThumbnail() || defaultImg;
    if (Array.isArray(thumbnail)) thumbnail = makeGradient(thumbnail);
    $<HTMLImageElement>("#debug-art")!.src = thumbnail;

    debugNumber("#debug-averageVolume", analyzer.averageVolume);
    debugNumber("#debug-rmsVolume", analyzer.rmsVolume);
    debugNumber("#debug-peakVolume", analyzer.peakVolume);
    debugNumber("#debug-leftVolume", analyzer.leftVolume);
    debugNumber("#debug-rightVolume", analyzer.rightVolume);
    // debugProgress("#debug-stereoBalance", analyzer.stereoBalance);
    debugNumber("#debug-leftBalance", clamp(-analyzer.stereoBalance, 1));
    debugNumber("#debug-rightBalance", clamp(analyzer.stereoBalance, 1));
    debugNumber("#debug-bass", analyzer.bass);
    debugNumber("#debug-midrange", analyzer.midrange);
    debugNumber("#debug-treble", analyzer.treble);

    debugNumber("#debug-decayingPeakVolume", analyzer.decayingPeakVolume);
    debugNumber("#debug-kick", analyzer.kick);
    debugNumber("#debug-clap", analyzer.clap);
    debugNumber("#debug-hiHat", analyzer.hiHat);
    debugNumber("#debug-beat", analyzer.beat);
    debugNumber("#debug-bpm", analyzer.bpm);
    debugText(
      "#debug-bpm-text",
      analyzer.bpm ? `${Math.round(analyzer.bpm)} ` : "",
    );
    debugNumber("#debug-onset", analyzer.onset);

    const statusEmojiMap = {
      playing: "▶️",
      paused: "⏸️",
      stopped: "⏹️",
      _: "❌",
    };
    const contentTypeEmojiMap = {
      image: "🖼️",
      music: "🎵",
      video: "📺",
      _: "",
    };

    if (media.artwork) {
      $<HTMLDivElement>("#debug-media-artwork")!.style.display = "block";
      $<HTMLImageElement>("#debug-media-art")!.src = media.artwork.thumbnail;
      debugValue("#debug-media-primary", media.artwork.primaryColor);
      debugValue("#debug-media-secondary", media.artwork.secondaryColor);
      debugValue("#debug-media-tertiary", media.artwork.tertiaryColor);
      debugValue("#debug-media-textColor", media.artwork.textColor);
      debugValue(
        "#debug-media-highContrastColor",
        media.artwork.highContrastColor,
      );
    } else $<HTMLDivElement>("#debug-media-artwork")!.style.display = "none";

    debugText(
      "#debug-media-status",
      !media.enabled
        ? "❌"
        : statusEmojiMap[getMediaPlaybackStatus(media.playback)],
    );
    debugText(
      "#debug-media-type",
      contentTypeEmojiMap[media.properties?.contentType || "_"],
    );

    $<HTMLMeterElement>("#debug-media-prog")!.max = media.duration;
    debugNumber("#debug-media-prog", media.position);
    if (media.duration != 0) {
      const text = `${secsToTime(media.position)} / ${secsToTime(media.duration)}`;
      debugText("#debug-media-prog-text", text);
      $<HTMLMeterElement>("#debug-media-prog")!.style.display = "inline-block";
    } else {
      debugText("#debug-media-prog-text", "");
      $<HTMLMeterElement>("#debug-media-prog")!.style.display = "none";
    }

    if (media.properties) {
      $<HTMLMeterElement>("#debug-media-props")!.style.display = "block";
      debugText("#debug-media-title", media.properties.title || "-");
      debugText("#debug-media-subTitle", media.properties.subTitle || "");
      debugText("#debug-media-artist", media.properties.artist || "-");
      debugText("#debug-media-albumArtist", media.properties.albumArtist || "");
      debugText("#debug-media-album", media.properties.albumTitle || "");
      debugText("#debug-media-genres", media.properties.genres || "");
    } else {
      $<HTMLMeterElement>("#debug-media-props")!.style.display = "none";
    }
  }

  // console.log(
  //   { audioAvg, audioPeak },
  //   { speedMultiplier: speedMult, scaleMultiplier: scaleMult },
  //   { currentSpeed, currentScale },
  //   { kawarpAnimationSpeed: kawarp.animationSpeed, kawarpScale: kawarp.scale },
  // );

  kawarp.renderFrame();
});

function secsToTime(secs: number): string {
  if (isNaN(secs) || secs < 0) return "0:00";

  const hours = Math.floor(secs / (60 * 60));
  const minutes = Math.floor((secs % (60 * 60)) / 60);
  const seconds = Math.floor(secs % 60);

  const pad = (num: number): string => String(num).padStart(2, "0");
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return `${minutes}:${pad(seconds)}`;
}

function makeGradient(colors: string[], angle = 135) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error();

  const angleRad = (angle * Math.PI) / 180;
  const x1 = size / 2 - Math.cos(angleRad) * size;
  const y1 = size / 2 - Math.sin(angleRad) * size;
  const x2 = size / 2 + Math.cos(angleRad) * size;
  const y2 = size / 2 + Math.sin(angleRad) * size;

  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  colors.forEach((color, i) => {
    gradient.addColorStop(i / (colors.length - 1), color);
  });

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas.toDataURL();
}

function debugText(selectors: string, value: string) {
  const el = $(selectors);
  assert(el);
  el.textContent = value;
}

function debugNumber(selectors: string, value: number) {
  const el = $<HTMLMeterElement>(selectors);
  assert(el);
  el.value = value;
}

function debugValue(selectors: string, value: string) {
  const el = $<HTMLInputElement>(selectors);
  assert(el);
  el.value = value;
}

type MyProps = DefaultWEProps & WallpaperUserPropertiesOf<typeof myProperties>;
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

    if (_props.debug)
      for (const el of $$<HTMLDivElement>(".debug"))
        el.style.display = props.debug ? "block" : "none";

    kawarp.warpIntensity = props.warpIntensity;
    kawarp.blurPasses = props.blurPasses;
    // kawarp.animationSpeed = props.animationSpeed;
    kawarp.transitionDuration = props.transitionDuration * 1000;
    kawarp.saturation = props.saturation;
    kawarp.dithering = props.dithering / 1000;
  },
  applyGeneralProperties(properties) {
    if (properties.fps !== undefined) loop.setLimit(properties.fps);
  },
  setPaused(paused) {
    if (paused) loop.stop();
    else loop.start();
  },
} satisfies WallpaperPropertyListenerOf<typeof myProperties>;

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
  const isContentAllowed = media.properties?.contentType == "music";
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
  console.log("MediaStatus", event);
  media.enabled = event.enabled;
  if (event.enabled) return;
  media.properties = undefined;
  media.artwork = undefined;
  media.playback = window.wallpaperMediaIntegration.PLAYBACK_STOPPED;
  media.position = 0;
  media.duration = 0;
});
window.wallpaperRegisterMediaPropertiesListener((event) => {
  console.log("MediaProperties", event);
  media.enabled = true;
  if (Object.values(event).some(Boolean)) media.properties = event;
  else media.properties = undefined;
});
window.wallpaperRegisterMediaThumbnailListener((event) => {
  console.log("MediaThumbnail", event);
  media.enabled = true;
  if (event.thumbnail != "data:image/png;base64,") media.artwork = event;
  else media.artwork = undefined;
  // console.log("thumbnail", media);
  useThumbnail();
});
window.wallpaperRegisterMediaPlaybackListener((event) => {
  console.log("MediaPlayback", event);
  media.enabled = true;
  media.playback = event.state;
  useThumbnail();
});
window.wallpaperRegisterMediaTimelineListener((event) => {
  console.log("MediaTimeline", event);
  media.enabled = true;
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
