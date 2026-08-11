import * as THREE from 'three';

export const FLOW_FIELD_GRADIENTS = {
  ocean: ['#123dff', '#65f3ff', '#f4ffff'],
  heat: ['#172bff', '#fb5c50', '#ffd36a'],
  aurora: ['#6b42ff', '#00d6b7', '#d8ff78'],
  ember: ['#6a1637', '#fb5c50', '#fff0c2']
};

const DEFAULT_HALF_EXTENTS = Object.freeze({ x: 6.2, y: 3.7, z: 5.2 });
const TRAIL_SEGMENTS = 10;
const TRAIL_POINTS = TRAIL_SEGMENTS + 1;
const RENDER_SEGMENTS = 24;
const RIBBON_VERTICES = (RENDER_SEGMENTS + 1) * 2;
const RIBBON_INDICES = RENDER_SEGMENTS * 6;
const FLUID_GRID_X = 18;
const FLUID_GRID_Y = 12;
const FLUID_GRID_Z = 14;
const FLUID_GRID_CELLS = FLUID_GRID_X * FLUID_GRID_Y * FLUID_GRID_Z;

function seededRandom(index, salt, epoch = 0) {
  const value = Math.sin((index + 1) * 12.9898 + salt * 78.233 + epoch * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function catmullRom(start, first, second, end, amount) {
  const amountSquared = amount * amount;
  const amountCubed = amountSquared * amount;
  return 0.5 * (
    2 * first
    + (-start + second) * amount
    + (2 * start - 5 * first + 4 * second - end) * amountSquared
    + (-start + 3 * first - 3 * second + end) * amountCubed
  );
}

function writeSmoothTrailSample(field, trailOffset, progress, targetOffset) {
  const scaledProgress = THREE.MathUtils.clamp(progress, 0, 1) * TRAIL_SEGMENTS;
  const segment = Math.min(TRAIL_SEGMENTS - 1, Math.floor(scaledProgress));
  const localProgress = scaledProgress - segment;
  const historyIndex0 = TRAIL_SEGMENTS - Math.max(0, segment - 1);
  const historyIndex1 = TRAIL_SEGMENTS - segment;
  const historyIndex2 = TRAIL_SEGMENTS - Math.min(TRAIL_SEGMENTS, segment + 1);
  const historyIndex3 = TRAIL_SEGMENTS - Math.min(TRAIL_SEGMENTS, segment + 2);

  for (let axis = 0; axis < 3; axis += 1) {
    field.curveSamples[targetOffset + axis] = catmullRom(
      field.trailHistory[trailOffset + historyIndex0 * 3 + axis],
      field.trailHistory[trailOffset + historyIndex1 * 3 + axis],
      field.trailHistory[trailOffset + historyIndex2 * 3 + axis],
      field.trailHistory[trailOffset + historyIndex3 * 3 + axis],
      localProgress
    );
  }
}

function setParticlePosition(field, index, center, incrementEpoch = false) {
  if (incrementEpoch) field.epochs[index] += 1;
  const epoch = field.epochs[index];
  const offset = index * 3;
  const concentrationMix = Math.sqrt(THREE.MathUtils.clamp(field.concentration / 5, 0, 1));
  const focusProbability = concentrationMix * 0.94;
  const focusOnAvatar = field.spawnPointCount > 0
    && seededRandom(index, 18, epoch) < focusProbability;

  if (focusOnAvatar) {
    const pointIndex = Math.min(
      field.spawnPointCount - 1,
      Math.floor(seededRandom(index, 19, epoch) * field.spawnPointCount)
    );
    const anchor = field.spawnPoints[pointIndex];
    const theta = seededRandom(index, 20, epoch) * Math.PI * 2;
    const cosine = seededRandom(index, 21, epoch) * 2 - 1;
    const sine = Math.sqrt(Math.max(0, 1 - cosine * cosine));
    const radius = Math.cbrt(seededRandom(index, 22, epoch))
      * THREE.MathUtils.lerp(2.15, 0.42, concentrationMix);
    field.positions[offset] = anchor.x + Math.cos(theta) * sine * radius;
    field.positions[offset + 1] = anchor.y + cosine * radius;
    field.positions[offset + 2] = anchor.z + Math.sin(theta) * sine * radius;
  } else {
    field.positions[offset] = center.x
      + (seededRandom(index, 1, epoch) * 2 - 1) * field.halfExtents.x;
    field.positions[offset + 1] = center.y
      + (seededRandom(index, 2, epoch) * 2 - 1) * field.halfExtents.y;
    field.positions[offset + 2] = center.z
      + (seededRandom(index, 3, epoch) * 2 - 1) * field.halfExtents.z;
  }

  const phase = field.phases[index];
  field.velocities[offset] = 0.2 + Math.sin(phase) * 0.08;
  field.velocities[offset + 1] = Math.cos(phase * 1.37) * 0.05;
  field.velocities[offset + 2] = Math.sin(phase * 0.71) * 0.08;
  field.inertiaVelocities[offset] = 0;
  field.inertiaVelocities[offset + 1] = 0;
  field.inertiaVelocities[offset + 2] = 0;
  field.inertiaAxes[offset] = 0;
  field.inertiaAxes[offset + 1] = 1;
  field.inertiaAxes[offset + 2] = 0;
  field.particleAges[index] = 0;

  if (field.trailHistory) {
    const trailOffset = index * TRAIL_POINTS * 3;
    for (let point = 0; point < TRAIL_POINTS; point += 1) {
      const pointOffset = trailOffset + point * 3;
      field.trailHistory[pointOffset] = field.positions[offset];
      field.trailHistory[pointOffset + 1] = field.positions[offset + 1];
      field.trailHistory[pointOffset + 2] = field.positions[offset + 2];
    }
  }
}

function gradientColor(field, amount, target, offset) {
  const colors = field.gradientColors;
  const scaled = THREE.MathUtils.clamp(amount, 0, 1) * 2;
  const startIndex = scaled < 1 ? 0 : 1;
  const localAmount = scaled < 1 ? scaled : scaled - 1;
  const start = colors[startIndex];
  const end = colors[startIndex + 1];
  target[offset] = THREE.MathUtils.lerp(start.r, end.r, localAmount);
  target[offset + 1] = THREE.MathUtils.lerp(start.g, end.g, localAmount);
  target[offset + 2] = THREE.MathUtils.lerp(start.b, end.b, localAmount);
}

function setGradient(field, gradient) {
  const stops = FLOW_FIELD_GRADIENTS[gradient] ?? FLOW_FIELD_GRADIENTS.ocean;
  field.gradient = gradient in FLOW_FIELD_GRADIENTS ? gradient : 'ocean';
  field.gradientColors = stops.map((color) => new THREE.Color(color));
}

function setCustomGradient(field, colors) {
  if (!Array.isArray(colors) || colors.length < 3) return;
  field.gradient = 'custom';
  field.gradientColors = colors.slice(0, 3).map((color) => new THREE.Color(color));
}

function updateMaterialScale(field) {
  const density = field.count / Math.max(1, field.maxParticles);
  field.strokes.material.uniforms.opacity.value = THREE.MathUtils.lerp(0.9, 0.62, density)
    * field.opacity;
}

export function createFlowField({ maxParticles = 7200 } = {}) {
  const count = Math.max(1, Math.floor(maxParticles));
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const inertiaVelocities = new Float32Array(count * 3);
  const inertiaAxes = new Float32Array(count * 3);
  const fluidVelocity = new Float32Array(FLUID_GRID_CELLS * 3);
  const fluidScratch = new Float32Array(FLUID_GRID_CELLS * 3);
  const fluidSample = new Float32Array(3);
  const phases = new Float32Array(count);
  const colorSeeds = new Float32Array(count);
  const epochs = new Uint16Array(count);
  const particleAges = new Float32Array(count);
  const trailHistory = new Float32Array(count * TRAIL_POINTS * 3);
  const curveSamples = new Float32Array(count * (RENDER_SEGMENTS + 1) * 3);
  const ribbonPositions = new Float32Array(count * RIBBON_VERTICES * 3);
  const ribbonColors = new Float32Array(count * RIBBON_VERTICES * 3);
  const ribbonAlphas = new Float32Array(count * RIBBON_VERTICES);
  const ribbonIndices = new Uint32Array(count * RIBBON_INDICES);

  for (let index = 0; index < count; index += 1) {
    phases[index] = seededRandom(index, 9) * Math.PI * 2;
    colorSeeds[index] = seededRandom(index, 14);
    const vertexOffset = index * RIBBON_VERTICES;
    const indexOffset = index * RIBBON_INDICES;
    for (let segment = 0; segment < RENDER_SEGMENTS; segment += 1) {
      const startLeft = vertexOffset + segment * 2;
      const startRight = startLeft + 1;
      const endLeft = startLeft + 2;
      const endRight = startLeft + 3;
      const triangleOffset = indexOffset + segment * 6;
      ribbonIndices[triangleOffset] = startLeft;
      ribbonIndices[triangleOffset + 1] = endLeft;
      ribbonIndices[triangleOffset + 2] = startRight;
      ribbonIndices[triangleOffset + 3] = startRight;
      ribbonIndices[triangleOffset + 4] = endLeft;
      ribbonIndices[triangleOffset + 5] = endRight;
    }
  }
  const ribbonGeometry = new THREE.BufferGeometry();
  ribbonGeometry.setIndex(new THREE.BufferAttribute(ribbonIndices, 1));
  ribbonGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(ribbonPositions, 3).setUsage(THREE.DynamicDrawUsage)
  );
  ribbonGeometry.setAttribute(
    'color',
    new THREE.BufferAttribute(ribbonColors, 3).setUsage(THREE.DynamicDrawUsage)
  );
  ribbonGeometry.setAttribute(
    'trailAlpha',
    new THREE.BufferAttribute(ribbonAlphas, 1).setUsage(THREE.DynamicDrawUsage)
  );
  ribbonGeometry.setDrawRange(0, 0);
  const ribbonMaterial = new THREE.ShaderMaterial({
    uniforms: {
      opacity: { value: 0.78 },
      avatarCenter: { value: new THREE.Vector3(0, 1.5, 0) },
      bodyPoints: { value: Array.from({ length: 12 }, () => new THREE.Vector3()) },
      bodyPointCount: { value: 0 },
      proximityFade: { value: 1 }
    },
    vertexShader: `
      attribute vec3 color;
      attribute float trailAlpha;
      uniform vec3 avatarCenter;
      uniform vec3 bodyPoints[12];
      uniform int bodyPointCount;
      uniform float proximityFade;
      varying vec3 vColor;
      varying float vTrailAlpha;
      varying float vProximityAlpha;
      void main() {
        vColor = color;
        vTrailAlpha = trailAlpha;
        float avatarDistance = distance( position, avatarCenter );
        for ( int index = 0; index < 12; index += 1 ) {
          if ( index < bodyPointCount ) {
            avatarDistance = min( avatarDistance, distance( position, bodyPoints[index] ) );
          }
        }
        avatarDistance = max( 0.0, avatarDistance - 0.6 );
        vProximityAlpha = max( 0.02, exp( -avatarDistance * proximityFade * 0.3 ) );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: `
      uniform float opacity;
      varying vec3 vColor;
      varying float vTrailAlpha;
      varying float vProximityAlpha;
      void main() {
        float resolvedAlpha = opacity * vTrailAlpha * vProximityAlpha;
        if ( resolvedAlpha <= 0.001 ) discard;
        gl_FragColor = vec4( vColor, resolvedAlpha );
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const strokes = new THREE.Mesh(ribbonGeometry, ribbonMaterial);
  strokes.frustumCulled = false;
  strokes.renderOrder = 2;

  const group = new THREE.Group();
  group.name = 'CyberSubinFlowField';
  group.visible = false;
  group.add(strokes);

  const field = {
    group,
    strokes,
    positions,
    colors,
    velocities,
    inertiaVelocities,
    inertiaAxes,
    fluidVelocity,
    fluidScratch,
    fluidSample,
    fluidTime: 0,
    fluidAccumulator: 1 / 30,
    phases,
    colorSeeds,
    epochs,
    particleAges,
    trailHistory,
    curveSamples,
    ribbonPositions,
    ribbonColors,
    ribbonAlphas,
    halfExtents: { ...DEFAULT_HALF_EXTENTS },
    maxParticles: count,
    count: Math.min(4800, count),
    enabled: false,
    speed: 1,
    thickness: 1.5,
    trailLength: 1,
    trailFade: 0.8,
    strokeLength: 1,
    curvature: 1,
    colorVariation: 1,
    influence: 1,
    bodyFlow: 1,
    recovery: 1,
    velocityDamping: 1,
    momentumDiffusivity: 1,
    proximityFade: 1,
    concentration: 1,
    opacity: 1,
    spawnPoints: Array.from({ length: 12 }, () => new THREE.Vector3()),
    spawnPointCount: 0,
    concentrationReseedRemaining: Math.min(4800, count),
    concentrationReseedCursor: 0,
    gradient: 'ocean',
    gradientColors: [],
    alphaDirty: true,
    initialized: false
  };
  setGradient(field, 'ocean');
  updateMaterialScale(field);
  return field;
}

export function resetFlowField(field, center = new THREE.Vector3(0, 1.5, 0)) {
  if (!field) return;
  field.fluidVelocity.fill(0);
  field.fluidScratch.fill(0);
  field.fluidTime = 0;
  field.fluidAccumulator = 1 / 30;
  field.concentrationReseedRemaining = field.count;
  field.concentrationReseedCursor = 0;
  for (let index = 0; index < field.maxParticles; index += 1) {
    setParticlePosition(field, index, center, field.initialized);
  }
  field.initialized = true;
  field.strokes.geometry.attributes.position.needsUpdate = true;
}

export function setFlowFieldOptions(field, options = {}) {
  if (!field) return;
  if (typeof options.enabled === 'boolean') field.enabled = options.enabled;
  if (Number.isFinite(Number(options.speed))) {
    field.speed = THREE.MathUtils.clamp(Number(options.speed), 0.05, 8);
  }
  if (Number.isFinite(Number(options.count))) {
    const nextCount = THREE.MathUtils.clamp(Math.round(Number(options.count)), 200, field.maxParticles);
    if (nextCount !== field.count) {
      field.count = nextCount;
      field.concentrationReseedRemaining = field.count;
      field.concentrationReseedCursor = 0;
    }
    field.alphaDirty = true;
  }
  if (Number.isFinite(Number(options.thickness))) {
    field.thickness = THREE.MathUtils.clamp(Number(options.thickness), 0.25, 8);
  }
  if (Number.isFinite(Number(options.trailLength))) {
    field.trailLength = THREE.MathUtils.clamp(Number(options.trailLength), 0.1, 8);
  }
  if (Number.isFinite(Number(options.trailFade))) {
    field.trailFade = THREE.MathUtils.clamp(Number(options.trailFade), 0, 1);
    field.alphaDirty = true;
  }
  if (Number.isFinite(Number(options.strokeLength))) {
    field.strokeLength = THREE.MathUtils.clamp(Number(options.strokeLength), 0.1, 5);
  }
  if (Number.isFinite(Number(options.curvature))) {
    field.curvature = THREE.MathUtils.clamp(Number(options.curvature), 0, 5);
  }
  if (Number.isFinite(Number(options.colorVariation))) {
    field.colorVariation = THREE.MathUtils.clamp(Number(options.colorVariation), 0, 3);
  }
  if (Number.isFinite(Number(options.influence))) {
    field.influence = THREE.MathUtils.clamp(Number(options.influence), 0, 5);
  }
  if (Number.isFinite(Number(options.bodyFlow))) {
    field.bodyFlow = THREE.MathUtils.clamp(Number(options.bodyFlow), 0, 5);
  }
  if (Number.isFinite(Number(options.recovery))) {
    field.recovery = THREE.MathUtils.clamp(Number(options.recovery), 0.05, 8);
  }
  if (Number.isFinite(Number(options.velocityDamping))) {
    field.velocityDamping = THREE.MathUtils.clamp(Number(options.velocityDamping), 0.25, 3);
  }
  if (Number.isFinite(Number(options.momentumDiffusivity))) {
    field.momentumDiffusivity = THREE.MathUtils.clamp(Number(options.momentumDiffusivity), 0, 3);
  }
  if (Number.isFinite(Number(options.proximityFade))) {
    field.proximityFade = THREE.MathUtils.clamp(Number(options.proximityFade), 0, 4);
    field.strokes.material.uniforms.proximityFade.value = field.proximityFade;
  }
  if (Number.isFinite(Number(options.concentration))) {
    const nextConcentration = THREE.MathUtils.clamp(Number(options.concentration), 0, 5);
    if (Math.abs(nextConcentration - field.concentration) > 0.0001) {
      field.concentration = nextConcentration;
      field.concentrationReseedRemaining = field.count;
      field.concentrationReseedCursor = 0;
    }
  }
  if (Number.isFinite(Number(options.opacity))) {
    field.opacity = THREE.MathUtils.clamp(Number(options.opacity), 0, 1);
  }
  if (typeof options.gradient === 'string') setGradient(field, options.gradient);
  if (Array.isArray(options.colors)) setCustomGradient(field, options.colors);

  field.group.visible = field.enabled;
  field.strokes.geometry.setDrawRange(0, field.count * RIBBON_INDICES);
  updateMaterialScale(field);
}

function fluidOffset(x, y, z) {
  return ((z * FLUID_GRID_Y + y) * FLUID_GRID_X + x) * 3;
}

function advanceFluidGrid(
  field,
  frameDelta,
  directionX,
  directionY,
  directionZ,
  baseSpeed
) {
  const current = field.fluidVelocity;
  const next = field.fluidScratch;
  const decay = Math.exp(
    -frameDelta * (0.08 + field.recovery * 0.2) * field.velocityDamping
  );
  const diffusion = THREE.MathUtils.clamp(
    frameDelta * (0.7 + field.curvature * 0.22) * field.momentumDiffusivity,
    0,
    0.11
  );
  const advection = THREE.MathUtils.clamp(frameDelta * baseSpeed * 0.72, 0, 0.08);
  const absoluteX = Math.abs(directionX);
  const absoluteY = Math.abs(directionY);
  const absoluteZ = Math.abs(directionZ);
  const stepX = absoluteX >= absoluteY && absoluteX >= absoluteZ
    ? (directionX >= 0 ? -1 : 1)
    : 0;
  const stepY = absoluteY > absoluteX && absoluteY >= absoluteZ
    ? (directionY >= 0 ? -1 : 1)
    : 0;
  const stepZ = absoluteZ > absoluteX && absoluteZ > absoluteY
    ? (directionZ >= 0 ? -1 : 1)
    : 0;
  const retainedWeight = Math.max(0, 1 - diffusion - advection);

  for (let z = 0; z < FLUID_GRID_Z; z += 1) {
    for (let y = 0; y < FLUID_GRID_Y; y += 1) {
      for (let x = 0; x < FLUID_GRID_X; x += 1) {
        const offset = fluidOffset(x, y, z);
        let neighborX = 0;
        let neighborY = 0;
        let neighborZ = 0;
        let neighborCount = 0;
        let sampleOffset;
        if (x > 0) {
          sampleOffset = offset - 3;
          neighborX += current[sampleOffset];
          neighborY += current[sampleOffset + 1];
          neighborZ += current[sampleOffset + 2];
          neighborCount += 1;
        }
        if (x < FLUID_GRID_X - 1) {
          sampleOffset = offset + 3;
          neighborX += current[sampleOffset];
          neighborY += current[sampleOffset + 1];
          neighborZ += current[sampleOffset + 2];
          neighborCount += 1;
        }
        if (y > 0) {
          sampleOffset = offset - FLUID_GRID_X * 3;
          neighborX += current[sampleOffset];
          neighborY += current[sampleOffset + 1];
          neighborZ += current[sampleOffset + 2];
          neighborCount += 1;
        }
        if (y < FLUID_GRID_Y - 1) {
          sampleOffset = offset + FLUID_GRID_X * 3;
          neighborX += current[sampleOffset];
          neighborY += current[sampleOffset + 1];
          neighborZ += current[sampleOffset + 2];
          neighborCount += 1;
        }
        if (z > 0) {
          sampleOffset = offset - FLUID_GRID_X * FLUID_GRID_Y * 3;
          neighborX += current[sampleOffset];
          neighborY += current[sampleOffset + 1];
          neighborZ += current[sampleOffset + 2];
          neighborCount += 1;
        }
        if (z < FLUID_GRID_Z - 1) {
          sampleOffset = offset + FLUID_GRID_X * FLUID_GRID_Y * 3;
          neighborX += current[sampleOffset];
          neighborY += current[sampleOffset + 1];
          neighborZ += current[sampleOffset + 2];
          neighborCount += 1;
        }
        const inverseNeighborCount = 1 / Math.max(1, neighborCount);
        const upstreamOffset = fluidOffset(
          THREE.MathUtils.clamp(x + stepX, 0, FLUID_GRID_X - 1),
          THREE.MathUtils.clamp(y + stepY, 0, FLUID_GRID_Y - 1),
          THREE.MathUtils.clamp(z + stepZ, 0, FLUID_GRID_Z - 1)
        );

        next[offset] = (
          current[offset] * retainedWeight
          + neighborX * inverseNeighborCount * diffusion
          + current[upstreamOffset] * advection
        ) * decay;
        next[offset + 1] = (
          current[offset + 1] * retainedWeight
          + neighborY * inverseNeighborCount * diffusion
          + current[upstreamOffset + 1] * advection
        ) * decay;
        next[offset + 2] = (
          current[offset + 2] * retainedWeight
          + neighborZ * inverseNeighborCount * diffusion
          + current[upstreamOffset + 2] * advection
        ) * decay;
      }
    }
  }

  field.fluidVelocity = next;
  field.fluidScratch = current;
}

function depositTrackerCurrents(field, trackers, center, frameDelta) {
  if (!trackers.length || field.influence <= 0.001) return;
  const grid = field.fluidVelocity;
  const minX = center.x - field.halfExtents.x;
  const minY = center.y - field.halfExtents.y;
  const minZ = center.z - field.halfExtents.z;
  const cellSizeX = field.halfExtents.x * 2 / (FLUID_GRID_X - 1);
  const cellSizeY = field.halfExtents.y * 2 / (FLUID_GRID_Y - 1);
  const cellSizeZ = field.halfExtents.z * 2 / (FLUID_GRID_Z - 1);
  const maxFluidComponent = 1.4
    + field.influence * 0.85
    + field.curvature * 0.24;

  trackers.forEach((tracker, trackerIndex) => {
    if (!tracker?.anchorPosition || tracker.speed < 0.035) return;
    const speed = Math.max(0.0001, tracker.speed);
    const motion = THREE.MathUtils.clamp(speed / 2.4, 0, 1);
    const motionX = tracker.velocity.x / speed;
    const motionY = tracker.velocity.y / speed;
    const motionZ = tracker.velocity.z / speed;
    const radius = 1.02 + motion * 1.08 + field.influence * 0.16;
    const centerX = Math.round((tracker.anchorPosition.x - minX) / cellSizeX);
    const centerY = Math.round((tracker.anchorPosition.y - minY) / cellSizeY);
    const centerZ = Math.round((tracker.anchorPosition.z - minZ) / cellSizeZ);
    const radiusX = Math.min(3, Math.ceil(radius / cellSizeX));
    const radiusY = Math.min(3, Math.ceil(radius / cellSizeY));
    const radiusZ = Math.min(3, Math.ceil(radius / cellSizeZ));
    const capture = Math.min(1, frameDelta * (8 + speed * 2.4));
    const sourceStrength = (0.75 + motion * 2.15) * field.influence;

    for (let z = Math.max(0, centerZ - radiusZ); z <= Math.min(FLUID_GRID_Z - 1, centerZ + radiusZ); z += 1) {
      const worldZ = minZ + z * cellSizeZ;
      for (let y = Math.max(0, centerY - radiusY); y <= Math.min(FLUID_GRID_Y - 1, centerY + radiusY); y += 1) {
        const worldY = minY + y * cellSizeY;
        for (let x = Math.max(0, centerX - radiusX); x <= Math.min(FLUID_GRID_X - 1, centerX + radiusX); x += 1) {
          const worldX = minX + x * cellSizeX;
          const dx = worldX - tracker.anchorPosition.x;
          const dy = worldY - tracker.anchorPosition.y;
          const dz = worldZ - tracker.anchorPosition.z;
          const distance = Math.hypot(dx, dy, dz);
          if (distance >= radius) continue;
          const inverseDistance = 1 / Math.max(0.0001, distance);
          const radialX = dx * inverseDistance;
          const radialY = dy * inverseDistance;
          const radialZ = dz * inverseDistance;
          let tangentX = motionY * radialZ - motionZ * radialY;
          let tangentY = motionZ * radialX - motionX * radialZ;
          let tangentZ = motionX * radialY - motionY * radialX;
          const tangentLength = Math.hypot(tangentX, tangentY, tangentZ);
          if (tangentLength > 0.0001) {
            tangentX /= tangentLength;
            tangentY /= tangentLength;
            tangentZ /= tangentLength;
          }
          const proximity = 1 - distance / radius;
          const weight = proximity * proximity * capture;
          const eddyPhase = field.fluidTime * (0.65 + field.curvature * 0.1)
            + trackerIndex * 1.91
            + distance * 2.35;
          const eddy = 0.72 + Math.sin(eddyPhase) * 0.28;
          const streamFlow = sourceStrength * (0.84 + motion * 0.68);
          const vortexFlow = sourceStrength
            * (0.28 + field.curvature * 0.4)
            * eddy;
          const pressureFlow = sourceStrength * field.bodyFlow * 0.045;
          const offset = fluidOffset(x, y, z);
          grid[offset] = THREE.MathUtils.clamp(
            grid[offset] + (
              motionX * streamFlow
              + tangentX * vortexFlow
              + radialX * pressureFlow
            ) * weight,
            -maxFluidComponent,
            maxFluidComponent
          );
          grid[offset + 1] = THREE.MathUtils.clamp(
            grid[offset + 1] + (
              motionY * streamFlow
              + tangentY * vortexFlow
              + radialY * pressureFlow
            ) * weight,
            -maxFluidComponent,
            maxFluidComponent
          );
          grid[offset + 2] = THREE.MathUtils.clamp(
            grid[offset + 2] + (
              motionZ * streamFlow
              + tangentZ * vortexFlow
              + radialZ * pressureFlow
            ) * weight,
            -maxFluidComponent,
            maxFluidComponent
          );
        }
      }
    }
  });
}

function sampleFluidGrid(field, x, y, z, center) {
  const normalizedX = (x - (center.x - field.halfExtents.x)) / (field.halfExtents.x * 2);
  const normalizedY = (y - (center.y - field.halfExtents.y)) / (field.halfExtents.y * 2);
  const normalizedZ = (z - (center.z - field.halfExtents.z)) / (field.halfExtents.z * 2);
  const target = field.fluidSample;
  if (
    normalizedX < 0 || normalizedX > 1
    || normalizedY < 0 || normalizedY > 1
    || normalizedZ < 0 || normalizedZ > 1
  ) {
    target[0] = 0;
    target[1] = 0;
    target[2] = 0;
    return target;
  }

  const gridX = normalizedX * (FLUID_GRID_X - 1);
  const gridY = normalizedY * (FLUID_GRID_Y - 1);
  const gridZ = normalizedZ * (FLUID_GRID_Z - 1);
  const x0 = Math.floor(gridX);
  const y0 = Math.floor(gridY);
  const z0 = Math.floor(gridZ);
  const x1 = Math.min(FLUID_GRID_X - 1, x0 + 1);
  const y1 = Math.min(FLUID_GRID_Y - 1, y0 + 1);
  const z1 = Math.min(FLUID_GRID_Z - 1, z0 + 1);
  const amountX = gridX - x0;
  const amountY = gridY - y0;
  const amountZ = gridZ - z0;
  const grid = field.fluidVelocity;
  target[0] = 0;
  target[1] = 0;
  target[2] = 0;

  for (let cornerZ = 0; cornerZ <= 1; cornerZ += 1) {
    const sampleZ = cornerZ ? z1 : z0;
    const weightZ = cornerZ ? amountZ : 1 - amountZ;
    for (let cornerY = 0; cornerY <= 1; cornerY += 1) {
      const sampleY = cornerY ? y1 : y0;
      const weightY = cornerY ? amountY : 1 - amountY;
      for (let cornerX = 0; cornerX <= 1; cornerX += 1) {
        const sampleX = cornerX ? x1 : x0;
        const weightX = cornerX ? amountX : 1 - amountX;
        const weight = weightX * weightY * weightZ;
        const offset = fluidOffset(sampleX, sampleY, sampleZ);
        target[0] += grid[offset] * weight;
        target[1] += grid[offset + 1] * weight;
        target[2] += grid[offset + 2] * weight;
      }
    }
  }
  return target;
}

export function updateFlowField(field, {
  delta,
  time,
  trackers = [],
  center = new THREE.Vector3(0, 1.5, 0),
  flowDirection = { x: 1, y: 0, z: 0 },
  viewDirection = { x: 0, y: 0, z: -1 }
}) {
  if (!field?.enabled || !field.group.visible || !field.initialized) return;
  field.strokes.material.uniforms.avatarCenter.value.copy(center);
  const frameDelta = THREE.MathUtils.clamp(delta, 1 / 240, 1 / 24);
  const directionLength = Math.hypot(flowDirection.x, flowDirection.y, flowDirection.z) || 1;
  const directionX = flowDirection.x / directionLength;
  const directionY = flowDirection.y / directionLength;
  const directionZ = flowDirection.z / directionLength;
  const viewLength = Math.hypot(viewDirection.x, viewDirection.y, viewDirection.z) || 1;
  const viewX = viewDirection.x / viewLength;
  const viewY = viewDirection.y / viewLength;
  const viewZ = viewDirection.z / viewLength;
  const bodyInfluences = trackers.filter((tracker) => tracker?.anchorPosition).slice(0, 12);
  const bodyPointUniforms = field.strokes.material.uniforms.bodyPoints.value;
  field.strokes.material.uniforms.bodyPointCount.value = bodyInfluences.length;
  field.spawnPointCount = bodyInfluences.length;
  for (let index = 0; index < bodyInfluences.length; index += 1) {
    bodyPointUniforms[index].copy(bodyInfluences[index].anchorPosition);
    field.spawnPoints[index].copy(bodyInfluences[index].anchorPosition);
  }
  const motionInfluences = [...bodyInfluences]
    .sort((first, second) => second.speed - first.speed)
    .slice(0, 10);
  const influenceStrength = field.influence;
  const bodyFlowStrength = field.bodyFlow;
  const curvatureStrength = field.curvature;
  const laminarDrift = curvatureStrength * (0.006 + field.speed * 0.004);
  const organicCurve = curvatureStrength * (0.012 + field.speed * 0.006);
  const baseSpeed = 0.55 * field.speed;
  field.fluidAccumulator += frameDelta;
  if (field.fluidAccumulator >= 1 / 30) {
    const fluidDelta = Math.min(1 / 15, field.fluidAccumulator);
    field.fluidTime += fluidDelta;
    advanceFluidGrid(field, fluidDelta, directionX, directionY, directionZ, baseSpeed);
    depositTrackerCurrents(field, motionInfluences, center, fluidDelta);
    field.fluidAccumulator %= 1 / 30;
  }
  const count = field.count;
  if (field.concentrationReseedRemaining > 0 && field.spawnPointCount > 0) {
    const reseedBatch = Math.min(
      field.concentrationReseedRemaining,
      Math.max(8, Math.ceil(count / 45))
    );
    for (let reseed = 0; reseed < reseedBatch; reseed += 1) {
      const particleIndex = field.concentrationReseedCursor % count;
      setParticlePosition(field, particleIndex, center, true);
      field.concentrationReseedCursor = (field.concentrationReseedCursor + 1) % count;
    }
    field.concentrationReseedRemaining -= reseedBatch;
  }
  const minX = center.x - field.halfExtents.x;
  const maxX = center.x + field.halfExtents.x;
  const minY = center.y - field.halfExtents.y;
  const maxY = center.y + field.halfExtents.y;
  const minZ = center.z - field.halfExtents.z;
  const maxZ = center.z + field.halfExtents.z;
  const updateTrailAlpha = field.alphaDirty;
  const fadeExponent = updateTrailAlpha
    ? THREE.MathUtils.lerp(0.38, 3.4, field.trailFade)
    : 1;
  const concentrationMix = Math.sqrt(THREE.MathUtils.clamp(field.concentration / 5, 0, 1));

  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    let px = field.positions[offset];
    let py = field.positions[offset + 1];
    let pz = field.positions[offset + 2];
    const phase = field.phases[index];

    const driftA = Math.sin(py * 0.52 + pz * 0.27 + time * 0.19 + phase);
    const driftB = Math.cos(px * 0.31 + py * 0.22 - time * 0.16 + phase * 0.83);
    const curveA = Math.sin(px * 0.85 + pz * 0.65 + time * 0.45 + phase);
    const curveB = Math.cos(px * 0.75 - py * 0.65 - time * 0.38 + phase * 0.7);
    let targetX = directionX * baseSpeed + driftA * laminarDrift * 0.22;
    let targetY = directionY * baseSpeed + driftA * laminarDrift + curveA * organicCurve;
    let targetZ = directionZ * baseSpeed + driftB * laminarDrift + curveB * organicCurve;
    const fluid = sampleFluidGrid(field, px, py, pz, center);
    const fluidX = fluid[0];
    const fluidY = fluid[1];
    const fluidZ = fluid[2];
    const fluidMagnitude = Math.hypot(fluidX, fluidY, fluidZ);
    targetX += fluidX;
    targetY += fluidY;
    targetZ += fluidZ;
    let localMotion = THREE.MathUtils.clamp(fluidMagnitude * 0.55, 0, 2);

    for (const tracker of bodyInfluences) {
      const dx = px - tracker.anchorPosition.x;
      const dy = py - tracker.anchorPosition.y;
      const dz = pz - tracker.anchorPosition.z;
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      const bodyRadius = bodyFlowStrength > 0
        ? 0.62 * (0.82 + Math.sqrt(bodyFlowStrength) * 0.24)
        : 0;
      if (distanceSquared >= bodyRadius * bodyRadius) continue;

      const distance = Math.sqrt(Math.max(0.00001, distanceSquared));
      const proximity = 1 - distance / bodyRadius;
      const weight = proximity * proximity;
      const inverseDistance = 1 / distance;
      const nx = dx * inverseDistance;
      const ny = dy * inverseDistance;
      const nz = dz * inverseDistance;
      const streamDot = nx * directionX + ny * directionY + nz * directionZ;
      const transverseX = nx - directionX * streamDot;
      const transverseY = ny - directionY * streamDot;
      const transverseZ = nz - directionZ * streamDot;
      let tangentX = directionX - nx * streamDot;
      let tangentY = directionY - ny * streamDot;
      let tangentZ = directionZ - nz * streamDot;
      const tangentLength = Math.hypot(tangentX, tangentY, tangentZ);
      if (tangentLength > 0.0001) {
        tangentX /= tangentLength;
        tangentY /= tangentLength;
        tangentZ /= tangentLength;
      }
      const pressure = weight * (0.16 + proximity * 0.42) * bodyFlowStrength;
      const wrap = weight * (0.28 + proximity * 0.62) * bodyFlowStrength;
      targetX += transverseX * pressure + tangentX * wrap;
      targetY += transverseY * pressure + tangentY * wrap;
      targetZ += transverseZ * pressure + tangentZ * wrap;
      localMotion = Math.max(localMotion, weight * bodyFlowStrength * 0.16);
    }

    const inertiaAmount = THREE.MathUtils.clamp(curvatureStrength / 5, 0, 1);
    const recoveryRate = (1.6 + field.recovery * 1.25) / (1 + inertiaAmount * 1.8);
    const response = Math.min(1, frameDelta * (recoveryRate + localMotion * 2.6));
    let velocityX = THREE.MathUtils.lerp(field.velocities[offset], targetX, response);
    let velocityY = THREE.MathUtils.lerp(field.velocities[offset + 1], targetY, response);
    let velocityZ = THREE.MathUtils.lerp(field.velocities[offset + 2], targetZ, response);
    const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY + velocityZ * velocityZ);
    const maximumSpeed = 1.25
      + field.speed * 1.15
      + localMotion * 2.2
      + influenceStrength * 0.35;
    if (speed > maximumSpeed) {
      const scale = maximumSpeed / speed;
      velocityX *= scale;
      velocityY *= scale;
      velocityZ *= scale;
    }

    px += velocityX * frameDelta;
    py += velocityY * frameDelta;
    pz += velocityZ * frameDelta;
    field.particleAges[index] += frameDelta;
    const maximumAge = THREE.MathUtils.lerp(24, 4.5, concentrationMix)
      * (0.75 + seededRandom(index, 27, field.epochs[index]) * 0.5);
    const concentrationExpired = concentrationMix > 0.001
      && field.particleAges[index] > maximumAge;
    if (
      px < minX || px > maxX
      || py < minY || py > maxY
      || pz < minZ || pz > maxZ
      || concentrationExpired
    ) {
      setParticlePosition(field, index, center, true);
      px = field.positions[offset];
      py = field.positions[offset + 1];
      pz = field.positions[offset + 2];
      velocityX = field.velocities[offset];
      velocityY = field.velocities[offset + 1];
      velocityZ = field.velocities[offset + 2];
    } else {
      field.positions[offset] = px;
      field.positions[offset + 1] = py;
      field.positions[offset + 2] = pz;
      field.velocities[offset] = velocityX;
      field.velocities[offset + 1] = velocityY;
      field.velocities[offset + 2] = velocityZ;
    }

    const resolvedSpeed = Math.sqrt(
      velocityX * velocityX + velocityY * velocityY + velocityZ * velocityZ
    );
    const rawColorAmount = THREE.MathUtils.clamp(
      0.1
        + resolvedSpeed / Math.max(1.2, maximumSpeed) * 0.52
        + localMotion * 0.68,
      0,
      1
    );
    const variationMix = THREE.MathUtils.clamp(field.colorVariation / 3, 0, 1) * 0.85;
    const colorAmount = THREE.MathUtils.lerp(
      rawColorAmount,
      field.colorSeeds[index],
      variationMix
    );
    gradientColor(field, colorAmount, field.colors, offset);

    const trailOffset = index * TRAIL_POINTS * 3;
    field.trailHistory[trailOffset] = px;
    field.trailHistory[trailOffset + 1] = py;
    field.trailHistory[trailOffset + 2] = pz;
    const followRate = (4.1 + localMotion * 2.2) / field.trailLength;
    const trailResponse = Math.min(1, frameDelta * followRate);
    for (let point = 1; point < TRAIL_POINTS; point += 1) {
      const pointOffset = trailOffset + point * 3;
      const leaderOffset = pointOffset - 3;
      field.trailHistory[pointOffset] = THREE.MathUtils.lerp(
        field.trailHistory[pointOffset],
        field.trailHistory[leaderOffset],
        trailResponse
      );
      field.trailHistory[pointOffset + 1] = THREE.MathUtils.lerp(
        field.trailHistory[pointOffset + 1],
        field.trailHistory[leaderOffset + 1],
        trailResponse
      );
      field.trailHistory[pointOffset + 2] = THREE.MathUtils.lerp(
        field.trailHistory[pointOffset + 2],
        field.trailHistory[leaderOffset + 2],
        trailResponse
      );
    }

    const sampleOffset = index * (RENDER_SEGMENTS + 1) * 3;
    for (let sample = 0; sample <= RENDER_SEGMENTS; sample += 1) {
      writeSmoothTrailSample(
        field,
        trailOffset,
        sample / RENDER_SEGMENTS,
        sampleOffset + sample * 3
      );
    }

    const originX = field.trailHistory[trailOffset];
    const originY = field.trailHistory[trailOffset + 1];
    const originZ = field.trailHistory[trailOffset + 2];
    for (let sample = 0; sample <= RENDER_SEGMENTS; sample += 1) {
      const curveOffset = sampleOffset + sample * 3;
      field.curveSamples[curveOffset] = originX
        + (field.curveSamples[curveOffset] - originX) * field.strokeLength;
      field.curveSamples[curveOffset + 1] = originY
        + (field.curveSamples[curveOffset + 1] - originY) * field.strokeLength;
      field.curveSamples[curveOffset + 2] = originZ
        + (field.curveSamples[curveOffset + 2] - originZ) * field.strokeLength;
    }

    const halfWidth = field.thickness * 0.0045;
    const ribbonVertexOffset = index * RIBBON_VERTICES;
    for (let sample = 0; sample <= RENDER_SEGMENTS; sample += 1) {
      const pointOffset = sampleOffset + sample * 3;
      const previousOffset = sampleOffset + Math.max(0, sample - 1) * 3;
      const nextOffset = sampleOffset + Math.min(RENDER_SEGMENTS, sample + 1) * 3;
      let tangentX = field.curveSamples[nextOffset] - field.curveSamples[previousOffset];
      let tangentY = field.curveSamples[nextOffset + 1] - field.curveSamples[previousOffset + 1];
      let tangentZ = field.curveSamples[nextOffset + 2] - field.curveSamples[previousOffset + 2];
      const inverseTangentLength = 1 / Math.max(
        0.0001,
        Math.hypot(tangentX, tangentY, tangentZ)
      );
      tangentX *= inverseTangentLength;
      tangentY *= inverseTangentLength;
      tangentZ *= inverseTangentLength;

      let sideX = tangentY * viewZ - tangentZ * viewY;
      let sideY = tangentZ * viewX - tangentX * viewZ;
      let sideZ = tangentX * viewY - tangentY * viewX;
      let sideLength = Math.hypot(sideX, sideY, sideZ);
      if (sideLength < 0.0001) {
        sideX = -tangentZ;
        sideY = 0;
        sideZ = tangentX;
        sideLength = Math.hypot(sideX, sideZ);
      }
      if (sideLength < 0.0001) {
        sideX = 1;
        sideY = 0;
        sideZ = 0;
        sideLength = 1;
      }
      const sideScale = halfWidth / sideLength;
      sideX *= sideScale;
      sideY *= sideScale;
      sideZ *= sideScale;

      const vertexIndex = ribbonVertexOffset + sample * 2;
      const leftOffset = vertexIndex * 3;
      const rightOffset = leftOffset + 3;
      const pointX = field.curveSamples[pointOffset];
      const pointY = field.curveSamples[pointOffset + 1];
      const pointZ = field.curveSamples[pointOffset + 2];
      field.ribbonPositions[leftOffset] = pointX + sideX;
      field.ribbonPositions[leftOffset + 1] = pointY + sideY;
      field.ribbonPositions[leftOffset + 2] = pointZ + sideZ;
      field.ribbonPositions[rightOffset] = pointX - sideX;
      field.ribbonPositions[rightOffset + 1] = pointY - sideY;
      field.ribbonPositions[rightOffset + 2] = pointZ - sideZ;
      field.ribbonColors[leftOffset] = field.colors[offset];
      field.ribbonColors[leftOffset + 1] = field.colors[offset + 1];
      field.ribbonColors[leftOffset + 2] = field.colors[offset + 2];
      field.ribbonColors[rightOffset] = field.colors[offset];
      field.ribbonColors[rightOffset + 1] = field.colors[offset + 1];
      field.ribbonColors[rightOffset + 2] = field.colors[offset + 2];

      if (updateTrailAlpha) {
        const progress = sample / RENDER_SEGMENTS;
        const strength = field.trailFade <= 0.001 ? 1 : Math.pow(progress, fadeExponent);
        field.ribbonAlphas[vertexIndex] = strength;
        field.ribbonAlphas[vertexIndex + 1] = strength;
      }
    }
  }

  field.strokes.geometry.attributes.position.needsUpdate = true;
  field.strokes.geometry.attributes.color.needsUpdate = true;
  if (updateTrailAlpha) {
    field.strokes.geometry.attributes.trailAlpha.needsUpdate = true;
    field.alphaDirty = false;
  }
}
