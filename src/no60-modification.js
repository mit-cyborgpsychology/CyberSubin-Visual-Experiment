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
    visual: 'Lower values progressively straighten curved limb travel while preserving the source poses. Higher values analyze each moving limb for under-curved or linear passages, then add more bounded circular opportunities. At the highest values, broad arcs divide into smaller secondary loops and straight passages gain new circular travel.',
    technical: 'Below 100%, a stable filtered motion axis replaces rapid direction changes with straighter quaternion segments. Above 100%, source speed, axis coherence, and turning are combined into a smoothed opportunity score. A primary orbit and faster bounded secondary orbit are added only at the four limb roots; child joints keep their source local rotation, and positions, scales, and bone lengths are never changed.',
    boundary: '0% removes the most source curvature, 100% preserves the choreography, and 200% creates the most circular opportunities and subdivisions while keeping the maximum added joint angle bounded.'
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
    meaning: 'Changes how often the hands and feet intentionally reach toward changing axis points on the body.',
    visual: 'Above 100%, hands blend slowly out of the choreography, remain in contact with changing landmarks on the outside of the body, and blend slowly back. The repeating phrase uses five hand-touch movements for every one foot-touch movement. Most hand gestures use one hand and some use both hands together. The percentage changes the average frequency of touches, not how fast an individual touch moves. Individual gestures now vary organically from 2.8 to 4.8 choreography seconds, including different slow approach, sustained contact, and release proportions. Even at 200%, the next gesture has an organically varied gap with occasional longer breaths, so the rhythm does not feel metronomic. Real-time timing continues to follow playback speed.',
    technical: 'Schedules a deterministic 5:1 ratio of hand-touch to foot-touch events using single- and double-hand gestures. Each gesture receives a repeatable pseudo-random duration from 2.8 to 4.8 choreography seconds plus independently varied approach and contact-hold proportions. The approach occupies 30–38% and the sustained hold occupies 38–46%, leaving a smooth release. A separate organic gap multiplier and periodic breath accent vary the time before each new gesture while preserving the percentage-controlled average cadence. If the hand required by the next event is still moving, the scheduler waits instead of substituting a foot event. Independent free limbs may overlap. Each gesture is solved with bounded two-bone inverse kinematics at the shoulder–elbow or hip–knee chain. Each landmark is expanded into an anatomical exterior envelope, including clearance for the hand or foot, so the effector approaches the visible surface instead of the bone center. Only local joint rotations change: bone positions, scales, lengths, fingers, the torso, and the underlying choreography remain intact.',
    boundary: '0–100% preserves the source choreography exactly. From 101–200%, only average contact frequency increases progressively; touch speed and duration remain organically varied within the same slow range at every percentage. At 200%, gaps vary around the fastest cadence without stretching or collapsing the body.'
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
    visual: 'At 0%, the torso, left arm, right arm, left leg, and right leg each begin at a different fixed point in the same looping choreography. Every body-part track remains smooth while the full body is strongly out of phase. At 200%, the right-side limbs fall behind the left.',
    technical: 'Samples each regional quaternion track with a fixed time offset and wraps every sample through the animation clip. The offsets ease into place when the control changes, but do not drift during playback. Limbs stay internally coherent and finger joints remain untouched.',
    boundary: '0% is maximum fixed multi-region phase separation, 100% preserves the original timing, and 200% creates maximum right-side lag.'
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
    meaning: 'Emphasizes the negative space around the body by slowing intact source poses without freezing them.',
    visual: 'Selected regions trigger increasingly frequent and long 5%-speed passages at important extended low-velocity endpoints. After every slow passage, meaningful movement must unfold before another pose can be selected, preventing back-to-back highlights. The choreography continues as one coherent silhouette while the external-space field becomes denser, larger, and brighter.',
    technical: 'Uses an intensity-dependent endpoint detector, a post-highlight recovery window, and accumulated joint travel to reduce the modified playback clock to 5%. Higher values shorten the required recovery phrase while retaining a strict minimum gap. It never changes joint rotations, positions, scales, or bone lengths, so every emphasized pose remains exactly on the source choreography.',
    boundary: '0–100% adds no pose deformation or slow-motion highlights. Above 100%, highlighted passages become more frequent and longer; 200% creates the strongest negative-space articulation while preserving the source body structure.'
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
    visual: 'One stable dominant region moves faster while every non-highlighted region slows down, strengthening the head-to-target shifting-relation cue.',
    technical: 'Uses hysteresis to hold one attention region at a time. Above 100%, the focused region ramps toward 1.5x speed while all other eligible regions ramp toward 0.5x speed. Below 100%, it accelerates every non-finger joint by the same rotational factor.',
    boundary: '0% distributes attention by speeding every body part equally, 100% preserves the source, and 200% isolates one clear center of attention at 1.5x against a 0.5x background.'
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

export function getNo60ExternalSpacePlaybackRate(runtime) {
  return (runtime?.spacePoseHoldRemaining ?? 0) > 0 ? 0.05 : 1;
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

function isCurveMotionRoot(name) {
  return /^(leftarm|rightarm|leftupleg|rightupleg)$/.test(cleanBoneName(name));
}

function isFingerBone(name) {
  return /thumb|finger|index|middle|ring|pinky|little|digit|metacarp/.test(cleanBoneName(name));
}

function primaryMotionRegion(tags) {
  for (const region of ['leftArm', 'rightArm', 'leftLeg', 'rightLeg', 'torso']) {
    if (tags.has(region)) return region;
  }
  return 'whole';
}

const SYNCHRONIC_PHASE_FRACTIONS = Object.freeze({
  torso: 0.08,
  leftArm: 0.32,
  rightArm: 0.56,
  leftLeg: 0.18,
  rightLeg: 0.74,
  whole: 0.44
});

function sampleQuaternionHistory(entry, delayFrames, target) {
  const latestIndex = entry.history.length - 1;
  const sampleIndex = latestIndex - delayFrames;
  if (sampleIndex < 0 || latestIndex < 1) return false;
  const earlierIndex = Math.floor(sampleIndex);
  const laterIndex = Math.min(latestIndex, earlierIndex + 1);
  const mix = sampleIndex - earlierIndex;
  target.copy(entry.history[earlierIndex]);
  if (laterIndex !== earlierIndex) target.slerp(entry.history[laterIndex], mix);
  return true;
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
      syncPhaseOffset: 0,
      syncInterpolant: null,
      syncQuaternion: object.quaternion.clone(),
      relationAmount: 0,
      relationDrag: 0,
      relationSpeedScale: 1,
      relationInput: object.quaternion.clone(),
      relationOutput: object.quaternion.clone(),
      sourceDeltaAngle: 0,
      sourceDeltaAxis: new THREE.Vector3(0, 1, 0),
      sourceDeltaQuaternion: new THREE.Quaternion(),
      energyInterpolant: null,
      energyTime: null,
      energyBlend: 0,
      energyQuaternion: object.quaternion.clone(),
      curveAxis: new THREE.Vector3(0, 1, 0),
      curveSecondaryAxis: new THREE.Vector3(1, 0, 0),
      curveAxisReady: false,
      curveActivation: 0,
      curveOpportunity: 0,
      curveSourceCurvature: 0,
      curveAmount: 0,
      curveAngularVelocity: 0,
      curvePhase: 0,
      curveMicroPhase: 0,
      curveSubdivision: 1,
      curveOrbitAmplitude: 0,
      curveRotation: new THREE.Quaternion(),
      curveLinearAxis: new THREE.Vector3(1, 0, 0),
      curveLinearAxisReady: false,
      curveLinearizedQuaternion: object.quaternion.clone(),
      curveLinearReady: false,
      curveMotionRoot: isCurveMotionRoot(object.name),
      regionRoot: isRegionRoot(object.name),
      effectEligible: !isFingerBone(object.name),
      bodyEligible: !isFingerBone(object.name),
      pairedEntry: null,
      axisTouchAdjusted: false
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
      entry.syncInterpolant = track.createInterpolant();
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
    spacePoseCapturePending: false,
    spacePoseTravelSinceHold: 0,
    axisTouchEvent: null,
    axisTouchEvents: [],
    axisNextTouchAt: 0.2,
    axisTouchGapCursor: 0,
    axisTouchPatternCursor: 0,
    axisTouchCount: 0,
    axisTouchStartTimes: [],
    axisTouchHistory: [],
    axisTouchWeight: 0,
    axisTouchLastDistance: null,
    axisTouchLastSourceDistance: null,
    axisTouchMinimumDistanceRatio: 1,
    axisTouchLastSurfaceRadius: null,
    axisTouchMinimumSurfaceClearance: Infinity,
    axisTouchTransitionDuration: 3.8,
    axisTouchTransitionVariation: 1,
    axisTouchMaximumConcurrent: 0
  };
}

const scratchEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const scratchEulerB = new THREE.Euler(0, 0, 0, 'XYZ');
const scratchQuaternion = new THREE.Quaternion();
const scratchQuaternionB = new THREE.Quaternion();
const scratchAxis = new THREE.Vector3();
const scratchCurveSecondaryAxis = new THREE.Vector3();
const axisTouchRootPosition = new THREE.Vector3();
const axisTouchMidPosition = new THREE.Vector3();
const axisTouchEndPosition = new THREE.Vector3();
const axisTouchTargetPosition = new THREE.Vector3();
const axisTouchHipsPosition = new THREE.Vector3();
const axisTouchHeadPosition = new THREE.Vector3();
const axisTouchBodyUp = new THREE.Vector3();
const axisTouchContactPosition = new THREE.Vector3();
const axisTouchContactNormal = new THREE.Vector3();
const axisTouchDesiredEnd = new THREE.Vector3();
const axisTouchTargetDirection = new THREE.Vector3();
const axisTouchFirstDirection = new THREE.Vector3();
const axisTouchSecondDirection = new THREE.Vector3();
const axisTouchDesiredFirstDirection = new THREE.Vector3();
const axisTouchDesiredSecondDirection = new THREE.Vector3();
const axisTouchBendDirection = new THREE.Vector3();
const axisTouchFallbackDirection = new THREE.Vector3();
const axisTouchWorldUp = new THREE.Vector3(0, 1, 0);
const axisTouchCurrentWorldQuaternion = new THREE.Quaternion();
const axisTouchParentWorldQuaternion = new THREE.Quaternion();
const axisTouchWorldCorrection = new THREE.Quaternion();
const axisTouchLimitedCorrection = new THREE.Quaternion();
const axisTouchDesiredWorldQuaternion = new THREE.Quaternion();
const axisTouchDesiredLocalQuaternion = new THREE.Quaternion();
const axisTouchUpperSourceQuaternion = new THREE.Quaternion();
const axisTouchLowerSourceQuaternion = new THREE.Quaternion();
const axisTouchUpperSolvedQuaternion = new THREE.Quaternion();
const axisTouchLowerSolvedQuaternion = new THREE.Quaternion();

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

function axisEntryByNames(runtime, names) {
  for (const name of names) {
    const entry = runtime.entries.find((candidate) => cleanBoneName(candidate.name) === name);
    if (entry) return entry;
  }
  return null;
}

const AXIS_TOUCH_LIMBS = Object.freeze([
  Object.freeze({
    key: 'leftArm',
    upper: Object.freeze(['leftarm']),
    lower: Object.freeze(['leftforearm']),
    effector: Object.freeze(['lefthand']),
    upperLimit: 1.25,
    lowerLimit: 1.45
  }),
  Object.freeze({
    key: 'rightArm',
    upper: Object.freeze(['rightarm']),
    lower: Object.freeze(['rightforearm']),
    effector: Object.freeze(['righthand']),
    upperLimit: 1.25,
    lowerLimit: 1.45
  }),
  Object.freeze({
    key: 'leftLeg',
    upper: Object.freeze(['leftupleg', 'leftthigh']),
    lower: Object.freeze(['leftleg', 'leftshin']),
    effector: Object.freeze(['leftfoot', 'lefttoe']),
    upperLimit: 0.95,
    lowerLimit: 1.2
  }),
  Object.freeze({
    key: 'rightLeg',
    upper: Object.freeze(['rightupleg', 'rightthigh']),
    lower: Object.freeze(['rightleg', 'rightshin']),
    effector: Object.freeze(['rightfoot', 'righttoe']),
    upperLimit: 0.95,
    lowerLimit: 1.2
  })
]);

// Twelve gestures repeat as a stable phrase: ten hand-touch events and two
// foot-touch events create the requested 5:1 frequency ratio. Two of the hand
// events use both hands together. Busy hands hold the phrase at its current
// step rather than allowing a foot event to replace the intended hand touch.
const AXIS_TOUCH_GESTURE_PATTERN = Object.freeze([
  Object.freeze([{ limb: 'leftArm', target: Object.freeze(['head']) }]),
  Object.freeze([{ limb: 'rightArm', target: Object.freeze(['leftupleg', 'leftthigh', 'leftleg']) }]),
  Object.freeze([{ limb: 'leftArm', target: Object.freeze(['rightupleg', 'rightthigh', 'rightleg']) }]),
  Object.freeze([{ limb: 'rightArm', target: Object.freeze(['head']) }]),
  Object.freeze([
    { limb: 'leftArm', target: Object.freeze(['head']) },
    { limb: 'rightArm', target: Object.freeze(['head']) }
  ]),
  Object.freeze([{ limb: 'leftLeg', target: Object.freeze(['rightleg', 'rightshin']) }]),
  Object.freeze([{ limb: 'rightArm', target: Object.freeze(['head']) }]),
  Object.freeze([{ limb: 'leftArm', target: Object.freeze(['rightupleg', 'rightthigh', 'rightleg']) }]),
  Object.freeze([{ limb: 'rightArm', target: Object.freeze(['spine2', 'spine1', 'spine']) }]),
  Object.freeze([{ limb: 'leftArm', target: Object.freeze(['head']) }]),
  Object.freeze([
    { limb: 'leftArm', target: Object.freeze(['rightupleg', 'rightthigh', 'rightleg']) },
    { limb: 'rightArm', target: Object.freeze(['leftupleg', 'leftthigh', 'leftleg']) }
  ]),
  Object.freeze([{ limb: 'rightLeg', target: Object.freeze(['leftleg', 'leftshin']) }])
]);

function resolveAxisTouchLimb(runtime, definition) {
  const upper = axisEntryByNames(runtime, definition.upper);
  const lower = axisEntryByNames(runtime, definition.lower);
  const effector = axisEntryByNames(runtime, definition.effector);
  if (!upper?.effectEligible || !lower?.effectEligible || !effector) return null;
  return { definition, upper, lower, effector };
}

function axisTouchStrength(values, definition, limb) {
  const value = resolveApplicableValue(values, definition, limb.effector.tags);
  return THREE.MathUtils.clamp((value - definition.neutral) / 100, 0, 1);
}

function axisTouchCadence(strength) {
  return THREE.MathUtils.lerp(8, 0.5, Math.pow(strength, 0.72));
}

function axisTouchOrganicGap(strength, gapIndex) {
  const baseline = axisTouchCadence(strength);
  const noise = axisTouchOrganicNoise(gapIndex, 0);
  const organicScale = THREE.MathUtils.lerp(0.72, 1.28, noise);
  const breathAccent = gapIndex % 5 === 4
    ? 0.22
    : gapIndex % 7 === 6
      ? 0.12
      : 0;
  return baseline * (organicScale + breathAccent);
}

function axisTouchOrganicNoise(index, channel) {
  const noiseSeed = Math.sin((index + 1) * 12.9898 + channel * 78.233) * 43758.5453;
  return noiseSeed - Math.floor(noiseSeed);
}

function axisTouchOrganicTiming(runtime, eventIndex) {
  const variation = runtime.axisTouchTransitionVariation;
  const duration = runtime.axisTouchTransitionDuration + THREE.MathUtils.lerp(
    -variation,
    variation,
    axisTouchOrganicNoise(eventIndex, 1)
  );
  const approachEnd = THREE.MathUtils.lerp(
    0.3,
    0.38,
    axisTouchOrganicNoise(eventIndex, 2)
  );
  const holdShare = THREE.MathUtils.lerp(
    0.38,
    0.46,
    axisTouchOrganicNoise(eventIndex, 3)
  );
  return {
    duration,
    approachEnd,
    holdEnd: approachEnd + holdShare
  };
}

function axisTouchEnvelope(elapsed, duration, approachEnd, holdEnd) {
  const progress = THREE.MathUtils.clamp(elapsed / Math.max(0.001, duration), 0, 1);
  if (progress < approachEnd) {
    return THREE.MathUtils.smoothstep(progress / approachEnd, 0, 1);
  }
  if (progress <= holdEnd) return 1;
  return 1 - THREE.MathUtils.smoothstep(
    (progress - holdEnd) / Math.max(0.001, 1 - holdEnd),
    0,
    1
  );
}

function applyAxisTouchWorldSwing(bone, fromDirection, toDirection, maximumAngle) {
  if (fromDirection.lengthSq() < 0.000001 || toDirection.lengthSq() < 0.000001) return 0;
  fromDirection.normalize();
  toDirection.normalize();
  const angle = fromDirection.angleTo(toDirection);
  if (!Number.isFinite(angle) || angle < 0.000001) return 0;

  axisTouchWorldCorrection.setFromUnitVectors(fromDirection, toDirection);
  if (angle > maximumAngle) {
    axisTouchLimitedCorrection.identity().slerp(
      axisTouchWorldCorrection,
      maximumAngle / angle
    );
    axisTouchWorldCorrection.copy(axisTouchLimitedCorrection);
  }
  bone.getWorldQuaternion(axisTouchCurrentWorldQuaternion);
  if (bone.parent) bone.parent.getWorldQuaternion(axisTouchParentWorldQuaternion);
  else axisTouchParentWorldQuaternion.identity();
  axisTouchDesiredWorldQuaternion.copy(axisTouchWorldCorrection)
    .multiply(axisTouchCurrentWorldQuaternion)
    .normalize();
  axisTouchDesiredLocalQuaternion.copy(axisTouchParentWorldQuaternion)
    .invert()
    .multiply(axisTouchDesiredWorldQuaternion)
    .normalize();
  bone.quaternion.copy(axisTouchDesiredLocalQuaternion);
  return Math.min(angle, maximumAngle);
}

function axisTouchSurfaceRadius(targetName, effectorName, bodyScale) {
  let targetRadius = 0.08;
  if (/head/.test(targetName)) targetRadius = 0.12;
  else if (/hips|pelvis/.test(targetName)) targetRadius = 0.17;
  else if (/spine|chest/.test(targetName)) targetRadius = 0.16;
  else if (/upleg|thigh/.test(targetName)) targetRadius = 0.105;
  else if (/leg|shin/.test(targetName)) targetRadius = 0.075;
  else if (/foot|toe/.test(targetName)) targetRadius = 0.06;
  else if (/shoulder|arm/.test(targetName)) targetRadius = 0.07;
  else if (/forearm/.test(targetName)) targetRadius = 0.055;
  else if (/hand/.test(targetName)) targetRadius = 0.045;

  // Hand/foot bones sit near the wrist/ankle rather than at the visible tip.
  // This extra clearance keeps the complete mesh outside the target surface.
  const effectorClearance = /hand/.test(effectorName) ? 0.055 : 0.065;
  return bodyScale * (targetRadius + effectorClearance + 0.012);
}

function positionAxisTouchSurfaceCenter(runtime, target, bodyScale) {
  target.bone.getWorldPosition(axisTouchTargetPosition);
  if (/head/.test(cleanBoneName(target.name))) {
    // Head bones commonly originate close to the neck. Raise the proxy toward
    // the skull center so a hand never gets pulled through the neck mesh.
    axisTouchTargetPosition.addScaledVector(axisTouchBodyUp, bodyScale * 0.06);
  }
}

function solveAxisTouchTwoBone(runtime, event, weight) {
  const { upper, lower, effector, target, definition } = event;
  axisTouchUpperSourceQuaternion.copy(upper.bone.quaternion);
  axisTouchLowerSourceQuaternion.copy(lower.bone.quaternion);
  runtime.root?.updateMatrixWorld(true);
  upper.bone.getWorldPosition(axisTouchRootPosition);
  lower.bone.getWorldPosition(axisTouchMidPosition);
  effector.bone.getWorldPosition(axisTouchEndPosition);

  const firstLength = axisTouchRootPosition.distanceTo(axisTouchMidPosition);
  const secondLength = axisTouchMidPosition.distanceTo(axisTouchEndPosition);
  if (firstLength < 0.0001 || secondLength < 0.0001) return false;

  const hips = axisEntryByNames(runtime, ['hips', 'pelvis']);
  const head = axisEntryByNames(runtime, ['head']);
  let bodyScale = firstLength + secondLength;
  if (hips && head) {
    hips.bone.getWorldPosition(axisTouchHipsPosition);
    head.bone.getWorldPosition(axisTouchHeadPosition);
    axisTouchBodyUp.copy(axisTouchHeadPosition).sub(axisTouchHipsPosition);
    bodyScale = Math.max(bodyScale, axisTouchBodyUp.length());
    if (axisTouchBodyUp.lengthSq() > 0.000001) axisTouchBodyUp.normalize();
    else axisTouchBodyUp.set(0, 1, 0);
  } else {
    axisTouchBodyUp.set(0, 1, 0);
  }

  positionAxisTouchSurfaceCenter(runtime, target, bodyScale);

  axisTouchContactNormal.copy(axisTouchEndPosition).sub(axisTouchTargetPosition);
  if (axisTouchContactNormal.lengthSq() < 0.000001) {
    axisTouchContactNormal.copy(axisTouchRootPosition).sub(axisTouchTargetPosition);
  }
  if (axisTouchContactNormal.lengthSq() < 0.000001) axisTouchContactNormal.set(1, 0, 0);
  axisTouchContactNormal.normalize();
  const targetName = cleanBoneName(target.name);
  const effectorName = cleanBoneName(effector.name);
  const contactGap = axisTouchSurfaceRadius(targetName, effectorName, bodyScale);
  axisTouchContactPosition.copy(axisTouchTargetPosition)
    .addScaledVector(axisTouchContactNormal, contactGap);
  axisTouchDesiredEnd.copy(axisTouchContactPosition);

  axisTouchTargetDirection.copy(axisTouchDesiredEnd).sub(axisTouchRootPosition);
  const rawDistance = axisTouchTargetDirection.length();
  if (rawDistance < 0.000001) return false;
  axisTouchTargetDirection.multiplyScalar(1 / rawDistance);
  const minimumReach = Math.abs(firstLength - secondLength) + 0.0001;
  const maximumReach = firstLength + secondLength - 0.0001;
  const reachDistance = THREE.MathUtils.clamp(rawDistance, minimumReach, maximumReach);

  axisTouchBendDirection.copy(axisTouchMidPosition).sub(axisTouchRootPosition);
  axisTouchBendDirection.addScaledVector(
    axisTouchTargetDirection,
    -axisTouchBendDirection.dot(axisTouchTargetDirection)
  );
  if (axisTouchBendDirection.lengthSq() < 0.000001) {
    axisTouchBendDirection.copy(axisTouchWorldUp).addScaledVector(
      axisTouchTargetDirection,
      -axisTouchWorldUp.dot(axisTouchTargetDirection)
    );
  }
  if (axisTouchBendDirection.lengthSq() < 0.000001) {
    axisTouchBendDirection.set(1, 0, 0).addScaledVector(
      axisTouchTargetDirection,
      -axisTouchTargetDirection.x
    );
  }
  axisTouchBendDirection.normalize();

  const along = (
    reachDistance * reachDistance + firstLength * firstLength - secondLength * secondLength
  ) / (2 * reachDistance);
  const bendHeight = Math.sqrt(Math.max(0, firstLength * firstLength - along * along));
  axisTouchContactPosition.copy(axisTouchRootPosition)
    .addScaledVector(axisTouchTargetDirection, along)
    .addScaledVector(axisTouchBendDirection, bendHeight);
  axisTouchDesiredEnd.copy(axisTouchRootPosition)
    .addScaledVector(axisTouchTargetDirection, reachDistance);

  axisTouchFirstDirection.copy(axisTouchMidPosition).sub(axisTouchRootPosition);
  axisTouchDesiredFirstDirection.copy(axisTouchContactPosition).sub(axisTouchRootPosition);
  applyAxisTouchWorldSwing(
    upper.bone,
    axisTouchFirstDirection,
    axisTouchDesiredFirstDirection,
    definition.upperLimit
  );

  runtime.root?.updateMatrixWorld(true);
  lower.bone.getWorldPosition(axisTouchMidPosition);
  effector.bone.getWorldPosition(axisTouchEndPosition);
  axisTouchSecondDirection.copy(axisTouchEndPosition).sub(axisTouchMidPosition);
  axisTouchDesiredSecondDirection.copy(axisTouchDesiredEnd).sub(axisTouchMidPosition);
  applyAxisTouchWorldSwing(
    lower.bone,
    axisTouchSecondDirection,
    axisTouchDesiredSecondDirection,
    definition.lowerLimit
  );

  // Solve the complete contact pose, then blend both joints from the live
  // choreography by the gesture envelope. This guarantees an exact return to
  // the source pose and avoids an elbow or knee branch flip near full extension.
  axisTouchUpperSolvedQuaternion.copy(upper.bone.quaternion);
  axisTouchLowerSolvedQuaternion.copy(lower.bone.quaternion);
  upper.bone.quaternion.copy(axisTouchUpperSourceQuaternion)
    .slerp(axisTouchUpperSolvedQuaternion, weight)
    .normalize();
  lower.bone.quaternion.copy(axisTouchLowerSourceQuaternion)
    .slerp(axisTouchLowerSolvedQuaternion, weight)
    .normalize();

  runtime.root?.updateMatrixWorld(true);
  effector.bone.getWorldPosition(axisTouchEndPosition);
  positionAxisTouchSurfaceCenter(runtime, target, bodyScale);
  const sourceDistance = event.sourceDistance > 0.0001
    ? event.sourceDistance
    : axisTouchEndPosition.distanceTo(axisTouchTargetPosition);
  const distance = axisTouchEndPosition.distanceTo(axisTouchTargetPosition);
  runtime.axisTouchLastSourceDistance = sourceDistance;
  runtime.axisTouchLastDistance = distance;
  runtime.axisTouchLastSurfaceRadius = contactGap;
  runtime.axisTouchMinimumSurfaceClearance = Math.min(
    runtime.axisTouchMinimumSurfaceClearance,
    distance - contactGap
  );
  runtime.axisTouchMinimumDistanceRatio = Math.min(
    runtime.axisTouchMinimumDistanceRatio,
    distance / Math.max(0.0001, sourceDistance)
  );
  upper.axisTouchAdjusted = true;
  lower.axisTouchAdjusted = true;
  return true;
}

function beginAxisTouchGesture(runtime, values, definition, availableLimbs, startTime) {
  const limbsByKey = new Map(availableLimbs.map((limb) => [limb.definition.key, limb]));
  const busyLimbs = new Set(
    runtime.axisTouchEvents
      .filter((event) => startTime - event.startTime < event.duration)
      .flatMap((event) => event.actions.map((action) => action.definition.key))
  );
  for (let offset = 0; offset < AXIS_TOUCH_GESTURE_PATTERN.length; offset += 1) {
    const patternIndex = (runtime.axisTouchPatternCursor + offset)
      % AXIS_TOUCH_GESTURE_PATTERN.length;
    const instructions = AXIS_TOUCH_GESTURE_PATTERN[patternIndex];
    const plannedLimbs = instructions
      .map((instruction) => limbsByKey.get(instruction.limb))
      .filter(Boolean);
    if (plannedLimbs.some((limb) => busyLimbs.has(limb.definition.key))) return false;

    const actions = instructions.flatMap((instruction) => {
      const limb = limbsByKey.get(instruction.limb);
      if (!limb) return [];
      const strength = axisTouchStrength(values, definition, limb);
      if (strength <= 0.001) return [];
      const target = axisEntryByNames(runtime, instruction.target);
      if (!target || target === limb.upper || target === limb.lower || target === limb.effector) {
        return [];
      }
      runtime.root?.updateMatrixWorld(true);
      limb.effector.bone.getWorldPosition(axisTouchEndPosition);
      target.bone.getWorldPosition(axisTouchTargetPosition);
      return [{
        ...limb,
        target,
        strength,
        sourceDistance: axisTouchEndPosition.distanceTo(axisTouchTargetPosition)
      }];
    });
    if (actions.length !== instructions.length) continue;

    const strength = Math.max(...actions.map((action) => action.strength));
    const timing = axisTouchOrganicTiming(runtime, runtime.axisTouchCount);
    const { duration, approachEnd, holdEnd } = timing;
    const event = {
      actions,
      startTime,
      duration,
      approachEnd,
      holdEnd,
      strength
    };
    runtime.axisTouchEvents.push(event);
    runtime.axisTouchEvent = event;
    runtime.axisTouchCount += 1;
    runtime.axisTouchStartTimes.push(startTime);
    if (runtime.axisTouchStartTimes.length > 48) runtime.axisTouchStartTimes.shift();
    runtime.axisTouchHistory.push({
      time: startTime,
      limb: actions[0].definition.key,
      target: cleanBoneName(actions[0].target.name),
      limbs: actions.map((action) => action.definition.key),
      targets: actions.map((action) => cleanBoneName(action.target.name)),
      strength,
      duration,
      approachDuration: duration * approachEnd,
      holdDuration: duration * (holdEnd - approachEnd),
      releaseDuration: duration * (1 - holdEnd)
    });
    if (runtime.axisTouchHistory.length > 48) runtime.axisTouchHistory.shift();
    runtime.axisTouchPatternCursor = (patternIndex + 1) % AXIS_TOUCH_GESTURE_PATTERN.length;
    return true;
  }
  return false;
}

function applyAxisTouchGestures(runtime, values, definition) {
  for (const entry of runtime.entries) entry.axisTouchAdjusted = false;
  const availableLimbs = AXIS_TOUCH_LIMBS
    .map((limbDefinition) => resolveAxisTouchLimb(runtime, limbDefinition))
    .filter(Boolean);
  const strongest = availableLimbs.reduce(
    (value, limb) => Math.max(value, axisTouchStrength(values, definition, limb)),
    0
  );
  if (strongest <= 0.001) {
    runtime.axisTouchEvent = null;
    runtime.axisTouchEvents = [];
    runtime.axisTouchWeight = 0;
    runtime.axisNextTouchAt = runtime.elapsed + 0.35;
    runtime.axisTouchGapCursor = 0;
    return;
  }

  runtime.axisTouchEvents = runtime.axisTouchEvents.filter(
    (event) => runtime.elapsed - event.startTime < event.duration
  );
  let scheduleGuard = 0;
  while (runtime.elapsed >= runtime.axisNextTouchAt && scheduleGuard < 8) {
    const scheduledAt = runtime.axisNextTouchAt;
    const didBegin = beginAxisTouchGesture(
      runtime,
      values,
      definition,
      availableLimbs,
      scheduledAt
    );
    const scheduledStrength = didBegin
      ? runtime.axisTouchEvents.at(-1)?.strength ?? strongest
      : strongest;
    runtime.axisNextTouchAt = scheduledAt + axisTouchOrganicGap(
      scheduledStrength,
      runtime.axisTouchGapCursor
    );
    runtime.axisTouchGapCursor += 1;
    scheduleGuard += 1;
  }
  runtime.axisTouchEvent = runtime.axisTouchEvents.at(-1) ?? null;
  runtime.axisTouchMaximumConcurrent = Math.max(
    runtime.axisTouchMaximumConcurrent,
    runtime.axisTouchEvents.length
  );
  runtime.axisTouchWeight = 0;
  for (const event of runtime.axisTouchEvents) {
    const eventElapsed = runtime.elapsed - event.startTime;
    const weight = axisTouchEnvelope(
      eventElapsed,
      event.duration,
      event.approachEnd,
      event.holdEnd
    );
    runtime.axisTouchWeight = Math.max(runtime.axisTouchWeight, weight);
    for (const action of event.actions) {
      if (weight > 0.0001) solveAxisTouchTwoBone(runtime, action, weight);
    }
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
    runtime.spacePoseTravelSinceHold = 0;
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
  if (runtime.spacePoseHoldRemaining <= 0 && poseSpeed > slowThreshold * 0.35) {
    runtime.spacePoseTravelSinceHold = Math.min(
      12,
      (runtime.spacePoseTravelSinceHold ?? 0) + poseSpeed * safeDelta
    );
  }
  const requiredPhraseTravel = THREE.MathUtils.lerp(1.35, 0.85, intensity);
  if (
    runtime.spacePoseHoldRemaining <= 0
    && runtime.spacePoseHoldCooldown <= 0
    && runtime.spacePoseTravelSinceHold >= requiredPhraseTravel
    && poseSpeed > motionArmThreshold
  ) {
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
    // A stop must be followed by a substantial passage of uninterrupted
    // choreography. The cooldown includes the hold itself, and the separate
    // travel requirement prevents a tiny gesture from qualifying as a phrase.
    const postHoldRecovery = THREE.MathUtils.lerp(5.2, 2.8, intensity);
    runtime.spacePoseHoldCooldown = runtime.spacePoseHoldRemaining
      + postHoldRecovery;
    runtime.spacePoseCapturePending = true;
    runtime.spacePoseMotionArmed = false;
    runtime.spacePoseTravelSinceHold = 0;
  }

  runtime.spacePoseHoldRemaining = Math.max(
    0,
    (runtime.spacePoseHoldRemaining ?? 0) - safeDelta
  );
  const holdTarget = runtime.spacePoseHoldRemaining > 0
    ? THREE.MathUtils.clamp(0.92 + intensity * 0.078, 0, 0.998)
    : 0;
  // Retain a smoothed status weight for visualization and diagnostics. The
  // actual stop is applied to the playback clock, never to a bone rotation.
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
  const smoothingDelta = Math.min(1 / 30, Math.max(1 / 240, delta));
  const validDelta = entry.sourceDeltaAngle > 0.0004 && entry.sourceDeltaAngle < 1.4;
  const startingCurve = validDelta && !entry.curveAxisReady;
  let axisAlignment = 1;
  if (validDelta) {
    if (!entry.curveAxisReady) {
      entry.curveAxis.copy(entry.sourceDeltaAxis);
      scratchCurveSecondaryAxis.set(
        Math.abs(entry.curveAxis.y) < 0.82 ? 0 : 1,
        Math.abs(entry.curveAxis.y) < 0.82 ? 1 : 0,
        0
      );
      entry.curveSecondaryAxis.crossVectors(
        entry.curveAxis,
        scratchCurveSecondaryAxis
      ).normalize();
      entry.curveAxisReady = true;
    } else {
      axisAlignment = entry.curveAxis.dot(entry.sourceDeltaAxis);
      scratchAxis.copy(entry.sourceDeltaAxis);
      if (axisAlignment < 0) {
        scratchAxis.multiplyScalar(-1);
        axisAlignment *= -1;
      }
      const axisAlpha = 1 - Math.exp(-smoothingDelta * 3.4);
      entry.curveAxis.lerp(scratchAxis, axisAlpha).normalize();

      // Transport the second orbit axis along the filtered source axis. This
      // keeps the two-axis circle frame stable without allowing an abrupt
      // reference-axis swap to flip the limb.
      scratchCurveSecondaryAxis.copy(entry.curveSecondaryAxis).addScaledVector(
        entry.curveAxis,
        -entry.curveSecondaryAxis.dot(entry.curveAxis)
      );
      if (scratchCurveSecondaryAxis.lengthSq() < 0.0001) {
        scratchCurveSecondaryAxis.set(
          Math.abs(entry.curveAxis.y) < 0.82 ? 0 : 1,
          Math.abs(entry.curveAxis.y) < 0.82 ? 1 : 0,
          0
        ).cross(entry.curveAxis);
      }
      scratchCurveSecondaryAxis.normalize();
      if (entry.curveSecondaryAxis.dot(scratchCurveSecondaryAxis) < 0) {
        scratchCurveSecondaryAxis.multiplyScalar(-1);
      }
      entry.curveSecondaryAxis.lerp(scratchCurveSecondaryAxis, axisAlpha).normalize();
    }
  }

  const curveAmountAlpha = 1 - Math.exp(-smoothingDelta * 3.8);
  entry.curveAmount = THREE.MathUtils.lerp(entry.curveAmount, curveSigned, curveAmountAlpha);
  // Make the first increase above 100% perceptible, then reserve enough of the
  // upper range for visibly more loops rather than only a larger radius.
  const perceptualCurveStrength = Math.pow(
    THREE.MathUtils.clamp(entry.curveAmount, 0, 1),
    0.55
  );

  const sourceCurvatureTarget = validDelta
    ? THREE.MathUtils.clamp((1 - axisAlignment) / 0.72, 0, 1)
    : 0;
  entry.curveSourceCurvature = THREE.MathUtils.lerp(
    entry.curveSourceCurvature,
    sourceCurvatureTarget,
    1 - Math.exp(-smoothingDelta * 4.4)
  );

  // Increasing the control lowers the motion threshold. This lets the system
  // discover circular opportunities in quieter and more linear passages where
  // the source choreography did not already contain an obvious circle.
  const opportunityFloor = THREE.MathUtils.lerp(0.024, 0.0035, perceptualCurveStrength);
  const opportunityRange = THREE.MathUtils.lerp(0.26, 0.09, perceptualCurveStrength);
  const motionAmount = validDelta
    ? THREE.MathUtils.clamp((entry.speed - opportunityFloor) / opportunityRange, 0, 1)
    : 0;
  const coherence = THREE.MathUtils.clamp((axisAlignment - 0.05) / 0.95, 0, 1);
  const existingCurveOpportunity = motionAmount * THREE.MathUtils.lerp(
    0.72,
    0.88,
    entry.curveSourceCurvature
  );
  const inventedCircleOpportunity = motionAmount
    * coherence
    * THREE.MathUtils.lerp(0.16, 1, perceptualCurveStrength);
  const opportunityTarget = Math.max(
    existingCurveOpportunity,
    inventedCircleOpportunity
  );
  const opportunityResponse = opportunityTarget > entry.curveOpportunity ? 5.4 : 1.25;
  entry.curveOpportunity = startingCurve
    ? opportunityTarget * 0.1
    : THREE.MathUtils.lerp(
      entry.curveOpportunity,
      opportunityTarget,
      1 - Math.exp(-smoothingDelta * opportunityResponse)
    );

  const activationTarget = entry.curveOpportunity;
  const activationResponse = activationTarget > entry.curveActivation ? 4.6 : 1.8;
  entry.curveActivation = startingCurve
    ? activationTarget * 0.12
    : THREE.MathUtils.lerp(
      entry.curveActivation,
      activationTarget,
      1 - Math.exp(-smoothingDelta * activationResponse)
    );

  // More curvature now means more completed circles. The source speed still
  // sets the rhythm, but a bounded opportunity-driven floor carries circular
  // momentum across brief under-curved gaps instead of dropping to zero.
  const sourceDrivenVelocity = (
    0.45 + Math.min(entry.speed, 2.5) * 0.75
  ) * THREE.MathUtils.lerp(0.55, 3.2, perceptualCurveStrength);
  const targetAngularVelocity = validDelta || entry.curveOpportunity > 0.02
    ? THREE.MathUtils.clamp(
      sourceDrivenVelocity * entry.curveOpportunity,
      0,
      10.5
    )
    : 0;
  const velocityResponse = targetAngularVelocity > entry.curveAngularVelocity ? 3.2 : 1.35;
  const velocityAlpha = 1 - Math.exp(-smoothingDelta * velocityResponse);
  entry.curveAngularVelocity = THREE.MathUtils.lerp(
    entry.curveAngularVelocity,
    targetAngularVelocity,
    velocityAlpha
  );

  const maximumPhaseStep = THREE.MathUtils.lerp(0.065, 0.18, perceptualCurveStrength);
  const phaseStep = THREE.MathUtils.clamp(
    entry.curveAngularVelocity * smoothingDelta,
    0,
    maximumPhaseStep
  );
  entry.curvePhase = THREE.MathUtils.euclideanModulo(
    entry.curvePhase + phaseStep,
    Math.PI * 2
  );

  const subdivisionTarget = 1 + 3.4 * THREE.MathUtils.smoothstep(
    perceptualCurveStrength,
    0.18,
    1
  );
  entry.curveSubdivision = THREE.MathUtils.lerp(
    entry.curveSubdivision,
    subdivisionTarget,
    1 - Math.exp(-smoothingDelta * 2.6)
  );
  const microPhaseStep = Math.min(0.34, phaseStep * entry.curveSubdivision);
  entry.curveMicroPhase = THREE.MathUtils.euclideanModulo(
    entry.curveMicroPhase + microPhaseStep,
    Math.PI * 2
  );

  // Orbit radius remains bounded. Higher values redistribute part of one broad
  // orbit into a faster secondary orbit, visually breaking a large circle into
  // several smaller circles without accumulating joint rotation.
  const targetOrbitAmplitude = 0.38
    * perceptualCurveStrength
    * entry.curveActivation;
  const amplitudeResponse = targetOrbitAmplitude > entry.curveOrbitAmplitude ? 3.8 : 1.8;
  entry.curveOrbitAmplitude = THREE.MathUtils.lerp(
    entry.curveOrbitAmplitude,
    targetOrbitAmplitude,
    1 - Math.exp(-smoothingDelta * amplitudeResponse)
  );

  const subdivisionMix = THREE.MathUtils.smoothstep(
    perceptualCurveStrength,
    0.24,
    1
  );
  const primaryWeight = THREE.MathUtils.lerp(1, 0.58, subdivisionMix);
  const secondaryLoopWeight = 0.38 * subdivisionMix;
  const primaryAngle = (
    Math.cos(entry.curvePhase) * primaryWeight
    + Math.cos(entry.curveMicroPhase) * secondaryLoopWeight
  ) * entry.curveOrbitAmplitude;
  const secondaryAngle = (
    Math.sin(entry.curvePhase) * primaryWeight
    + Math.sin(entry.curveMicroPhase) * secondaryLoopWeight
  ) * entry.curveOrbitAmplitude;
  scratchQuaternion.setFromAxisAngle(
    entry.curveAxis,
    primaryAngle
  );
  scratchQuaternionB.setFromAxisAngle(
    entry.curveSecondaryAxis,
    secondaryAngle
  );
  scratchQuaternion.multiply(scratchQuaternionB).normalize();
  const orbitAlpha = 1 - Math.exp(-smoothingDelta * 7.2);
  entry.curveRotation.slerp(scratchQuaternion, orbitAlpha).normalize();
  bone.quaternion.multiply(entry.curveRotation);
}

function releaseCircularTravel(entry, bone, delta) {
  const smoothingDelta = Math.min(1 / 30, Math.max(1 / 240, delta));
  const releaseAlpha = 1 - Math.exp(-smoothingDelta * 4.2);
  entry.curveAmount = THREE.MathUtils.lerp(entry.curveAmount, 0, releaseAlpha);
  entry.curveActivation = THREE.MathUtils.lerp(entry.curveActivation, 0, releaseAlpha);
  entry.curveOpportunity = THREE.MathUtils.lerp(entry.curveOpportunity, 0, releaseAlpha);
  entry.curveSourceCurvature = THREE.MathUtils.lerp(
    entry.curveSourceCurvature,
    0,
    releaseAlpha
  );
  entry.curveAngularVelocity = THREE.MathUtils.lerp(
    entry.curveAngularVelocity,
    0,
    releaseAlpha
  );
  entry.curveOrbitAmplitude = THREE.MathUtils.lerp(
    entry.curveOrbitAmplitude,
    0,
    releaseAlpha
  );
  entry.curveSubdivision = THREE.MathUtils.lerp(
    entry.curveSubdivision,
    1,
    releaseAlpha
  );
  scratchQuaternion.identity();
  entry.curveRotation.slerp(scratchQuaternion, releaseAlpha).normalize();
  if (
    entry.curveRotation.angleTo(scratchQuaternion) < 0.001
    && Math.abs(entry.curveAngularVelocity) < 0.001
  ) {
    entry.curveRotation.identity();
    entry.curveAxisReady = false;
    entry.curvePhase = 0;
    entry.curveMicroPhase = 0;
  }
  bone.quaternion.multiply(entry.curveRotation);
}

function resetLinearizedTravel(entry, bone) {
  entry.curveLinearizedQuaternion.copy(bone.quaternion);
  entry.curveLinearAxisReady = false;
  entry.curveLinearReady = false;
}

function applyLinearizedTravel(entry, bone, straightenAmount, delta) {
  const smoothingDelta = Math.min(1 / 30, Math.max(1 / 240, delta));
  // Keep the midpoint close to the source trajectory. A linear blend between
  // two quaternion paths can itself introduce an extra change of axis, so the
  // straightening response is deliberately eased: low settings remain nearly
  // neutral while the final third progressively commits to the stable axis.
  const straightenResponse = Math.pow(
    THREE.MathUtils.smoothstep(straightenAmount, 0, 1),
    2.2
  );
  const sourceJump = entry.sourceDeltaAngle >= 1.2;
  if (!entry.curveLinearReady || sourceJump) {
    entry.curveLinearizedQuaternion.copy(bone.quaternion);
    if (entry.sourceDeltaAngle > 0.00001 && !sourceJump) {
      entry.curveLinearAxis.copy(entry.sourceDeltaAxis);
      entry.curveLinearAxisReady = true;
    } else {
      entry.curveLinearAxisReady = false;
    }
    entry.curveLinearReady = true;
    return;
  }

  const validDelta = entry.sourceDeltaAngle > 0.00001 && !sourceJump;
  if (validDelta) {
    scratchAxis.copy(entry.sourceDeltaAxis);
    let signedAngle = entry.sourceDeltaAngle;
    if (!entry.curveLinearAxisReady) {
      entry.curveLinearAxis.copy(scratchAxis);
      entry.curveLinearAxisReady = true;
    } else {
      if (entry.curveLinearAxis.dot(scratchAxis) < 0) {
        scratchAxis.multiplyScalar(-1);
        signedAngle *= -1;
      }
      // At 0% the filtered axis changes slowly, converting a changing circular
      // direction into a straighter quaternion segment. Near 100% it follows
      // the source closely so the transition into neutral remains continuous.
      const axisFollowRate = THREE.MathUtils.lerp(8.5, 0.12, straightenResponse);
      entry.curveLinearAxis.lerp(
        scratchAxis,
        1 - Math.exp(-smoothingDelta * axisFollowRate)
      ).normalize();
    }
    scratchQuaternion.setFromAxisAngle(entry.curveLinearAxis, signedAngle);
    entry.curveLinearizedQuaternion.multiply(scratchQuaternion).normalize();
  }

  // Re-anchor slowly during travel and faster at an endpoint. This preserves
  // the choreography's destination poses while removing curvature between them.
  const reanchorRate = entry.speed < 0.02
    ? THREE.MathUtils.lerp(5.5, 2.4, straightenResponse)
    : THREE.MathUtils.lerp(4, 0.08, straightenResponse);
  entry.curveLinearizedQuaternion.slerp(
    bone.quaternion,
    1 - Math.exp(-smoothingDelta * reanchorRate)
  ).normalize();
  const straightenWeight = straightenResponse * 0.985;
  bone.quaternion.slerp(entry.curveLinearizedQuaternion, straightenWeight).normalize();
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
    if (entry.history.length > 78) entry.history.shift();
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
      entry.curveOpportunity = 0;
      entry.curveSourceCurvature = 0;
      entry.curveAmount = 0;
      entry.curveAngularVelocity = 0;
      entry.curvePhase = 0;
      entry.curveMicroPhase = 0;
      entry.curveSubdivision = 1;
      entry.curveAxisReady = false;
      entry.curveLinearAxisReady = false;
      entry.curveLinearReady = false;
      entry.curveLinearizedQuaternion.copy(bone.quaternion);
      entry.stationary = 0;
      entry.spaceExtensionPeak = 0;
      entry.spaceMotionArmed = false;
      entry.spaceHoldRemaining = 0;
      entry.spaceHoldCooldown = 0;
      entry.spaceHoldWeight = 0;
      continue;
    }
    const curveValue = resolveApplicableValue(values, definitions.curves, tags);
    const syncValue = resolveApplicableValue(values, definitions.sync, tags);
    const spaceValue = resolveApplicableValue(values, definitions.space, tags);
    const relationValue = resolveApplicableValue(values, definitions.relations, tags);

    const syncSigned = THREE.MathUtils.clamp((syncValue - 100) / 100, -1, 1);
    const isRightPhase = tags.has('rightArm') || tags.has('rightLeg');
    const phaseSeparation = Math.max(0, -syncSigned);
    const stableRightLag = Math.max(0, syncSigned);
    const clipDuration = Math.max(0, runtime.clipEnd - runtime.clipStart);
    const region = primaryMotionRegion(tags);
    let targetPhaseOffset = 0;
    if (clipDuration > 0 && phaseSeparation > 0.001) {
      targetPhaseOffset = clipDuration
        * (SYNCHRONIC_PHASE_FRACTIONS[region] ?? SYNCHRONIC_PHASE_FRACTIONS.whole)
        * phaseSeparation;
    } else if (clipDuration > 0 && stableRightLag > 0.001 && isRightPhase) {
      targetPhaseOffset = clipDuration * 0.32 * stableRightLag;
    }

    // The offset only moves when the slider changes. Once settled, each body
    // region follows the source clip at a constant phase and therefore retains
    // the clip's original smooth velocity instead of receiving a moving delay.
    const syncOffsetAlpha = 1 - Math.exp(-Math.max(1 / 240, delta) * 2.8);
    entry.syncPhaseOffset = THREE.MathUtils.lerp(
      entry.syncPhaseOffset,
      targetPhaseOffset,
      syncOffsetAlpha
    );
    if (Math.abs(entry.syncPhaseOffset - targetPhaseOffset) < 0.00001) {
      entry.syncPhaseOffset = targetPhaseOffset;
    }

    if (entry.syncPhaseOffset > 0.0001) {
      const phaseBaseTime = Number.isFinite(entry.energyTime)
        ? entry.energyTime
        : Number.isFinite(actionTime)
          ? actionTime
          : runtime.clipStart + runtime.elapsed;
      if (entry.syncInterpolant && clipDuration > 0) {
        const sampled = entry.syncInterpolant.evaluate(
          wrapNo60ClipTime(runtime, phaseBaseTime - entry.syncPhaseOffset)
        );
        entry.syncQuaternion.set(sampled[0], sampled[1], sampled[2], sampled[3]).normalize();
        bone.quaternion.copy(entry.syncQuaternion);
      } else {
        // History sampling is retained only for clips without accessible
        // quaternion tracks. The fixed delay remains fractional and smooth.
        const fallbackDelayFrames = Math.min(
          entry.history.length - 1,
          entry.syncPhaseOffset * 60
        );
        if (
          fallbackDelayFrames > 0.5
          && sampleQuaternionHistory(entry, fallbackDelayFrames, scratchQuaternionB)
        ) {
          bone.quaternion.copy(scratchQuaternionB).normalize();
        }
      }
    }

    const curveSigned = (curveValue - 100) / 100;
    if (curveSigned < -0.001 && entry.curveMotionRoot) {
      releaseCircularTravel(entry, bone, delta);
      applyLinearizedTravel(entry, bone, -curveSigned, delta);
    } else if (curveSigned > 0.001 && entry.curveMotionRoot) {
      resetLinearizedTravel(entry, bone);
      applyCircularTravel(entry, bone, curveSigned, delta);
    } else {
      resetLinearizedTravel(entry, bone);
      releaseCircularTravel(entry, bone, delta);
    }

    const spaceSigned = (spaceValue - 100) / 100;
    if (spaceSigned > 0.001) {
      entry.spaceMotionArmed = runtime.spacePoseMotionArmed;
      entry.spaceHoldRemaining = runtime.spacePoseHoldRemaining;
      entry.spaceHoldCooldown = runtime.spacePoseHoldCooldown;
      entry.spaceHoldWeight = runtime.spacePoseHoldWeight;
      entry.stationary = runtime.spacePoseHoldRemaining;
    } else {
      entry.stationary = 0;
      entry.spaceHoldRemaining = 0;
      entry.spaceHoldCooldown = 0;
      entry.spaceMotionArmed = false;
      entry.spaceHoldWeight = 0;
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
      // Integrate the already-modified joint delta at a different rate for
      // each attention region. At the maximum setting the focused region runs
      // at 1.5x while all non-focused regions run at 0.5x. The multiplier is
      // crossfaded so a focus handoff cannot introduce a pose discontinuity.
      const isFocusedRegion = Boolean(dominantRegion && entryRegion === dominantRegion);
      const targetSpeedScale = isFocusedRegion
        ? 1 + THREE.MathUtils.clamp(entry.relationAmount, 0, 1) * 0.5
        : 1 - THREE.MathUtils.clamp(entry.relationDrag, 0, 1) * 0.5;
      const speedScaleResponse = targetSpeedScale > entry.relationSpeedScale ? 5.8 : 4.2;
      const speedScaleAlpha = 1 - Math.exp(
        -Math.max(1 / 240, delta) * speedScaleResponse
      );
      entry.relationSpeedScale = THREE.MathUtils.lerp(
        entry.relationSpeedScale,
        targetSpeedScale,
        speedScaleAlpha
      );

      scratchQuaternion.copy(entry.relationInput).invert().multiply(bone.quaternion).normalize();
      if (scratchQuaternion.w < 0) {
        scratchQuaternion.set(
          -scratchQuaternion.x,
          -scratchQuaternion.y,
          -scratchQuaternion.z,
          -scratchQuaternion.w
        );
      }
      const relationHalfAngleSine = Math.sqrt(Math.max(0, 1 - scratchQuaternion.w ** 2));
      const relationDeltaAngle = 2 * Math.acos(
        THREE.MathUtils.clamp(scratchQuaternion.w, -1, 1)
      );
      entry.relationInput.copy(bone.quaternion);
      if (
        relationHalfAngleSine > 0.00001
        && relationDeltaAngle > 0.00001
        && relationDeltaAngle < 1.25
      ) {
        scratchAxis.set(
          scratchQuaternion.x / relationHalfAngleSine,
          scratchQuaternion.y / relationHalfAngleSine,
          scratchQuaternion.z / relationHalfAngleSine
        ).normalize();
        scratchQuaternionB.setFromAxisAngle(
          scratchAxis,
          relationDeltaAngle * entry.relationSpeedScale
        );
        entry.relationOutput.multiply(scratchQuaternionB).normalize();
      } else if (relationDeltaAngle >= 1.25) {
        // A seek or clip boundary establishes a new baseline instead of being
        // interpreted as an extremely fast attention shift.
        entry.relationOutput.copy(bone.quaternion);
      }
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
      entry.relationInput.copy(bone.quaternion);
      entry.relationSpeedScale = 1;
      entry.relationOutput.copy(bone.quaternion);
    } else {
      entry.relationInput.copy(bone.quaternion);
      entry.relationSpeedScale = 1;
      entry.relationOutput.copy(bone.quaternion);
    }

    const bodyValue = resolveApplicableValue(values, definitions.body, tags);
    if (entry.regionRoot && entry.bodyEligible && Math.abs(bodyValue) > 0.001) {
      const radians = THREE.MathUtils.degToRad(bodyValue);
      setQuaternionAxisRotation(scratchQuaternionB, values.bodyAxis ?? 'y', radians);
      bone.quaternion.premultiply(scratchQuaternionB);
    }

    entry.previous.slerp(bone.quaternion, Math.min(1, delta * 18));
  }
  // A reach is layered over the fully modified source pose so every contact
  // begins from the current choreography. The analytic two-joint solve rotates
  // only a shoulder/elbow or hip/knee chain and therefore cannot stretch or
  // translate any body segment.
  applyAxisTouchGestures(runtime, values, definitions.axes);
  for (const entry of runtime.entries) {
    if (entry.axisTouchAdjusted) entry.previous.copy(entry.bone.quaternion);
  }
  runtime.spacePoseCapturePending = false;
}
