import assert from 'node:assert/strict';
import {
  chooseStandaloneRigClip,
  prepareStandaloneRigClip
} from '../src/standalone-rig-clips.js';

function clip(name, trackSampleCounts) {
  return {
    name,
    tracks: trackSampleCounts.map((sampleCount) => ({ times: { length: sampleCount } }))
  };
}

const normalizedVietnam = clip('Action', Array(600).fill(1768));
const rawVietnam = clip('Skeletons|VIETNAM_FULL_TK0001_LOC', Array(599).fill(1996));
assert.equal(
  chooseStandaloneRigClip([normalizedVietnam, rawVietnam]),
  normalizedVietnam,
  'Vietnam should use its retargeted Action clip even when the raw clip has more samples'
);

const normalizedLaos = clip('Action.004', Array(588).fill(1736));
const tinyBodyAction = clip('Action.005', Array(3).fill(2));
assert.equal(
  chooseStandaloneRigClip([normalizedLaos, tinyBodyAction]),
  normalizedLaos,
  'The complete numbered Action should win over the tiny mesh-only Action'
);

const fallbackShort = clip('Capture A', Array(100).fill(20));
const fallbackComplete = clip('Capture B', Array(120).fill(10));
assert.equal(
  chooseStandaloneRigClip([fallbackShort, fallbackComplete]),
  fallbackComplete,
  'Unknown exports should fall back to the clip covering the most tracks'
);
assert.equal(chooseStandaloneRigClip([]), null);

console.log('Standalone rig clip selection verified.');

function trimmableClip(name, duration) {
  return {
    name,
    duration,
    tracks: Array(10).fill(null).map(() => ({ times: { length: 100 } })),
    clone() {
      return trimmableClip(this.name, this.duration);
    },
    trim(start, end) {
      assert.equal(start, 0);
      this.duration = end;
    }
  };
}

const vietnamAction = trimmableClip('Action', 416.667);
const vietnamChoreography = trimmableClip('Skeletons|VIETNAM_FULL_TK0001_LOC', 204.833);
const vietnamPlayback = prepareStandaloneRigClip(
  [vietnamAction, vietnamChoreography],
  'Vietnamfull.glb'
);
assert.notEqual(vietnamPlayback, vietnamAction, 'Vietnam playback should use a safe cloned clip');
assert.equal(vietnamPlayback.duration, vietnamChoreography.duration);
assert.match(vietnamPlayback.name, /VietnamPlayback$/);
assert.equal(
  prepareStandaloneRigClip([vietnamAction, vietnamChoreography], 'Singaporefull.glb'),
  vietnamAction,
  'Other standalone rigs should retain their existing playback duration'
);

console.log('Vietnam standalone playback duration verified.');
