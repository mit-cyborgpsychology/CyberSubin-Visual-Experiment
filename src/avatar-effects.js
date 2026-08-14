import * as THREE from 'three';

export const AVATAR_EFFECT_MODES = Object.freeze(['off', 'hair', 'interior', 'sculpture']);
export const AVATAR_EFFECT_PATTERNS = Object.freeze(['gradient', 'animal', 'polkadot', 'random']);
export const HAIR_COVERAGE_OPTIONS = Object.freeze(['open', 'full']);
export const HAIR_LIGHTING_OPTIONS = Object.freeze(['scene', 'flat']);
export const HAIR_SHAPE_OPTIONS = Object.freeze([
  'line',
  'ribbon',
  'rod',
  'tuft',
  'sphere',
  'triangle',
  'circle',
  'oval',
  'spike'
]);
export const HAIR_DISTRIBUTION_OPTIONS = Object.freeze([
  'current',
  'uniform',
  'clusters',
  'bands',
  'asymmetric'
]);
export const HAIR_LENGTH_MODE_OPTIONS = Object.freeze([
  'uniform',
  'extremities',
  'head',
  'topGradient',
  'random',
  'alternating'
]);
export const HAIR_GROWTH_PATTERN_OPTIONS = Object.freeze([
  'uniform',
  'organic',
  'headOnly',
  'headHands',
  'wingHands',
  'bodyRhythm',
  'topCascade',
  'shoulderHalo',
  'legBloom',
  'torsoPulse',
  'leftSweep',
  'rightSweep',
  'diagonalFlow'
]);
export const HAIR_GROWTH_PATTERN_SETTINGS = Object.freeze({
  uniform: Object.freeze({ distribution: 'uniform', lengthMode: 'uniform', region: 'all', symmetrical: true }),
  organic: Object.freeze({ distribution: 'current', lengthMode: 'uniform', region: 'all', symmetrical: false }),
  headOnly: Object.freeze({ distribution: 'uniform', lengthMode: 'uniform', region: 'head', symmetrical: true }),
  headHands: Object.freeze({ distribution: 'uniform', lengthMode: 'uniform', region: 'headHands', symmetrical: true }),
  wingHands: Object.freeze({ distribution: 'uniform', lengthMode: 'uniform', region: 'hands', symmetrical: true }),
  bodyRhythm: Object.freeze({ distribution: 'bands', lengthMode: 'alternating', region: 'all', symmetrical: true }),
  topCascade: Object.freeze({ distribution: 'uniform', lengthMode: 'topGradient', region: 'all', symmetrical: true }),
  shoulderHalo: Object.freeze({ distribution: 'uniform', lengthMode: 'alternating', region: 'upper', symmetrical: true }),
  legBloom: Object.freeze({ distribution: 'uniform', lengthMode: 'extremities', region: 'legs', symmetrical: true }),
  torsoPulse: Object.freeze({ distribution: 'bands', lengthMode: 'alternating', region: 'torso', symmetrical: true }),
  leftSweep: Object.freeze({ distribution: 'uniform', lengthMode: 'topGradient', region: 'left', symmetrical: false }),
  rightSweep: Object.freeze({ distribution: 'uniform', lengthMode: 'topGradient', region: 'right', symmetrical: false }),
  diagonalFlow: Object.freeze({ distribution: 'uniform', lengthMode: 'random', region: 'diagonal', symmetrical: false }),
  // Legacy aliases remain readable in previously shared URLs.
  extremityBloom: Object.freeze({ distribution: 'uniform', lengthMode: 'extremities', region: 'all', symmetrical: true }),
  headCrown: Object.freeze({ distribution: 'uniform', lengthMode: 'head', region: 'all', symmetrical: true }),
  clusteredTufts: Object.freeze({ distribution: 'clusters', lengthMode: 'random', region: 'all', symmetrical: false }),
  asymmetricBurst: Object.freeze({ distribution: 'asymmetric', lengthMode: 'random', region: 'all', symmetrical: false })
});
// Kept for backward-compatible share links; the UI uses outwardBias continuously.
export const HAIR_DIRECTION_OPTIONS = Object.freeze(['flow', 'outward']);
export const SCULPTURE_RETENTION_OPTIONS = Object.freeze([
  'permanent',
  'minute',
  'extended',
  'long',
  'medium',
  'short'
]);
export const SCULPTURE_FORM_OPTIONS = Object.freeze(['dots', 'surface']);

const SCULPTURE_RETENTION_SECONDS = Object.freeze({
  permanent: Infinity,
  minute: 60,
  extended: 30,
  long: 15,
  medium: 8,
  short: 3
});

export const DEFAULT_AVATAR_EFFECT_SETTINGS = Object.freeze({
  hair: Object.freeze({
    coverage: 'open',
    lighting: 'scene',
    shape: 'line',
    growthPattern: 'organic',
    distribution: 'current',
    lengthMode: 'uniform',
    outwardBias: 0,
    length: 0.34,
    thickness: 2.2,
    shapeWidth: 1,
    shapeLength: 1,
    shapeDepth: 1,
    density: 420,
    weight: 1,
    flexibility: 0.68,
    motionResponse: 0.65,
    curl: 0.15,
    pattern: 'gradient',
    colors: Object.freeze(['#00d9ff', '#f7f8ff', '#ff5e57'])
  }),
  interior: Object.freeze({
    density: 4400,
    size: 2.4,
    flow: 0.75,
    turbulence: 0.3,
    opacity: 1,
    pattern: 'gradient',
    colors: Object.freeze(['#1437ff', '#43ecff', '#ffffff'])
  }),
  sculpture: Object.freeze({
    form: 'dots',
    interval: 0.05,
    density: 1500,
    size: 1.4,
    opacity: 0.24,
    retention: 'long',
    colors: Object.freeze(['#153dff', '#63efff', '#fff7ef'])
  })
});

const OPTION_RANGES = Object.freeze({
  hair: Object.freeze({
    length: [0.08, 1.2],
    thickness: [0.5, 7],
    shapeWidth: [0.25, 3],
    shapeLength: [0.25, 3],
    shapeDepth: [0.25, 3],
    density: [60, 4800],
    weight: [0, 2.5],
    flexibility: [0, 1],
    motionResponse: [0, 2],
    curl: [0, 2],
    outwardBias: [0, 1]
  }),
  interior: Object.freeze({
    density: [300, 6000],
    size: [0.4, 5],
    flow: [0, 4],
    turbulence: [0, 3],
    opacity: [0.05, 1]
  }),
  sculpture: Object.freeze({
    interval: [0.001, 0.1],
    density: [250, 3200],
    size: [0.4, 4],
    opacity: [0.04, 0.8]
  })
});

const tempVertex = new THREE.Vector3();
const tempAnchor = new THREE.Vector3();
const tempCore = new THREE.Vector3();
const tempColorA = new THREE.Color();
const tempColorB = new THREE.Color();
const tempColorC = new THREE.Color();
const tempHairColor = new THREE.Color();
const tempHairDirection = new THREE.Vector3();
const tempHairOutward = new THREE.Vector3();
const tempHairMidpoint = new THREE.Vector3();
const tempHairCenter = new THREE.Vector3();
const tempHairTarget = new THREE.Vector3();
const tempHairObject = new THREE.Object3D();
const HAIR_LOCAL_AXIS = new THREE.Vector3(0, 1, 0);
const WHOLE_STRAND_HAIR_SHAPES = new Set(['triangle', 'circle', 'oval', 'spike']);

function clampNumber(value, fallback, range) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return THREE.MathUtils.clamp(numeric, range[0], range[1]);
}

function normalizeColor(value, fallback) {
  const candidate = String(value ?? '').trim().toLowerCase();
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback;
}

function sanitizeColors(colors, defaults) {
  return defaults.map((fallback, index) => normalizeColor(colors?.[index], fallback));
}

export function isHairScalpReference(normalizedHeight, boneNames = []) {
  const height = THREE.MathUtils.clamp(Number(normalizedHeight) || 0, 0, 1);
  const names = boneNames.map((name) => String(name ?? '').toLowerCase());
  const hasHeadInfluence = names.some((name) => /head|skull/.test(name));
  const hasNeckInfluence = names.some((name) => /neck/.test(name));
  // Explicit neck weighting always wins. This prevents the Head Only preset
  // from growing a collar around the neck, including blended neck/head seams.
  if (hasNeckInfluence) return false;
  if (hasHeadInfluence) return height >= 0.88;
  // Rigs without usable skin-weight names fall back to the top ten percent of
  // the avatar, which approximates a scalp cap rather than the whole head.
  return height >= 0.92;
}

export function createDefaultAvatarEffectSettings() {
  return {
    hair: {
      ...DEFAULT_AVATAR_EFFECT_SETTINGS.hair,
      colors: [...DEFAULT_AVATAR_EFFECT_SETTINGS.hair.colors]
    },
    interior: {
      ...DEFAULT_AVATAR_EFFECT_SETTINGS.interior,
      colors: [...DEFAULT_AVATAR_EFFECT_SETTINGS.interior.colors]
    },
    sculpture: {
      ...DEFAULT_AVATAR_EFFECT_SETTINGS.sculpture,
      colors: [...DEFAULT_AVATAR_EFFECT_SETTINGS.sculpture.colors]
    }
  };
}

export function sanitizeAvatarEffectSettings(settings) {
  const defaults = createDefaultAvatarEffectSettings();
  const resolved = createDefaultAvatarEffectSettings();
  for (const [section, ranges] of Object.entries(OPTION_RANGES)) {
    for (const [key, range] of Object.entries(ranges)) {
      resolved[section][key] = clampNumber(settings?.[section]?.[key], defaults[section][key], range);
    }
    resolved[section].colors = sanitizeColors(settings?.[section]?.colors, defaults[section].colors);
  }
  // Older share links exposed stiffness directly. Preserve their intent while
  // presenting one clearer material control in the current interface.
  if (settings?.hair?.flexibility == null && settings?.hair?.stiffness != null) {
    const legacyStiffness = clampNumber(settings.hair.stiffness, 1 - defaults.hair.flexibility, [0, 1]);
    resolved.hair.flexibility = 1 - legacyStiffness;
  }
  resolved.hair.density = Math.round(resolved.hair.density);
  resolved.interior.density = Math.round(resolved.interior.density);
  resolved.sculpture.density = Math.round(resolved.sculpture.density);
  resolved.hair.pattern = AVATAR_EFFECT_PATTERNS.includes(settings?.hair?.pattern)
    ? settings.hair.pattern
    : defaults.hair.pattern;
  resolved.hair.coverage = HAIR_COVERAGE_OPTIONS.includes(settings?.hair?.coverage)
    ? settings.hair.coverage
    : defaults.hair.coverage;
  resolved.hair.lighting = HAIR_LIGHTING_OPTIONS.includes(settings?.hair?.lighting)
    ? settings.hair.lighting
    : defaults.hair.lighting;
  resolved.hair.shape = HAIR_SHAPE_OPTIONS.includes(settings?.hair?.shape)
    ? settings.hair.shape
    : defaults.hair.shape;
  resolved.hair.distribution = HAIR_DISTRIBUTION_OPTIONS.includes(settings?.hair?.distribution)
    ? settings.hair.distribution
    : defaults.hair.distribution;
  resolved.hair.lengthMode = HAIR_LENGTH_MODE_OPTIONS.includes(settings?.hair?.lengthMode)
    ? settings.hair.lengthMode
    : defaults.hair.lengthMode;
  if (HAIR_GROWTH_PATTERN_SETTINGS[settings?.hair?.growthPattern]) {
    resolved.hair.growthPattern = settings.hair.growthPattern;
    const preset = HAIR_GROWTH_PATTERN_SETTINGS[resolved.hair.growthPattern];
    resolved.hair.distribution = preset.distribution;
    resolved.hair.lengthMode = preset.lengthMode;
  } else {
    const inferred = Object.entries(HAIR_GROWTH_PATTERN_SETTINGS).find(([, preset]) => (
      preset.distribution === resolved.hair.distribution
      && preset.lengthMode === resolved.hair.lengthMode
    ));
    resolved.hair.growthPattern = inferred?.[0] ?? 'custom';
  }
  if (settings?.hair?.outwardBias == null && settings?.hair?.direction === 'outward') {
    resolved.hair.outwardBias = 1;
  }
  resolved.interior.pattern = AVATAR_EFFECT_PATTERNS.includes(settings?.interior?.pattern)
    ? settings.interior.pattern
    : defaults.interior.pattern;
  resolved.sculpture.retention = SCULPTURE_RETENTION_OPTIONS.includes(settings?.sculpture?.retention)
    ? settings.sculpture.retention
    : defaults.sculpture.retention;
  resolved.sculpture.form = SCULPTURE_FORM_OPTIONS.includes(settings?.sculpture?.form)
    ? settings.sculpture.form
    : defaults.sculpture.form;
  return resolved;
}

export function resolveHairActiveCount(density, availableCount, coverage = 'open') {
  const available = Math.max(0, Math.round(Number(availableCount) || 0));
  const requested = Math.max(0, Math.round(Number(density) || 0));
  const fullCoatMinimum = coverage === 'full' ? Math.round(available * 0.96) : 0;
  return Math.min(available, Math.max(requested, fullCoatMinimum));
}

export function resolveHairLengthScale(
  mode,
  {
    normalizedHeight = 0.5,
    normalizedRadius = 0.5,
    seed = 0,
    isHead = false
  } = {}
) {
  const height = THREE.MathUtils.clamp(Number(normalizedHeight) || 0, 0, 1);
  const radius = THREE.MathUtils.clamp(Number(normalizedRadius) || 0, 0, 1);
  if (mode === 'extremities') {
    const verticalReach = Math.abs(height - 0.5) * 2;
    return THREE.MathUtils.lerp(0.32, 1.85, Math.max(radius, verticalReach));
  }
  if (mode === 'head') return isHead ? 1.65 : 0;
  if (mode === 'topGradient') return THREE.MathUtils.lerp(0.22, 1.75, height ** 1.35);
  if (mode === 'random') return THREE.MathUtils.lerp(0.18, 1.9, hash01(seed * 4.31 + 0.71));
  if (mode === 'alternating') {
    const wave = 0.5 + 0.5 * Math.sin(seed * 2.17 + height * Math.PI * 8);
    return THREE.MathUtils.lerp(0.2, 1.75, wave ** 1.4);
  }
  return 1;
}

export function resolveHairGrowthPattern(pattern) {
  const key = HAIR_GROWTH_PATTERN_SETTINGS[pattern] ? pattern : 'organic';
  return { key, ...HAIR_GROWTH_PATTERN_SETTINGS[key] };
}

export function resolveHairPhysicsProfile(flexibility, weight, delta, motionResponse = 1) {
  const softness = THREE.MathUtils.clamp(Number(flexibility) || 0, 0, 1);
  const resolvedWeight = THREE.MathUtils.clamp(Number(weight) || 0, 0, 2.5);
  const weightAmount = resolvedWeight / 2.5;
  const dt = Math.min(Math.max(Number(delta) || 0, 0), 1 / 30);
  const frameScale = dt * 60;
  const perFrameRetention = THREE.MathUtils.clamp(
    THREE.MathUtils.lerp(0.64, 0.965, softness) * THREE.MathUtils.lerp(1, 0.92, weightAmount),
    0.52,
    0.97
  );
  // Material structure drops non-linearly near the flexible end. This is
  // especially important at the skin: outward direction is a rest pose, not a
  // rigid hinge, so 90-100% flexible hair can bend directly from its base.
  const structure = (1 - softness) ** 2;
  const perFrameSpring = 0.00025 + 0.08975 * structure;
  const perFrameChainStiffness = 0.095 * structure;
  const perFrameRootDirection = 0.3 * structure;
  const requestedMotionResponse = THREE.MathUtils.clamp(Number(motionResponse) || 0, 0, 2);
  const responseAmount = requestedMotionResponse / 2;
  return {
    softness,
    // Exponential damping keeps the same material feel at different frame
    // rates. Weight adds drag instead of making the strand more rigid.
    velocityRetention: Math.pow(perFrameRetention, frameScale),
    gravity: 4.2 * resolvedWeight,
    springBlend: 1 - Math.pow(1 - perFrameSpring, frameScale),
    chainStiffnessBlend: 1 - Math.pow(1 - perFrameChainStiffness, frameScale),
    // Direction is a root rest bias only. At full flexibility it reaches zero,
    // even when the strand was initialized 100% radially outward.
    rootDirectionBlend: 1 - Math.pow(1 - perFrameRootDirection, frameScale),
    windResponse: THREE.MathUtils.lerp(0.3, 1.15, softness)
      * THREE.MathUtils.lerp(1, 0.68, weightAmount),
    // Structured strands are carried with the surface. Flexible strands keep
    // more world-space inertia, with motion response increasing tip lag rather
    // than translating the whole strand as one rigid object.
    kinematicCarry: THREE.MathUtils.lerp(0.9, 0.14, softness)
      * THREE.MathUtils.lerp(0.62, 1, responseAmount),
    inertialResponse: THREE.MathUtils.lerp(0.05, 0.62, softness)
      * requestedMotionResponse
  };
}

function hash01(value) {
  const sine = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return sine - Math.floor(sine);
}

function setGradientColor(target, amount, colors) {
  const t = THREE.MathUtils.clamp(amount, 0, 1);
  if (t < 0.5) {
    return target.set(colors[0]).lerp(tempColorB.set(colors[1]), t * 2);
  }
  return target.set(colors[1]).lerp(tempColorC.set(colors[2]), (t - 0.5) * 2);
}

export function resolveAvatarEffectColor(target, pattern, amount, seed, colors) {
  const t = THREE.MathUtils.clamp(amount, 0, 1);
  if (pattern === 'animal') {
    const stripe = Math.sin(t * 42 + seed * 0.37) + Math.sin(t * 17 - seed * 0.83);
    return target.set(stripe > 0.35 ? colors[0] : stripe < -0.62 ? colors[2] : colors[1]);
  }
  if (pattern === 'polkadot') {
    const row = Math.floor(t * 15);
    const dot = hash01(seed * 1.91 + row * 7.13);
    return target.set(dot > 0.72 ? colors[2] : dot > 0.38 ? colors[0] : colors[1]);
  }
  if (pattern === 'random') {
    const random = hash01(seed * 4.17);
    return target.set(random < 0.333 ? colors[0] : random < 0.666 ? colors[1] : colors[2]);
  }
  return setGradientColor(target, t, colors);
}

function collectSourceMeshes(root) {
  const meshes = [];
  root?.traverse((child) => {
    const position = child.isMesh ? child.geometry?.attributes?.position : null;
    if (!position || child.userData.cyberSubinBaseVisible === false) return;
    meshes.push({ source: child, count: position.count });
  });
  return meshes;
}

function readAttributeComponent(attribute, index, component) {
  if (component === 0) return attribute.getX(index);
  if (component === 1) return attribute.getY(index);
  if (component === 2) return attribute.getZ(index);
  return attribute.getW(index);
}

function createBoneInfluences(source, vertexIndex) {
  const skinIndex = source.isSkinnedMesh ? source.geometry?.attributes?.skinIndex : null;
  const skinWeight = source.isSkinnedMesh ? source.geometry?.attributes?.skinWeight : null;
  if (!skinIndex || !skinWeight || !source.skeleton?.bones?.length) return [];
  const influences = [];
  const componentCount = Math.min(4, skinIndex.itemSize, skinWeight.itemSize);
  for (let component = 0; component < componentCount; component += 1) {
    const weight = readAttributeComponent(skinWeight, vertexIndex, component);
    const boneIndex = Math.round(readAttributeComponent(skinIndex, vertexIndex, component));
    const bone = source.skeleton.bones[boneIndex];
    if (bone && Number.isFinite(weight) && weight > 0.0001) influences.push({ bone, weight });
  }
  return influences;
}

function createSampleReferences(
  meshes,
  count,
  seedOffset = 0,
  includeBoneInfluences = false,
  sampling = 'current'
) {
  const totalVertices = meshes.reduce((sum, entry) => sum + entry.count, 0);
  if (!totalVertices || !meshes.length) return [];
  const references = [];
  for (let sampleIndex = 0; sampleIndex < count; sampleIndex += 1) {
    let globalIndex = sampling === 'uniform'
      ? Math.min(totalVertices - 1, Math.floor(((sampleIndex + 0.5) / count) * totalVertices))
      : Math.floor(hash01(sampleIndex * 2.73 + seedOffset) * totalVertices);
    let selected = meshes[meshes.length - 1];
    for (const entry of meshes) {
      if (globalIndex < entry.count) {
        selected = entry;
        break;
      }
      globalIndex -= entry.count;
    }
    const reference = { source: selected.source, vertexIndex: globalIndex, seed: sampleIndex + seedOffset };
    if (includeBoneInfluences) reference.boneInfluences = createBoneInfluences(selected.source, globalIndex);
    references.push(reference);
  }
  return references;
}

function readWorldVertex(reference, target) {
  reference.source.getVertexPosition(reference.vertexIndex, target);
  return target.applyMatrix4(reference.source.matrixWorld);
}

function annotateHairReferences(root, references) {
  if (!root || !references.length) return references;
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const halfX = Math.max(size.x * 0.5, 0.001);
  const halfY = Math.max(size.y * 0.5, 0.001);
  const halfZ = Math.max(size.z * 0.5, 0.001);
  for (const reference of references) {
    reference.source.updateWorldMatrix(true, false);
    readWorldVertex(reference, tempVertex);
    reference.normalizedX = THREE.MathUtils.clamp((tempVertex.x - bounds.min.x) / Math.max(size.x, 0.001), 0, 1);
    reference.normalizedHeight = THREE.MathUtils.clamp((tempVertex.y - bounds.min.y) / Math.max(size.y, 0.001), 0, 1);
    reference.normalizedZ = THREE.MathUtils.clamp((tempVertex.z - bounds.min.z) / Math.max(size.z, 0.001), 0, 1);
    reference.normalizedRadius = THREE.MathUtils.clamp(Math.sqrt(
      ((tempVertex.x - center.x) / halfX) ** 2
      + ((tempVertex.y - center.y) / halfY) ** 2
      + ((tempVertex.z - center.z) / halfZ) ** 2
    ) / Math.sqrt(3), 0, 1);
    const boneNames = (reference.boneInfluences ?? [])
      .filter(({ weight }) => weight > 0.04)
      .map(({ bone }) => String(bone.name ?? '').toLowerCase());
    const hasBone = (pattern) => boneNames.some((name) => pattern.test(name));
    reference.isHead = isHairScalpReference(reference.normalizedHeight, boneNames);
    reference.isHand = hasBone(/hand|wrist|finger|thumb|index|middle|ring|pinky/);
    reference.isArm = hasBone(/arm|shoulder|clavicle|forearm/);
    reference.isLeg = hasBone(/leg|thigh|calf|shin|foot|toe/);
    reference.isTorso = hasBone(/spine|chest|hip|pelvis|torso|root/);
    const isLeft = hasBone(/left|(^|[_:.])l($|[_:.])|lhand|larm|lleg|lfoot/);
    const isRight = hasBone(/right|(^|[_:.])r($|[_:.])|rhand|rarm|rleg|rfoot/);
    reference.side = isLeft && !isRight ? 'left' : isRight && !isLeft ? 'right' : 'center';
    if (!boneNames.length) {
      reference.isHand = reference.normalizedRadius > 0.7
        && reference.normalizedHeight > 0.38
        && reference.normalizedHeight < 0.88;
      reference.isLeg = reference.normalizedHeight < 0.46;
      reference.isTorso = !reference.isHead && !reference.isHand && !reference.isLeg;
    }
  }
  return references;
}

function hairReferenceMatchesRegion(reference, region) {
  if (region === 'head') return reference.isHead;
  if (region === 'hands') return reference.isHand;
  if (region === 'headHands') return reference.isHead || reference.isHand;
  if (region === 'upper') {
    return reference.isHead || reference.isHand || reference.isArm || reference.normalizedHeight > 0.58;
  }
  if (region === 'legs') return reference.isLeg || reference.normalizedHeight < 0.46;
  if (region === 'torso') {
    return reference.isTorso || (
      !reference.isHead
      && !reference.isHand
      && !reference.isArm
      && !reference.isLeg
      && reference.normalizedHeight > 0.28
      && reference.normalizedHeight < 0.82
    );
  }
  if (region === 'left') return reference.side === 'left' || reference.normalizedX < 0.46;
  if (region === 'right') return reference.side === 'right' || reference.normalizedX > 0.54;
  if (region === 'diagonal') {
    const leftSide = reference.side === 'left' || reference.normalizedX < 0.5;
    return leftSide === (reference.normalizedHeight > 0.52);
  }
  return true;
}

function getHairReferenceSide(reference) {
  if (reference.side === 'left' || reference.side === 'right') return reference.side;
  if (reference.normalizedX < 0.485) return 'left';
  if (reference.normalizedX > 0.515) return 'right';
  return 'center';
}

function orderSymmetricHairReferences(references) {
  const left = references.filter((reference) => getHairReferenceSide(reference) === 'left');
  const right = references.filter((reference) => getHairReferenceSide(reference) === 'right');
  const center = references.filter((reference) => getHairReferenceSide(reference) === 'center');
  const compareMirrorCoordinates = (a, b) => (
    a.normalizedHeight - b.normalizedHeight
    || a.normalizedZ - b.normalizedZ
    || Math.abs(a.normalizedX - 0.5) - Math.abs(b.normalizedX - 0.5)
  );
  left.sort(compareMirrorCoordinates);
  right.sort(compareMirrorCoordinates);
  const pairCount = Math.min(left.length, right.length);
  const pairs = [];
  for (let index = 0; index < pairCount; index += 1) {
    pairs.push({
      left: left[index],
      right: right[index],
      order: hash01((left[index].seed + right[index].seed) * 2.37)
    });
  }
  pairs.sort((a, b) => a.order - b.order);
  const ordered = [];
  for (const pair of pairs) ordered.push(pair.left, pair.right);
  center.sort((a, b) => hash01(a.seed * 3.29) - hash01(b.seed * 3.29));
  ordered.push(...center);
  return ordered;
}

function expandHairReferences(references, count) {
  if (!references.length || count <= 0) return [];
  const expanded = [];
  for (let index = 0; index < count; index += 1) {
    const source = references[index % references.length];
    const cycle = Math.floor(index / references.length);
    expanded.push(cycle === 0 ? source : { ...source, seed: source.seed + cycle * 7919 });
  }
  return expanded;
}

function orderUniformHairReferences(references) {
  const cells = new Map();
  for (const reference of references) {
    const cellKey = `${Math.min(4, Math.floor(reference.normalizedX * 5))}:${Math.min(7, Math.floor(reference.normalizedHeight * 8))}:${Math.min(4, Math.floor(reference.normalizedZ * 5))}`;
    if (!cells.has(cellKey)) cells.set(cellKey, []);
    cells.get(cellKey).push(reference);
  }
  const queues = [...cells.values()];
  for (const queue of queues) queue.sort((a, b) => hash01(a.seed * 1.91) - hash01(b.seed * 1.91));
  queues.sort((a, b) => hash01(a[0].seed * 3.17) - hash01(b[0].seed * 3.17));
  const ordered = [];
  let remaining = true;
  while (remaining) {
    remaining = false;
    for (const queue of queues) {
      const reference = queue.shift();
      if (!reference) continue;
      ordered.push(reference);
      remaining = true;
    }
  }
  return ordered;
}

function createHairReferences(root, meshes, count, distribution, growthPattern) {
  if (!root || !meshes.length || count <= 0) return [];
  const growth = HAIR_GROWTH_PATTERN_SETTINGS[growthPattern] ?? {
    region: 'all',
    symmetrical: false
  };
  if (distribution === 'current' && growth.region === 'all' && !growth.symmetrical) {
    return annotateHairReferences(root, createSampleReferences(meshes, count, 11, true));
  }
  const allCandidates = annotateHairReferences(
    root,
    createSampleReferences(meshes, Math.max(count, count * 3), 11, true, 'uniform')
  );
  const regionCandidates = allCandidates.filter((reference) => (
    hairReferenceMatchesRegion(reference, growth.region)
  ));
  let candidates = regionCandidates.length ? regionCandidates : allCandidates;
  const clusterCenters = [
    [0.22, 0.74, 0.46],
    [0.78, 0.54, 0.54],
    [0.38, 0.18, 0.62],
    [0.62, 0.9, 0.38]
  ];
  const score = (reference) => {
    const jitter = hash01(reference.seed * 4.73) * 0.12;
    if (distribution === 'clusters') {
      let nearest = Infinity;
      for (const [x, y, z] of clusterCenters) {
        nearest = Math.min(nearest, Math.sqrt(
          (reference.normalizedX - x) ** 2
          + (reference.normalizedHeight - y) ** 2
          + (reference.normalizedZ - z) ** 2
        ));
      }
      return 1 - nearest + jitter;
    }
    if (distribution === 'bands') {
      return 0.5 + 0.5 * Math.cos(reference.normalizedHeight * Math.PI * 10) + jitter;
    }
    if (distribution === 'asymmetric') {
      return reference.normalizedX * 0.82 + reference.normalizedHeight * 0.08 + jitter;
    }
    return jitter;
  };
  if (distribution === 'clusters' || distribution === 'bands' || distribution === 'asymmetric') {
    candidates = candidates
      .sort((a, b) => score(b) - score(a))
      .slice(0, Math.max(count, Math.round(candidates.length * 0.5)));
  } else {
    candidates = orderUniformHairReferences(candidates);
  }
  const ordered = growth.symmetrical
    ? orderSymmetricHairReferences(candidates)
    : candidates;
  return expandHairReferences(ordered.length ? ordered : candidates, count);
}

export function bakeAvatarSurfaceGeometry(source) {
  const sourcePosition = source?.geometry?.attributes?.position;
  const geometry = new THREE.BufferGeometry();
  if (!sourcePosition || typeof source.getVertexPosition !== 'function') return geometry;
  updateAvatarSurfaceGeometry(source, geometry, true);
  return geometry;
}

export function updateAvatarSurfaceGeometry(source, geometry, initialize = false) {
  const sourcePosition = source?.geometry?.attributes?.position;
  if (!sourcePosition || typeof source.getVertexPosition !== 'function' || !geometry) return geometry;
  source.updateWorldMatrix(true, false);
  let positionAttribute = geometry.getAttribute('position');
  if (!positionAttribute || positionAttribute.count !== sourcePosition.count) {
    positionAttribute = new THREE.BufferAttribute(new Float32Array(sourcePosition.count * 3), 3);
    positionAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positionAttribute);
    initialize = true;
  }
  const positions = positionAttribute.array;
  for (let index = 0; index < sourcePosition.count; index += 1) {
    source.getVertexPosition(index, tempVertex);
    tempVertex.applyMatrix4(source.matrixWorld).toArray(positions, index * 3);
  }
  positionAttribute.needsUpdate = true;
  if (initialize) {
    for (const attributeName of ['uv', 'uv1', 'uv2', 'color']) {
      const attribute = source.geometry.attributes[attributeName];
      if (attribute) geometry.setAttribute(attributeName, attribute.clone());
    }
    if (source.geometry.index) geometry.setIndex(source.geometry.index.clone());
    geometry.clearGroups();
    for (const group of source.geometry.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
  }
  geometry.computeVertexNormals();
  if (geometry.attributes.normal) geometry.attributes.normal.needsUpdate = true;
  geometry.computeBoundingSphere();
  return geometry;
}

export function resolveSculptureCaptureInterval(
  requestedInterval,
  form,
  averageCaptureCostSeconds = 0,
  retentionSeconds = Infinity,
  playbackDuration = 0,
  maxSnapshots = 0
) {
  const requested = THREE.MathUtils.clamp(Number(requestedInterval) || 0.001, 0.001, 0.1);
  const captureCost = Math.max(0, Number(averageCaptureCostSeconds) || 0);
  // Keep surface baking under roughly 25% of the frame-time budget. Fast
  // machines retain the requested cadence; slower machines self-throttle.
  const adaptiveFloor = form === 'surface'
    ? THREE.MathUtils.clamp(captureCost * 4, 0.001, 0.24)
    : 0.001;
  // Capture frequency is independent from retention. The bounded snapshot pool
  // recycles older layers when necessary, so a long retention option must not
  // silently force every Capture Interval value to the same slow cadence.
  return Math.max(requested, adaptiveFloor);
}

export function resolveInteriorParticleDepth(baseDepth, elapsedTime, flow, turbulence, phase) {
  const time = Math.max(0, Number(elapsedTime) || 0) * Math.max(0, Number(flow) || 0);
  const agitation = THREE.MathUtils.clamp(Number(turbulence) || 0, 0, 3);
  const radialFlow = Math.sin(time * 1.37 + phase) * 0.04 * agitation;
  const secondaryFlow = Math.sin(time * 0.61 + phase * 1.91) * 0.02 * agitation;
  return THREE.MathUtils.clamp(baseDepth + radialFlow + secondaryFlow, 0.06, 0.9);
}

export function resolveInteriorParticlePosition(target, localCore, skinSurface, depth) {
  return target.copy(localCore).lerp(skinSurface, THREE.MathUtils.clamp(depth, 0.06, 0.9));
}

function disposeMaterial(material) {
  if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
  else material?.dispose?.();
}

function createHairShapeMaterial(lighting = 'scene') {
  const common = {
    color: '#ffffff',
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    side: THREE.DoubleSide
  };
  if (lighting === 'flat') {
    return new THREE.MeshBasicMaterial({
      ...common,
      toneMapped: false
    });
  }
  return new THREE.MeshStandardMaterial({
    ...common,
    roughness: 0.58,
    metalness: 0.08
  });
}

function createHairShapeMesh(shape, maxInstances) {
  let geometry;
  if (shape === 'ribbon') geometry = new THREE.PlaneGeometry(1, 1);
  else if (shape === 'rod') geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 5, 1, false);
  else if (shape === 'sphere') geometry = new THREE.SphereGeometry(0.5, 7, 5);
  else if (shape === 'triangle') geometry = new THREE.ConeGeometry(0.5, 1, 3, 1, false);
  else if (shape === 'circle') geometry = new THREE.CircleGeometry(0.5, 20);
  else if (shape === 'oval') geometry = new THREE.SphereGeometry(0.5, 7, 5);
  else if (shape === 'spike') geometry = new THREE.ConeGeometry(0.32, 1, 7, 1, false);
  else geometry = new THREE.ConeGeometry(0.68, 1, 5, 1, false);
  const material = createHairShapeMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, maxInstances);
  // Allocate the instance-color attribute before the first render. Without it,
  // Three can compile a zero-count mesh without USE_INSTANCING_COLOR and the
  // later ribbon/rod/tuft instances inherit an unlit black vertex attribute.
  mesh.setColorAt(0, new THREE.Color('#ffffff'));
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor.needsUpdate = true;
  material.needsUpdate = true;
  mesh.name = `CyberSubinHair${shape[0].toUpperCase()}${shape.slice(1)}`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.renderOrder = 12;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  return mesh;
}

function createHairVisual(maxStrands, segments) {
  const vertexCount = maxStrands * segments * 2;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, 0);
  const lineMaterial = new THREE.LineBasicMaterial({
    color: '#ffffff',
    vertexColors: true,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(geometry, lineMaterial);
  lines.frustumCulled = false;
  lines.renderOrder = 12;

  const nodePositions = new Float32Array(maxStrands * (segments + 1) * 3);
  const nodePrevious = new Float32Array(nodePositions.length);
  const tipGeometry = new THREE.BufferGeometry();
  tipGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
  tipGeometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nodePositions.length), 3));
  tipGeometry.setDrawRange(0, 0);
  const tipMaterial = new THREE.PointsMaterial({
    color: '#ffffff',
    vertexColors: true,
    size: 0.012,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    toneMapped: false
  });
  const tips = new THREE.Points(tipGeometry, tipMaterial);
  tips.frustumCulled = false;
  tips.renderOrder = 13;

  const maximumShapeSegments = maxStrands * segments;
  const shapeMeshes = Object.fromEntries(
    HAIR_SHAPE_OPTIONS
      .filter((shape) => shape !== 'line')
      .map((shape) => [shape, createHairShapeMesh(shape, maximumShapeSegments)])
  );

  const group = new THREE.Group();
  group.name = 'CyberSubinFullBodyHair';
  group.add(lines, tips, ...Object.values(shapeMeshes));
  group.visible = false;
  return {
    group,
    lines,
    tips,
    positions,
    colors,
    nodePositions,
    nodePrevious,
    anchorPrevious: new Float32Array(maxStrands * 3),
    shapeMeshes,
    segments,
    initialized: false
  };
}

function createInteriorVisual(maxParticles) {
  const positions = new Float32Array(maxParticles * 3);
  const colors = new Float32Array(maxParticles * 3);
  const velocities = new Float32Array(maxParticles * 3);
  const depths = new Float32Array(maxParticles);
  const phases = new Float32Array(maxParticles);
  for (let index = 0; index < maxParticles; index += 1) {
    depths[index] = 0.08 + hash01(index * 5.17) * 0.8;
    phases[index] = hash01(index * 8.41) * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setDrawRange(0, 0);
  const material = new THREE.PointsMaterial({
    color: '#ffffff',
    vertexColors: true,
    size: 0.016,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'CyberSubinInteriorParticles';
  points.frustumCulled = false;
  points.renderOrder = 14;
  points.visible = false;
  return { points, positions, colors, velocities, depths, phases };
}

function createSnapshotMaterial(size, opacity) {
  return new THREE.PointsMaterial({
    color: '#ffffff',
    vertexColors: true,
    size: 0.01 * size,
    sizeAttenuation: true,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}

export function syncSurfaceSnapshotMaterial(
  material,
  sourceMaterial,
  opacity = material?.opacity ?? 1
) {
  if (!material) return material;
  if (sourceMaterial && material !== sourceMaterial) material.copy(sourceMaterial);
  // Three.js deliberately does not copy shader callbacks when cloning or
  // copying a material. The avatar gradient and energy surface treatment live
  // in this hook, so preserve it explicitly for captured body surfaces.
  if (sourceMaterial?.onBeforeCompile) {
    material.onBeforeCompile = sourceMaterial.onBeforeCompile;
    material.customProgramCacheKey = sourceMaterial.customProgramCacheKey;
  }
  material.transparent = true;
  // Capture opacity is independent from the live avatar opacity. This lets the
  // source avatar disappear while its frozen surface sculpture remains visible.
  material.opacity = opacity;
  material.depthWrite = false;
  // Captures share the avatar's visual material, but must not rewrite the live
  // avatar's stencil mask as overlapping sculpture layers accumulate.
  material.stencilWrite = false;
  material.polygonOffset = true;
  material.polygonOffsetFactor = -0.35;
  material.polygonOffsetUnits = -0.35;
  material.needsUpdate = true;
  return material;
}

function createSurfaceSnapshotMaterial(sourceMaterial, opacity) {
  const material = sourceMaterial?.clone?.() ?? new THREE.MeshStandardMaterial({ color: '#d9dcde' });
  return syncSurfaceSnapshotMaterial(material, sourceMaterial, opacity);
}

export function createAvatarEffects({
  maxHairStrands = 800,
  hairSegments = 6,
  maxInteriorParticles = 6000,
  maxSculptures = 36,
  maxPermanentSculptures = 120
} = {}) {
  const group = new THREE.Group();
  group.name = 'CyberSubinAvatarEffects';
  const hair = createHairVisual(maxHairStrands, hairSegments);
  const interior = createInteriorVisual(maxInteriorParticles);
  const sculptureGroup = new THREE.Group();
  sculptureGroup.name = 'CyberSubinMotionSculpture';
  sculptureGroup.visible = false;
  group.add(hair.group, interior.points, sculptureGroup);

  let mode = 'off';
  let settings = createDefaultAvatarEffectSettings();
  let root = null;
  let sourceMeshes = [];
  let hairReferences = [];
  let interiorReferences = [];
  let sculptureReferences = [];
  let sculptureElapsed = 0;
  let sculptureCaptureCost = 0;
  let elapsedTime = 0;
  const sculptures = [];
  const permanentSculptureSlots = new Set();
  const boneWorldPositions = new Map();

  function syncHairShapeVisibility() {
    const lineVisible = settings.hair.shape === 'line';
    hair.lines.visible = lineVisible;
    hair.tips.visible = lineVisible && settings.hair.lengthMode !== 'head';
    for (const [shape, mesh] of Object.entries(hair.shapeMeshes)) {
      mesh.visible = settings.hair.shape === shape;
      if (!mesh.visible) mesh.count = 0;
    }
  }

  function syncHairLighting() {
    const flat = settings.hair.lighting === 'flat';
    for (const mesh of Object.values(hair.shapeMeshes)) {
      const materialMatches = flat
        ? mesh.material?.isMeshBasicMaterial
        : mesh.material?.isMeshStandardMaterial;
      if (!materialMatches) {
        const previousMaterial = mesh.material;
        mesh.material = createHairShapeMaterial(settings.hair.lighting);
        mesh.material.needsUpdate = true;
        disposeMaterial(previousMaterial);
      }
      // Flat hair is deliberately independent from both scene light and
      // shadow maps. Scene-lit hair keeps the fully shaded behavior.
      mesh.castShadow = !flat;
      mesh.receiveShadow = !flat;
    }
  }

  function rebuildHairReferences() {
    hairReferences = createHairReferences(
      root,
      sourceMeshes,
      maxHairStrands,
      settings.hair.distribution,
      settings.hair.growthPattern
    );
    hair.initialized = false;
    hair.anchorPrevious.fill(0);
  }

  function updateVisibility() {
    hair.group.visible = mode === 'hair' && Boolean(root);
    interior.points.visible = mode === 'interior' && Boolean(root);
    sculptureGroup.visible = mode === 'sculpture' && Boolean(root);
    syncHairShapeVisibility();
  }

  function setRoot(nextRoot) {
    root = nextRoot ?? null;
    sourceMeshes = collectSourceMeshes(root);
    rebuildHairReferences();
    interiorReferences = createSampleReferences(sourceMeshes, maxInteriorParticles, 29, true);
    sculptureReferences = createSampleReferences(sourceMeshes, 3200, 47);
    boneWorldPositions.clear();
    hair.initialized = false;
    hair.anchorPrevious.fill(0);
    hair.lines.geometry.setDrawRange(0, 0);
    hair.tips.geometry.setDrawRange(0, 0);
    for (const mesh of Object.values(hair.shapeMeshes)) mesh.count = 0;
    interior.positions.fill(0);
    interior.velocities.fill(0);
    interior.points.geometry.setDrawRange(0, 0);
    clearSculpture();
    updateVisibility();
  }

  function setMode(nextMode) {
    mode = AVATAR_EFFECT_MODES.includes(nextMode) ? nextMode : 'off';
    sculptureElapsed = settings.sculpture.interval;
    updateVisibility();
  }

  function setSettings(nextSettings) {
    const previousSculptureForm = settings.sculpture.form;
    const previousHair = settings.hair;
    const nextResolvedSettings = sanitizeAvatarEffectSettings(nextSettings);
    const resetHair = previousHair.length !== nextResolvedSettings.hair.length
      || previousHair.density !== nextResolvedSettings.hair.density
      || previousHair.coverage !== nextResolvedSettings.hair.coverage
      || previousHair.lengthMode !== nextResolvedSettings.hair.lengthMode;
    const redistributeHair = previousHair.distribution !== nextResolvedSettings.hair.distribution
      || previousHair.growthPattern !== nextResolvedSettings.hair.growthPattern;
    const retuneHairPhysics = previousHair.flexibility !== nextResolvedSettings.hair.flexibility
      || previousHair.weight !== nextResolvedSettings.hair.weight;
    settings = nextResolvedSettings;
    // Retention works like Trace retention: it changes which stored captures
    // are visible, but never destroys the capture history. A form change still
    // clears because dot and surface snapshots use incompatible geometry.
    if (previousSculptureForm !== settings.sculpture.form) clearSculpture();
    if (redistributeHair) rebuildHairReferences();
    else if (resetHair) hair.initialized = false;
    else if (retuneHairPhysics && hair.initialized) {
      // Remove most stored oscillation when material controls change. The
      // current shape is preserved, then continues naturally under the new
      // profile instead of snapping or carrying an obsolete spring impulse.
      for (let index = 0; index < hair.nodePrevious.length; index += 1) {
        hair.nodePrevious[index] = THREE.MathUtils.lerp(
          hair.nodePrevious[index],
          hair.nodePositions[index],
          0.72
        );
      }
    }
    const coatScale = settings.hair.coverage === 'full' ? 1.45 : 1;
    hair.lines.material.linewidth = settings.hair.thickness * coatScale;
    hair.lines.material.opacity = settings.hair.coverage === 'full' ? 1 : 0.86;
    hair.tips.material.size = 0.0045 * settings.hair.thickness * coatScale;
    hair.tips.material.opacity = settings.hair.coverage === 'full' ? 0.98 : 0.8;
    syncHairLighting();
    syncHairShapeVisibility();
    interior.points.material.size = 0.009 * settings.interior.size;
    interior.points.material.opacity = settings.interior.opacity;
    for (const snapshot of sculptures) {
      if (snapshot.kind === 'dots') snapshot.materials[0].size = 0.01 * settings.sculpture.size;
      snapshot.baseOpacity = settings.sculpture.opacity;
    }
    applySculptureRetentionToAll();
  }

  function syncSurfaceAppearance() {
    for (const snapshot of sculptures) {
      if (snapshot.kind !== 'surface') continue;
      snapshot.materials.forEach((material, index) => {
        syncSurfaceSnapshotMaterial(
          material,
          snapshot.materialSources?.[index],
          material.opacity
        );
      });
    }
  }

  function initializeHair(activeCount) {
    root?.updateMatrixWorld(true);
    updateBoneWorldPositionCache();
    root.getWorldPosition(tempHairCenter);
    tempHairCenter.y += 1.35;
    for (let index = 0; index < activeCount; index += 1) {
      const reference = hairReferences[index];
      if (!reference) continue;
      reference.source.updateWorldMatrix(true, false);
      readWorldVertex(reference, tempAnchor);
      resolveHairOutwardDirection(reference, tempAnchor, tempHairOutward);
      tempHairDirection.set(0, -1, 0).lerp(tempHairOutward, settings.hair.outwardBias);
      if (tempHairDirection.lengthSq() < 0.000001) tempHairDirection.copy(tempHairOutward);
      tempHairDirection.normalize();
      const lengthScale = resolveHairLengthScale(settings.hair.lengthMode, reference);
      for (let segment = 0; segment <= hair.segments; segment += 1) {
        const offset = (index * (hair.segments + 1) + segment) * 3;
        const spread = segment * settings.hair.length * lengthScale / hair.segments;
        hair.nodePositions[offset] = tempAnchor.x + tempHairDirection.x * spread;
        hair.nodePositions[offset + 1] = tempAnchor.y + tempHairDirection.y * spread;
        hair.nodePositions[offset + 2] = tempAnchor.z + tempHairDirection.z * spread;
        hair.nodePrevious[offset] = hair.nodePositions[offset];
        hair.nodePrevious[offset + 1] = hair.nodePositions[offset + 1];
        hair.nodePrevious[offset + 2] = hair.nodePositions[offset + 2];
      }
      const anchorOffset = index * 3;
      hair.anchorPrevious[anchorOffset] = tempAnchor.x;
      hair.anchorPrevious[anchorOffset + 1] = tempAnchor.y;
      hair.anchorPrevious[anchorOffset + 2] = tempAnchor.z;
    }
    hair.initialized = true;
  }

  function updateBoneWorldPositionCache() {
    for (const { source } of sourceMeshes) {
      if (!source.isSkinnedMesh) continue;
      for (const bone of source.skeleton?.bones ?? []) {
        let position = boneWorldPositions.get(bone);
        if (!position) {
          position = new THREE.Vector3();
          boneWorldPositions.set(bone, position);
        }
        bone.getWorldPosition(position);
      }
    }
  }

  function resolveHairOutwardDirection(reference, anchor, target) {
    tempCore.set(0, 0, 0);
    let totalWeight = 0;
    for (const influence of reference.boneInfluences ?? []) {
      const bonePosition = boneWorldPositions.get(influence.bone);
      if (!bonePosition) continue;
      tempCore.addScaledVector(bonePosition, influence.weight);
      totalWeight += influence.weight;
    }
    if (totalWeight > 0.0001) tempCore.multiplyScalar(1 / totalWeight);
    else tempCore.copy(tempHairCenter);
    target.copy(anchor).sub(tempCore);
    if (target.lengthSq() < 0.000001) target.copy(anchor).sub(tempHairCenter);
    if (target.lengthSq() < 0.000001) target.set(0, 1, 0);
    return target.normalize();
  }

  function setHairShapeInstance(mesh, instanceIndex, startOffset, endOffset, thickness, color) {
    tempHairDirection.set(
      hair.nodePositions[endOffset] - hair.nodePositions[startOffset],
      hair.nodePositions[endOffset + 1] - hair.nodePositions[startOffset + 1],
      hair.nodePositions[endOffset + 2] - hair.nodePositions[startOffset + 2]
    );
    const segmentLength = Math.max(0.0001, tempHairDirection.length());
    tempHairDirection.multiplyScalar(1 / segmentLength);
    tempHairMidpoint.set(
      (hair.nodePositions[startOffset] + hair.nodePositions[endOffset]) * 0.5,
      (hair.nodePositions[startOffset + 1] + hair.nodePositions[endOffset + 1]) * 0.5,
      (hair.nodePositions[startOffset + 2] + hair.nodePositions[endOffset + 2]) * 0.5
    );
    tempHairObject.position.copy(tempHairMidpoint);
    tempHairObject.quaternion.setFromUnitVectors(HAIR_LOCAL_AXIS, tempHairDirection);
    const shapeWidth = settings.hair.shapeWidth;
    const shapeLength = settings.hair.shapeLength;
    const shapeDepth = settings.hair.shapeDepth;
    if (settings.hair.shape === 'ribbon') {
      tempHairObject.scale.set(0.012 * thickness * shapeWidth, segmentLength * shapeLength, 1);
    } else if (settings.hair.shape === 'rod') {
      const radius = 0.0065 * thickness;
      tempHairObject.scale.set(radius * shapeWidth, segmentLength * shapeLength, radius * shapeDepth);
    } else if (settings.hair.shape === 'sphere') {
      const radius = 0.024 * thickness;
      tempHairObject.scale.set(radius * shapeWidth, radius * shapeLength, radius * shapeDepth);
    } else if (settings.hair.shape === 'circle') {
      // CircleGeometry has a 0.5-unit radius. Keep the disc in its native XY
      // plane so local Y follows the strand, then move its center one rendered
      // radius away from the skin. The local -Y perimeter now lands exactly on
      // the hair root instead of the body intersecting the middle of the disc.
      const diameter = Math.max(0.026 * thickness, segmentLength * 0.72);
      tempHairObject.scale.set(diameter * shapeWidth, diameter * shapeLength, diameter);
      tempHairObject.position.set(
        hair.nodePositions[startOffset],
        hair.nodePositions[startOffset + 1],
        hair.nodePositions[startOffset + 2]
      ).addScaledVector(tempHairDirection, diameter * shapeLength * 0.5);
    } else if (settings.hair.shape === 'oval') {
      const radius = Math.max(0.022 * thickness, segmentLength * 0.24);
      const renderedLength = segmentLength * shapeLength;
      tempHairObject.scale.set(radius * shapeWidth, renderedLength, radius * 0.72 * shapeDepth);
      tempHairObject.position.set(
        hair.nodePositions[startOffset],
        hair.nodePositions[startOffset + 1],
        hair.nodePositions[startOffset + 2]
      ).addScaledVector(tempHairDirection, renderedLength * 0.5);
    } else if (settings.hair.shape === 'triangle') {
      const radius = 0.03 * thickness;
      const renderedLength = segmentLength * shapeLength;
      tempHairObject.scale.set(radius * shapeWidth, renderedLength, radius * shapeDepth);
      tempHairObject.position.set(
        hair.nodePositions[startOffset],
        hair.nodePositions[startOffset + 1],
        hair.nodePositions[startOffset + 2]
      ).addScaledVector(tempHairDirection, renderedLength * 0.5);
    } else if (settings.hair.shape === 'spike') {
      const radius = 0.012 * thickness;
      const renderedLength = segmentLength * shapeLength;
      tempHairObject.scale.set(radius * shapeWidth, renderedLength, radius * shapeDepth);
      tempHairObject.position.set(
        hair.nodePositions[startOffset],
        hair.nodePositions[startOffset + 1],
        hair.nodePositions[startOffset + 2]
      ).addScaledVector(tempHairDirection, renderedLength * 0.5);
    } else {
      const radius = 0.009 * thickness;
      tempHairObject.scale.set(radius * shapeWidth, segmentLength * shapeLength, radius * shapeDepth);
    }
    tempHairObject.updateMatrix();
    mesh.setMatrixAt(instanceIndex, tempHairObject.matrix);
    mesh.setColorAt(instanceIndex, color);
  }

  function updateHair(delta) {
    const activeCount = resolveHairActiveCount(
      settings.hair.density,
      hairReferences.length,
      settings.hair.coverage
    );
    if (!activeCount) return;
    if (!hair.initialized) initializeHair(activeCount);
    root.updateMatrixWorld(true);
    updateBoneWorldPositionCache();
    root.getWorldPosition(tempHairCenter);
    tempHairCenter.y += 1.35;
    const dt = Math.min(delta, 1 / 30);
    const outwardBlend = THREE.MathUtils.clamp(settings.hair.outwardBias, 0, 1);
    const physics = resolveHairPhysicsProfile(
      settings.hair.flexibility,
      settings.hair.weight,
      dt,
      settings.hair.motionResponse
    );
    const {
      velocityRetention,
      gravity,
      springBlend,
      chainStiffnessBlend,
      rootDirectionBlend,
      windResponse,
      kinematicCarry,
      inertialResponse
    } = physics;
    const activeShapeMesh = hair.shapeMeshes[settings.hair.shape] ?? null;
    const wholeStrandShape = WHOLE_STRAND_HAIR_SHAPES.has(settings.hair.shape);
    let shapeInstanceIndex = 0;
    const linePosition = hair.positions;
    const lineColor = hair.colors;
    const tipColor = hair.tips.geometry.attributes.color.array;

    for (let index = 0; index < activeCount; index += 1) {
      const reference = hairReferences[index];
      const lengthScale = resolveHairLengthScale(settings.hair.lengthMode, reference);
      const segmentLength = settings.hair.length * lengthScale / hair.segments;
      reference.source.updateWorldMatrix(true, false);
      readWorldVertex(reference, tempAnchor);
      const rootOffset = index * (hair.segments + 1) * 3;
      const anchorOffset = index * 3;
      const anchorDeltaX = THREE.MathUtils.clamp(
        tempAnchor.x - hair.anchorPrevious[anchorOffset],
        -0.12,
        0.12
      );
      const anchorDeltaY = THREE.MathUtils.clamp(
        tempAnchor.y - hair.anchorPrevious[anchorOffset + 1],
        -0.12,
        0.12
      );
      const anchorDeltaZ = THREE.MathUtils.clamp(
        tempAnchor.z - hair.anchorPrevious[anchorOffset + 2],
        -0.12,
        0.12
      );
      for (let segment = 1; segment <= hair.segments; segment += 1) {
        const offset = rootOffset + segment * 3;
        const tipAmount = segment / hair.segments;
        const carry = kinematicCarry * (1 - tipAmount * 0.58);
        const lag = inertialResponse * tipAmount;
        hair.nodePositions[offset] += anchorDeltaX * carry;
        hair.nodePositions[offset + 1] += anchorDeltaY * carry;
        hair.nodePositions[offset + 2] += anchorDeltaZ * carry;
        // Moving the previous point slightly farther with the root creates a
        // bounded opposite velocity at the tip: real trailing inertia rather
        // than artificial spring oscillation.
        hair.nodePrevious[offset] += anchorDeltaX * (carry + lag);
        hair.nodePrevious[offset + 1] += anchorDeltaY * (carry + lag);
        hair.nodePrevious[offset + 2] += anchorDeltaZ * (carry + lag);
      }
      hair.anchorPrevious[anchorOffset] = tempAnchor.x;
      hair.anchorPrevious[anchorOffset + 1] = tempAnchor.y;
      hair.anchorPrevious[anchorOffset + 2] = tempAnchor.z;
      hair.nodePositions[rootOffset] = tempAnchor.x;
      hair.nodePositions[rootOffset + 1] = tempAnchor.y;
      hair.nodePositions[rootOffset + 2] = tempAnchor.z;

      resolveHairOutwardDirection(reference, tempAnchor, tempHairOutward);
      tempHairDirection.set(0, -1, 0).lerp(tempHairOutward, outwardBlend);
      if (tempHairDirection.lengthSq() < 0.000001) tempHairDirection.copy(tempHairOutward);
      tempHairDirection.normalize();
      tempCore.set(-tempHairDirection.z, 0, tempHairDirection.x);
      if (tempCore.lengthSq() < 0.000001) tempCore.set(1, 0, 0);
      tempCore.normalize();

      for (let segment = 1; segment <= hair.segments; segment += 1) {
        const offset = rootOffset + segment * 3;
        const x = hair.nodePositions[offset];
        const y = hair.nodePositions[offset + 1];
        const z = hair.nodePositions[offset + 2];
        const velocityX = (x - hair.nodePrevious[offset]) * velocityRetention;
        const velocityY = (y - hair.nodePrevious[offset + 1]) * velocityRetention;
        const velocityZ = (z - hair.nodePrevious[offset + 2]) * velocityRetention;
        hair.nodePrevious[offset] = x;
        hair.nodePrevious[offset + 1] = y;
        hair.nodePrevious[offset + 2] = z;
        const phase = reference.seed * 0.71 + segment * 0.57;
        const wind = (0.75 + settings.hair.length * 0.55)
          * Math.sin(elapsedTime * 2.1 + phase)
          * windResponse;
        const curlOffset = Math.sin(phase + segment * 0.86)
          * settings.hair.curl * segmentLength * segment * 0.28;
        tempHairTarget.copy(tempAnchor)
          .addScaledVector(tempHairDirection, segmentLength * segment)
          .addScaledVector(tempCore, curlOffset);
        hair.nodePositions[offset] = x + velocityX + wind * dt * dt
          + (tempHairTarget.x - x) * springBlend;
        hair.nodePositions[offset + 1] = y + velocityY - gravity * dt * dt
          + (tempHairTarget.y - y) * springBlend;
        hair.nodePositions[offset + 2] = z + velocityZ
          + Math.cos(elapsedTime * 1.7 + phase) * 0.08 * dt * dt
          + (tempHairTarget.z - z) * springBlend;
      }

      for (let pass = 0; pass < 4; pass += 1) {
        for (let segment = 1; segment <= hair.segments; segment += 1) {
          const previousOffset = rootOffset + (segment - 1) * 3;
          const offset = rootOffset + segment * 3;
          tempVertex.set(
            hair.nodePositions[offset] - hair.nodePositions[previousOffset],
            hair.nodePositions[offset + 1] - hair.nodePositions[previousOffset + 1],
            hair.nodePositions[offset + 2] - hair.nodePositions[previousOffset + 2]
          );
          if (tempVertex.lengthSq() < 0.0000001) tempVertex.set(0, -1, 0);
          tempVertex.setLength(segmentLength);
          hair.nodePositions[offset] = hair.nodePositions[previousOffset] + tempVertex.x;
          hair.nodePositions[offset + 1] = hair.nodePositions[previousOffset + 1] + tempVertex.y;
          hair.nodePositions[offset + 2] = hair.nodePositions[previousOffset + 2] + tempVertex.z;
          const directionBlend = segment === 1 ? rootDirectionBlend : chainStiffnessBlend;
          if (directionBlend > 0.0001) {
            const curlAmount = Math.sin(reference.seed * 0.71 + segment * 0.86)
              * settings.hair.curl * 0.18;
            tempHairTarget.copy(tempHairDirection).addScaledVector(tempCore, curlAmount).normalize();
            tempHairTarget.multiplyScalar(segmentLength).add(tempVertex.set(
              hair.nodePositions[previousOffset],
              hair.nodePositions[previousOffset + 1],
              hair.nodePositions[previousOffset + 2]
            ));
            hair.nodePositions[offset] = THREE.MathUtils.lerp(hair.nodePositions[offset], tempHairTarget.x, directionBlend);
            hair.nodePositions[offset + 1] = THREE.MathUtils.lerp(hair.nodePositions[offset + 1], tempHairTarget.y, directionBlend);
            hair.nodePositions[offset + 2] = THREE.MathUtils.lerp(hair.nodePositions[offset + 2], tempHairTarget.z, directionBlend);
          }
        }
      }

      for (let segment = 0; segment <= hair.segments; segment += 1) {
        const nodeOffset = rootOffset + segment * 3;
        const heightAmount = (hair.nodePositions[nodeOffset + 1] - (root.position?.y ?? 0)) / 3;
        resolveAvatarEffectColor(tempColorA, settings.hair.pattern, heightAmount, reference.seed + segment * 0.1, settings.hair.colors);
        tipColor[nodeOffset] = tempColorA.r;
        tipColor[nodeOffset + 1] = tempColorA.g;
        tipColor[nodeOffset + 2] = tempColorA.b;
        if (segment === hair.segments) continue;
        const lineOffset = (index * hair.segments + segment) * 6;
        linePosition.set(hair.nodePositions.subarray(nodeOffset, nodeOffset + 3), lineOffset);
        linePosition.set(hair.nodePositions.subarray(nodeOffset + 3, nodeOffset + 6), lineOffset + 3);
        lineColor.set([tempColorA.r, tempColorA.g, tempColorA.b], lineOffset);
        resolveAvatarEffectColor(tempColorA, settings.hair.pattern, heightAmount, reference.seed + (segment + 1) * 0.1, settings.hair.colors);
        lineColor.set([tempColorA.r, tempColorA.g, tempColorA.b], lineOffset + 3);
        if (activeShapeMesh && !wholeStrandShape && lengthScale > 0.001) {
          tempHairColor.setRGB(
            (lineColor[lineOffset] + lineColor[lineOffset + 3]) * 0.5,
            (lineColor[lineOffset + 1] + lineColor[lineOffset + 4]) * 0.5,
            (lineColor[lineOffset + 2] + lineColor[lineOffset + 5]) * 0.5
          );
          setHairShapeInstance(
            activeShapeMesh,
            shapeInstanceIndex,
            nodeOffset,
            nodeOffset + 3,
            settings.hair.thickness * (settings.hair.coverage === 'full' ? 1.45 : 1),
            tempHairColor
          );
          shapeInstanceIndex += 1;
        }
      }
      if (activeShapeMesh && wholeStrandShape && lengthScale > 0.001) {
        setHairShapeInstance(
          activeShapeMesh,
          shapeInstanceIndex,
          rootOffset,
          rootOffset + hair.segments * 3,
          settings.hair.thickness * (settings.hair.coverage === 'full' ? 1.45 : 1),
          tempColorA
        );
        shapeInstanceIndex += 1;
      }
    }
    hair.lines.geometry.setDrawRange(0, activeCount * hair.segments * 2);
    hair.tips.geometry.setDrawRange(0, activeCount * (hair.segments + 1));
    hair.lines.geometry.attributes.position.needsUpdate = true;
    hair.lines.geometry.attributes.color.needsUpdate = true;
    hair.tips.geometry.attributes.position.needsUpdate = true;
    hair.tips.geometry.attributes.color.needsUpdate = true;
    for (const mesh of Object.values(hair.shapeMeshes)) {
      mesh.count = mesh === activeShapeMesh ? shapeInstanceIndex : 0;
      if (mesh === activeShapeMesh) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    }
  }

  function updateInterior(delta) {
    const activeCount = Math.min(interiorReferences.length, Math.round(settings.interior.density));
    if (!activeCount) return;
    root.updateMatrixWorld(true);
    updateBoneWorldPositionCache();
    for (let index = 0; index < activeCount; index += 1) {
      const reference = interiorReferences[index];
      reference.source.updateWorldMatrix(true, false);
      readWorldVertex(reference, tempAnchor);
      const phase = interior.phases[index];
      const depth = resolveInteriorParticleDepth(
        interior.depths[index],
        elapsedTime,
        settings.interior.flow,
        settings.interior.turbulence,
        phase
      );
      tempCore.set(0, 0, 0);
      let totalWeight = 0;
      for (const influence of reference.boneInfluences ?? []) {
        const bonePosition = boneWorldPositions.get(influence.bone);
        if (!bonePosition) continue;
        tempCore.addScaledVector(bonePosition, influence.weight);
        totalWeight += influence.weight;
      }
      if (totalWeight > 0.0001) tempCore.multiplyScalar(1 / totalWeight);
      else reference.source.getWorldPosition(tempCore);
      resolveInteriorParticlePosition(tempVertex, tempCore, tempAnchor, depth);
      const offset = index * 3;
      interior.positions[offset] = tempVertex.x;
      interior.positions[offset + 1] = tempVertex.y;
      interior.positions[offset + 2] = tempVertex.z;
      const heightAmount = (interior.positions[offset + 1] - (root.position?.y ?? 0)) / 3;
      resolveAvatarEffectColor(tempColorA, settings.interior.pattern, heightAmount, reference.seed, settings.interior.colors);
      interior.colors[offset] = tempColorA.r;
      interior.colors[offset + 1] = tempColorA.g;
      interior.colors[offset + 2] = tempColorA.b;
    }
    interior.points.geometry.setDrawRange(0, activeCount);
    interior.points.geometry.attributes.position.needsUpdate = true;
    interior.points.geometry.attributes.color.needsUpdate = true;
  }

  function captureDotSculpture(reusableSnapshot = null) {
    const count = Math.min(sculptureReferences.length, Math.round(settings.sculpture.density));
    if (!count) return null;
    root.updateMatrixWorld(true);
    const canReuse = reusableSnapshot?.kind === 'dots'
      && reusableSnapshot.geometries[0]?.attributes?.position?.count === count;
    const geometry = canReuse ? reusableSnapshot.geometries[0] : new THREE.BufferGeometry();
    const positions = canReuse
      ? geometry.attributes.position.array
      : new Float32Array(count * 3);
    const colors = canReuse
      ? geometry.attributes.color.array
      : new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const reference = sculptureReferences[index];
      reference.source.updateWorldMatrix(true, false);
      readWorldVertex(reference, tempVertex);
      const offset = index * 3;
      positions[offset] = tempVertex.x;
      positions[offset + 1] = tempVertex.y;
      positions[offset + 2] = tempVertex.z;
      setGradientColor(tempColorA, index / Math.max(1, count - 1), settings.sculpture.colors);
      colors[offset] = tempColorA.r;
      colors[offset + 1] = tempColorA.g;
      colors[offset + 2] = tempColorA.b;
    }
    if (canReuse) {
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      reusableSnapshot.age = 0;
      reusableSnapshot.baseOpacity = settings.sculpture.opacity;
      reusableSnapshot.materials[0].size = 0.01 * settings.sculpture.size;
      setSnapshotOpacity(reusableSnapshot, reusableSnapshot.baseOpacity);
      return reusableSnapshot;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
    const material = createSnapshotMaterial(settings.sculpture.size, settings.sculpture.opacity);
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = 10;
    return {
      kind: 'dots',
      object: points,
      geometries: [geometry],
      materials: [material],
      materialOpacityScales: [1],
      age: 0,
      baseOpacity: settings.sculpture.opacity
    };
  }

  function captureSurfaceSculpture(reusableSnapshot = null) {
    root.updateMatrixWorld(true);
    const canReuse = reusableSnapshot?.kind === 'surface'
      && reusableSnapshot.sourceIndices?.length === reusableSnapshot.geometries.length
      && reusableSnapshot.sourceIndices.every((sourceIndex, index) => {
        const source = sourceMeshes[sourceIndex]?.source;
        return source?.geometry?.attributes?.position?.count
          === reusableSnapshot.geometries[index]?.attributes?.position?.count;
      });
    if (canReuse) {
      reusableSnapshot.sourceIndices.forEach((sourceIndex, index) => {
        updateAvatarSurfaceGeometry(sourceMeshes[sourceIndex].source, reusableSnapshot.geometries[index]);
      });
      reusableSnapshot.age = 0;
      reusableSnapshot.baseOpacity = settings.sculpture.opacity;
      setSnapshotOpacity(reusableSnapshot, reusableSnapshot.baseOpacity);
      return reusableSnapshot;
    }
    const snapshotGroup = new THREE.Group();
    const geometries = [];
    const materials = [];
    const materialSources = [];
    const materialOpacityScales = [];
    const sourceIndices = [];
    for (let sourceIndex = 0; sourceIndex < sourceMeshes.length; sourceIndex += 1) {
      const { source } = sourceMeshes[sourceIndex];
      const geometry = bakeAvatarSurfaceGeometry(source);
      if (!geometry.attributes.position?.count) {
        geometry.dispose();
        continue;
      }
      const sourceMaterials = Array.isArray(source.material) ? source.material : [source.material];
      const meshMaterials = (sourceMaterials.length ? sourceMaterials : [null])
        .map((sourceMaterial) => createSurfaceSnapshotMaterial(sourceMaterial, settings.sculpture.opacity));
      const mesh = new THREE.Mesh(geometry, Array.isArray(source.material) ? meshMaterials : meshMaterials[0]);
      mesh.frustumCulled = false;
      mesh.renderOrder = 9;
      snapshotGroup.add(mesh);
      geometries.push(geometry);
      sourceIndices.push(sourceIndex);
      for (let materialIndex = 0; materialIndex < meshMaterials.length; materialIndex += 1) {
        const material = meshMaterials[materialIndex];
        materials.push(material);
        materialSources.push(sourceMaterials[materialIndex] ?? null);
        materialOpacityScales.push(1);
      }
    }
    if (!snapshotGroup.children.length) return null;
    return {
      kind: 'surface',
      object: snapshotGroup,
      geometries,
      sourceIndices,
      materials,
      materialSources,
      materialOpacityScales,
      age: 0,
      baseOpacity: settings.sculpture.opacity
    };
  }

  function setSnapshotOpacity(snapshot, opacity) {
    snapshot.materials.forEach((material, index) => {
      material.opacity = (snapshot.materialOpacityScales[index] ?? 1) * opacity;
    });
  }

  function applySculptureRetention(snapshot, lifetime) {
    if (!Number.isFinite(lifetime)) {
      snapshot.object.visible = true;
      setSnapshotOpacity(snapshot, snapshot.baseOpacity);
      return;
    }
    if (snapshot.age >= lifetime) {
      snapshot.object.visible = false;
      setSnapshotOpacity(snapshot, 0);
      return;
    }
    snapshot.object.visible = true;
    const fade = THREE.MathUtils.smoothstep(lifetime - snapshot.age, 0, lifetime * 0.72);
    setSnapshotOpacity(snapshot, snapshot.baseOpacity * fade);
  }

  function applySculptureRetentionToAll() {
    const lifetime = SCULPTURE_RETENTION_SECONDS[settings.sculpture.retention];
    for (const snapshot of sculptures) applySculptureRetention(snapshot, lifetime);
  }

  function getSculptureHistoryLimit() {
    return settings.sculpture.form === 'surface'
      ? Math.min(180, maxPermanentSculptures)
      : maxPermanentSculptures;
  }

  function getSculptureCaptureLimit(permanent = settings.sculpture.retention === 'permanent') {
    if (permanent) return getSculptureHistoryLimit();
    return settings.sculpture.form === 'surface'
      ? Math.min(48, maxSculptures)
      : maxSculptures;
  }

  function captureSculpture({ playbackTime = 0, playbackDuration = 0 } = {}) {
    const permanent = settings.sculpture.retention === 'permanent';
    const historyLimit = getSculptureHistoryLimit();
    let permanentSlot = null;
    if (permanent) {
      if (playbackDuration > 0) {
        const permanentSlotDuration = playbackDuration / Math.max(1, historyLimit);
        permanentSlot = Math.min(
          historyLimit - 1,
          Math.max(0, Math.floor(playbackTime / Math.max(0.0001, permanentSlotDuration)))
        );
        if (permanentSculptureSlots.has(permanentSlot)) return false;
      }
      // A permanent layer is never recycled. Once all full-loop slots are
      // occupied, the complete sculpture stays intact until explicitly cleared.
      if (sculptures.length >= historyLimit) return false;
    }
    const reusableSnapshot = !permanent && sculptures.length >= historyLimit
      ? sculptures.shift()
      : null;
    if (reusableSnapshot) {
      sculptureGroup.remove(reusableSnapshot.object);
      if (reusableSnapshot.permanentSlot != null) {
        permanentSculptureSlots.delete(reusableSnapshot.permanentSlot);
      }
    }
    const snapshot = settings.sculpture.form === 'surface'
      ? captureSurfaceSculpture(reusableSnapshot)
      : captureDotSculpture(reusableSnapshot);
    if (reusableSnapshot && snapshot !== reusableSnapshot) disposeSculptureSnapshot(reusableSnapshot);
    if (!snapshot) return false;
    snapshot.permanentSlot = permanentSlot;
    snapshot.object.visible = true;
    sculptureGroup.add(snapshot.object);
    sculptures.push(snapshot);
    if (permanentSlot !== null) permanentSculptureSlots.add(permanentSlot);
    while (sculptures.length > historyLimit) removeSculpture(sculptures[0]);
    return true;
  }

  function disposeSculptureSnapshot(snapshot) {
    snapshot.geometries.forEach((geometry) => geometry.dispose());
    snapshot.materials.forEach((material) => disposeMaterial(material));
  }

  function removeSculpture(snapshot) {
    const index = sculptures.indexOf(snapshot);
    if (index >= 0) sculptures.splice(index, 1);
    if (snapshot.permanentSlot != null) permanentSculptureSlots.delete(snapshot.permanentSlot);
    sculptureGroup.remove(snapshot.object);
    disposeSculptureSnapshot(snapshot);
  }

  function clearSculpture() {
    while (sculptures.length) removeSculpture(sculptures[0]);
    sculptureElapsed = 0;
    sculptureCaptureCost = 0;
    permanentSculptureSlots.clear();
  }

  function updateSculpture(delta, playback = {}) {
    sculptureElapsed += delta;
    const lifetime = SCULPTURE_RETENTION_SECONDS[settings.sculpture.retention];
    const captureLimit = getSculptureCaptureLimit(!Number.isFinite(lifetime));
    const playbackDuration = Math.max(0, Number(playback.duration) || 0);
    const playbackTime = playbackDuration > 0
      ? THREE.MathUtils.euclideanModulo(Number(playback.currentTime) || 0, playbackDuration)
      : Math.max(0, Number(playback.currentTime) || 0);
    const captureInterval = resolveSculptureCaptureInterval(
      settings.sculpture.interval,
      settings.sculpture.form,
      sculptureCaptureCost,
      lifetime,
      playbackDuration,
      captureLimit
    );
    if (sculptureElapsed >= captureInterval) {
      sculptureElapsed %= captureInterval;
      const captureStarted = globalThis.performance?.now?.() ?? Date.now();
      captureSculpture({ playbackTime, playbackDuration });
      const captureFinished = globalThis.performance?.now?.() ?? Date.now();
      const captureCost = Math.max(0, (captureFinished - captureStarted) / 1000);
      sculptureCaptureCost = sculptureCaptureCost
        ? sculptureCaptureCost * 0.82 + captureCost * 0.18
        : captureCost;
    }
    for (const snapshot of sculptures) {
      snapshot.age += delta;
      applySculptureRetention(snapshot, lifetime);
    }
  }

  function update(delta, playback = {}) {
    if (!root || mode === 'off') return;
    elapsedTime += Math.min(delta, 0.08);
    if (mode === 'hair') updateHair(delta);
    else if (mode === 'interior') updateInterior(delta);
    else if (mode === 'sculpture') updateSculpture(delta, playback);
  }

  function dispose() {
    clearSculpture();
    hair.lines.geometry.dispose();
    hair.tips.geometry.dispose();
    disposeMaterial(hair.lines.material);
    disposeMaterial(hair.tips.material);
    for (const mesh of Object.values(hair.shapeMeshes)) {
      mesh.geometry.dispose();
      disposeMaterial(mesh.material);
    }
    interior.points.geometry.dispose();
    disposeMaterial(interior.points.material);
    group.remove(hair.group, interior.points, sculptureGroup);
    root = null;
    sourceMeshes = [];
    boneWorldPositions.clear();
  }

  setSettings(settings);
  updateVisibility();
  return {
    group,
    setRoot,
    setMode,
    setSettings,
    syncSurfaceAppearance,
    update,
    clearSculpture,
    dispose,
    getMode: () => mode,
    getSettings: () => sanitizeAvatarEffectSettings(settings),
    hidesAvatarBody: () => mode === 'interior' || (mode === 'hair' && settings.hair.coverage === 'full'),
    getDebugState: () => ({
      mode,
      hairCoverage: settings.hair.coverage,
      hairLighting: settings.hair.lighting,
      hairShape: settings.hair.shape,
      hairGrowthPattern: settings.hair.growthPattern,
      hairDistribution: settings.hair.distribution,
      hairLengthMode: settings.hair.lengthMode,
      hairOutwardBias: settings.hair.outwardBias,
      hairReferenceCount: hairReferences.length,
      hairLeftReferences: hairReferences.filter((reference) => getHairReferenceSide(reference) === 'left').length,
      hairRightReferences: hairReferences.filter((reference) => getHairReferenceSide(reference) === 'right').length,
      hairHeadReferences: hairReferences.filter((reference) => reference.isHead).length,
      hairHandReferences: hairReferences.filter((reference) => reference.isHand).length,
      hairStrands: resolveHairActiveCount(settings.hair.density, hairReferences.length, settings.hair.coverage),
      interiorParticles: Math.min(interiorReferences.length, Math.round(settings.interior.density)),
      sculptureForm: settings.sculpture.form,
      sculptureRetention: settings.sculpture.retention,
      sculptureCount: sculptures.length,
      sculptureVisibleCount: sculptures.filter((snapshot) => snapshot.object.visible).length,
      sculptureHiddenCount: sculptures.filter((snapshot) => !snapshot.object.visible).length,
      sculpturePermanentSlots: permanentSculptureSlots.size,
      sculptureCaptureInterval: resolveSculptureCaptureInterval(
        settings.sculpture.interval,
        settings.sculpture.form,
        sculptureCaptureCost,
        SCULPTURE_RETENTION_SECONDS[settings.sculpture.retention],
        0,
        getSculptureCaptureLimit()
      ),
      sculptureCaptureCost
    })
  };
}
