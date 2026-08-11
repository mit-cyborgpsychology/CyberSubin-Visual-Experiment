import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  applyNo60Modifications,
  createDefaultNo60ModificationValues,
  createNo60ModificationRuntime,
  getNo60BoneRegionTags,
  resolveNo60ModificationValue
} from '../src/no60-modification.js';

function createRig() {
  const root = new THREE.Group();
  const bones = {};
  const add = (name, parent = root) => {
    const bone = new THREE.Bone();
    bone.name = name;
    parent.add(bone);
    bones[name] = bone;
    return bone;
  };

  const hips = add('Hips');
  const spine = add('Spine', hips);
  add('Head', spine);
  const leftArm = add('LeftArm', spine);
  add('LeftForeArm', leftArm);
  const rightArm = add('RightArm', spine);
  add('RightForeArm', rightArm);
  const leftUpLeg = add('LeftUpLeg', hips);
  add('LeftLeg', leftUpLeg);
  const rightUpLeg = add('RightUpLeg', hips);
  add('RightLeg', rightUpLeg);
  return { root, bones };
}

function angleAroundX(radians) {
  return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), radians);
}

function assertNear(actual, expected, tolerance = 0.001, message = '') {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message} (${actual} vs ${expected})`);
}

function testRegionTags() {
  assert.deepEqual(new Set(getNo60BoneRegionTags('mixamorig:Hips')), new Set(['whole', 'torso']));
  assert.deepEqual(
    new Set(getNo60BoneRegionTags('mixamorig:Spine')),
    new Set(['whole', 'upper', 'torso'])
  );
  assert.deepEqual(
    new Set(getNo60BoneRegionTags('mixamorig:LeftArm')),
    new Set(['whole', 'upper', 'arms', 'leftArm'])
  );
  assert.deepEqual(
    new Set(getNo60BoneRegionTags('mixamorig:RightUpLeg')),
    new Set(['whole', 'lower', 'legs', 'rightLeg'])
  );
}

function testRegionalResolver() {
  const cases = [
    ['energy', 'upper', 'Spine', 'LeftUpLeg', 200],
    ['energy', 'lower', 'LeftUpLeg', 'Spine', 200],
    ['energy', 'leftArm', 'LeftArm', 'RightArm', 200],
    ['energy', 'rightArm', 'RightArm', 'LeftArm', 200],
    ['energy', 'leftLeg', 'LeftUpLeg', 'RightUpLeg', 200],
    ['energy', 'rightLeg', 'RightUpLeg', 'LeftUpLeg', 200],
    ['curves', 'leftArm', 'LeftArm', 'RightArm', 200],
    ['curves', 'rightArm', 'RightArm', 'LeftArm', 200],
    ['curves', 'leftLeg', 'LeftUpLeg', 'RightUpLeg', 200],
    ['curves', 'rightLeg', 'RightUpLeg', 'LeftUpLeg', 200],
    ['axes', 'arms', 'LeftArm', 'LeftUpLeg', 200],
    ['axes', 'legs', 'LeftUpLeg', 'LeftArm', 200],
    ['sync', 'arms', 'LeftArm', 'LeftUpLeg', 200],
    ['sync', 'legs', 'LeftUpLeg', 'LeftArm', 200],
    ['space', 'arms', 'LeftArm', 'LeftUpLeg', 200],
    ['space', 'legs', 'LeftUpLeg', 'LeftArm', 200],
    ['body', 'torso', 'Spine', 'LeftArm', 90],
    ['body', 'arms', 'LeftArm', 'LeftUpLeg', 90],
    ['body', 'legs', 'LeftUpLeg', 'LeftArm', 90]
  ];

  for (const [element, region, targetBone, controlBone, changedValue] of cases) {
    const values = createDefaultNo60ModificationValues();
    values[element][region] = changedValue;
    const target = resolveNo60ModificationValue(
      values,
      element,
      getNo60BoneRegionTags(targetBone)
    );
    const control = resolveNo60ModificationValue(
      values,
      element,
      getNo60BoneRegionTags(controlBone)
    );
    assert.equal(target, changedValue, `${element}.${region} should reach ${targetBone}`);
    assert.equal(
      control,
      element === 'body' ? 0 : 100,
      `${element}.${region} should not leak into ${controlBone}`
    );
  }
}

function testRegionalEnergyClocks() {
  const { root, bones } = createRig();
  const times = [0, 1, 2];
  const values = times.flatMap((time) => angleAroundX(time * 0.6).toArray());
  const tracks = Object.keys(bones).map(
    (name) => new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, values)
  );
  const clip = new THREE.AnimationClip('regional-energy', 2, tracks);
  const runtime = createNo60ModificationRuntime(root, clip, 0);
  const settings = createDefaultNo60ModificationValues();
  settings.energy.upper = 200;

  applyNo60Modifications({
    runtime,
    values: settings,
    actionTime: 0,
    delta: 0.1,
    advanceEnergy: false
  });
  for (const bone of Object.values(bones)) bone.quaternion.copy(angleAroundX(0.06));
  applyNo60Modifications({
    runtime,
    values: settings,
    actionTime: 0.1,
    delta: 0.1,
    advanceEnergy: true
  });

  const byName = Object.fromEntries(runtime.entries.map((entry) => [entry.name, entry]));
  assertNear(byName.Spine.energyTime, 0.2, 0.0001, 'Upper-body clock should run at 2x');
  assertNear(byName.LeftArm.energyTime, 0.2, 0.0001, 'Arm should inherit Upper Body');
  assertNear(byName.LeftUpLeg.energyTime, 0.1, 0.0001, 'Leg should stay on Full Body clock');
  assertNear(byName.Hips.energyTime, 0.1, 0.0001, 'Pelvis should stay on Full Body clock');
}

function applySingleEffect(element, region, value, setup = () => {}) {
  const { root, bones } = createRig();
  const runtime = createNo60ModificationRuntime(root);
  const values = createDefaultNo60ModificationValues();
  values[element][region] = value;
  setup(bones, runtime);
  applyNo60Modifications({ runtime, values, delta: 0.1 });
  return bones;
}

function testDeterministicRegionalApplications() {
  const curves = applySingleEffect('curves', 'leftArm', 0, (bones) => {
    bones.LeftArm.quaternion.copy(angleAroundX(1));
    bones.RightArm.quaternion.copy(angleAroundX(1));
  });
  assert.ok(curves.LeftArm.quaternion.angleTo(new THREE.Quaternion()) < 0.35);
  assertNear(curves.RightArm.quaternion.angleTo(new THREE.Quaternion()), 1, 0.001);

  const axes = applySingleEffect('axes', 'arms', 0, (bones) => {
    bones.LeftArm.quaternion.copy(angleAroundX(1));
    bones.LeftUpLeg.quaternion.copy(angleAroundX(1));
  });
  assert.ok(axes.LeftArm.quaternion.angleTo(new THREE.Quaternion()) < 0.4);
  assertNear(axes.LeftUpLeg.quaternion.angleTo(new THREE.Quaternion()), 1, 0.001);

  const space = applySingleEffect('space', 'arms', 0, (bones) => {
    bones.LeftArm.quaternion.copy(angleAroundX(1));
    bones.LeftUpLeg.quaternion.copy(angleAroundX(1));
  });
  assertNear(space.LeftArm.quaternion.angleTo(new THREE.Quaternion()), 0.32, 0.01);
  assertNear(space.LeftUpLeg.quaternion.angleTo(new THREE.Quaternion()), 1, 0.001);

  const body = applySingleEffect('body', 'arms', 90);
  assert.ok(body.LeftArm.quaternion.angleTo(new THREE.Quaternion()) > 1.5);
  assertNear(body.LeftUpLeg.quaternion.angleTo(new THREE.Quaternion()), 0, 0.001);
}

function runSynchronicExtreme(value) {
  const { root, bones } = createRig();
  const runtime = createNo60ModificationRuntime(root);
  const values = createDefaultNo60ModificationValues();
  values.sync.arms = value;
  const frameCount = 42;
  const radiansPerFrame = 0.03;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const source = angleAroundX(frame * radiansPerFrame);
    bones.LeftArm.quaternion.copy(source);
    bones.RightArm.quaternion.copy(source);
    applyNo60Modifications({ runtime, values, delta: 1 / 60 });
  }

  const current = angleAroundX((frameCount - 1) * radiansPerFrame);
  return {
    leftLag: bones.LeftArm.quaternion.angleTo(current),
    rightLag: bones.RightArm.quaternion.angleTo(current)
  };
}

function testSynchronicScaleIsBipolar() {
  const leftBehind = runSynchronicExtreme(0);
  const neutral = runSynchronicExtreme(100);
  const rightBehind = runSynchronicExtreme(200);

  assert.ok(leftBehind.leftLag > 0.7, '0% should place the left-side limbs behind');
  assertNear(leftBehind.rightLag, 0, 0.001, '0% should leave the right-side phase current');
  assertNear(neutral.leftLag, 0, 0.001, '100% should preserve the left-side phase');
  assertNear(neutral.rightLag, 0, 0.001, '100% should preserve the right-side phase');
  assertNear(rightBehind.leftLag, 0, 0.001, '200% should leave the left-side phase current');
  assert.ok(rightBehind.rightLag > 0.7, '200% should place the right-side limbs behind');
  assertNear(
    leftBehind.leftLag,
    rightBehind.rightLag,
    0.001,
    '0% and 200% should create equal phase separation in opposite directions'
  );
}

function testShiftingRelationCrossfade() {
  const { root, bones } = createRig();
  const runtime = createNo60ModificationRuntime(root);
  const values = createDefaultNo60ModificationValues();
  values.relations.whole = 200;
  const delta = 1 / 60;
  let leftSourceAngle = 0;
  let rightSourceAngle = 0;
  let previousFocus = null;
  let previousRightOutput = bones.RightArm.quaternion.clone();
  let switchDelta = Infinity;
  let switched = false;

  for (let frame = 0; frame < 150; frame += 1) {
    if (frame < 55) {
      leftSourceAngle += 0.045;
      rightSourceAngle += 0.005;
    } else {
      leftSourceAngle += 0.002;
      rightSourceAngle += 0.055;
    }
    bones.LeftArm.quaternion.copy(angleAroundX(leftSourceAngle));
    bones.RightArm.quaternion.copy(angleAroundX(rightSourceAngle));
    applyNo60Modifications({ runtime, values, delta });

    if (
      previousFocus === 'leftArm'
      && runtime.relationFocusRegion === 'rightArm'
    ) {
      switched = true;
      switchDelta = previousRightOutput.angleTo(bones.RightArm.quaternion);
      break;
    }
    previousFocus = runtime.relationFocusRegion;
    previousRightOutput.copy(bones.RightArm.quaternion);
  }

  assert.ok(switched, 'Sustained right-arm motion should eventually receive attention');
  assert.ok(
    switchDelta < 0.2,
    `Attention handoff should crossfade instead of snapping (${switchDelta} radians)`
  );
  const entries = Object.fromEntries(runtime.entries.map((entry) => [entry.name, entry]));
  assert.ok(entries.LeftArm.relationDrag > 0 && entries.LeftArm.relationDrag < 1);
  assert.ok(entries.RightArm.relationDrag > 0 && entries.RightArm.relationDrag < 1);
}

function testExtendedSpaceHoldDuration() {
  const { root, bones } = createRig();
  const runtime = createNo60ModificationRuntime(root);
  const values = createDefaultNo60ModificationValues();
  values.space.arms = 200;
  const delta = 1 / 60;
  let sourceAngle = 0;

  // Move decisively into an extended arm pose so the endpoint detector is armed.
  for (let frame = 0; frame < 14; frame += 1) {
    sourceAngle += 0.07;
    bones.LeftArm.quaternion.copy(angleAroundX(sourceAngle));
    applyNo60Modifications({ runtime, values, delta });
  }
  // The first low-velocity frame at the extended pose should begin the stop.
  bones.LeftArm.quaternion.copy(angleAroundX(sourceAngle));
  applyNo60Modifications({ runtime, values, delta });

  const leftArm = runtime.entries.find((entry) => entry.name === 'LeftArm');
  const rightArm = runtime.entries.find((entry) => entry.name === 'RightArm');
  assert.ok(leftArm.spaceHoldWeight > 0, 'Extended arm should ease into a held pose');
  assert.ok(
    leftArm.spaceHoldRemaining > 3.5,
    `External-space endpoint stop should use a long staged duration (${leftArm.spaceHoldRemaining})`
  );
  assertNear(
    leftArm.spaceHoldRemaining,
    rightArm.spaceHoldRemaining,
    0.0001,
    'External-space stops should hold the affected pose as one synchronized shape'
  );

  // A static endpoint must not repeatedly restart the hold after it finishes.
  for (let frame = 0; frame < 260; frame += 1) {
    bones.LeftArm.quaternion.copy(angleAroundX(sourceAngle));
    applyNo60Modifications({ runtime, values, delta });
  }
  assert.equal(leftArm.spaceHoldRemaining, 0);
}

testRegionTags();
testRegionalResolver();
testRegionalEnergyClocks();
testDeterministicRegionalApplications();
testSynchronicScaleIsBipolar();
testShiftingRelationCrossfade();
testExtendedSpaceHoldDuration();
console.log('NO.60 regional modification tests passed.');
