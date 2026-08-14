import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  AVATAR_EFFECT_MODES,
  HAIR_COVERAGE_OPTIONS,
  HAIR_DIRECTION_OPTIONS,
  HAIR_DISTRIBUTION_OPTIONS,
  HAIR_GROWTH_PATTERN_OPTIONS,
  HAIR_GROWTH_PATTERN_SETTINGS,
  HAIR_LENGTH_MODE_OPTIONS,
  HAIR_LIGHTING_OPTIONS,
  HAIR_SHAPE_OPTIONS,
  SCULPTURE_FORM_OPTIONS,
  SCULPTURE_RETENTION_OPTIONS,
  bakeAvatarSurfaceGeometry,
  createAvatarEffects,
  updateAvatarSurfaceGeometry,
  createDefaultAvatarEffectSettings,
  isHairScalpReference,
  resolveAvatarEffectColor,
  resolveHairActiveCount,
  resolveHairGrowthPattern,
  resolveHairLengthScale,
  resolveHairPhysicsProfile,
  resolveInteriorParticleDepth,
  resolveInteriorParticlePosition,
  resolveSculptureCaptureInterval,
  sanitizeAvatarEffectSettings,
  syncSurfaceSnapshotMaterial
} from '../src/avatar-effects.js';
import { readViewStateFromParams, writeViewStateToParams } from '../src/view-url.js';

test('avatar effect defaults expose all three generative modes', () => {
  assert.deepEqual(AVATAR_EFFECT_MODES, ['off', 'hair', 'interior', 'sculpture']);
  assert.deepEqual(HAIR_COVERAGE_OPTIONS, ['open', 'full']);
  assert.deepEqual(HAIR_LIGHTING_OPTIONS, ['scene', 'flat']);
  assert.deepEqual(HAIR_DIRECTION_OPTIONS, ['flow', 'outward']);
  assert.deepEqual(
    HAIR_SHAPE_OPTIONS,
    ['line', 'ribbon', 'rod', 'tuft', 'sphere', 'triangle', 'circle', 'oval', 'spike']
  );
  assert.deepEqual(
    HAIR_DISTRIBUTION_OPTIONS,
    ['current', 'uniform', 'clusters', 'bands', 'asymmetric']
  );
  assert.deepEqual(
    HAIR_LENGTH_MODE_OPTIONS,
    ['uniform', 'extremities', 'head', 'topGradient', 'random', 'alternating']
  );
  assert.deepEqual(
    HAIR_GROWTH_PATTERN_OPTIONS,
    [
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
    ]
  );
  assert.deepEqual(
    HAIR_GROWTH_PATTERN_SETTINGS.headHands,
    {
      distribution: 'uniform',
      lengthMode: 'uniform',
      region: 'headHands',
      symmetrical: true
    }
  );
  assert.deepEqual(SCULPTURE_FORM_OPTIONS, ['dots', 'surface']);
  assert.deepEqual(
    SCULPTURE_RETENTION_OPTIONS,
    ['permanent', 'minute', 'extended', 'long', 'medium', 'short']
  );
  const defaults = createDefaultAvatarEffectSettings();
  assert.equal(defaults.hair.length, 0.34);
  assert.equal(defaults.hair.coverage, 'open');
  assert.equal(defaults.hair.lighting, 'scene');
  assert.equal(defaults.hair.shape, 'line');
  assert.equal(defaults.hair.shapeWidth, 1);
  assert.equal(defaults.hair.shapeLength, 1);
  assert.equal(defaults.hair.shapeDepth, 1);
  assert.equal(defaults.hair.growthPattern, 'organic');
  assert.equal(defaults.hair.distribution, 'current');
  assert.equal(defaults.hair.lengthMode, 'uniform');
  assert.equal(defaults.hair.outwardBias, 0);
  assert.equal(defaults.hair.flexibility, 0.68);
  assert.equal('stiffness' in defaults.hair, false);
  assert.equal(defaults.interior.density, 4400);
  assert.equal(defaults.sculpture.retention, 'long');
  assert.equal(defaults.sculpture.form, 'dots');
  assert.equal(defaults.sculpture.interval, 0.05);
});

test('avatar effect settings sanitize ranges, patterns, retention, and colors', () => {
  const sanitized = sanitizeAvatarEffectSettings({
    hair: {
      length: 99,
      shapeWidth: 99,
      shapeLength: -4,
      shapeDepth: 2.4,
      density: -10,
      flexibility: 99,
      motionResponse: -2,
      curl: 7,
      coverage: 'full',
      lighting: 'flat',
      shape: 'ribbon',
      distribution: 'bands',
      lengthMode: 'head',
      outwardBias: 0.72,
      pattern: 'invalid',
      colors: ['#ABCDEF', 'bad', '#010203']
    },
    interior: { opacity: -1, density: 99999, pattern: 'polkadot' },
    sculpture: { interval: 0, retention: 'invalid', opacity: 4, form: 'surface' }
  });
  assert.equal(sanitized.hair.length, 1.2);
  assert.equal(sanitized.hair.shapeWidth, 3);
  assert.equal(sanitized.hair.shapeLength, 0.25);
  assert.equal(sanitized.hair.shapeDepth, 2.4);
  assert.equal(sanitized.hair.density, 60);
  assert.equal(sanitized.hair.pattern, 'gradient');
  assert.equal(sanitized.hair.coverage, 'full');
  assert.equal(sanitized.hair.lighting, 'flat');
  assert.equal(sanitized.hair.shape, 'ribbon');
  assert.equal(sanitized.hair.growthPattern, 'custom');
  assert.equal(sanitized.hair.distribution, 'bands');
  assert.equal(sanitized.hair.lengthMode, 'head');
  assert.equal(sanitized.hair.outwardBias, 0.72);
  assert.equal(sanitized.hair.flexibility, 1);
  assert.equal(sanitized.hair.motionResponse, 0);
  assert.equal(sanitized.hair.curl, 2);
  assert.deepEqual(sanitized.hair.colors, ['#abcdef', '#f7f8ff', '#010203']);
  assert.equal(sanitized.interior.opacity, 0.05);
  assert.equal(sanitized.interior.density, 6000);
  assert.equal(sanitized.interior.pattern, 'polkadot');
  assert.equal(sanitized.sculpture.interval, 0.001);
  assert.equal(sanitized.sculpture.retention, 'long');
  assert.equal(sanitized.sculpture.opacity, 0.8);
  assert.equal(sanitized.sculpture.form, 'surface');
  assert.equal(
    sanitizeAvatarEffectSettings({ hair: { direction: 'outward' } }).hair.outwardBias,
    1
  );
  assert.ok(
    Math.abs(sanitizeAvatarEffectSettings({ hair: { stiffness: 0.9 } }).hair.flexibility - 0.1) < 1e-9
  );
  const preset = sanitizeAvatarEffectSettings({
    hair: { growthPattern: 'headCrown', distribution: 'current', lengthMode: 'uniform' }
  });
  assert.equal(preset.hair.growthPattern, 'headCrown');
  assert.equal(preset.hair.distribution, 'uniform');
  assert.equal(preset.hair.lengthMode, 'head');
});

test('combined hair growth presets resolve distribution and length together', () => {
  assert.deepEqual(
    resolveHairGrowthPattern('uniform'),
    {
      key: 'uniform',
      distribution: 'uniform',
      lengthMode: 'uniform',
      region: 'all',
      symmetrical: true
    }
  );
  assert.deepEqual(
    resolveHairGrowthPattern('headHands'),
    {
      key: 'headHands',
      distribution: 'uniform',
      lengthMode: 'uniform',
      region: 'headHands',
      symmetrical: true
    }
  );
  assert.deepEqual(
    resolveHairGrowthPattern('unknown'),
    {
      key: 'organic',
      distribution: 'current',
      lengthMode: 'uniform',
      region: 'all',
      symmetrical: false
    }
  );
  assert.deepEqual(
    resolveHairGrowthPattern('clusteredTufts'),
    {
      key: 'clusteredTufts',
      distribution: 'clusters',
      lengthMode: 'random',
      region: 'all',
      symmetrical: false
    }
  );
});

test('Head Only uses a scalp cap and excludes neck-weighted vertices', () => {
  assert.equal(isHairScalpReference(0.93, ['mixamorigHead']), true);
  assert.equal(isHairScalpReference(0.93, ['mixamorigNeck']), false);
  assert.equal(isHairScalpReference(0.95, ['mixamorigHead', 'mixamorigNeck']), false);
  assert.equal(isHairScalpReference(0.87, ['mixamorigHead']), false);
  assert.equal(isHairScalpReference(0.93, []), true);
  assert.equal(isHairScalpReference(0.9, []), false);
});

test('symmetrical growth presets maintain balanced left and right anchor counts', () => {
  const root = new THREE.Group();
  const sourceGeometry = new THREE.BoxGeometry(2, 4, 1);
  const sourceMaterial = new THREE.MeshStandardMaterial();
  root.add(new THREE.Mesh(sourceGeometry, sourceMaterial));
  const effects = createAvatarEffects({
    maxHairStrands: 40,
    hairSegments: 1,
    maxInteriorParticles: 1
  });
  effects.setRoot(root);
  const settings = createDefaultAvatarEffectSettings();
  settings.hair.growthPattern = 'uniform';
  settings.hair.distribution = 'uniform';
  settings.hair.lengthMode = 'uniform';
  effects.setSettings(settings);
  const debug = effects.getDebugState();
  assert.equal(debug.hairGrowthPattern, 'uniform');
  assert.equal(debug.hairReferenceCount, 40);
  assert.equal(debug.hairLeftReferences, debug.hairRightReferences);
  effects.dispose();
  sourceGeometry.dispose();
  sourceMaterial.dispose();
});

test('hair length profiles create deterministic body-aware variation', () => {
  assert.equal(resolveHairLengthScale('uniform'), 1);
  assert.equal(resolveHairLengthScale('head', { isHead: false }), 0);
  assert.equal(resolveHairLengthScale('head', { isHead: true }), 1.65);
  assert.ok(
    resolveHairLengthScale('extremities', { normalizedHeight: 1, normalizedRadius: 1 })
      > resolveHairLengthScale('extremities', { normalizedHeight: 0.5, normalizedRadius: 0.1 })
  );
  assert.ok(
    resolveHairLengthScale('topGradient', { normalizedHeight: 0.95 })
      > resolveHairLengthScale('topGradient', { normalizedHeight: 0.05 })
  );
  const randomA = resolveHairLengthScale('random', { seed: 41 });
  const randomB = resolveHairLengthScale('random', { seed: 41 });
  assert.equal(randomA, randomB);
  assert.ok(randomA >= 0.18 && randomA <= 1.9);
  const wave = resolveHairLengthScale('alternating', { seed: 8, normalizedHeight: 0.5 });
  assert.ok(wave >= 0.2 && wave <= 1.75);
});

test('hair flexibility remains independent from radial outward direction', () => {
  const firm = resolveHairPhysicsProfile(0, 1, 1 / 60);
  const soft = resolveHairPhysicsProfile(1, 1, 1 / 60);
  assert.ok(soft.velocityRetention > firm.velocityRetention);
  assert.ok(soft.springBlend < firm.springBlend);
  assert.ok(soft.chainStiffnessBlend < firm.chainStiffnessBlend);
  assert.equal(soft.rootDirectionBlend, 0);
  assert.equal(soft.chainStiffnessBlend, 0);
  assert.ok(soft.kinematicCarry < firm.kinematicCarry);
  assert.ok(soft.inertialResponse > firm.inertialResponse);
  assert.equal(soft.gravity, firm.gravity);
});

test('highly flexible hair can bend at its base independently of outward direction', () => {
  const almostFullyFlexible = resolveHairPhysicsProfile(0.92, 2.5, 1 / 60, 2);
  assert.ok(almostFullyFlexible.rootDirectionBlend < 0.002);
  assert.ok(almostFullyFlexible.chainStiffnessBlend < 0.001);
  assert.ok(almostFullyFlexible.springBlend < 0.001);
  assert.ok(almostFullyFlexible.inertialResponse > 1);
});

test('hair weight adds sag and drag without making flexible strands stiff or springy', () => {
  const lightSoft = resolveHairPhysicsProfile(0.85, 0.2, 1 / 60, 0);
  const heavySoft = resolveHairPhysicsProfile(0.85, 2.4, 1 / 60, 0);
  const heavyStructured = resolveHairPhysicsProfile(0.15, 2.4, 1 / 60, 0);
  assert.ok(heavySoft.gravity > lightSoft.gravity);
  assert.ok(heavySoft.velocityRetention < lightSoft.velocityRetention);
  assert.equal(heavySoft.chainStiffnessBlend, lightSoft.chainStiffnessBlend);
  assert.equal(heavySoft.rootDirectionBlend, lightSoft.rootDirectionBlend);
  assert.ok(heavySoft.velocityRetention < 0.9);
  assert.ok(heavyStructured.springBlend > heavySoft.springBlend);
  assert.ok(heavySoft.kinematicCarry > 0);
  assert.equal(heavySoft.inertialResponse, lightSoft.inertialResponse);
});

test('flexible hair converts body response into trailing inertia instead of rigid transport', () => {
  const quiet = resolveHairPhysicsProfile(1, 0.15, 1 / 60, 0);
  const responsive = resolveHairPhysicsProfile(1, 0.15, 1 / 60, 2);
  assert.equal(quiet.inertialResponse, 0);
  assert.ok(responsive.inertialResponse > 1);
  assert.ok(responsive.kinematicCarry < 0.2);
  assert.ok(responsive.velocityRetention > 0.95);
  assert.ok(responsive.springBlend < 0.002);
});

test('hair damping and restoration remain stable across common frame rates', () => {
  const sixtyFps = resolveHairPhysicsProfile(0.68, 1, 1 / 60, 0.65);
  const thirtyFps = resolveHairPhysicsProfile(0.68, 1, 1 / 30, 0.65);
  assert.ok(Math.abs(thirtyFps.velocityRetention - sixtyFps.velocityRetention ** 2) < 1e-9);
  assert.ok(
    Math.abs(thirtyFps.springBlend - (1 - (1 - sixtyFps.springBlend) ** 2)) < 1e-9
  );
  assert.ok(
    Math.abs(thirtyFps.chainStiffnessBlend - (1 - (1 - sixtyFps.chainStiffnessBlend) ** 2)) < 1e-9
  );
  assert.ok(sixtyFps.kinematicCarry > 0);
  assert.ok(sixtyFps.inertialResponse > 0);
});

test('motion sculpture cadence supports faster capture with adaptive surface budgeting', () => {
  assert.equal(resolveSculptureCaptureInterval(0.001, 'dots', 0.2), 0.001);
  assert.equal(resolveSculptureCaptureInterval(0.001, 'surface', 0), 0.001);
  assert.equal(resolveSculptureCaptureInterval(0.001, 'surface', 0.03), 0.12);
  assert.equal(resolveSculptureCaptureInterval(0.001, 'surface', 0.2), 0.24);
  assert.equal(resolveSculptureCaptureInterval(0.1, 'surface', 0.02), 0.1);
  assert.equal(resolveSculptureCaptureInterval(5, 'dots', 0), 0.1);
  assert.equal(resolveSculptureCaptureInterval(0.001, 'surface', 0, 60, 0, 48), 0.001);
  assert.equal(resolveSculptureCaptureInterval(0.1, 'surface', 0, 60, 0, 48), 0.1);
  assert.equal(resolveSculptureCaptureInterval(0.001, 'surface', 0, Infinity, 36, 180), 0.001);
});

test('decreasing capture interval creates more retained surface layers', () => {
  const root = new THREE.Group();
  const sourceGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sourceMaterial = new THREE.MeshStandardMaterial();
  root.add(new THREE.Mesh(sourceGeometry, sourceMaterial));
  const effects = createAvatarEffects({
    maxHairStrands: 1,
    hairSegments: 1,
    maxInteriorParticles: 1,
    maxSculptures: 40,
    maxPermanentSculptures: 40
  });
  effects.setRoot(root);
  const settings = createDefaultAvatarEffectSettings();
  settings.sculpture.form = 'surface';
  settings.sculpture.retention = 'minute';
  settings.sculpture.interval = 0.1;
  effects.setSettings(settings);
  effects.setMode('sculpture');
  for (let frame = 0; frame < 30; frame += 1) effects.update(1 / 60);
  const slowLayerCount = effects.getDebugState().sculptureCount;

  effects.clearSculpture();
  settings.sculpture.interval = 0.001;
  effects.setSettings(settings);
  effects.setMode('sculpture');
  for (let frame = 0; frame < 30; frame += 1) effects.update(1 / 60);
  const fastLayerCount = effects.getDebugState().sculptureCount;

  assert.ok(fastLayerCount > slowLayerCount * 3);
  effects.dispose();
  sourceGeometry.dispose();
  sourceMaterial.dispose();
});

test('body surface snapshots update their existing geometry buffers in place', () => {
  const sourceGeometry = new THREE.BoxGeometry(1, 1, 1);
  const source = new THREE.Mesh(sourceGeometry, new THREE.MeshStandardMaterial());
  source.position.set(0, 0, 0);
  source.updateMatrixWorld(true);
  const baked = bakeAvatarSurfaceGeometry(source);
  const positionAttribute = baked.getAttribute('position');
  const before = positionAttribute.array[0];
  source.position.x = 2;
  source.updateMatrixWorld(true);
  updateAvatarSurfaceGeometry(source, baked);
  assert.equal(baked.getAttribute('position'), positionAttribute);
  assert.ok(Math.abs(positionAttribute.array[0] - before - 2) < 1e-6);
  baked.dispose();
  sourceGeometry.dispose();
  source.material.dispose();
});

test('motion sculpture surfaces retain and refresh the main avatar material treatment', () => {
  const root = new THREE.Group();
  const sourceGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sourceMaterial = new THREE.MeshStandardMaterial({
    color: '#29a9ff',
    roughness: 0.38,
    metalness: 0.14,
    emissive: '#071012',
    emissiveIntensity: 0.18
  });
  const firstShaderHook = () => {};
  sourceMaterial.onBeforeCompile = firstShaderHook;
  sourceMaterial.customProgramCacheKey = () => 'avatar-gradient-v1';
  sourceMaterial.stencilWrite = true;
  root.add(new THREE.Mesh(sourceGeometry, sourceMaterial));

  const effects = createAvatarEffects({
    maxHairStrands: 1,
    hairSegments: 1,
    maxInteriorParticles: 1,
    maxSculptures: 4,
    maxPermanentSculptures: 4
  });
  effects.setRoot(root);
  const settings = createDefaultAvatarEffectSettings();
  settings.sculpture.form = 'surface';
  settings.sculpture.interval = 0.001;
  settings.sculpture.opacity = 0.31;
  settings.sculpture.retention = 'permanent';
  effects.setSettings(settings);
  effects.setMode('sculpture');
  effects.update(0.1, { currentTime: 0.1, duration: 4 });

  const sculptureGroup = effects.group.getObjectByName('CyberSubinMotionSculpture');
  const captureMaterial = sculptureGroup.children[0].children[0].material;
  assert.equal(captureMaterial.color.getHexString(), '29a9ff');
  assert.equal(captureMaterial.roughness, 0.38);
  assert.equal(captureMaterial.metalness, 0.14);
  assert.equal(captureMaterial.onBeforeCompile, firstShaderHook);
  assert.equal(captureMaterial.customProgramCacheKey(), 'avatar-gradient-v1');
  assert.equal(captureMaterial.opacity, 0.31);
  assert.equal(captureMaterial.depthWrite, false);
  assert.equal(captureMaterial.stencilWrite, false);

  const secondShaderHook = () => {};
  sourceMaterial.color.set('#ff5e57');
  sourceMaterial.roughness = 0.96;
  sourceMaterial.metalness = 0.01;
  sourceMaterial.flatShading = true;
  sourceMaterial.onBeforeCompile = secondShaderHook;
  sourceMaterial.customProgramCacheKey = () => 'avatar-gradient-v2';
  effects.syncSurfaceAppearance();

  assert.equal(captureMaterial.color.getHexString(), 'ff5e57');
  assert.equal(captureMaterial.roughness, 0.96);
  assert.equal(captureMaterial.metalness, 0.01);
  assert.equal(captureMaterial.flatShading, true);
  assert.equal(captureMaterial.onBeforeCompile, secondShaderHook);
  assert.equal(captureMaterial.customProgramCacheKey(), 'avatar-gradient-v2');
  assert.equal(captureMaterial.opacity, 0.31);

  const directlySynced = syncSurfaceSnapshotMaterial(
    new THREE.MeshStandardMaterial(),
    sourceMaterial,
    0.22
  );
  assert.equal(directlySynced.color.getHexString(), 'ff5e57');
  assert.equal(directlySynced.opacity, 0.22);
  directlySynced.dispose();
  effects.dispose();
  sourceGeometry.dispose();
  sourceMaterial.dispose();
});

test('permanent motion sculpture keeps captured surface slots instead of recycling them', () => {
  const root = new THREE.Group();
  const sourceGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sourceMaterial = new THREE.MeshStandardMaterial();
  root.add(new THREE.Mesh(sourceGeometry, sourceMaterial));
  const effects = createAvatarEffects({
    maxHairStrands: 1,
    hairSegments: 1,
    maxInteriorParticles: 1,
    maxSculptures: 4,
    maxPermanentSculptures: 8
  });
  effects.setRoot(root);
  const settings = createDefaultAvatarEffectSettings();
  settings.sculpture.form = 'surface';
  settings.sculpture.interval = 0.001;
  settings.sculpture.retention = 'permanent';
  effects.setSettings(settings);
  effects.setMode('sculpture');
  for (let index = 0; index < 4; index += 1) {
    effects.update(0.5, { currentTime: index * 0.5, duration: 4 });
  }
  const sculptureGroup = effects.group.getObjectByName('CyberSubinMotionSculpture');
  const initialObjects = new Set(sculptureGroup.children);
  assert.equal(effects.getDebugState().sculptureCount, 4);
  for (let index = 4; index < 8; index += 1) {
    effects.update(0.5, { currentTime: index * 0.5, duration: 4 });
  }
  assert.equal(effects.getDebugState().sculptureCount, 8);
  for (const object of initialObjects) assert.ok(sculptureGroup.children.includes(object));
  for (let index = 0; index < 8; index += 1) {
    effects.update(0.5, { currentTime: index * 0.5, duration: 4 });
  }
  assert.equal(effects.getDebugState().sculptureCount, 8);
  assert.equal(effects.getDebugState().sculpturePermanentSlots, 8);
  effects.dispose();
  sourceGeometry.dispose();
  sourceMaterial.dispose();
});

test('motion sculpture retention changes preserve and restore the capture history', () => {
  const root = new THREE.Group();
  const sourceGeometry = new THREE.BoxGeometry(1, 1, 1);
  const sourceMaterial = new THREE.MeshStandardMaterial();
  root.add(new THREE.Mesh(sourceGeometry, sourceMaterial));
  const effects = createAvatarEffects({
    maxHairStrands: 1,
    hairSegments: 1,
    maxInteriorParticles: 1,
    maxSculptures: 4,
    maxPermanentSculptures: 8
  });
  effects.setRoot(root);
  const settings = createDefaultAvatarEffectSettings();
  settings.sculpture.form = 'surface';
  settings.sculpture.interval = 0.001;
  settings.sculpture.retention = 'permanent';
  effects.setSettings(settings);
  effects.setMode('sculpture');
  effects.update(0.1, { currentTime: 0.1, duration: 4 });
  const sculptureGroup = effects.group.getObjectByName('CyberSubinMotionSculpture');
  const originalSnapshot = sculptureGroup.children[0];
  const originalCount = effects.getDebugState().sculptureCount;
  assert.ok(originalSnapshot);
  assert.equal(originalCount, 1);

  settings.sculpture.retention = 'short';
  settings.sculpture.interval = 0.1;
  effects.setSettings(settings);
  assert.equal(effects.getDebugState().sculptureCount, originalCount);
  assert.ok(sculptureGroup.children.includes(originalSnapshot));

  effects.update(3.1, { currentTime: 3.2, duration: 4 });
  const agedCount = effects.getDebugState().sculptureCount;
  assert.ok(agedCount >= originalCount);
  assert.equal(effects.getDebugState().sculptureVisibleCount, 0);
  assert.ok(sculptureGroup.children.includes(originalSnapshot));

  settings.sculpture.retention = 'long';
  effects.setSettings(settings);
  assert.equal(effects.getDebugState().sculptureCount, agedCount);
  assert.equal(effects.getDebugState().sculptureVisibleCount, agedCount);
  assert.ok(sculptureGroup.children.includes(originalSnapshot));

  settings.sculpture.retention = 'permanent';
  effects.setSettings(settings);
  assert.equal(effects.getDebugState().sculptureCount, agedCount);
  assert.equal(effects.getDebugState().sculptureVisibleCount, agedCount);
  assert.ok(sculptureGroup.children.includes(originalSnapshot));

  effects.dispose();
  sourceGeometry.dispose();
  sourceMaterial.dispose();
});

test('full hair coat raises strand coverage without exceeding available references', () => {
  assert.equal(resolveHairActiveCount(420, 2400, 'open'), 420);
  assert.equal(resolveHairActiveCount(420, 2400, 'full'), 2304);
  assert.equal(resolveHairActiveCount(2400, 900, 'full'), 900);
});

test('circle hair uses a filled 2D disc with its perimeter attached to the body root', () => {
  const sourceGeometry = new THREE.BufferGeometry();
  sourceGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const sourceMaterial = new THREE.MeshBasicMaterial();
  const source = new THREE.Mesh(sourceGeometry, sourceMaterial);
  const root = new THREE.Group();
  root.add(source);
  const effects = createAvatarEffects({ maxHairStrands: 1, hairSegments: 1 });
  const circle = effects.group.getObjectByName('CyberSubinHairCircle');
  assert.ok(circle?.isInstancedMesh);
  assert.equal(circle.geometry.type, 'CircleGeometry');
  assert.ok(circle.geometry.index.count > 0);
  const circlePositions = circle.geometry.getAttribute('position');
  for (let index = 0; index < circlePositions.count; index += 1) {
    assert.ok(Math.abs(circlePositions.getZ(index)) < 1e-9);
  }

  effects.setRoot(root);
  const settings = createDefaultAvatarEffectSettings();
  settings.hair.shape = 'circle';
  settings.hair.length = 0.4;
  settings.hair.shapeWidth = 1.8;
  settings.hair.shapeLength = 0.6;
  settings.hair.density = 60;
  effects.setSettings(settings);
  effects.setMode('hair');
  effects.update(1 / 60);
  assert.equal(circle.count, 1);
  const instanceMatrix = new THREE.Matrix4();
  circle.getMatrixAt(0, instanceMatrix);
  const attachedEdge = new THREE.Vector3(0, -0.5, 0).applyMatrix4(instanceMatrix);
  assert.ok(attachedEdge.distanceTo(new THREE.Vector3(0, 0, 0)) < 1e-6);
  const instanceScale = new THREE.Vector3();
  instanceMatrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), instanceScale);
  assert.ok(Math.abs(instanceScale.x / instanceScale.y - 3) < 1e-6);
  effects.dispose();
  sourceGeometry.dispose();
  sourceMaterial.dispose();
});

test('geometric hair surfaces use light-reactive shadow materials', () => {
  const effects = createAvatarEffects({ maxHairStrands: 1, hairSegments: 1 });
  for (const shape of HAIR_SHAPE_OPTIONS.filter((entry) => entry !== 'line')) {
    const name = `CyberSubinHair${shape[0].toUpperCase()}${shape.slice(1)}`;
    const mesh = effects.group.getObjectByName(name);
    assert.ok(mesh?.material?.isMeshStandardMaterial, `${shape} should use MeshStandardMaterial`);
    assert.equal(mesh.castShadow, true);
    assert.equal(mesh.receiveShadow, true);
  }
  effects.dispose();
});

test('three-dimensional hair shapes expose independent width, length, and depth', () => {
  const sourceGeometry = new THREE.BufferGeometry();
  sourceGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const sourceMaterial = new THREE.MeshBasicMaterial();
  const source = new THREE.Mesh(sourceGeometry, sourceMaterial);
  const root = new THREE.Group();
  root.add(source);
  const effects = createAvatarEffects({ maxHairStrands: 1, hairSegments: 1 });
  const oval = effects.group.getObjectByName('CyberSubinHairOval');
  effects.setRoot(root);
  const settings = createDefaultAvatarEffectSettings();
  settings.hair.shape = 'oval';
  settings.hair.length = 0.4;
  settings.hair.shapeWidth = 1.5;
  settings.hair.shapeLength = 0.75;
  settings.hair.shapeDepth = 2.25;
  settings.hair.density = 60;
  effects.setSettings(settings);
  effects.setMode('hair');
  effects.update(1 / 60);
  assert.equal(oval.count, 1);
  const instanceMatrix = new THREE.Matrix4();
  oval.getMatrixAt(0, instanceMatrix);
  const attachedEdge = new THREE.Vector3(0, -0.5, 0).applyMatrix4(instanceMatrix);
  assert.ok(attachedEdge.distanceTo(new THREE.Vector3(0, 0, 0)) < 1e-6);
  const instanceScale = new THREE.Vector3();
  instanceMatrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), instanceScale);
  assert.ok(Math.abs(instanceScale.x / instanceScale.z - (1.5 / (0.72 * 2.25))) < 1e-6);
  effects.dispose();
  sourceGeometry.dispose();
  sourceMaterial.dispose();
});

test('flat hair lighting swaps every geometric surface to unlit shadow-free material', () => {
  const effects = createAvatarEffects({ maxHairStrands: 1, hairSegments: 1 });
  const settings = createDefaultAvatarEffectSettings();
  settings.hair.lighting = 'flat';
  effects.setSettings(settings);
  for (const shape of HAIR_SHAPE_OPTIONS.filter((entry) => entry !== 'line')) {
    const name = `CyberSubinHair${shape[0].toUpperCase()}${shape.slice(1)}`;
    const mesh = effects.group.getObjectByName(name);
    assert.ok(mesh?.material?.isMeshBasicMaterial, `${shape} should use MeshBasicMaterial`);
    assert.equal(mesh.material.toneMapped, false);
    assert.equal(mesh.castShadow, false);
    assert.equal(mesh.receiveShadow, false);
  }
  assert.equal(effects.getDebugState().hairLighting, 'flat');
  effects.dispose();
});

test('body surface snapshots bake the posed mesh into world-space geometry', () => {
  const sourceGeometry = new THREE.BoxGeometry(1, 2, 3);
  const sourceMaterial = new THREE.MeshStandardMaterial();
  const source = new THREE.Mesh(sourceGeometry, sourceMaterial);
  source.position.set(2, 3, -1);
  source.rotation.set(0.2, -0.45, 0.1);
  source.scale.set(1.25, 0.8, 1.1);
  source.updateMatrixWorld(true);

  const baked = bakeAvatarSurfaceGeometry(source);
  const sourcePosition = sourceGeometry.getAttribute('position');
  const bakedPosition = baked.getAttribute('position');
  assert.equal(bakedPosition.count, sourcePosition.count);
  assert.equal(baked.getAttribute('normal').count, sourcePosition.count);
  assert.ok(baked.index);

  const expected = new THREE.Vector3().fromBufferAttribute(sourcePosition, 0).applyMatrix4(source.matrixWorld);
  const actual = new THREE.Vector3().fromBufferAttribute(bakedPosition, 0);
  assert.ok(actual.distanceTo(expected) < 1e-6);

  baked.dispose();
  sourceGeometry.dispose();
  sourceMaterial.dispose();
});

test('pattern color resolver produces valid and meaningfully different colors', () => {
  const colors = ['#0044ff', '#ffffff', '#ff3300'];
  const target = new THREE.Color();
  const gradient = resolveAvatarEffectColor(target, 'gradient', 0.25, 3, colors).clone();
  const animal = resolveAvatarEffectColor(target, 'animal', 0.25, 3, colors).clone();
  const random = resolveAvatarEffectColor(target, 'random', 0.25, 3, colors).clone();
  for (const color of [gradient, animal, random]) {
    assert.ok(color.r >= 0 && color.r <= 1);
    assert.ok(color.g >= 0 && color.g <= 1);
    assert.ok(color.b >= 0 && color.b <= 1);
  }
  assert.notEqual(gradient.getHexString(), animal.getHexString());
});

test('interior particles remain on the local bone-to-skin segment', () => {
  const localCore = new THREE.Vector3(-0.25, 1.1, 0.4);
  const skinSurface = new THREE.Vector3(0.7, 1.85, -0.2);
  const target = new THREE.Vector3();
  for (let step = 0; step < 240; step += 1) {
    const depth = resolveInteriorParticleDepth(0.48, step / 24, 4, 3, 1.37);
    assert.ok(depth >= 0.06 && depth <= 0.9);
    resolveInteriorParticlePosition(target, localCore, skinSurface, depth);
    const expected = localCore.clone().lerp(skinSurface, depth);
    assert.ok(target.distanceTo(expected) < 1e-9);
    for (const axis of ['x', 'y', 'z']) {
      const minimum = Math.min(localCore[axis], skinSurface[axis]);
      const maximum = Math.max(localCore[axis], skinSurface[axis]);
      assert.ok(target[axis] >= minimum && target[axis] <= maximum);
    }
  }
  assert.equal(
    resolveInteriorParticleDepth(0.48, 0, 0, 2, 0.5),
    resolveInteriorParticleDepth(0.48, 500, 0, 2, 0.5)
  );
});

test('avatar effect state round-trips through shareable URL parameters', () => {
  const settings = createDefaultAvatarEffectSettings();
  settings.hair.weight = 1.65;
  settings.hair.coverage = 'full';
  settings.hair.lighting = 'flat';
  settings.hair.shape = 'rod';
  settings.hair.shapeWidth = 1.35;
  settings.hair.shapeLength = 0.8;
  settings.hair.shapeDepth = 2.1;
  settings.hair.growthPattern = 'headHands';
  settings.hair.distribution = 'uniform';
  settings.hair.lengthMode = 'uniform';
  settings.hair.outwardBias = 0.65;
  settings.hair.flexibility = 0.92;
  settings.sculpture.form = 'surface';
  const params = new URLSearchParams();
  writeViewStateToParams(params, {
    experiments: [],
    avatarEffectMode: 'hair',
    avatarEffectSettings: JSON.stringify(settings)
  });
  const view = readViewStateFromParams(params);
  assert.equal(view.avatarEffectMode, 'hair');
  assert.equal(JSON.parse(view.avatarEffectSettings).hair.weight, 1.65);
  assert.equal(JSON.parse(view.avatarEffectSettings).hair.coverage, 'full');
  assert.equal(JSON.parse(view.avatarEffectSettings).hair.lighting, 'flat');
  assert.equal(JSON.parse(view.avatarEffectSettings).hair.shape, 'rod');
  assert.equal(JSON.parse(view.avatarEffectSettings).hair.shapeWidth, 1.35);
  assert.equal(JSON.parse(view.avatarEffectSettings).hair.shapeLength, 0.8);
  assert.equal(JSON.parse(view.avatarEffectSettings).hair.shapeDepth, 2.1);
  assert.equal(JSON.parse(view.avatarEffectSettings).hair.growthPattern, 'headHands');
  assert.equal(JSON.parse(view.avatarEffectSettings).hair.distribution, 'uniform');
  assert.equal(JSON.parse(view.avatarEffectSettings).hair.lengthMode, 'uniform');
  assert.equal(JSON.parse(view.avatarEffectSettings).hair.outwardBias, 0.65);
  assert.equal(JSON.parse(view.avatarEffectSettings).hair.flexibility, 0.92);
  assert.equal(JSON.parse(view.avatarEffectSettings).sculpture.form, 'surface');
});
