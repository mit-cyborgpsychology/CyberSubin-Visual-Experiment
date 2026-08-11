import * as THREE from 'three';

const BODY_CHAINS = [
  ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head'],
  ['Spine2', 'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand'],
  ['Spine2', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'],
  ['Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase'],
  ['Hips', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']
];

const TRACKER_FALLBACKS = {
  Hips: 'body',
  Spine: 'body',
  Spine1: 'body',
  Spine2: 'body',
  Neck: 'head',
  Head: 'head',
  LeftShoulder: 'leftArm',
  LeftArm: 'leftArm',
  LeftForeArm: 'leftArm',
  LeftHand: 'leftHand',
  RightShoulder: 'rightArm',
  RightArm: 'rightArm',
  RightForeArm: 'rightArm',
  RightHand: 'rightHand',
  LeftUpLeg: 'leftLeg',
  LeftLeg: 'leftLeg',
  LeftFoot: 'leftFoot',
  LeftToeBase: 'leftFoot',
  RightUpLeg: 'rightLeg',
  RightLeg: 'rightLeg',
  RightFoot: 'rightFoot',
  RightToeBase: 'rightFoot'
};

const EXPERIMENT_RED = new THREE.Color(0xfb5c50);
const CANDIDATE_MULTIPLIER = 2.75;
const PARTICLE_ALPHA = 0.86;
const PARTICLE_SIZE = 14;
const BASE_PARTICLE_BUDGET = Object.freeze({ embedded: 1800, full: 10000 });
const MAX_PARTICLE_BUDGET = Object.freeze({ embedded: 2400, full: 13500 });

const VERTEX_SHADER = /* glsl */`
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uBodyHeight;
  attribute vec3 color;
  attribute float aPhase;
  attribute float aSize;
  attribute float aAlpha;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // Particle positions are rebuilt from the current pose every frame. Keep
    // them exact here so the shape never floats away from the body contour.
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = max(1.0, aSize * uPixelRatio * (2.9 / max(1.0, -viewPosition.z)));
    vColor = color;
    vAlpha = aAlpha;
  }
`;

const FRAGMENT_SHADER = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float alpha = smoothstep(1.0, 0.18, radius) * vAlpha;
    if (alpha < 0.012) discard;
    float luminousCore = 0.78 + smoothstep(0.92, 0.0, radius) * 0.34;
    gl_FragColor = vec4(vColor * luminousCore, alpha);
  }
`;

function halton(index, base) {
  let fraction = 1;
  let result = 0;
  let value = index;
  while (value > 0) {
    fraction /= base;
    result += fraction * (value % base);
    value = Math.floor(value / base);
  }
  return result;
}

function createCandidates(count) {
  const coordinates = new Float32Array(count * 3);
  const selectors = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let index = 0; index < count; index += 1) {
    const sequence = index + 1;
    coordinates[index * 3] = halton(sequence, 2) * 2 - 1;
    coordinates[index * 3 + 1] = halton(sequence, 3) * 2 - 1;
    coordinates[index * 3 + 2] = halton(sequence, 5) * 2 - 1;
    selectors[index] = halton(sequence, 7);
    phases[index] = halton(sequence, 11) * Math.PI * 2;
  }
  return { coordinates, selectors, phases, count };
}

export function createExternalSpacePointCloud({ embedded = false } = {}) {
  const baseBudget = embedded ? BASE_PARTICLE_BUDGET.embedded : BASE_PARTICLE_BUDGET.full;
  const budget = embedded ? MAX_PARTICLE_BUDGET.embedded : MAX_PARTICLE_BUDGET.full;
  const geometry = new THREE.BufferGeometry();
  const positions = new THREE.BufferAttribute(new Float32Array(budget * 3), 3);
  const colors = new THREE.BufferAttribute(new Float32Array(budget * 3), 3);
  const phases = new THREE.BufferAttribute(new Float32Array(budget), 1);
  const sizes = new THREE.BufferAttribute(new Float32Array(budget), 1);
  const alphas = new THREE.BufferAttribute(new Float32Array(budget), 1);
  for (const attribute of [positions, colors, phases, sizes, alphas]) {
    attribute.setUsage(THREE.DynamicDrawUsage);
  }
  geometry.setAttribute('position', positions);
  geometry.setAttribute('color', colors);
  geometry.setAttribute('aPhase', phases);
  geometry.setAttribute('aSize', sizes);
  geometry.setAttribute('aAlpha', alphas);
  geometry.setDrawRange(0, 0);

  const uniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: 1 },
    uBodyHeight: { value: 3 }
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 14;
  points.visible = false;
  const group = new THREE.Group();
  group.add(points);

  return {
    group,
    points,
    geometry,
    positions,
    colors,
    phases,
    sizes,
    alphas,
    uniforms,
    // Scan a larger deterministic candidate field and pack every accepted
    // point. This keeps the negative-space volume evenly filled instead of
    // leaving sparse holes wherever a candidate lands inside the body.
    candidates: createCandidates(Math.ceil(budget * CANDIDATE_MULTIPLIER)),
    targetPositions: new Float32Array(budget * 3),
    targetColors: new Float32Array(budget * 3),
    targetSizes: new Float32Array(budget),
    targetAlphas: new Float32Array(budget),
    budget,
    baseBudget,
    embedded,
    surfaceRoot: null,
    surfaceSamplers: [],
    targetCount: 0,
    visibleCount: 0,
    renderCount: 0,
    initialized: false,
    color: EXPERIMENT_RED.clone(),
    bodyHeight: 3
  };
}

function commitPointCloud(visuals) {
  const pointValues = visuals.targetCount * 3;
  visuals.positions.array.set(visuals.targetPositions.subarray(0, pointValues), 0);
  visuals.colors.array.set(visuals.targetColors.subarray(0, pointValues), 0);
  visuals.sizes.array.set(visuals.targetSizes.subarray(0, visuals.targetCount), 0);
  visuals.alphas.array.set(visuals.targetAlphas.subarray(0, visuals.targetCount), 0);
  visuals.renderCount = visuals.targetCount;
  visuals.initialized = true;
  for (const attribute of [visuals.positions, visuals.colors, visuals.phases, visuals.sizes, visuals.alphas]) {
    attribute.needsUpdate = true;
  }
  visuals.geometry.setDrawRange(0, visuals.renderCount);
  visuals.points.visible = visuals.visibleCount > 0;
}

function getBoneRadius(name, bodyHeight) {
  if (/Head/i.test(name)) return bodyHeight * 0.105;
  if (/Neck/i.test(name)) return bodyHeight * 0.058;
  if (/Spine2/i.test(name)) return bodyHeight * 0.145;
  if (/Hips|Spine/i.test(name)) return bodyHeight * 0.125;
  if (/UpLeg/i.test(name)) return bodyHeight * 0.075;
  if (/Leg/i.test(name)) return bodyHeight * 0.055;
  if (/Foot|Toe/i.test(name)) return bodyHeight * 0.058;
  if (/Shoulder/i.test(name)) return bodyHeight * 0.055;
  if (/ForeArm/i.test(name)) return bodyHeight * 0.044;
  if (/Arm/i.test(name)) return bodyHeight * 0.05;
  if (/Hand/i.test(name)) return bodyHeight * 0.048;
  return bodyHeight * 0.055;
}

function convexHull(points) {
  if (points.length < 3) return points;
  const sorted = points.slice().sort((first, second) => first.x - second.x || first.y - second.y);
  const cross = (origin, first, second) => (
    (first.x - origin.x) * (second.y - origin.y)
    - (first.y - origin.y) * (second.x - origin.x)
  );
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return [...lower, ...upper];
}

function pointInsidePolygon(x, y, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if (
      (currentPoint.y > y) !== (previousPoint.y > y)
      && x < (previousPoint.x - currentPoint.x) * (y - currentPoint.y)
        / (previousPoint.y - currentPoint.y + 0.0000001) + currentPoint.x
    ) inside = !inside;
  }
  return inside;
}

function measureToCapsule(px, py, pz, capsule) {
  const abx = capsule.end.position.x - capsule.start.position.x;
  const aby = capsule.end.position.y - capsule.start.position.y;
  const abz = capsule.end.position.z - capsule.start.position.z;
  const apx = px - capsule.start.position.x;
  const apy = py - capsule.start.position.y;
  const apz = pz - capsule.start.position.z;
  const denominator = abx * abx + aby * aby + abz * abz;
  const progress = denominator > 0.0000001
    ? THREE.MathUtils.clamp((apx * abx + apy * aby + apz * abz) / denominator, 0, 1)
    : 0;
  const dx = px - (capsule.start.position.x + abx * progress);
  const dy = py - (capsule.start.position.y + aby * progress);
  const dz = pz - (capsule.start.position.z + abz * progress);
  const radius = THREE.MathUtils.lerp(capsule.start.radius, capsule.end.radius, progress);
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - radius;
}

function sampleCapsuleSurface(capsule, bodyHeight, hullSamples) {
  const horizontalLength = capsule.end.horizontal - capsule.start.horizontal;
  const verticalLength = capsule.end.vertical - capsule.start.vertical;
  const projectedLength = Math.hypot(horizontalLength, verticalLength);
  const alongSamples = THREE.MathUtils.clamp(
    Math.ceil(projectedLength / Math.max(bodyHeight * 0.045, 0.001)),
    4,
    14
  );
  const radialSamples = 16;

  // Sample the full anatomical segment, including its end caps. The resulting
  // silhouette is built from estimated skin surfaces rather than joint centers.
  for (let along = 0; along <= alongSamples; along += 1) {
    const progress = along / alongSamples;
    const horizontal = THREE.MathUtils.lerp(
      capsule.start.horizontal,
      capsule.end.horizontal,
      progress
    );
    const vertical = THREE.MathUtils.lerp(
      capsule.start.vertical,
      capsule.end.vertical,
      progress
    );
    const radius = THREE.MathUtils.lerp(
      capsule.start.radius,
      capsule.end.radius,
      progress
    );
    for (let radial = 0; radial < radialSamples; radial += 1) {
      const angle = radial / radialSamples * Math.PI * 2;
      hullSamples.push(new THREE.Vector2(
        horizontal + Math.cos(angle) * radius,
        vertical + Math.sin(angle) * radius
      ));
    }
  }
}

function getSurfaceSamplers(visuals, root) {
  if (!root) return [];
  if (visuals.surfaceRoot === root) return visuals.surfaceSamplers;

  const meshes = [];
  let totalVertices = 0;
  root.traverse((child) => {
    const position = child.geometry?.getAttribute?.('position');
    if (!child.isMesh || !position?.count) return;
    meshes.push({ mesh: child, vertexCount: position.count });
    totalVertices += position.count;
  });

  const surfaceBudget = visuals.embedded ? 320 : 720;
  visuals.surfaceSamplers = meshes.map(({ mesh, vertexCount }) => {
    const sampleCount = THREE.MathUtils.clamp(
      Math.round(surfaceBudget * vertexCount / Math.max(1, totalVertices)),
      12,
      Math.min(surfaceBudget, vertexCount)
    );
    const indices = new Uint32Array(sampleCount);
    for (let index = 0; index < sampleCount; index += 1) {
      indices[index] = Math.min(
        vertexCount - 1,
        Math.floor((index + 0.5) * vertexCount / sampleCount)
      );
    }
    return { mesh, indices };
  });
  visuals.surfaceRoot = root;
  return visuals.surfaceSamplers;
}

function sampleSkinnedSurface(visuals, root, frame, hullSamples) {
  const samplers = getSurfaceSamplers(visuals, root);
  if (!samplers.length) return null;
  root.updateMatrixWorld(true);

  const vertex = new THREE.Vector3();
  const relative = new THREE.Vector3();
  let minimumDepth = Infinity;
  let maximumDepth = -Infinity;
  let sampleCount = 0;
  for (const { mesh, indices } of samplers) {
    for (const vertexIndex of indices) {
      mesh.getVertexPosition(vertexIndex, vertex).applyMatrix4(mesh.matrixWorld);
      relative.copy(vertex).sub(frame.hips);
      const horizontal = relative.dot(frame.horizontalAxis);
      const vertical = relative.dot(frame.verticalAxis);
      const depth = relative.dot(frame.depthAxis);
      if (!Number.isFinite(horizontal + vertical + depth)) continue;
      hullSamples.push(new THREE.Vector2(horizontal, vertical));
      minimumDepth = Math.min(minimumDepth, depth);
      maximumDepth = Math.max(maximumDepth, depth);
      sampleCount += 1;
    }
  }
  return sampleCount >= 24 ? { minimumDepth, maximumDepth } : null;
}

function buildBodyFrame(bones, trackers, displayHeight) {
  const trackersById = new Map(trackers.map((tracker) => [tracker.definition.id, tracker]));
  const resolvePosition = (name) => {
    const bone = bones.get(name);
    if (bone) return bone.getWorldPosition(new THREE.Vector3());
    return trackersById.get(TRACKER_FALLBACKS[name])?.anchorPosition?.clone() ?? null;
  };
  const hips = resolvePosition('Hips');
  const head = resolvePosition('Head');
  const leftShoulder = resolvePosition('LeftArm');
  const rightShoulder = resolvePosition('RightArm');
  if (!hips || !head || !leftShoulder || !rightShoulder) return null;

  const verticalAxis = head.clone().sub(hips);
  if (verticalAxis.lengthSq() < 0.0001) verticalAxis.set(0, 1, 0);
  verticalAxis.normalize();
  const horizontalAxis = rightShoulder.clone().sub(leftShoulder);
  horizontalAxis.addScaledVector(verticalAxis, -horizontalAxis.dot(verticalAxis));
  if (horizontalAxis.lengthSq() < 0.0001) horizontalAxis.set(1, 0, 0);
  horizontalAxis.normalize();
  const depthAxis = horizontalAxis.clone().cross(verticalAxis).normalize();
  horizontalAxis.copy(verticalAxis).cross(depthAxis).normalize();

  const uniqueNames = [...new Set(BODY_CHAINS.flat())];
  const rawNodes = uniqueNames.map((name) => ({ name, position: resolvePosition(name) }))
    .filter((node) => node.position);
  let minimumVertical = Infinity;
  let maximumVertical = -Infinity;
  for (const node of rawNodes) {
    const relative = node.position.clone().sub(hips);
    node.horizontal = relative.dot(horizontalAxis);
    node.vertical = relative.dot(verticalAxis);
    node.depth = relative.dot(depthAxis);
    minimumVertical = Math.min(minimumVertical, node.vertical);
    maximumVertical = Math.max(maximumVertical, node.vertical);
  }
  const bodyHeight = Math.max(maximumVertical - minimumVertical, displayHeight * 0.62);
  const nodes = new Map(rawNodes.map((node) => [node.name, {
    ...node,
    radius: getBoneRadius(node.name, bodyHeight)
  }]));
  const capsules = [];
  for (const chain of BODY_CHAINS) {
    for (let index = 0; index < chain.length - 1; index += 1) {
      const start = nodes.get(chain[index]);
      const end = nodes.get(chain[index + 1]);
      if (start && end) capsules.push({ start, end });
    }
  }
  return { hips, verticalAxis, horizontalAxis, depthAxis, nodes, capsules, bodyHeight };
}

export function updateExternalSpacePointCloud(
  visuals,
  {
    root = null,
    bones,
    trackers,
    time,
    pixelRatio = 1,
    displayHeight = 3,
    intensity = 100
  }
) {
  visuals.uniforms.uTime.value = time;
  visuals.uniforms.uPixelRatio.value = pixelRatio;

  const frame = buildBodyFrame(bones, trackers, displayHeight);
  if (!frame || frame.capsules.length < 4) {
    visuals.targetCount = 0;
    visuals.visibleCount = 0;
    commitPointCloud(visuals);
    return;
  }
  const { hips, horizontalAxis, verticalAxis, depthAxis, capsules, bodyHeight } = frame;
  visuals.bodyHeight = bodyHeight;
  visuals.uniforms.uBodyHeight.value = bodyHeight;

  const hullSamples = [];
  let minimumDepth = Infinity;
  let maximumDepth = -Infinity;
  const skinnedSurface = sampleSkinnedSurface(visuals, root, frame, hullSamples);
  if (skinnedSurface) {
    minimumDepth = skinnedSurface.minimumDepth;
    maximumDepth = skinnedSurface.maximumDepth;
  } else {
    for (const capsule of capsules) {
      minimumDepth = Math.min(
        minimumDepth,
        capsule.start.depth - capsule.start.radius,
        capsule.end.depth - capsule.end.radius
      );
      maximumDepth = Math.max(
        maximumDepth,
        capsule.start.depth + capsule.start.radius,
        capsule.end.depth + capsule.end.radius
      );
      sampleCapsuleSurface(capsule, bodyHeight, hullSamples);
    }
  }
  let hull = convexHull(hullSamples);
  if (hull.length < 3) {
    visuals.targetCount = 0;
    visuals.visibleCount = 0;
    commitPointCloud(visuals);
    return;
  }
  const hullCenter = hull.reduce((center, point) => center.add(point), new THREE.Vector2())
    .multiplyScalar(1 / hull.length);
  const normalizedIntensity = THREE.MathUtils.clamp(Number(intensity) / 100, 0, 2);
  const addedEmphasis = Math.max(0, normalizedIntensity - 1);
  const envelopePadding = bodyHeight * (0.085 + addedEmphasis * 0.025);
  hull = hull.map((point) => {
    const outward = point.clone().sub(hullCenter);
    return outward.lengthSq() > 0.000001
      ? point.clone().add(outward.normalize().multiplyScalar(envelopePadding))
      : point.clone();
  });
  let minimumHorizontal = Infinity;
  let maximumHorizontal = -Infinity;
  let minimumHullVertical = Infinity;
  let maximumHullVertical = -Infinity;
  for (const point of hull) {
    minimumHorizontal = Math.min(minimumHorizontal, point.x);
    maximumHorizontal = Math.max(maximumHorizontal, point.x);
    minimumHullVertical = Math.min(minimumHullVertical, point.y);
    maximumHullVertical = Math.max(maximumHullVertical, point.y);
  }
  const horizontalRange = maximumHorizontal - minimumHorizontal;
  const verticalRange = maximumHullVertical - minimumHullVertical;
  const depthCenter = (minimumDepth + maximumDepth) * 0.5;
  const depthHalf = Math.max(
    (maximumDepth - minimumDepth) * 0.5 + bodyHeight * 0.04,
    bodyHeight * 0.13
  );
  // Begin immediately outside the estimated skin surface. The stencil test is
  // the final guard against drawing any particle inside the rendered mesh.
  const bodyClearance = Math.max(bodyHeight * 0.0045, 0.004);
  const pointEmphasisScale = normalizedIntensity <= 1
    ? THREE.MathUtils.lerp(0.82, 1, normalizedIntensity)
    : THREE.MathUtils.lerp(1, 1.3, addedEmphasis);
  const alphaEmphasisScale = normalizedIntensity <= 1
    ? THREE.MathUtils.lerp(0.68, 1, normalizedIntensity)
    : THREE.MathUtils.lerp(1, 1.16, addedEmphasis);
  const pointSizeScale = (visuals.embedded ? 0.7 : 1) * pointEmphasisScale;
  const pointAlpha = THREE.MathUtils.clamp(
    PARTICLE_ALPHA * alphaEmphasisScale,
    0.38,
    1
  );
  const drawBudget = Math.min(
    visuals.budget,
    Math.round(visuals.baseBudget * (
      normalizedIntensity <= 1
        ? THREE.MathUtils.lerp(0.62, 1, normalizedIntensity)
        : THREE.MathUtils.lerp(1, visuals.budget / visuals.baseBudget, addedEmphasis)
    ))
  );
  let drawCount = 0;

  for (
    let candidateIndex = 0;
    candidateIndex < visuals.candidates.count && drawCount < drawBudget;
    candidateIndex += 1
  ) {
    const candidateOffset = candidateIndex * 3;
    const normalizedHorizontal = visuals.candidates.coordinates[candidateOffset];
    const normalizedVertical = visuals.candidates.coordinates[candidateOffset + 1];
    const normalizedDepth = visuals.candidates.coordinates[candidateOffset + 2];
    const horizontal = minimumHorizontal + (normalizedHorizontal + 1) * 0.5 * horizontalRange;
    const vertical = minimumHullVertical + (normalizedVertical + 1) * 0.5 * verticalRange;
    if (!pointInsidePolygon(horizontal, vertical, hull)) continue;

    const radialHorizontal = (horizontal - hullCenter.x) / Math.max(0.001, horizontalRange * 0.5);
    const radialVertical = (vertical - hullCenter.y) / Math.max(0.001, verticalRange * 0.5);
    const radial = Math.min(1, Math.sqrt(radialHorizontal ** 2 + radialVertical ** 2));
    const localDepthHalf = depthHalf * (0.42 + (1 - radial) * 0.58);
    const depth = depthCenter + normalizedDepth * localDepthHalf;
    const worldX = hips.x
      + horizontalAxis.x * horizontal + verticalAxis.x * vertical + depthAxis.x * depth;
    const worldY = hips.y
      + horizontalAxis.y * horizontal + verticalAxis.y * vertical + depthAxis.y * depth;
    const worldZ = hips.z
      + horizontalAxis.z * horizontal + verticalAxis.z * vertical + depthAxis.z * depth;
    let clearance = Infinity;
    for (const capsule of capsules) {
      clearance = Math.min(clearance, measureToCapsule(worldX, worldY, worldZ, capsule));
    }
    if (clearance <= bodyClearance) continue;

    // Every accepted point uses the same color, size, and opacity. The Halton
    // field provides an even volumetric distribution between the live body
    // contour and its outer envelope without surface clustering.
    const pointOffset = drawCount * 3;
    visuals.targetPositions[pointOffset] = worldX;
    visuals.targetPositions[pointOffset + 1] = worldY;
    visuals.targetPositions[pointOffset + 2] = worldZ;
    visuals.targetColors[pointOffset] = visuals.color.r;
    visuals.targetColors[pointOffset + 1] = visuals.color.g;
    visuals.targetColors[pointOffset + 2] = visuals.color.b;
    visuals.phases.array[drawCount] = visuals.candidates.phases[candidateIndex];
    visuals.targetSizes[drawCount] = PARTICLE_SIZE * pointSizeScale;
    visuals.targetAlphas[drawCount] = pointAlpha;
    drawCount += 1;
  }

  visuals.targetCount = drawCount;
  visuals.visibleCount = drawCount;
  visuals.phases.needsUpdate = true;
  commitPointCloud(visuals);
}
