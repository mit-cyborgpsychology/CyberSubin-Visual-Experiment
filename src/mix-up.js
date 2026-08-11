import * as THREE from 'three';

const LIMB_PREFIXES = Object.freeze({
  leftHand: ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand'],
  rightHand: ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'],
  leftFoot: ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToe'],
  rightFoot: ['RightUpLeg', 'RightLeg', 'RightFoot', 'RightToe']
});

export const MIX_UP_PARTS = Object.freeze([
  {
    id: 'body',
    label: 'BODY + HEAD',
    description: 'Core, spine, neck, head, and all remaining joints'
  },
  {
    id: 'leftHand',
    label: 'LEFT HAND + ARM',
    description: 'Shoulder through fingers'
  },
  {
    id: 'rightHand',
    label: 'RIGHT HAND + ARM',
    description: 'Shoulder through fingers'
  },
  {
    id: 'leftFoot',
    label: 'LEFT FOOT + LEG',
    description: 'Hip through toes'
  },
  {
    id: 'rightFoot',
    label: 'RIGHT FOOT + LEG',
    description: 'Hip through toes'
  }
]);

function getTrackNodeName(trackName) {
  const propertySeparator = trackName.lastIndexOf('.');
  const objectPath = propertySeparator >= 0 ? trackName.slice(0, propertySeparator) : trackName;
  const boneMatch = objectPath.match(/\.bones\[([^\]]+)\]$/);
  if (boneMatch) return boneMatch[1];
  return objectPath.split('/').at(-1);
}

function matchesPrefixes(nodeName, prefixes) {
  return prefixes.some((prefix) => nodeName === prefix || nodeName.startsWith(prefix));
}

function trackBelongsToPart(track, partId) {
  const nodeName = getTrackNodeName(track.name);
  if (partId === 'body') {
    return !Object.values(LIMB_PREFIXES).some((prefixes) => matchesPrefixes(nodeName, prefixes));
  }
  return matchesPrefixes(nodeName, LIMB_PREFIXES[partId] ?? []);
}

function sampleTrack(track, time) {
  const target = new Float32Array(track.getValueSize());
  track.createInterpolant(target).evaluate(time);
  return [...target];
}

function createSmoothLoopTrack(sourceTrack, clipStart, clipEnd, blendDuration) {
  const start = THREE.MathUtils.clamp(clipStart, 0, Math.max(0, clipEnd - 0.001));
  const playableDuration = Math.max(0.001, clipEnd - start);
  const valueSize = sourceTrack.getValueSize();
  const startValue = sampleTrack(sourceTrack, start);
  const times = [0];
  const values = [...startValue];

  for (let index = 0; index < sourceTrack.times.length; index += 1) {
    const sourceTime = sourceTrack.times[index];
    if (sourceTime <= start + 0.0001 || sourceTime > clipEnd + 0.0001) continue;
    times.push(sourceTime - start);
    const offset = index * valueSize;
    for (let valueIndex = 0; valueIndex < valueSize; valueIndex += 1) {
      values.push(sourceTrack.values[offset + valueIndex]);
    }
  }

  if (times.at(-1) < playableDuration - 0.0001) {
    times.push(playableDuration);
    values.push(...sampleTrack(sourceTrack, clipEnd));
  }

  times.push(playableDuration + blendDuration);
  values.push(...startValue);

  return new sourceTrack.constructor(
    sourceTrack.name,
    times,
    values,
    sourceTrack.getInterpolation()
  ).optimize();
}

export function createSmoothMixClip({
  sourceClip,
  clipStart,
  partId,
  name,
  blendDuration = 0.55
}) {
  const tracks = sourceClip.tracks
    .filter((track) => trackBelongsToPart(track, partId))
    .map((track) => createSmoothLoopTrack(track, clipStart, sourceClip.duration, blendDuration));

  if (!tracks.length) return null;
  return new THREE.AnimationClip(name, -1, tracks).resetDuration();
}
