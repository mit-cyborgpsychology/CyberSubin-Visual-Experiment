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

function scalableClip(name) {
  const positionValues = new Float32Array([
    0, 0.9, 0.06,
    100, -9.1, 50.06
  ]);
  const rotationValues = new Float32Array([
    0, 0, 0, 1,
    0, 0.5, 0, 0.866
  ]);
  return {
    name,
    duration: 10,
    tracks: [
      { name: 'Hips.position', values: positionValues },
      { name: 'Hips.quaternion', values: rotationValues }
    ],
    clone() {
      return {
        ...this,
        tracks: this.tracks.map((track) => ({
          ...track,
          values: new Float32Array(track.values)
        }))
      };
    }
  };
}

for (const fileName of ['Bruneifull.glb', 'Myanmarfull.glb', 'Thailandpart2full.glb']) {
  const source = scalableClip('Raw Capture');
  const playback = prepareStandaloneRigClip([source], fileName);
  assert.notEqual(playback, source, `${fileName} should use a safe cloned clip`);
  assert.match(playback.name, /Playback$/);
  assert.deepEqual(
    Array.from(playback.tracks[0].values).map((value) => Number(value.toFixed(4))),
    [0, 0.9, 0.06, 1, 0.8, 0.56],
    `${fileName} should retain its first pose and scale later displacement from centimeters`
  );
  assert.deepEqual(
    Array.from(playback.tracks[1].values),
    Array.from(source.tracks[1].values),
    `${fileName} should not alter joint rotation`
  );
  assert.deepEqual(
    Array.from(source.tracks[0].values).map((value) => Number(value.toFixed(4))),
    [0, 0.9, 0.06, 100, -9.1, 50.06],
    `${fileName} should not mutate the source clip`
  );
}

console.log('Brunei, Myanmar, and Thailand Part 2 standalone translation units verified.');
