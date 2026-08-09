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

const CANDIDATE_MULTIPLIER = 3.25;
const UPDATE_RATE = { single: 18, embedded: 12 };
const EXPERIMENT_RED = new THREE.Color(0xfb5c50);

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
    vec3 fluidPosition = position;
    float drift = uBodyHeight * 0.0065;
    fluidPosition.x += sin(uTime * 0.72 + aPhase + position.y * 2.1) * drift;
    fluidPosition.y += cos(uTime * 0.58 + aPhase * 1.37 + position.x * 1.8) * drift;
    fluidPosition.z += sin(uTime * 0.84 + aPhase * 0.71 + position.x * 2.4) * drift * 1.3;
    vec4 viewPosition = modelViewMatrix * vec4(fluidPosition, 1.0);
    gl_Position = projectionMatrix * viewPosition;
    gl_PointSize = max(1.0, aSize * uPixelRatio * (2.9 / max(1.0, -viewPosition.z)));
    vColor = color;
    vAlpha = aAlpha * (0.88 + sin(uTime * 1.08 + aPhase) * 0.12);
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
  const budget = embedded ? 1500 : 8000;
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
    candidates: createCandidates(Math.ceil(budget * CANDIDATE_MULTIPLIER)),
    budget,
    embedded,
    lastUpdate: -Infinity,
    color: EXPERIMENT_RED.clone(),
    bodyHeight: 3
  };
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
  { bones, trackers, time, pixelRatio = 1, displayHeight = 3 }
) {
  visuals.uniforms.uTime.value = time;
  visuals.uniforms.uPixelRatio.value = pixelRatio;
  const updateRate = visuals.embedded ? UPDATE_RATE.embedded : UPDATE_RATE.single;
  if (time - visuals.lastUpdate < 1 / updateRate) return;
  visuals.lastUpdate = time;

  const frame = buildBodyFrame(bones, trackers, displayHeight);
  if (!frame || frame.capsules.length < 4) {
    visuals.points.visible = false;
    visuals.geometry.setDrawRange(0, 0);
    return;
  }
  const { hips, horizontalAxis, verticalAxis, depthAxis, nodes, capsules, bodyHeight } = frame;
  visuals.bodyHeight = bodyHeight;
  visuals.uniforms.uBodyHeight.value = bodyHeight;

  const hullSamples = [];
  let minimumDepth = Infinity;
  let maximumDepth = -Infinity;
  for (const node of nodes.values()) {
    minimumDepth = Math.min(minimumDepth, node.depth - node.radius);
    maximumDepth = Math.max(maximumDepth, node.depth + node.radius);
    for (let sample = 0; sample < 10; sample += 1) {
      const angle = sample / 10 * Math.PI * 2;
      const surfaceRadius = node.radius * 1.06;
      hullSamples.push(new THREE.Vector2(
        node.horizontal + Math.cos(angle) * surfaceRadius,
        node.vertical + Math.sin(angle) * surfaceRadius
      ));
    }
  }
  let hull = convexHull(hullSamples);
  if (hull.length < 3) {
    visuals.points.visible = false;
    return;
  }
  const hullCenter = hull.reduce((center, point) => center.add(point), new THREE.Vector2())
    .multiplyScalar(1 / hull.length);
  const envelopePadding = bodyHeight * 0.095;
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
  const depthHalf = Math.max((maximumDepth - minimumDepth) * 0.5 + bodyHeight * 0.035, bodyHeight * 0.13);
  const bodyClearance = bodyHeight * 0.012;
  const densityDistance = bodyHeight * 0.2;
  const pointSizeScale = visuals.embedded ? 0.7 : 1;
  const temporaryColor = new THREE.Color();
  let drawCount = 0;

  for (let candidateIndex = 0; candidateIndex < visuals.candidates.count; candidateIndex += 1) {
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
    const nearBody = Math.exp(-clearance / densityDistance);
    const density = 0.3 + nearBody * 0.68;
    if (visuals.candidates.selectors[candidateIndex] > density) continue;

    const pointOffset = drawCount * 3;
    visuals.positions.array[pointOffset] = worldX;
    visuals.positions.array[pointOffset + 1] = worldY;
    visuals.positions.array[pointOffset + 2] = worldZ;
    temporaryColor.copy(visuals.color);
    const depthLight = 0.78 + (1 - Math.abs(normalizedDepth)) * 0.22;
    visuals.colors.array[pointOffset] = temporaryColor.r * depthLight;
    visuals.colors.array[pointOffset + 1] = temporaryColor.g * depthLight;
    visuals.colors.array[pointOffset + 2] = temporaryColor.b * depthLight;
    visuals.phases.array[drawCount] = visuals.candidates.phases[candidateIndex];
    visuals.sizes.array[drawCount] = (10.2 + nearBody * 9.2
      + visuals.candidates.selectors[candidateIndex] * 3) * pointSizeScale;
    visuals.alphas.array[drawCount] = (0.44 + nearBody * 0.54)
      * (0.8 + (1 - Math.abs(normalizedDepth)) * 0.2);
    drawCount += 1;
    if (drawCount >= visuals.budget) break;
  }

  for (const attribute of [visuals.positions, visuals.colors, visuals.phases, visuals.sizes, visuals.alphas]) {
    attribute.needsUpdate = true;
  }
  visuals.geometry.setDrawRange(0, drawCount);
  visuals.points.visible = drawCount > 0;
}
