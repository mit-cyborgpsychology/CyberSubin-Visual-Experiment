import * as THREE from 'three';

const REGION_OPTIONS = Object.freeze({
  whole: 'FULL BODY',
  upper: 'UPPER BODY',
  lower: 'LOWER BODY',
  torso: 'TORSO',
  arms: 'BOTH ARMS',
  legs: 'BOTH LEGS',
  leftArm: 'LEFT ARM',
  rightArm: 'RIGHT ARM',
  leftLeg: 'LEFT LEG',
  rightLeg: 'RIGHT LEG'
});

export const NO60_MODIFICATION_DEFINITIONS = Object.freeze([
  {
    id: 'energy',
    label: 'ENERGY',
    neutral: 100,
    min: 0,
    max: 300,
    step: 1,
    masterMin: 0,
    masterMax: 300,
    regions: ['whole', 'upper', 'lower', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'],
    meaning: 'Changes the temporal energy of the choreography without changing its joint paths or poses.',
    visual: 'Full Body Energy changes playback speed uniformly. Upper Body, Lower Body, and limb controls independently speed up or slow down the matching animation tracks and their local heat accumulation.',
    technical: 'Maps FULL BODY to the global playback rate, then samples each regional quaternion track with an independent clock. This changes timing without inventing new poses or changing the source joint path.',
    boundary: '0% pauses the selected region, 100% preserves its source timing, and 300% plays the same regional choreography at 3× temporal energy.'
  },
  {
    id: 'curves',
    label: 'CIRCLES + CURVES',
    neutral: 100,
    min: 0,
    max: 200,
    step: 1,
    masterMin: 0,
    masterMax: 200,
    regions: ['whole', 'leftArm', 'rightArm', 'leftLeg', 'rightLeg'],
    meaning: 'Changes how straight, rounded, and continuous limb trajectories feel.',
    visual: 'Lower values straighten the motion; higher values extend an existing curved stroke through full and repeated circular turns. The existing curve lens draws the resulting pathways.',
    technical: 'Blends animated quaternions toward a stable reference below 100%. Above 100%, it detects a coherent source rotation axis and accumulates additional quaternion travel around that axis instead of adding an unrelated oscillation.',
    boundary: '0% is maximally linear and 100% preserves the source. Around 150%, a source half-circle can become a full circle; at 200%, the same stroke can continue through two full turns.'
  },
  {
    id: 'axes',
    label: 'AXIS POINTS',
    neutral: 100,
    min: 0,
    max: 200,
    step: 1,
    masterMin: 0,
    masterMax: 200,
    regions: ['whole', 'arms', 'legs'],
    meaning: 'Introduces magnetic attraction around joint axes, emphasizing balance, pivots, and held rotational alignments.',
    visual: 'A moving joint rotates smoothly toward a nearby axis node, settles into a temporary hold, and releases when the next major source movement begins. Other body points may move toward the head node, while the head keeps its original animation.',
    technical: 'Detects nearby axis-node pairs, rotates the controlling parent joint toward the target with quaternion interpolation, and temporarily overrides that joint until accumulated source rotation identifies the next major movement. Head and neck joints are target-only and never receive an axis rotation override.',
    boundary: '0% softens rotational pivots, 100% preserves the source, and 200% creates the widest attraction range and strongest held alignment without a discontinuous jump.'
  },
  {
    id: 'sync',
    label: 'SYNCHRONIC LIMBS',
    neutral: 100,
    min: 0,
    max: 200,
    step: 1,
    masterMin: 0,
    masterMax: 200,
    regions: ['whole', 'arms', 'legs'],
    meaning: 'Changes the phase relationship among related limbs while preserving the underlying source movement.',
    visual: 'Both ends of the scale create the same amount of bilateral phase separation in opposite directions: 0% places the left limbs behind, while 200% places the right limbs behind.',
    technical: 'Uses the same bounded quaternion-history delay on opposite sides of each bilateral pair. Crossing 100% reverses which side leads without changing or reordering the source choreography.',
    boundary: '0% is maximum left-side lag, 100% preserves the original timing, and 200% is the equal-and-opposite maximum right-side lag.'
  },
  {
    id: 'space',
    label: 'EXTERNAL BODY SPACE',
    neutral: 100,
    min: 0,
    max: 200,
    step: 1,
    masterMin: 0,
    masterMax: 200,
    regions: ['whole', 'arms', 'legs'],
    meaning: 'Emphasizes the negative space around the body by making spatial endpoints more deliberate.',
    visual: 'Selected regions pause more frequently and for longer at extended low-velocity endpoints. The external-space field simultaneously becomes denser, larger, and brighter.',
    technical: 'Uses an intensity-dependent motion gate, extension threshold, hold duration, and point-cloud emphasis so higher values reveal more stable negative-space shapes.',
    boundary: '0% compresses the spatial reach and softens the field, 100% preserves the source and baseline field, and 200% creates the most frequent extended-pose stops with the strongest negative-space articulation.'
  },
  {
    id: 'relations',
    label: 'SHIFTING RELATION',
    neutral: 100,
    min: 0,
    max: 200,
    step: 1,
    masterMin: 0,
    masterMax: 200,
    regions: ['whole'],
    meaning: 'Directs attention toward the body region currently carrying the strongest change.',
    visual: 'One stable dominant region remains articulate while every non-highlighted region slows dramatically, strengthening the head-to-target shifting-relation cue.',
    technical: 'Uses hysteresis to hold one attention region at a time. Above 100%, it preserves that region and applies strong smooth temporal drag everywhere else. Below 100%, it accelerates every non-finger joint by the same rotational factor.',
    boundary: '0% distributes attention by speeding every body part equally, 100% preserves the source, and 200% isolates one clear center of attention while maintaining continuous motion.'
  },
  {
    id: 'body',
    label: 'BODY MODIFICATION',
    neutral: 0,
    min: -180,
    max: 180,
    step: 1,
    masterMin: -180,
    masterMax: 180,
    regions: ['whole', 'torso', 'arms', 'legs'],
    axisOptions: ['x', 'y', 'z', 'xyz'],
    meaning: 'Adds a controlled local twist or rotation to selected body regions.',
    visual: 'The chosen regions rotate around X, Y, Z, or all three axes while the source animation continues underneath.',
    technical: 'Applies a damped axis-angle quaternion after the animation mixer, only to the root joints of the selected regions.',
    boundary: '-180° and +180° rotate in opposite directions around a centered 0° source. Finger and thumb joints are always excluded.'
  }
]);

export function getNo60RegionLabel(region) {
  return REGION_OPTIONS[region] ?? region.toUpperCase();
}

export function createDefaultNo60ModificationValues() {
  const values = {};
  for (const definition of NO60_MODIFICATION_DEFINITIONS) {
    values[definition.id] = Object.fromEntries(
      definition.regions.map((region) => [region, definition.neutral])
    );
  }
  values.bodyAxis = 'y';
  return values;
}

export function createDefaultNo60ModificationMasters() {
  return Object.fromEntries(
    NO60_MODIFICATION_DEFINITIONS.map((definition) => [definition.id, definition.neutral])
  );
}

export function sanitizeNo60ModificationMasters(candidate) {
  const defaults = createDefaultNo60ModificationMasters();
  if (!candidate || typeof candidate !== 'object') return defaults;
  for (const definition of NO60_MODIFICATION_DEFINITIONS) {
    const value = Number(candidate[definition.id]);
    if (!Number.isFinite(value)) continue;
    defaults[definition.id] = THREE.MathUtils.clamp(
      value,
      definition.masterMin ?? 0,
      definition.masterMax ?? 100
    );
  }
  return defaults;
}

export function sanitizeNo60ModificationValues(candidate) {
  const defaults = createDefaultNo60ModificationValues();
  if (!candidate || typeof candidate !== 'object') return defaults;
  for (const definition of NO60_MODIFICATION_DEFINITIONS) {
    for (const region of definition.regions) {
      const value = Number(candidate?.[definition.id]?.[region]);
      if (Number.isFinite(value)) {
        defaults[definition.id][region] = THREE.MathUtils.clamp(
          value,
          definition.min,
          definition.max
        );
      }
    }
  }
  if (['x', 'y', 'z', 'xyz'].includes(candidate.bodyAxis)) defaults.bodyAxis = candidate.bodyAxis;
  return defaults;
}

export function randomizeNo60ModificationValues() {
  const values = createDefaultNo60ModificationValues();
  for (const definition of NO60_MODIFICATION_DEFINITIONS) {
    for (const region of definition.regions) {
      values[definition.id][region] = Math.round(
        THREE.MathUtils.lerp(definition.min, definition.max, Math.random())
      );
    }
  }
  values.bodyAxis = ['x', 'y', 'z', 'xyz'][Math.floor(Math.random() * 4)];
  return values;
}

export function getNo60EnergyPlaybackRate(values) {
  const wholeBodyEnergy = resolveNo60ModificationValue(values, 'energy');
  return THREE.MathUtils.clamp(
    Number.isFinite(wholeBodyEnergy) ? wholeBodyEnergy / 100 : 1,
    0,
    3
  );
}

function cleanBoneName(name = '') {
  return name.split(':').at(-1).replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function regionTagsForBone(name) {
  const bone = cleanBoneName(name);
  const tags = new Set(['whole']);
  const left = bone.includes('left');
  const right = bone.includes('right');
  const arm = /shoulder|arm|forearm|hand|thumb|finger/.test(bone);
  const leg = /upleg|leg|foot|toe/.test(bone);
  const pelvis = /hips|pelvis/.test(bone);
  const torso = pelvis || /spine|neck|head/.test(bone);

  // Pelvis/root motion must stay on the Full Body clock. Assigning it to
  // Upper or Lower Body would carry the opposite half of the hierarchy too,
  // making an apparently regional slider modify the entire choreography.
  if (arm || (torso && !pelvis)) tags.add('upper');
  if (leg) tags.add('lower');
  if (torso) tags.add('torso');
  if (arm) tags.add('arms');
  if (leg) tags.add('legs');
  if (arm && left) tags.add('leftArm');
  if (arm && right) tags.add('rightArm');
  if (leg && left) tags.add('leftLeg');
  if (leg && right) tags.add('rightLeg');
  return tags;
}

export function getNo60BoneRegionTags(name) {
  return [...regionTagsForBone(name)];
}

export function resolveNo60ModificationValue(values, elementId, regions = []) {
  const definition = NO60_MODIFICATION_DEFINITIONS.find(({ id }) => id === elementId);
  if (!definition) return 0;
  const settings = values?.[elementId] ?? {};
  const fullBody = Number(settings.whole ?? definition.neutral);
  let resolved = Number.isFinite(fullBody) ? fullBody : definition.neutral;
  for (const region of regions) {
    if (region === 'whole' || !definition.regions.includes(region)) continue;
    const regionalValue = Number(settings[region] ?? definition.neutral);
    if (Number.isFinite(regionalValue)) resolved += regionalValue - definition.neutral;
  }
  return THREE.MathUtils.clamp(resolved, definition.min, definition.max);
}

function resolveApplicableValue(values, definition, tags) {
  return resolveNo60ModificationValue(values, definition.id, [...tags]);
}

function isRegionRoot(name) {
  const bone = cleanBoneName(name);
  return /^(hips|spine|spine1|leftarm|rightarm|leftupleg|rightupleg)$/.test(bone);
}

function isFingerBone(name) {
  return /thumb|finger|index|middle|ring|pinky|little|digit|metacarp/.test(cleanBoneName(name));
}

function isHeadChainBone(name) {
  return /head|neck/.test(cleanBoneName(name));
}

const AXIS_POINT_BONES = new Set([
  'hips', 'spine2', 'head',
  'leftarm', 'leftforearm', 'lefthand',
  'rightarm', 'rightforearm', 'righthand',
  'leftleg', 'leftfoot', 'rightleg', 'rightfoot'
]);

function axisPointGroup(entry) {
  if (entry.tags.has('leftArm')) return 'leftArm';
  if (entry.tags.has('rightArm')) return 'rightArm';
  if (entry.tags.has('leftLeg')) return 'leftLeg';
  if (entry.tags.has('rightLeg')) return 'rightLeg';
  return cleanBoneName(entry.name) === 'head' ? 'head' : 'center';
}

function axisMoverPriority(entry) {
  const bone = cleanBoneName(entry.name);
  if (/hand|foot/.test(bone)) return 1;
  if (/forearm|arm|leg/.test(bone)) return 0.72;
  if (bone === 'head') return 0.34;
  return 0.12;
}

function primaryMotionRegion(tags) {
  for (const region of ['leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'torso']) {
    if (tags.has(region)) return region;
  }
  return 'whole';
}

export function createNo60ModificationRuntime(root, clip = null, clipStart = 0) {
  const entries = [];
  root?.traverse((object) => {
    if (!object.isBone) return;
    entries.push({
      bone: object,
      name: object.name,
      tags: regionTagsForBone(object.name),
      rest: object.quaternion.clone(),
      previous: object.quaternion.clone(),
      previousSource: object.quaternion.clone(),
      history: [],
      hold: object.quaternion.clone(),
      source: object.quaternion.clone(),
      stationary: 0,
      spaceExtensionPeak: 0,
      spaceMotionArmed: false,
      spaceHoldRemaining: 0,
      spaceHoldCooldown: 0,
      spaceHoldWeight: 0,
      speed: 0,
      relationMotionScore: 0,
      relationAmount: 0,
      relationDrag: 0,
      relationOutput: object.quaternion.clone(),
      sourceDeltaAngle: 0,
      sourceDeltaAxis: new THREE.Vector3(0, 1, 0),
      sourceDeltaQuaternion: new THREE.Quaternion(),
      energyInterpolant: null,
      energyTime: null,
      energyBlend: 0,
      energyQuaternion: object.quaternion.clone(),
      curveAxis: new THREE.Vector3(0, 1, 0),
      curveAxisReady: false,
      curveActivation: 0,
      curveRotation: new THREE.Quaternion(),
      regionRoot: isRegionRoot(object.name),
      effectEligible: !isFingerBone(object.name),
      bodyEligible: !isFingerBone(object.name),
      axisRotationEligible: !isFingerBone(object.name) && !isHeadChainBone(object.name),
      pairedEntry: null,
      parentEntry: null,
      axisPoint: AXIS_POINT_BONES.has(cleanBoneName(object.name)),
      axisPointGroup: null,
      axisWorldPosition: new THREE.Vector3(),
      axisLockPoint: null,
      axisTargetEntry: null,
      axisLockActive: false,
      axisLockReleasing: false,
      axisLockAge: 0,
      axisSourceTravel: 0,
      axisCooldown: 0,
      axisStrength: 0,
      axisSourceAtLock: object.quaternion.clone(),
      axisTargetQuaternion: object.quaternion.clone(),
      axisOverrideQuaternion: object.quaternion.clone()
    });
  });
  const entriesByName = new Map(entries.map((entry) => [cleanBoneName(entry.name), entry]));
  for (const entry of entries) {
    const name = cleanBoneName(entry.name);
    const pairedName = name.includes('left')
      ? name.replace('left', 'right')
      : name.includes('right')
        ? name.replace('right', 'left')
        : null;
    entry.pairedEntry = pairedName ? entriesByName.get(pairedName) ?? null : null;
    entry.parentEntry = entry.bone.parent?.isBone
      ? entriesByName.get(cleanBoneName(entry.bone.parent.name)) ?? null
      : null;
    entry.axisPointGroup = axisPointGroup(entry);
  }
  if (clip?.tracks?.length) {
    for (const track of clip.tracks) {
      let parsed;
      try {
        parsed = THREE.PropertyBinding.parseTrackName(track.name);
      } catch {
        continue;
      }
      const trackBoneName = parsed?.nodeName ?? parsed?.objectIndex;
      if (parsed?.propertyName !== 'quaternion' || !trackBoneName) continue;
      const entry = entriesByName.get(cleanBoneName(trackBoneName));
      if (!entry) continue;
      entry.energyInterpolant = track.createInterpolant();
    }
  }
  return {
    root,
    entries,
    clipStart: THREE.MathUtils.clamp(Number(clipStart) || 0, 0, clip?.duration ?? 0),
    clipEnd: Math.max(Number(clip?.duration) || 0, Number(clipStart) || 0),
    elapsed: 0,
    relationFocusRegion: null,
    relationFocusElapsed: 0,
    relationCandidateRegion: null,
    relationCandidateElapsed: 0,
    spacePoseMotionArmed: false,
    spacePoseHoldRemaining: 0,
    spacePoseHoldCooldown: 0,
    spacePoseHoldWeight: 0,
    spacePoseExtensionPeak: 0,
    spacePoseCapturePending: false
  };
}

const scratchEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const scratchEulerB = new THREE.Euler(0, 0, 0, 'XYZ');
const scratchQuaternion = new THREE.Quaternion();
const scratchQuaternionB = new THREE.Quaternion();
const scratchAxis = new THREE.Vector3();
const axisControllerPosition = new THREE.Vector3();
const axisCurrentDirection = new THREE.Vector3();
const axisTargetDirection = new THREE.Vector3();
const axisControllerWorldQuaternion = new THREE.Quaternion();
const axisParentWorldQuaternion = new THREE.Quaternion();
const axisWorldCorrection = new THREE.Quaternion();
const axisDesiredWorldQuaternion = new THREE.Quaternion();
const axisDesiredLocalQuaternion = new THREE.Quaternion();

function wrapNo60ClipTime(runtime, time) {
  const clipStart = runtime.clipStart ?? 0;
  const clipEnd = runtime.clipEnd ?? clipStart;
  const duration = clipEnd - clipStart;
  if (!(duration > 0)) return Math.max(0, time);
  return clipStart + THREE.MathUtils.euclideanModulo(time - clipStart, duration);
}

function resetRegionalEnergy(entry, actionTime) {
  entry.energyTime = Number.isFinite(actionTime) ? actionTime : null;
  entry.energyBlend = 0;
  entry.energyQuaternion.copy(entry.bone.quaternion);
}

function applyRegionalEnergy({
  runtime,
  entry,
  bone,
  source,
  energyValue,
  fullBodyEnergy,
  actionTime,
  delta,
  advanceEnergy,
  resetEnergyTime
}) {
  if (resetEnergyTime) {
    resetRegionalEnergy(entry, actionTime);
    return;
  }

  const regionalTimingIsDifferent = Math.abs(energyValue - fullBodyEnergy) > 0.001;
  if (!entry.energyInterpolant || !regionalTimingIsDifferent) {
    entry.energyTime = Number.isFinite(actionTime) ? actionTime : entry.energyTime;
    if (entry.energyBlend > 0.0001) {
      entry.energyBlend *= Math.exp(-Math.max(1 / 240, delta) * 9);
      bone.quaternion.copy(source).slerp(entry.energyQuaternion, entry.energyBlend).normalize();
    } else {
      entry.energyBlend = 0;
    }
    return;
  }

  const fullBodyRate = THREE.MathUtils.clamp(fullBodyEnergy / 100, 0, 3);
  const regionalRate = THREE.MathUtils.clamp(energyValue / 100, 0, 3);
  if (!Number.isFinite(entry.energyTime)) {
    const globalStep = advanceEnergy ? Math.max(0, delta) * fullBodyRate : 0;
    entry.energyTime = Number.isFinite(actionTime) ? actionTime - globalStep : runtime.clipStart;
  }
  if (advanceEnergy) {
    entry.energyTime = wrapNo60ClipTime(runtime, entry.energyTime + Math.max(0, delta) * regionalRate);
  }

  const sampled = entry.energyInterpolant.evaluate(wrapNo60ClipTime(runtime, entry.energyTime));
  entry.energyQuaternion.set(sampled[0], sampled[1], sampled[2], sampled[3]).normalize();
  const blendAlpha = 1 - Math.exp(-Math.max(1 / 240, delta) * 14);
  entry.energyBlend = THREE.MathUtils.lerp(entry.energyBlend, 1, blendAlpha);
  bone.quaternion.copy(source).slerp(entry.energyQuaternion, entry.energyBlend).normalize();
}

function releaseAxisLock(entry, cooldown = 0.24) {
  entry.axisLockActive = false;
  entry.axisLockReleasing = true;
  entry.axisLockAge = 0;
  entry.axisSourceTravel = 0;
  entry.axisCooldown = Math.max(entry.axisCooldown, cooldown);
  entry.axisLockPoint = null;
  entry.axisTargetEntry = null;
}

function createAxisLock(point, target, strength) {
  const controller = point.parentEntry;
  if (
    !controller?.effectEligible
    || !controller.axisRotationEligible
    || isHeadChainBone(point.name)
  ) return false;

  controller.bone.getWorldPosition(axisControllerPosition);
  axisCurrentDirection.copy(point.axisWorldPosition).sub(axisControllerPosition);
  axisTargetDirection.copy(target.axisWorldPosition).sub(axisControllerPosition);
  if (axisCurrentDirection.lengthSq() < 0.000001 || axisTargetDirection.lengthSq() < 0.000001) {
    return false;
  }
  axisCurrentDirection.normalize();
  axisTargetDirection.normalize();

  controller.bone.getWorldQuaternion(axisControllerWorldQuaternion);
  if (controller.bone.parent) {
    controller.bone.parent.getWorldQuaternion(axisParentWorldQuaternion);
  } else {
    axisParentWorldQuaternion.identity();
  }
  axisWorldCorrection.setFromUnitVectors(axisCurrentDirection, axisTargetDirection);
  axisDesiredWorldQuaternion.copy(axisWorldCorrection)
    .multiply(axisControllerWorldQuaternion)
    .normalize();
  axisDesiredLocalQuaternion.copy(axisParentWorldQuaternion)
    .invert()
    .multiply(axisDesiredWorldQuaternion)
    .normalize();

  const attractionWeight = THREE.MathUtils.lerp(0.34, 1, strength);
  controller.axisTargetQuaternion.copy(controller.source)
    .slerp(axisDesiredLocalQuaternion, attractionWeight)
    .normalize();
  controller.axisOverrideQuaternion.copy(controller.bone.quaternion);
  controller.axisSourceAtLock.copy(controller.source);
  controller.axisLockPoint = point;
  controller.axisTargetEntry = target;
  controller.axisLockActive = true;
  controller.axisLockReleasing = false;
  controller.axisLockAge = 0;
  controller.axisSourceTravel = 0;
  controller.axisStrength = strength;
  return true;
}

function prepareAxisPointAttractions(runtime, values, definition, delta) {
  const frameDelta = Math.max(1 / 240, delta);
  const axisPoints = runtime.entries.filter(
    (entry) => entry.axisPoint && entry.effectEligible && entry.parentEntry?.effectEligible
  );

  for (const entry of runtime.entries) {
    entry.axisCooldown = Math.max(0, entry.axisCooldown - frameDelta);
    if (!entry.axisLockActive) continue;
    const pointValue = entry.axisLockPoint
      ? resolveApplicableValue(values, definition, entry.axisLockPoint.tags)
      : definition.neutral;
    const currentStrength = THREE.MathUtils.clamp((pointValue - 100) / 100, 0, 1);
    entry.axisLockAge += frameDelta;
    entry.axisSourceTravel += entry.sourceDeltaAngle;

    const majorMovementTravel = THREE.MathUtils.lerp(0.42, 0.68, entry.axisStrength);
    const sourceDiscontinuity = entry.sourceDeltaAngle > 1.25;
    const nextMajorMovement = entry.axisLockAge > 0.2
      && entry.axisSourceTravel > majorMovementTravel
      && entry.speed > 0.38;
    if (currentStrength <= 0.001 || sourceDiscontinuity || nextMajorMovement) {
      releaseAxisLock(entry, sourceDiscontinuity ? 0.34 : 0.24);
    }
  }

  if (!axisPoints.length) return;
  runtime.root?.updateMatrixWorld(true);
  axisPoints.forEach((entry) => entry.bone.getWorldPosition(entry.axisWorldPosition));

  const pairs = [];
  for (let firstIndex = 0; firstIndex < axisPoints.length; firstIndex += 1) {
    const first = axisPoints[firstIndex];
    const firstValue = resolveApplicableValue(values, definition, first.tags);
    const firstStrength = THREE.MathUtils.clamp((firstValue - 100) / 100, 0, 1);
    for (let secondIndex = firstIndex + 1; secondIndex < axisPoints.length; secondIndex += 1) {
      const second = axisPoints[secondIndex];
      if (first.axisPointGroup === second.axisPointGroup) continue;
      if (
        first.parentEntry === second
        || second.parentEntry === first
        || first.parentEntry === second.parentEntry
      ) continue;
      const secondValue = resolveApplicableValue(values, definition, second.tags);
      const secondStrength = THREE.MathUtils.clamp((secondValue - 100) / 100, 0, 1);
      const strongest = Math.max(firstStrength, secondStrength);
      if (strongest <= 0.001) continue;
      const distance = first.axisWorldPosition.distanceTo(second.axisWorldPosition);
      const attractionDistance = THREE.MathUtils.lerp(0.18, 0.38, strongest);
      if (distance > 0.035 && distance < attractionDistance) {
        pairs.push({ first, second, firstStrength, secondStrength, distance });
      }
    }
  }
  pairs.sort((first, second) => first.distance - second.distance);

  const reservedControllers = new Set();
  for (const pair of pairs) {
    const firstController = pair.first.parentEntry;
    const secondController = pair.second.parentEntry;
    const firstAvailable = pair.firstStrength > 0.001
      && pair.first.axisRotationEligible
      && firstController.axisRotationEligible
      && !isHeadChainBone(pair.first.name)
      && !firstController.axisLockActive
      && !firstController.axisLockReleasing
      && firstController.axisCooldown <= 0
      && !reservedControllers.has(firstController);
    const secondAvailable = pair.secondStrength > 0.001
      && pair.second.axisRotationEligible
      && secondController.axisRotationEligible
      && !isHeadChainBone(pair.second.name)
      && !secondController.axisLockActive
      && !secondController.axisLockReleasing
      && secondController.axisCooldown <= 0
      && !reservedControllers.has(secondController);
    if (!firstAvailable && !secondAvailable) continue;

    let point;
    let target;
    let strength;
    const firstMotionScore = firstController.speed * (0.65 + pair.firstStrength * 0.35)
      + axisMoverPriority(pair.first) * 0.02;
    const secondMotionScore = secondController.speed * (0.65 + pair.secondStrength * 0.35)
      + axisMoverPriority(pair.second) * 0.02;
    if (!secondAvailable || (
      firstAvailable
      && firstMotionScore >= secondMotionScore
    )) {
      point = pair.first;
      target = pair.second;
      strength = pair.firstStrength;
    } else {
      point = pair.second;
      target = pair.first;
      strength = pair.secondStrength;
    }
    if (createAxisLock(point, target, strength)) {
      reservedControllers.add(point.parentEntry);
      reservedControllers.add(target.parentEntry);
    }
  }
}

function applyAxisPointOverride(entry, bone, delta) {
  if (entry.axisLockActive) {
    const response = THREE.MathUtils.lerp(3.4, 6.5, entry.axisStrength);
    const alpha = 1 - Math.exp(-Math.max(1 / 240, delta) * response);
    entry.axisOverrideQuaternion.slerp(entry.axisTargetQuaternion, alpha).normalize();
    bone.quaternion.copy(entry.axisOverrideQuaternion);
    return;
  }
  if (!entry.axisLockReleasing) return;
  const releaseAlpha = 1 - Math.exp(-Math.max(1 / 240, delta) * 8.5);
  entry.axisOverrideQuaternion.slerp(bone.quaternion, releaseAlpha).normalize();
  const remainingOverride = entry.axisOverrideQuaternion.angleTo(bone.quaternion);
  bone.quaternion.copy(entry.axisOverrideQuaternion);
  if (remainingOverride < 0.012) {
    entry.axisLockReleasing = false;
    entry.axisStrength = 0;
  }
}

function captureSourceRotationDelta(entry, source, delta) {
  scratchQuaternion.copy(entry.previousSource).invert().multiply(source).normalize();
  if (scratchQuaternion.w < 0) {
    scratchQuaternion.set(
      -scratchQuaternion.x,
      -scratchQuaternion.y,
      -scratchQuaternion.z,
      -scratchQuaternion.w
    );
  }
  entry.sourceDeltaQuaternion.copy(scratchQuaternion);
  const halfAngleSine = Math.sqrt(Math.max(0, 1 - scratchQuaternion.w ** 2));
  const angle = 2 * Math.acos(THREE.MathUtils.clamp(scratchQuaternion.w, -1, 1));
  entry.sourceDeltaAngle = Number.isFinite(angle) ? angle : 0;
  if (halfAngleSine > 0.00001 && entry.sourceDeltaAngle > 0.00001) {
    entry.sourceDeltaAxis.set(
      scratchQuaternion.x / halfAngleSine,
      scratchQuaternion.y / halfAngleSine,
      scratchQuaternion.z / halfAngleSine
    ).normalize();
  }
  entry.speed = entry.sourceDeltaAngle / Math.max(1 / 240, delta);
}

function prepareExternalSpacePoseStops(runtime, values, definition, delta) {
  const safeDelta = Math.max(1 / 240, delta);
  runtime.spacePoseCapturePending = false;
  runtime.spacePoseHoldCooldown = Math.max(
    0,
    (runtime.spacePoseHoldCooldown ?? 0) - safeDelta
  );

  const activeEntries = runtime.entries.map((entry) => {
    const signed = (resolveApplicableValue(values, definition, entry.tags) - 100) / 100;
    return { entry, signed };
  }).filter(({ entry, signed }) => entry.effectEligible && signed > 0.001);

  if (!activeEntries.length) {
    runtime.spacePoseMotionArmed = false;
    runtime.spacePoseHoldRemaining = 0;
    runtime.spacePoseHoldCooldown = 0;
    runtime.spacePoseExtensionPeak = 0;
    const releaseAlpha = 1 - Math.exp(-safeDelta * 1.1);
    runtime.spacePoseHoldWeight = THREE.MathUtils.lerp(
      runtime.spacePoseHoldWeight ?? 0,
      0,
      releaseAlpha
    );
    return;
  }

  const intensity = THREE.MathUtils.clamp(
    Math.max(...activeEntries.map(({ signed }) => signed)),
    0,
    1
  );
  const poseEntries = activeEntries.filter(({ entry }) => (
    entry.tags.has('arms') || entry.tags.has('legs') || entry.tags.has('torso')
  ));
  const samples = poseEntries.length ? poseEntries : activeEntries;
  const sortedSpeeds = samples
    .map(({ entry }) => Math.min(entry.speed, 3))
    .sort((first, second) => second - first);
  const movingSampleCount = Math.max(1, Math.ceil(sortedSpeeds.length * 0.35));
  const poseSpeed = sortedSpeeds
    .slice(0, movingSampleCount)
    .reduce((total, speed) => total + speed, 0) / movingSampleCount;
  const sourceExtension = Math.max(
    ...samples.map(({ entry }) => entry.rest.angleTo(entry.source))
  );
  runtime.spacePoseExtensionPeak = Math.max(
    sourceExtension,
    (runtime.spacePoseExtensionPeak ?? 0) * Math.exp(-safeDelta * 0.32)
  );

  // One decisive movement arms a pose stop. Higher settings need less motion
  // to arm and accept a wider low-speed window, producing clear staged poses
  // instead of a continuously drifting silhouette.
  const motionArmThreshold = THREE.MathUtils.lerp(0.34, 0.16, intensity);
  const slowThreshold = THREE.MathUtils.lerp(0.14, 0.42, intensity);
  if (runtime.spacePoseHoldRemaining <= 0 && poseSpeed > motionArmThreshold) {
    runtime.spacePoseMotionArmed = true;
  }

  const extensionFloor = THREE.MathUtils.lerp(0.18, 0.075, intensity);
  const extendedEndpoint = sourceExtension >= Math.max(
    extensionFloor,
    runtime.spacePoseExtensionPeak * THREE.MathUtils.lerp(0.82, 0.56, intensity)
  );
  if (
    runtime.spacePoseMotionArmed
    && runtime.spacePoseHoldCooldown <= 0
    && poseSpeed < slowThreshold
    && extendedEndpoint
  ) {
    runtime.spacePoseHoldRemaining = THREE.MathUtils.lerp(1.35, 3.8, intensity);
    runtime.spacePoseHoldCooldown = runtime.spacePoseHoldRemaining
      + THREE.MathUtils.lerp(0.48, 0.12, intensity);
    runtime.spacePoseCapturePending = true;
    runtime.spacePoseMotionArmed = false;
  }

  runtime.spacePoseHoldRemaining = Math.max(
    0,
    (runtime.spacePoseHoldRemaining ?? 0) - safeDelta
  );
  const holdTarget = runtime.spacePoseHoldRemaining > 0
    ? THREE.MathUtils.clamp(0.92 + intensity * 0.078, 0, 0.998)
    : 0;
  // Ease deliberately into and out of each still pose. The long release makes
  // the next pose arrive as a slow transition rather than a sudden catch-up.
  const response = holdTarget > (runtime.spacePoseHoldWeight ?? 0) ? 4.2 : 0.9;
  const holdAlpha = 1 - Math.exp(-safeDelta * response);
  runtime.spacePoseHoldWeight = THREE.MathUtils.lerp(
    runtime.spacePoseHoldWeight ?? 0,
    holdTarget,
    holdAlpha
  );

  for (const { entry } of activeEntries) {
    entry.spaceHoldRemaining = runtime.spacePoseHoldRemaining;
    entry.spaceHoldCooldown = runtime.spacePoseHoldCooldown;
    entry.spaceHoldWeight = runtime.spacePoseHoldWeight;
    entry.stationary = runtime.spacePoseHoldRemaining;
  }
}

function updateRelationFocus(runtime, dominantEntry, dominantSpeed, delta) {
  const candidateRegion = dominantEntry ? primaryMotionRegion(dominantEntry.tags) : null;
  const safeDelta = Math.max(1 / 240, delta);
  runtime.relationFocusElapsed += safeDelta;
  if (!runtime.relationFocusRegion) {
    runtime.relationFocusRegion = candidateRegion;
    runtime.relationFocusElapsed = 0;
    runtime.relationCandidateRegion = null;
    runtime.relationCandidateElapsed = 0;
    return runtime.relationFocusRegion;
  }
  if (!candidateRegion || candidateRegion === runtime.relationFocusRegion) {
    runtime.relationCandidateRegion = null;
    runtime.relationCandidateElapsed = 0;
    return runtime.relationFocusRegion;
  }

  if (candidateRegion !== runtime.relationCandidateRegion) {
    runtime.relationCandidateRegion = candidateRegion;
    runtime.relationCandidateElapsed = 0;
  } else {
    runtime.relationCandidateElapsed += safeDelta;
  }

  let currentRegionSpeed = 0;
  for (const entry of runtime.entries) {
    if (!entry.effectEligible || entry.sourceDeltaAngle >= 1.25) continue;
    if (primaryMotionRegion(entry.tags) === runtime.relationFocusRegion) {
      currentRegionSpeed = Math.max(currentRegionSpeed, entry.relationMotionScore);
    }
  }
  const clearlyStronger = dominantSpeed > Math.max(0.08, currentRegionSpeed * 1.3 + 0.025);
  const currentRegionQuiet = currentRegionSpeed < 0.035 && dominantSpeed > 0.1;
  const minimumHoldElapsed = runtime.relationFocusElapsed >= (currentRegionQuiet ? 0.28 : 0.5);
  const candidateIsSustained = runtime.relationCandidateElapsed >= 0.16;
  if (minimumHoldElapsed && candidateIsSustained && (clearlyStronger || currentRegionQuiet)) {
    runtime.relationFocusRegion = candidateRegion;
    runtime.relationFocusElapsed = 0;
    runtime.relationCandidateRegion = null;
    runtime.relationCandidateElapsed = 0;
  }
  return runtime.relationFocusRegion;
}

function applyCircularTravel(entry, bone, curveSigned, delta) {
  const validDelta = entry.sourceDeltaAngle > 0.0004 && entry.sourceDeltaAngle < 1.4;
  const startingCurve = validDelta && !entry.curveAxisReady;
  let axisAlignment = 1;
  let rotationDirection = 1;
  if (validDelta) {
    if (!entry.curveAxisReady) {
      entry.curveAxis.copy(entry.sourceDeltaAxis);
      entry.curveAxisReady = true;
    } else {
      axisAlignment = entry.curveAxis.dot(entry.sourceDeltaAxis);
      scratchAxis.copy(entry.sourceDeltaAxis);
      if (axisAlignment < 0) {
        scratchAxis.multiplyScalar(-1);
        axisAlignment *= -1;
        rotationDirection = -1;
      }
      entry.curveAxis.lerp(scratchAxis, Math.min(1, delta * 14)).normalize();
    }
  }

  const motionAmount = validDelta
    ? THREE.MathUtils.clamp((entry.speed - 0.02) / 0.28, 0, 1)
    : 0;
  const coherence = THREE.MathUtils.clamp((axisAlignment - 0.42) / 0.58, 0, 1);
  const activationTarget = motionAmount * coherence;
  const activationResponse = activationTarget > entry.curveActivation ? 12 : 3.2;
  entry.curveActivation = startingCurve
    ? activationTarget
    : THREE.MathUtils.lerp(
      entry.curveActivation,
      activationTarget,
      Math.min(1, delta * activationResponse)
    );

  if (validDelta && entry.curveActivation > 0.001) {
    // This curve maps a source half-turn to roughly one full turn at 150%
    // and two full turns at 200%, while remaining continuous in between.
    const angularMultiplier = 1 + curveSigned * (1 + curveSigned * 2);
    const additionalAngle = entry.sourceDeltaAngle
      * (angularMultiplier - 1)
      * entry.curveActivation
      * rotationDirection;
    scratchQuaternion.setFromAxisAngle(entry.curveAxis, additionalAngle);
    entry.curveRotation.multiply(scratchQuaternion).normalize();
  } else if (entry.sourceDeltaAngle >= 1.4) {
    // A large one-frame source jump is a clip boundary or seek, not a curve.
    entry.curveRotation.identity();
    entry.curveActivation = 0;
    entry.curveAxisReady = false;
  } else if (entry.curveActivation < 0.08) {
    scratchQuaternion.identity();
    entry.curveRotation.slerp(scratchQuaternion, Math.min(1, delta * 0.8));
  }
  bone.quaternion.multiply(entry.curveRotation);
}

function setQuaternionAxisRotation(target, axisKey, radians) {
  if (axisKey === 'xyz') {
    scratchEuler.set(radians * 0.58, radians * 0.72, radians * 0.46, 'XYZ');
    return target.setFromEuler(scratchEuler);
  }
  scratchAxis.set(axisKey === 'x' ? 1 : 0, axisKey === 'y' ? 1 : 0, axisKey === 'z' ? 1 : 0);
  return target.setFromAxisAngle(scratchAxis, radians);
}

export function applyNo60Modifications({
  runtime,
  values,
  delta = 1 / 60,
  actionTime = null,
  advanceEnergy = false,
  resetEnergyTime = false
}) {
  if (!runtime?.entries?.length) return;
  runtime.elapsed += delta;

  const definitions = Object.fromEntries(
    NO60_MODIFICATION_DEFINITIONS.map((definition) => [definition.id, definition])
  );
  let dominantEntry = null;
  // Do not establish an arbitrary focus from a perfectly still first frame.
  // Wait until a region has meaningful source motion.
  let dominantSpeed = 0.01;
  const fullBodyEnergy = resolveNo60ModificationValue(values, 'energy');

  for (const entry of runtime.entries) {
    const source = entry.bone.quaternion.clone();
    if (entry.effectEligible) {
      const energyValue = resolveApplicableValue(values, definitions.energy, entry.tags);
      applyRegionalEnergy({
        runtime,
        entry,
        bone: entry.bone,
        source,
        energyValue,
        fullBodyEnergy,
        actionTime,
        delta,
        advanceEnergy,
        resetEnergyTime
      });
    } else {
      resetRegionalEnergy(entry, actionTime);
    }
    source.copy(entry.bone.quaternion);
    entry.source.copy(source);
    captureSourceRotationDelta(entry, source, delta);
    // A clip loop or seek can produce one very large quaternion delta. Treat
    // that as a boundary, not as a new center of attention, so it cannot cause
    // a one-frame focus jump on the next rendered pose.
    const relationMotionSample = entry.sourceDeltaAngle < 1.25
      ? Math.min(entry.speed, 8)
      : 0;
    const motionScoreResponse = relationMotionSample > entry.relationMotionScore ? 7.5 : 2.8;
    const motionScoreAlpha = 1 - Math.exp(
      -Math.max(1 / 240, delta) * motionScoreResponse
    );
    entry.relationMotionScore = THREE.MathUtils.lerp(
      entry.relationMotionScore,
      relationMotionSample,
      motionScoreAlpha
    );
    entry.previousSource.copy(source);
    entry.history.push(source.clone());
    if (entry.history.length > 38) entry.history.shift();
    if (
      entry.bodyEligible
      && entry.relationMotionScore > dominantSpeed
      && entry.sourceDeltaAngle < 1.25
      && (entry.tags.has('arms') || entry.tags.has('legs') || entry.tags.has('torso'))
    ) {
      dominantSpeed = entry.relationMotionScore;
      dominantEntry = entry;
    }
  }
  const dominantRegion = updateRelationFocus(runtime, dominantEntry, dominantSpeed, delta);
  prepareAxisPointAttractions(runtime, values, definitions.axes, delta);
  prepareExternalSpacePoseStops(runtime, values, definitions.space, delta);

  for (let index = 0; index < runtime.entries.length; index += 1) {
    const entry = runtime.entries[index];
    const bone = entry.bone;
    const tags = entry.tags;
    // Finger and thumb joints always retain the animation mixer's untouched
    // local rotation. Parent hand/arm movement may carry them through space,
    // but no NO.60 modification is ever applied to the joints themselves.
    if (!entry.effectEligible) {
      entry.previous.copy(bone.quaternion);
      entry.hold.copy(bone.quaternion);
      entry.curveRotation.identity();
      entry.curveActivation = 0;
      entry.curveAxisReady = false;
      entry.stationary = 0;
      entry.spaceExtensionPeak = 0;
      entry.spaceMotionArmed = false;
      entry.spaceHoldRemaining = 0;
      entry.spaceHoldCooldown = 0;
      entry.spaceHoldWeight = 0;
      continue;
    }
    const curveValue = resolveApplicableValue(values, definitions.curves, tags);
    const axesValue = resolveApplicableValue(values, definitions.axes, tags);
    const syncValue = resolveApplicableValue(values, definitions.sync, tags);
    const spaceValue = resolveApplicableValue(values, definitions.space, tags);
    const relationValue = resolveApplicableValue(values, definitions.relations, tags);

    const syncSigned = THREE.MathUtils.clamp((syncValue - 100) / 100, -1, 1);
    const isLeftPhase = entry.tags.has('leftArm') || entry.tags.has('leftLeg');
    const isRightPhase = entry.tags.has('rightArm') || entry.tags.has('rightLeg');
    const delaysThisSide = syncSigned < -0.001
      ? isLeftPhase
      : syncSigned > 0.001 && isRightPhase;
    const delayFrames = delaysThisSide
      ? Math.round(Math.abs(syncSigned) * 30)
      : 0;
    if (delayFrames > 0 && entry.history.length > delayFrames) {
      const delayed = entry.history[Math.max(0, entry.history.length - 1 - delayFrames)];
      const phaseStrength = THREE.MathUtils.clamp(0.46 + delayFrames / 34, 0, 0.94);
      bone.quaternion.slerp(delayed, phaseStrength).normalize();
    }

    const curveSigned = (curveValue - 100) / 100;
    if (curveSigned < -0.001) {
      entry.curveRotation.identity();
      entry.curveActivation = 0;
      entry.curveAxisReady = false;
      bone.quaternion.slerp(entry.rest, -curveSigned * 0.78);
      bone.quaternion.slerp(entry.previous, -curveSigned * 0.18);
    } else if (curveSigned > 0.001) {
      applyCircularTravel(entry, bone, curveSigned, delta);
      // Curved travel is most expressive during coherent rotation, but the
      // regional control must remain observable on quieter source frames too.
      // A small rest-relative expansion provides that deterministic baseline.
      if (entry.curveActivation < 0.08) {
        scratchQuaternion.copy(entry.rest).invert().multiply(bone.quaternion);
        scratchEuler.setFromQuaternion(scratchQuaternion, 'XYZ');
        const quietCurveExpansion = 1 + curveSigned * 0.22;
        scratchEuler.set(
          scratchEuler.x * quietCurveExpansion,
          scratchEuler.y * quietCurveExpansion,
          scratchEuler.z * quietCurveExpansion,
          'XYZ'
        );
        bone.quaternion.copy(entry.rest).multiply(scratchQuaternion.setFromEuler(scratchEuler));
      }
    } else {
      entry.curveRotation.identity();
      entry.curveActivation = 0;
      entry.curveAxisReady = false;
    }

    const axisSigned = (axesValue - 100) / 100;
    if (axisSigned < -0.001 && entry.axisRotationEligible) {
      bone.quaternion.slerp(entry.previous, -axisSigned * 0.74);
    } else if (
      axisSigned > 0.001
      && entry.axisRotationEligible
      && !entry.axisLockActive
      && entry.sourceDeltaAngle > 0.00001
      && entry.sourceDeltaAngle < 1.25
    ) {
      // Nearby-node attraction remains the primary axis behavior. This
      // regional continuation makes Arms/Legs controls responsive even on a
      // frame where no eligible node pair happens to be within range.
      scratchQuaternionB.setFromAxisAngle(
        entry.sourceDeltaAxis,
        entry.sourceDeltaAngle * axisSigned * 0.32
      );
      bone.quaternion.multiply(scratchQuaternionB).normalize();
    }

    const spaceSigned = (spaceValue - 100) / 100;
    const safeSpaceDelta = Math.max(1 / 240, delta);
    if (spaceSigned > 0.001) {
      scratchQuaternion.copy(entry.rest).invert().multiply(bone.quaternion);
      scratchEuler.setFromQuaternion(scratchQuaternion, 'XYZ');
      const expansion = 1 + spaceSigned * 0.48;
      scratchEuler.set(
        scratchEuler.x * expansion,
        scratchEuler.y * expansion,
        scratchEuler.z * expansion,
        'XYZ'
      );
      scratchQuaternion.setFromEuler(scratchEuler);
      bone.quaternion.copy(entry.rest).multiply(scratchQuaternion);

      if (runtime.spacePoseCapturePending) {
        entry.hold.copy(bone.quaternion);
      }
      entry.spaceMotionArmed = runtime.spacePoseMotionArmed;
      entry.spaceHoldRemaining = runtime.spacePoseHoldRemaining;
      entry.spaceHoldCooldown = runtime.spacePoseHoldCooldown;
      entry.spaceHoldWeight = runtime.spacePoseHoldWeight;
      entry.stationary = runtime.spacePoseHoldRemaining;
    } else if (spaceSigned < -0.001) {
      const compression = 1 + spaceSigned * 0.68;
      scratchQuaternion.copy(entry.rest).invert().multiply(bone.quaternion);
      scratchEuler.setFromQuaternion(scratchQuaternion, 'XYZ');
      scratchEuler.set(
        scratchEuler.x * compression,
        scratchEuler.y * compression,
        scratchEuler.z * compression,
        'XYZ'
      );
      scratchQuaternion.setFromEuler(scratchEuler);
      bone.quaternion.copy(entry.rest).multiply(scratchQuaternion);
      entry.stationary = 0;
      entry.spaceHoldRemaining = 0;
      entry.spaceHoldCooldown = 0;
      entry.spaceMotionArmed = false;
      const releaseAlpha = 1 - Math.exp(-safeSpaceDelta * 2.4);
      entry.spaceHoldWeight = THREE.MathUtils.lerp(entry.spaceHoldWeight, 0, releaseAlpha);
    } else {
      entry.stationary = 0;
      entry.spaceHoldRemaining = 0;
      entry.spaceHoldCooldown = 0;
      entry.spaceMotionArmed = false;
      const releaseAlpha = 1 - Math.exp(-safeSpaceDelta * 2.4);
      entry.spaceHoldWeight = THREE.MathUtils.lerp(entry.spaceHoldWeight, 0, releaseAlpha);
    }

    if (entry.spaceHoldWeight > 0.001) {
      bone.quaternion.slerp(entry.hold, entry.spaceHoldWeight).normalize();
    } else if (spaceSigned <= 0.001) {
      entry.spaceHoldWeight = 0;
      entry.hold.copy(bone.quaternion);
    }

    const relationSigned = (relationValue - 100) / 100;
    const entryRegion = primaryMotionRegion(tags);
    const relationAmountAlpha = 1 - Math.exp(-Math.max(1 / 240, delta) * 4.2);
    entry.relationAmount = THREE.MathUtils.lerp(
      entry.relationAmount,
      relationSigned,
      relationAmountAlpha
    );
    const targetDrag = entry.relationAmount > 0.001
      && dominantRegion
      && entryRegion !== dominantRegion
      ? entry.relationAmount
      : 0;
    const dragResponse = targetDrag > entry.relationDrag ? 4.6 : 2.8;
    const dragAlpha = 1 - Math.exp(-Math.max(1 / 240, delta) * dragResponse);
    entry.relationDrag = THREE.MathUtils.lerp(entry.relationDrag, targetDrag, dragAlpha);

    if (entry.relationAmount > 0.001 || entry.relationDrag > 0.001) {
      // Slowly blend into and out of the temporal hold. When attention shifts,
      // the old focus catches up while the new background region eases into
      // its drag, so neither joint set can snap to a distant source pose.
      const dragStrength = THREE.MathUtils.clamp(entry.relationDrag, 0, 1);
      const followRate = THREE.MathUtils.lerp(22, 0.48, dragStrength ** 0.78);
      const followAlpha = 1 - Math.exp(-Math.max(1 / 240, delta) * followRate);
      entry.relationOutput.slerp(bone.quaternion, followAlpha).normalize();
      bone.quaternion.copy(entry.relationOutput);
    } else if (
      entry.relationAmount < -0.001
      && entry.sourceDeltaAngle > 0.00001
      && entry.sourceDeltaAngle < 1.25
    ) {
      // The reverse direction distributes attention evenly: every eligible
      // joint receives the same proportional continuation of its source
      // rotation. Finger joints have already exited above and remain untouched.
      const uniformSpeedUp = -entry.relationAmount;
      scratchQuaternionB.setFromAxisAngle(
        entry.sourceDeltaAxis,
        entry.sourceDeltaAngle * uniformSpeedUp
      );
      bone.quaternion.multiply(scratchQuaternionB).normalize();
      entry.relationOutput.copy(bone.quaternion);
    } else {
      entry.relationOutput.copy(bone.quaternion);
    }

    const bodyValue = resolveApplicableValue(values, definitions.body, tags);
    if (entry.regionRoot && entry.bodyEligible && Math.abs(bodyValue) > 0.001) {
      const radians = THREE.MathUtils.degToRad(bodyValue);
      setQuaternionAxisRotation(scratchQuaternionB, values.bodyAxis ?? 'y', radians);
      bone.quaternion.premultiply(scratchQuaternionB);
    }

    // Axis attraction is deliberately applied last. Once a nearby node has
    // engaged it temporarily owns the controlling joint, so the underlying
    // mixer cannot make the joint jump away before the next major movement.
    applyAxisPointOverride(entry, bone, delta);

    entry.previous.slerp(bone.quaternion, Math.min(1, delta * 18));
  }
  runtime.spacePoseCapturePending = false;
}
