import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PLAYBACK_SPEED,
  PLAYBACK_SPEED_OPTIONS,
  SOURCE_FRAME_RATE,
  getPlaybackFrameRate,
  getPlaybackTimeScale
} from '../src/playback-speed.js';

test('1x playback uses the avatars native 24 frame-per-second timing', () => {
  assert.equal(SOURCE_FRAME_RATE, 24);
  assert.equal(DEFAULT_PLAYBACK_SPEED, 1);
  assert.ok(PLAYBACK_SPEED_OPTIONS.includes(DEFAULT_PLAYBACK_SPEED));
  assert.equal(getPlaybackFrameRate(0.5), 12);
  assert.equal(getPlaybackFrameRate(1), 24);
  assert.equal(getPlaybackFrameRate(2), 48);
  assert.equal(getPlaybackTimeScale(1), 1);
  assert.equal(getPlaybackTimeScale(3), 3);
});
