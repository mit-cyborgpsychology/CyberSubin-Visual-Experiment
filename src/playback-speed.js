export const SOURCE_FRAME_RATE = 24;
export const DEFAULT_PLAYBACK_SPEED = 1;
export const PLAYBACK_SPEED_OPTIONS = Object.freeze([
  0.05, 0.1, 0.5, 1, 1.5, 2, 3, 4, 5, 10, 20, 50
]);

export function getPlaybackFrameRate(speed = DEFAULT_PLAYBACK_SPEED) {
  return SOURCE_FRAME_RATE * Number(speed);
}

export function getPlaybackTimeScale(speed = DEFAULT_PLAYBACK_SPEED) {
  return getPlaybackFrameRate(speed) / SOURCE_FRAME_RATE;
}
