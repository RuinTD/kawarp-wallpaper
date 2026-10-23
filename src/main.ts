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
  DefaultWEProps,
} from "wallpaper-engine/helpers";
import { mapValues } from "es-toolkit/object";
import "./style.css";
import type {
  DefaultWEProps as DefaultWEPropertyDefinitions,
  WallpaperMediaPlaybackState,
  WallpaperMediaPropertiesEvent,
  WallpaperMediaThumbnailEvent,
  WallpaperPropertyListenerOf,
} from "wallpaper-engine";
import { clamp, isEqual, throttle } from "es-toolkit";

const $ = <T extends Element = HTMLElement>(selector: string): T => {
  const el = document.querySelector(selector);
  if (!el) throw new Error(`Element not found: ${selector}`);
  return el as T;
};
const $$ = document.querySelectorAll.bind(document);

const debugEl = {
  art: $<HTMLImageElement>("#debug-art"),
  artInfo: $<HTMLParagraphElement>("#debug-art-info"),

  media: $<HTMLDivElement>("#debug-media"),
  mediaStatus: $<HTMLSpanElement>("#debug-media-status"),
  mediaProgText: $<HTMLSpanElement>("#debug-media-prog-text"),
  mediaType: $<HTMLSpanElement>("#debug-media-type"),
  mediaProg: $<HTMLMeterElement>("#debug-media-prog"),

  mediaProps: $<HTMLDivElement>("#debug-media-props"),
  mediaTitle: $<HTMLParagraphElement>("#debug-media-title"),
  mediaSubTitle: $<HTMLParagraphElement>("#debug-media-subTitle"),
  mediaArtist: $<HTMLParagraphElement>("#debug-media-artist"),
  mediaAlbumArtist: $<HTMLParagraphElement>("#debug-media-albumArtist"),
  mediaAlbum: $<HTMLParagraphElement>("#debug-media-album"),
  mediaGenres: $<HTMLParagraphElement>("#debug-media-genres"),

  mediaArtwork: $<HTMLDivElement>("#debug-media-artwork"),
  mediaArt: $<HTMLImageElement>("#debug-media-art"),
  mediaPrimary: $<HTMLInputElement>("#debug-media-primary"),
  mediaSecondary: $<HTMLInputElement>("#debug-media-secondary"),
  mediaTertiary: $<HTMLInputElement>("#debug-media-tertiary"),
  mediaTextColor: $<HTMLInputElement>("#debug-media-textColor"),
  mediaHighContrastColor: $<HTMLInputElement>("#debug-media-highContrastColor"),

  audio: $<HTMLDivElement>("#debug-audio"),
  averageVolume: $<HTMLMeterElement>("#debug-averageVolume"),
  rmsVolume: $<HTMLMeterElement>("#debug-rmsVolume"),
  peakVolume: $<HTMLMeterElement>("#debug-peakVolume"),
  leftVolume: $<HTMLMeterElement>("#debug-leftVolume"),
  rightVolume: $<HTMLMeterElement>("#debug-rightVolume"),
  leftBalance: $<HTMLMeterElement>("#debug-leftBalance"),
  rightBalance: $<HTMLMeterElement>("#debug-rightBalance"),
  bass: $<HTMLMeterElement>("#debug-bass"),
  midrange: $<HTMLMeterElement>("#debug-midrange"),
  treble: $<HTMLMeterElement>("#debug-treble"),

  decayingPeakVolume: $<HTMLMeterElement>("#debug-decayingPeakVolume"),
  kick: $<HTMLMeterElement>("#debug-kick"),
  clap: $<HTMLMeterElement>("#debug-clap"),
  hiHat: $<HTMLMeterElement>("#debug-hiHat"),
  beat: $<HTMLMeterElement>("#debug-beat"),
  bpm: $<HTMLMeterElement>("#debug-bpm"),
  bpmText: $<HTMLSpanElement>("#debug-bpm-text"),
  onset: $<HTMLMeterElement>("#debug-onset"),
};

const canvas = $<HTMLCanvasElement>("canvas");
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

let time = 0;
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

  // console.log(
  //   { audioAvg, audioPeak },
  //   { speedMultiplier: speedMult, scaleMultiplier: scaleMult },
  //   { currentSpeed, currentScale },
  //   { kawarpAnimationSpeed: kawarp.animationSpeed, kawarpScale: kawarp.scale },
  // );

  const doAnimate =
    getMediaPlaybackStatus(media.playback) == "playing" ||
    currentThumbnail.source != "media";
  if (doAnimate) time += _dt * kawarp.animationSpeed;
  kawarp.renderFrame(time);
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

type AllProps = DefaultWEPropertyDefinitions &
  WallpaperUserPropertiesOf<typeof myProperties>;
type AllPropValues = {
  [K in keyof AllProps]: NonNullable<AllProps[K]>["value"];
};
let props = mapValues(
  { ...DefaultWEProps, ...myProperties },
  (v) => v?.value,
) as AllPropValues;
window.wallpaperPropertyListener = {
  applyUserProperties(_props) {
    props = {
      ...props,
      ...(mapValues(_props, (v) => v?.value) as Partial<AllPropValues>),
    };
    console.log("props", _props, props);
    if (_props.transitionDuration)
      _useThumbnail = throttle(__useThumbnail, props.transitionDuration * 1000);
    useThumbnail();

    if (_props.debug)
      for (const el of $$<HTMLDivElement>(".debug"))
        el.style.display = props.debug ? "block" : "none";
    debugEl.audio.style.display =
      props.debug && props.audioprocessing ? "block" : "none";
    debugEl.media.style.display =
      props.debug && media.enabled ? "block" : "none";

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

interface Thumbnail {
  source: "fallback" | "media";
  src: string;
}
const defaultThumbnail: Thumbnail = {
  src: "missingtexture.png",
  source: "fallback",
};
function getThumbnail(): Thumbnail {
  const thumbnail: string | undefined = media.artwork?.thumbnail;
  const state = getMediaPlaybackStatus(media.playback);

  const contentMap: Record<
    WallpaperMediaPropertiesEvent["contentType"] | "_",
    boolean
  > = {
    music: props.detectMusic,
    video: props.detectVideo,
    image: props.detectImage,
    _: false,
  };
  const isPlaybackActive =
    (props.useAlbumArt == "playing" && state == "playing") ||
    (props.useAlbumArt == "playorpause" && state != "stopped");
  const isContentAllowed = contentMap[media.properties?.contentType || "_"];
  const shouldShowArt = !!thumbnail && isPlaybackActive && isContentAllowed;

  if (shouldShowArt) return { source: "media", src: thumbnail };
  else if (props.fallback == "gradient") {
    const colors = [];
    for (let i = 1; i <= props.gradientSteps; i++) {
      // @ts-ignore will be a string
      const color: string = props[`gradientColor${i}`];
      // console.log(color, wallpaperColorToHex(color));
      colors.push(wallpaperColorToHex(color));
    }
    return { source: "fallback", src: makeGradient(colors) };
  } else {
    switch (props.fallback) {
      case "custom":
        if (props.customImg)
          return { source: "fallback", src: toFileUrl(props.customImg) };
        break;
      case "pride":
        return { source: "fallback", src: props.pridePreset };
      default:
        return { source: "fallback", src: props.fallback };
    }
  }
  return defaultThumbnail;
}

let lastThumbnail: Thumbnail | undefined;
let currentThumbnail: Thumbnail = defaultThumbnail;
let queuedThumbnail: NodeJS.Timeout | undefined;
async function __useThumbnail(thumbnail: Thumbnail) {
  currentThumbnail = thumbnail;
  // DEBUG
  {
    debugEl.art.src = thumbnail.src;
    debugEl.artInfo.innerText = thumbnail.source;
  }
  await kawarp.loadImage(thumbnail.src);
}
let _useThumbnail = throttle(__useThumbnail, 0);
function useThumbnail() {
  const newThumbnail = getThumbnail();
  if (lastThumbnail) {
    if (isEqual(lastThumbnail, newThumbnail)) return;
  } else lastThumbnail = newThumbnail;

  queueThumbnail(
    newThumbnail,
    newThumbnail.source == "fallback"
      ? props.fallbackTimeout * 1000
      : undefined,
  );
}

function queueThumbnail(thumbnail: Thumbnail, delay?: number | undefined) {
  if (queuedThumbnail) {
    clearTimeout(queuedThumbnail);
    queuedThumbnail = undefined;
  }
  queuedThumbnail = setTimeout(() => {
    queuedThumbnail = undefined;
    _useThumbnail(thumbnail);
  }, delay);
  lastThumbnail = thumbnail;
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

function setMediaEnabled(enabled = true) {
  media.enabled = enabled;
  // DEBUG
  debugEl.media.style.display = props.debug && media.enabled ? "block" : "none";

  if (enabled) return;
  media.properties = undefined;
  media.artwork = undefined;
  media.playback = window.wallpaperMediaIntegration.PLAYBACK_STOPPED;
  media.position = 0;
  media.duration = 0;
  // debugEl.mediaStatus.innerText = "❌";
}
window.wallpaperRegisterMediaStatusListener((event) => {
  console.log("MediaStatus", event);
  setMediaEnabled(event.enabled);
});
window.wallpaperRegisterMediaPropertiesListener((event) => {
  console.log("MediaProperties", event);
  setMediaEnabled();
  if (Object.values(event).some(Boolean)) media.properties = event;
  else media.properties = undefined;

  // DEBUG
  {
    const contentTypeEmojiMap = {
      music: "🎵",
      video: "📹",
      image: "🖼️",
      _: "",
    };
    debugEl.mediaType.innerText =
      contentTypeEmojiMap[media.properties?.contentType || "_"];
    if (media.properties) {
      debugEl.mediaProps.style.display = "block";
      debugEl.mediaTitle.innerText = media.properties.title || "-";
      debugEl.mediaSubTitle.innerText = media.properties.subTitle || "";
      debugEl.mediaArtist.innerText = media.properties.artist || "-";
      debugEl.mediaAlbumArtist.innerText = media.properties.albumArtist || "";
      debugEl.mediaAlbum.innerText = media.properties.albumTitle || "";
      debugEl.mediaGenres.innerText = media.properties.genres || "";
    } else {
      debugEl.mediaProps.style.display = "none";
    }
  }
});
window.wallpaperRegisterMediaThumbnailListener((event) => {
  console.log("MediaThumbnail", event);
  setMediaEnabled();
  if (event.thumbnail != "data:image/png;base64,") media.artwork = event;
  else media.artwork = undefined;
  // console.log("thumbnail", media);
  useThumbnail();

  // DEBUG
  {
    if (media.artwork) {
      debugEl.mediaArtwork.style.display = "block";
      debugEl.mediaArt.src = media.artwork.thumbnail;
      debugEl.mediaPrimary.value = media.artwork.primaryColor;
      debugEl.mediaSecondary.value = media.artwork.secondaryColor;
      debugEl.mediaTertiary.value = media.artwork.tertiaryColor;
      debugEl.mediaTextColor.value = media.artwork.textColor;
      debugEl.mediaHighContrastColor.value = media.artwork.highContrastColor;
    } else debugEl.mediaArtwork.style.display = "none";
  }
});
window.wallpaperRegisterMediaPlaybackListener((event) => {
  console.log("MediaPlayback", event);
  setMediaEnabled();
  media.playback = event.state;
  useThumbnail();

  // DEBUG
  {
    const emojiMap = {
      playing: "▶️",
      paused: "⏸️",
      stopped: "⏹️",
    };
    debugEl.mediaStatus.innerText =
      emojiMap[getMediaPlaybackStatus(media.playback)];
  }
});
window.wallpaperRegisterMediaTimelineListener((event) => {
  console.log("MediaTimeline", event);
  setMediaEnabled();
  media.position = Math.max(0, event.position);
  media.duration = Math.max(0, event.duration);

  // DEBUG
  {
    debugEl.mediaProg.max = media.duration;
    debugEl.mediaProg.value = media.position;
    if (media.duration != 0) {
      const text = `${secsToTime(media.position)} / ${secsToTime(media.duration)}`;
      debugEl.mediaProgText.innerText = text;
      debugEl.mediaProg.style.display = "inline-block";
    } else {
      debugEl.mediaProgText.innerText = "";
      debugEl.mediaProg.style.display = "none";
    }
  }
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

  // DEBUG
  {
    debugEl.averageVolume.value = analyzer.averageVolume;
    debugEl.rmsVolume.value = analyzer.rmsVolume;
    debugEl.peakVolume.value = analyzer.peakVolume;
    debugEl.leftVolume.value = analyzer.leftVolume;
    debugEl.rightVolume.value = analyzer.rightVolume;
    debugEl.leftBalance.value = clamp(-analyzer.stereoBalance, 1);
    debugEl.rightBalance.value = clamp(analyzer.stereoBalance, 1);
    debugEl.bass.value = analyzer.bass;
    debugEl.midrange.value = analyzer.midrange;
    debugEl.treble.value = analyzer.treble;

    debugEl.decayingPeakVolume.value = analyzer.decayingPeakVolume;
    debugEl.kick.value = analyzer.kick;
    debugEl.clap.value = analyzer.clap;
    debugEl.hiHat.value = analyzer.hiHat;
    debugEl.beat.value = analyzer.beat;
    debugEl.bpm.value = analyzer.bpm;
    debugEl.bpmText.innerText = analyzer.bpm
      ? `${Math.round(analyzer.bpm)} `
      : "";
    debugEl.onset.value = analyzer.onset;
  }
});

useThumbnail();
loop.start();
