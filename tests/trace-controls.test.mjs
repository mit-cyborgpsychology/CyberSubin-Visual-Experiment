import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ALL_TRACE_PARTS,
  DEFAULT_TRACE_PARTS,
  TRACE_EXTRA_DEFINITIONS,
  TRACE_FOOT_EDGE_PAIRS,
  TRACE_PART_PRESETS,
  resolveTraceEdgePair,
  tracePartsIncludeTracker,
  tracePartsMatch
} from '../src/trace-controls.js';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readGlbNodeNames(relativePath) {
  const buffer = fs.readFileSync(path.join(PROJECT_ROOT, relativePath));
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, `${relativePath} should be a GLB file`);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    if (chunkType === 0x4e4f534a) {
      const document = JSON.parse(
        buffer.subarray(offset + 8, offset + 8 + chunkLength).toString('utf8')
      );
      return new Set((document.nodes ?? []).map(({ name }) => name).filter(Boolean));
    }
    offset += chunkLength + 8;
  }
  throw new Error(`${relativePath} does not contain a JSON chunk`);
}

const fingerDefinitions = TRACE_EXTRA_DEFINITIONS.filter(({ id }) => id !== 'bottom');
assert.equal(fingerDefinitions.length, 10, 'Trace controls should define all ten fingertips');
assert.equal(TRACE_EXTRA_DEFINITIONS.at(-1).id, 'bottom');
assert.equal(
  new Set(fingerDefinitions.map(({ color }) => color)).size,
  fingerDefinitions.length,
  'Every fingertip should use a distinct blue shade'
);
for (const definition of fingerDefinitions) {
  const [red, green, blue] = definition.color.match(/[0-9a-f]{2}/gi).map((value) => (
    Number.parseInt(value, 16)
  ));
  assert.ok(
    blue >= red && blue >= green,
    `${definition.label} should remain in the blue color family`
  );
  assert.ok(
    Math.max(red, green, blue) - Math.min(red, green, blue) >= 120,
    `${definition.label} should retain a visibly saturated blue chroma`
  );
}

const fingerById = new Map(fingerDefinitions.map((definition) => [definition.id, definition]));
const pairedFingerIds = [
  ['leftThumb', 'rightThumb'],
  ['leftIndexFinger', 'rightIndexFinger'],
  ['leftMiddleFinger', 'rightMiddleFinger'],
  ['leftRingFinger', 'rightRingFinger'],
  ['leftPinkyFinger', 'rightPinkyFinger']
];
for (const [leftId, rightId] of pairedFingerIds) {
  const leftRgb = fingerById.get(leftId).color.match(/[0-9a-f]{2}/gi).map((value) => (
    Number.parseInt(value, 16)
  ));
  const rightRgb = fingerById.get(rightId).color.match(/[0-9a-f]{2}/gi).map((value) => (
    Number.parseInt(value, 16)
  ));
  const colorDistance = Math.hypot(...leftRgb.map((value, index) => value - rightRgb[index]));
  assert.ok(
    colorDistance <= 24,
    `${leftId} and ${rightId} should use closely matched blue shades`
  );
}

assert.ok(tracePartsMatch(DEFAULT_TRACE_PARTS, [
  'body', 'bottom', 'indexFinger', 'arm', 'leg', 'feet', 'head'
]));
assert.equal(tracePartsIncludeTracker('leftIndexFinger', DEFAULT_TRACE_PARTS), true);
assert.equal(tracePartsIncludeTracker('leftThumb', DEFAULT_TRACE_PARTS), false);
assert.equal(tracePartsIncludeTracker('leftHand', DEFAULT_TRACE_PARTS), false);

const allFingerIds = fingerDefinitions.map(({ id }) => id);
assert.ok(allFingerIds.every((id) => tracePartsIncludeTracker(id, TRACE_PART_PRESETS.allFingers)));
assert.equal(tracePartsIncludeTracker('leftHand', TRACE_PART_PRESETS.allFingers), false);
assert.ok(allFingerIds.every((id) => (
  tracePartsIncludeTracker(id, TRACE_PART_PRESETS.fingersHandsArms)
)));
for (const id of ['leftHand', 'rightHand', 'leftArm', 'rightArm']) {
  assert.equal(tracePartsIncludeTracker(id, TRACE_PART_PRESETS.fingersHandsArms), true);
}
assert.equal(tracePartsIncludeTracker('leftLeg', TRACE_PART_PRESETS.fingersHandsArms), false);
assert.ok(tracePartsMatch(TRACE_PART_PRESETS.fullBody, ALL_TRACE_PARTS));

const standardBoneNames = readGlbNodeNames('glb-optim/59.glb');
for (const definition of fingerDefinitions) {
  const pair = resolveTraceEdgePair(definition, standardBoneNames);
  assert.ok(pair, `59.glb should resolve ${definition.label}`);
  assert.match(pair.anchor, /3$/);
  assert.match(pair.from, /2$/);
  assert.equal(pair.extension, 0.82, 'Standard rig fingertips should extend past the final joint');
}

const laosBoneNames = readGlbNodeNames('glb-style-2/Laosfull.glb');
for (const definition of fingerDefinitions) {
  const pair = resolveTraceEdgePair(definition, laosBoneNames);
  assert.ok(pair, `Laosfull.glb should resolve ${definition.label}`);
  assert.match(pair.anchor, /4_end$/, 'Laos traces should use the literal terminal fingertip bone');
  assert.match(pair.from, /4$/);
  assert.equal(pair.extension, 0);
}

for (const [side, pairs] of Object.entries(TRACE_FOOT_EDGE_PAIRS)) {
  const pair = resolveTraceEdgePair({ edgePairs: pairs }, laosBoneNames);
  assert.ok(pair, `Laosfull.glb should resolve the ${side} terminal foot edge`);
  assert.match(pair.anchor, /Toe_End_end$/);
  assert.match(pair.from, /Toe_End$/);
  assert.equal(pair.extension, 0);
}

assert.equal(
  resolveTraceEdgePair({ edgePairs: TRACE_FOOT_EDGE_PAIRS.left }, standardBoneNames),
  null,
  'The standard rig should use its foot-weighted mesh surface fallback'
);

console.log('Trace controls and Laosfull.glb fingertip/foot-edge mapping verified.');
