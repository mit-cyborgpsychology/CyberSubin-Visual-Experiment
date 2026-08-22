import * as THREE from 'three';

const LIMB_PREFIXES = Object.freeze({
  leftHand: ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftInHand'],
  rightHand: ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'RightInHand'],
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

export const MIX_UP_SOURCE_GROUPS = Object.freeze({
  topBottom: Object.freeze([
    Object.freeze({
      id: 'top',
      label: 'TOP',
      description: 'Both arms and hands',
      sourcePartId: 'leftHand',
      partIds: Object.freeze(['leftHand', 'rightHand'])
    }),
    Object.freeze({
      id: 'bottom',
      label: 'BOTTOM',
      description: 'Body, head, both legs, and both feet',
      sourcePartId: 'body',
      partIds: Object.freeze(['body', 'leftFoot', 'rightFoot'])
    })
  ]),
  leftRight: Object.freeze([
    Object.freeze({
      id: 'left',
      label: 'LEFT',
      description: 'Left arm, hand, leg, and foot',
      sourcePartId: 'leftHand',
      partIds: Object.freeze(['leftHand', 'leftFoot'])
    }),
    Object.freeze({
      id: 'right',
      label: 'RIGHT',
      description: 'Right arm, hand, leg, and foot',
      sourcePartId: 'rightHand',
      partIds: Object.freeze(['rightHand', 'rightFoot'])
    })
  ])
});

export function getMixUpSourceGroups(mode) {
  return MIX_UP_SOURCE_GROUPS[mode] ?? [];
}

export function applyMixUpGroupSource(sources, mode, groupId, movementId) {
  const group = getMixUpSourceGroups(mode).find((candidate) => candidate.id === groupId);
  if (!group) return { ...sources };
  const nextSources = { ...sources };
  for (const partId of group.partIds) nextSources[partId] = movementId;
  return nextSources;
}

function getTrackNodeName(trackName) {
  const propertySeparator = trackName.lastIndexOf('.');
  const objectPath = propertySeparator >= 0 ? trackName.slice(0, propertySeparator) : trackName;
  const boneMatch = objectPath.match(/\.bones\[([^\]]+)\]$/);
  if (boneMatch) return boneMatch[1];
  return objectPath.split('/').at(-1);
}

function getTrackProperty(trackName) {
  const propertySeparator = trackName.lastIndexOf('.');
  return propertySeparator >= 0 ? trackName.slice(propertySeparator + 1) : '';
}

function getMixUpBodyFrameQuaternion(nodesByName) {
  const hips = nodesByName.get('Hips');
  const leftHip = nodesByName.get('LeftUpLeg');
  const rightHip = nodesByName.get('RightUpLeg');
  const top = nodesByName.get('Head')
    ?? nodesByName.get('Neck')
    ?? nodesByName.get('Spine2')
    ?? nodesByName.get('Spine1');
  if (!hips || !leftHip || !rightHip || !top) {
    return hips?.getWorldQuaternion(new THREE.Quaternion()) ?? new THREE.Quaternion();
  }

  const hipsPosition = hips.getWorldPosition(new THREE.Vector3());
  const leftPosition = leftHip.getWorldPosition(new THREE.Vector3());
  const rightPosition = rightHip.getWorldPosition(new THREE.Vector3());
  const topPosition = top.getWorldPosition(new THREE.Vector3());
  const anatomicalLeft = leftPosition.sub(rightPosition);
  const anatomicalUp = topPosition.sub(hipsPosition);
  if (anatomicalLeft.lengthSq() < 1e-8 || anatomicalUp.lengthSq() < 1e-8) {
    return hips.getWorldQuaternion(new THREE.Quaternion());
  }

  anatomicalLeft.normalize();
  anatomicalUp.addScaledVector(anatomicalLeft, -anatomicalUp.dot(anatomicalLeft));
  if (anatomicalUp.lengthSq() < 1e-8) {
    return hips.getWorldQuaternion(new THREE.Quaternion());
  }
  anatomicalUp.normalize();
  const anatomicalForward = anatomicalLeft.clone().cross(anatomicalUp).normalize();
  anatomicalUp.copy(anatomicalForward).cross(anatomicalLeft).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(anatomicalLeft, anatomicalUp, anatomicalForward)
  );
}

export function captureMixUpRestPose(root) {
  const pose = new Map();
  const nodesByName = new Map();
  root?.updateMatrixWorld?.(true);
  root?.traverse?.((node) => {
    if (!node?.name) return;
    const existing = pose.get(node.name);
    if (!existing || (!existing.isBone && node.isBone)) {
      nodesByName.set(node.name, node);
      pose.set(node.name, {
        isBone: Boolean(node.isBone),
        quaternion: node.quaternion.clone(),
        worldQuaternion: node.getWorldQuaternion(new THREE.Quaternion())
      });
    }
  });
  const bodyWorldQuaternion = getMixUpBodyFrameQuaternion(nodesByName);
  const bodyWorldInverse = bodyWorldQuaternion.clone().invert();
  for (const entry of pose.values()) {
    entry.bodyQuaternion = bodyWorldInverse.clone().multiply(entry.worldQuaternion).normalize();
  }
  return pose;
}

export function retargetMixUpClip({
  sourceClip,
  sourceRestPose,
  targetRestPose,
  sourceRigFamily = 'indexed',
  targetRigFamily = 'indexed'
}) {
  if (!sourceClip) return null;
  const requiresRetargeting = sourceRigFamily !== 'indexed' || targetRigFamily !== 'indexed';
  if (!requiresRetargeting) return sourceClip;

  const sourcePose = sourceRestPose instanceof Map ? sourceRestPose : new Map();
  const targetPose = targetRestPose instanceof Map ? targetRestPose : new Map();
  const sourceRestInverse = new THREE.Quaternion();
  const sourceWorldInverse = new THREE.Quaternion();
  const targetWorldInverse = new THREE.Quaternion();
  const sourceValue = new THREE.Quaternion();
  const sourceLocalDelta = new THREE.Quaternion();
  const worldDelta = new THREE.Quaternion();
  const targetLocalDelta = new THREE.Quaternion();
  const targetValue = new THREE.Quaternion();
  const tracks = [];

  for (const sourceTrack of sourceClip.tracks ?? []) {
    if (getTrackProperty(sourceTrack.name) !== 'quaternion') continue;
    const nodeName = getTrackNodeName(sourceTrack.name);
    const sourceEntry = sourcePose.get(nodeName);
    const targetEntry = targetPose.get(nodeName);
    const sourceBasis = sourceEntry?.bodyQuaternion ?? sourceEntry?.worldQuaternion;
    const targetBasis = targetEntry?.bodyQuaternion ?? targetEntry?.worldQuaternion;
    if (
      !sourceEntry?.quaternion
      || !sourceBasis
      || !sourceEntry.isBone
      || !targetEntry?.quaternion
      || !targetBasis
      || !targetEntry.isBone
    ) continue;

    sourceRestInverse.copy(sourceEntry.quaternion).invert();
    sourceWorldInverse.copy(sourceBasis).invert();
    targetWorldInverse.copy(targetBasis).invert();
    const values = new Float32Array(sourceTrack.values.length);
    for (let offset = 0; offset < sourceTrack.values.length; offset += 4) {
      sourceValue.fromArray(sourceTrack.values, offset).normalize();
      sourceLocalDelta.copy(sourceRestInverse).multiply(sourceValue).normalize();
      worldDelta
        .copy(sourceBasis)
        .multiply(sourceLocalDelta)
        .multiply(sourceWorldInverse)
        .normalize();
      targetLocalDelta
        .copy(targetWorldInverse)
        .multiply(worldDelta)
        .multiply(targetBasis)
        .normalize();
      targetValue.copy(targetEntry.quaternion).multiply(targetLocalDelta).normalize();
      targetValue.toArray(values, offset);
    }

    tracks.push(new sourceTrack.constructor(
      `${nodeName}.quaternion`,
      sourceTrack.times,
      values,
      sourceTrack.getInterpolation()
    ));
  }

  const clip = new THREE.AnimationClip(
    `${sourceClip.name}-mix-up-retargeted`,
    sourceClip.duration,
    tracks
  );
  clip.duration = sourceClip.duration;
  return clip;
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
