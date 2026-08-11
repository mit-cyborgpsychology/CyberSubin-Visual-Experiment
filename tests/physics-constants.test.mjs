import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PHYSICS_CONSTANT_DEFINITIONS,
  createDefaultPhysicsConstants,
  sanitizePhysicsConstants
} from '../src/physics-constants.js';

test('physics constants use normalized baselines and slightly stronger heat deposition', () => {
  const defaults = createDefaultPhysicsConstants();
  assert.equal(defaults.heatDepositionRate, 1.15);
  assert.equal(defaults.thermalDissipationRate, 1);
  assert.equal(defaults.thermalDiffusivity, 1);
  assert.equal(defaults.activityMemoryPersistence, 1);
  assert.equal(defaults.flowVelocityDamping, 1);
  assert.equal(defaults.flowMomentumDiffusivity, 1);
  assert.equal(Object.keys(defaults).length, PHYSICS_CONSTANT_DEFINITIONS.length);
});

test('physics constants sanitize malformed and out-of-range URL values', () => {
  const sanitized = sanitizePhysicsConstants({
    heatDepositionRate: 999,
    thermalDissipationRate: -2,
    thermalDiffusivity: '2.4',
    activityMemoryPersistence: 'not-a-number'
  });
  assert.equal(sanitized.heatDepositionRate, 2.5);
  assert.equal(sanitized.thermalDissipationRate, 0.25);
  assert.equal(sanitized.thermalDiffusivity, 2.4);
  assert.equal(sanitized.activityMemoryPersistence, 1);
});
