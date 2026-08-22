import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  applyMixUpGroupSource,
  captureMixUpRestPose,
  createSmoothMixClip,
  getMixUpSourceGroups,
  retargetMixUpClip
} from '../src/mix-up.js';

test('Mix-Up methods expose only their grouped movement selectors', () => {
  assert.deepEqual(getMixUpSourceGroups('topBottom').map(({ id }) => id), ['top', 'bottom']);
  assert.deepEqual(getMixUpSourceGroups('leftRight').map(({ id }) => id), ['left', 'right']);
  assert.deepEqual(getMixUpSourceGroups('frankenstein'), []);

  const sources = {
    body: '59',
    leftHand: '59',
    rightHand: '59',
    leftFoot: '59',
    rightFoot: '59'
  };
  assert.deepEqual(applyMixUpGroupSource(sources, 'topBottom', 'top', '12'), {
    body: '59',
    leftHand: '12',
    rightHand: '12',
    leftFoot: '59',
    rightFoot: '59'
  });
  assert.deepEqual(applyMixUpGroupSource(sources, 'topBottom', 'bottom', '37'), {
    body: '37',
    leftHand: '59',
    rightHand: '59',
    leftFoot: '37',
    rightFoot: '37'
  });
  assert.deepEqual(applyMixUpGroupSource(sources, 'leftRight', 'right', '23'), {
    body: '59',
    leftHand: '59',
    rightHand: '23',
    leftFoot: '59',
    rightFoot: '23'
  });
});

function createRig(boneName, restQuaternion, position = new THREE.Vector3()) {
  const root = new THREE.Group();
  const bone = new THREE.Bone();
  bone.name = boneName;
  bone.quaternion.copy(restQuaternion);
  bone.position.copy(position);
  root.add(bone);
  return { root, bone };
}

function createFacingRig({ mirrored = false } = {}) {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = 'Hips';
  const leftHip = new THREE.Bone();
  leftHip.name = 'LeftUpLeg';
  leftHip.position.x = mirrored ? -1 : 1;
  const rightHip = new THREE.Bone();
  rightHip.name = 'RightUpLeg';
  rightHip.position.x = mirrored ? 1 : -1;
  const head = new THREE.Bone();
  head.name = 'Head';
  head.position.y = 2;
  const arm = new THREE.Bone();
  arm.name = 'LeftArm';
  root.add(hips, leftHip, rightHip, head, arm);
  return { root, arm };
}

test('Style 2 Mix-Up transfers rotation deltas without position, scale, or deformation', () => {
  const sourceRest = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(30)
  );
  const targetRest = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(1, 0, 0),
    THREE.MathUtils.degToRad(45)
  );
  const animatedDelta = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    THREE.MathUtils.degToRad(90)
  );
  const sourceAnimated = sourceRest.clone().multiply(animatedDelta);
  const sourceRig = createRig('LeftArm', sourceRest);
  const targetPosition = new THREE.Vector3(2, 3, 4);
  const targetRig = createRig('LeftArm', targetRest, targetPosition);
  sourceRig.root.updateMatrixWorld(true);
  targetRig.root.updateMatrixWorld(true);
  const sourceWorldRest = sourceRig.bone.getWorldQuaternion(new THREE.Quaternion());
  const targetWorldRest = targetRig.bone.getWorldQuaternion(new THREE.Quaternion());
  const worldDelta = sourceWorldRest.clone()
    .multiply(animatedDelta)
    .multiply(sourceWorldRest.clone().invert());
  const targetDelta = targetWorldRest.clone().invert()
    .multiply(worldDelta)
    .multiply(targetWorldRest);
  const targetExpected = targetRest.clone().multiply(targetDelta);

  const sourceClip = new THREE.AnimationClip('Style2Source', 1, [
    new THREE.QuaternionKeyframeTrack(
      'Armature/LeftArm.quaternion',
      [0, 1],
      [...sourceRest.toArray(), ...sourceAnimated.toArray()]
    ),
    new THREE.VectorKeyframeTrack('LeftArm.position', [0, 1], [0, 0, 0, 100, 200, 300]),
    new THREE.QuaternionKeyframeTrack(
      'Style2OnlyBone.quaternion',
      [0, 1],
      [0, 0, 0, 1, 0, 0, 0, 1]
    )
  ]);

  const retargeted = retargetMixUpClip({
    sourceClip,
    sourceRestPose: captureMixUpRestPose(sourceRig.root),
    targetRestPose: captureMixUpRestPose(targetRig.root),
    sourceRigFamily: 'glb-style-2',
    targetRigFamily: 'indexed'
  });

  assert.equal(retargeted.tracks.length, 1);
  assert.equal(retargeted.tracks[0].name, 'LeftArm.quaternion');
  const firstPose = new THREE.Quaternion().fromArray(retargeted.tracks[0].values, 0);
  const secondPose = new THREE.Quaternion().fromArray(retargeted.tracks[0].values, 4);
  assert.ok(firstPose.angleTo(targetRest) < 1e-3);
  assert.ok(secondPose.angleTo(targetExpected) < 1e-3);
  assert.deepEqual(targetRig.bone.position.toArray(), targetPosition.toArray());

  const regionalClip = createSmoothMixClip({
    sourceClip: retargeted,
    clipStart: 0,
    partId: 'leftHand',
    name: 'Style2LeftArmMix'
  });
  assert.ok(regionalClip);
  assert.equal(regionalClip.tracks.length, 1);
});

test('indexed Mix-Up clips retain their native tracks', () => {
  const clip = new THREE.AnimationClip('IndexedSource', 1, [
    new THREE.QuaternionKeyframeTrack('Hips.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])
  ]);
  assert.equal(retargetMixUpClip({
    sourceClip: clip,
    sourceRigFamily: 'indexed',
    targetRigFamily: 'indexed'
  }), clip);
});

test('Style 2 Mix-Up aligns anatomical forward when the source rig faces backward', () => {
  const sourceRig = createFacingRig({ mirrored: true });
  const targetRig = createFacingRig();
  const sourcePose = captureMixUpRestPose(sourceRig.root);
  const targetPose = captureMixUpRestPose(targetRig.root);
  const intendedBodyDelta = new THREE.Quaternion().setFromAxisAngle(
    new THREE.Vector3(0, 0, 1),
    THREE.MathUtils.degToRad(70)
  );
  const sourceBasis = sourcePose.get('LeftArm').bodyQuaternion;
  const sourceLocalDelta = sourceBasis.clone().invert()
    .multiply(intendedBodyDelta)
    .multiply(sourceBasis);
  const sourceClip = new THREE.AnimationClip('BackwardFacingStyle2', 1, [
    new THREE.QuaternionKeyframeTrack(
      'LeftArm.quaternion',
      [0, 1],
      [0, 0, 0, 1, ...sourceLocalDelta.toArray()]
    )
  ]);

  const retargeted = retargetMixUpClip({
    sourceClip,
    sourceRestPose: sourcePose,
    targetRestPose: targetPose,
    sourceRigFamily: 'glb-style-2',
    targetRigFamily: 'indexed'
  });
  const targetAnimated = new THREE.Quaternion().fromArray(retargeted.tracks[0].values, 4);
  assert.ok(
    targetAnimated.angleTo(intendedBodyDelta) < 1e-3,
    'The target should move in the same anatomical direction, not the source scene direction'
  );
});
