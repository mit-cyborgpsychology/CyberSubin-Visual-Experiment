export const PHYSICS_CONSTANT_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'heatDepositionRate',
    label: 'HEAT DEPOSITION RATE',
    description: 'Rate that movement energy becomes local heat.',
    min: 0.25,
    max: 2.5,
    step: 0.05,
    defaultValue: 1.15
  }),
  Object.freeze({
    id: 'thermalDissipationRate',
    label: 'THERMAL DISSIPATION RATE',
    description: 'Rate that stored heat is lost to the environment.',
    min: 0.25,
    max: 2.5,
    step: 0.05,
    defaultValue: 1
  }),
  Object.freeze({
    id: 'thermalDiffusivity',
    label: 'THERMAL DIFFUSIVITY',
    description: 'Speed of heat transfer between adjacent body regions.',
    min: 0,
    max: 3,
    step: 0.05,
    defaultValue: 1
  }),
  Object.freeze({
    id: 'activityMemoryPersistence',
    label: 'ACTIVITY-MEMORY PERSISTENCE',
    description: 'How long repeated movement protects a hot region from cooling.',
    min: 0.25,
    max: 3,
    step: 0.05,
    defaultValue: 1
  }),
  Object.freeze({
    id: 'flowVelocityDamping',
    label: 'FLOW VELOCITY DAMPING',
    description: 'Rate that residual flow-field velocity loses momentum.',
    min: 0.25,
    max: 3,
    step: 0.05,
    defaultValue: 1
  }),
  Object.freeze({
    id: 'flowMomentumDiffusivity',
    label: 'FLOW MOMENTUM DIFFUSIVITY',
    description: 'Rate that turbulent momentum spreads through the field.',
    min: 0,
    max: 3,
    step: 0.05,
    defaultValue: 1
  })
]);

const DEFINITION_BY_ID = new Map(
  PHYSICS_CONSTANT_DEFINITIONS.map((definition) => [definition.id, definition])
);

export function createDefaultPhysicsConstants() {
  return Object.fromEntries(
    PHYSICS_CONSTANT_DEFINITIONS.map(({ id, defaultValue }) => [id, defaultValue])
  );
}

export function sanitizePhysicsConstants(values) {
  const defaults = createDefaultPhysicsConstants();
  if (!values || typeof values !== 'object') return defaults;
  for (const [id, definition] of DEFINITION_BY_ID) {
    const value = Number(values[id]);
    if (!Number.isFinite(value)) continue;
    defaults[id] = Math.min(definition.max, Math.max(definition.min, value));
  }
  return defaults;
}

export function getPhysicsConstantDefinition(id) {
  return DEFINITION_BY_ID.get(id) ?? null;
}
