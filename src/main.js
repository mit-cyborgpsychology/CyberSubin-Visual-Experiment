import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { posture } from '../59.ts';
import './styles.css';

const DISPLAY_HEIGHT = 3;
const SIGNAL_WINDOW = 270;
const TRAIL_LENGTH = 4096;
const TRAIL_RENDER_LENGTH = TRAIL_LENGTH * 2;
const CURVE_HISTORY_LENGTH = 108;
const MODEL_COUNT = 59;
const TRACE_DURATION_SECONDS = {
  permanent: Infinity,
  long: 15,
  medium: 8,
  short: 3,
  brief: 1.5,
  instant: 1
};
const FLOOR_LIGHT_LEVELS = {
  off: { color: 0x000000, gridOpacity: 0.2, ringOpacity: 0.04 },
  low: { color: 0x020303, gridOpacity: 0.3, ringOpacity: 0.065 },
  medium: { color: 0x050708, gridOpacity: 0.42, ringOpacity: 0.1 },
  high: { color: 0x162226, gridOpacity: 0.9, ringOpacity: 0.34 }
};
const EXPERIMENT_INFO = {
  energy: {
    label: 'ENERGY',
    description: 'ISOMETRIC TORQUE + SUPPORT BALANCE + LOADED MOTION ACCUMULATE AS BLUE → ORANGE → RED'
  },
  curves: {
    label: 'CIRCLES + CURVES',
    description: 'CLEAN NON-GLOWING LINES PRESERVE THE FULL SMOOTHED MOVEMENT STROKE WITHOUT THRESHOLDS'
  },
  axes: {
    label: 'AXIS POINTS',
    description: 'NEARBY PIVOTS ACTIVATE EARLY, COLLAPSE INTO ONE CENTRAL POINT + TURN WHITE AT CONTACT'
  },
  sync: {
    label: 'SYNCHRONOUS LIMBS',
    description: 'BILATERAL + SAME-SIDE + CROSS-BODY LINKS MAP CORAL ASYNCHRONY TO CYAN SYNCHRONY'
  },
  space: {
    label: 'EXTERNAL BODY SPACES',
    description: 'FIVE WARPED 3D PANELS OCCUPY LEG–LEG, ARM–LEG + ARM–HEAD NEGATIVE SPACES'
  },
  relations: {
    label: 'SHIFTING RELATIONS',
    description: 'A HEAD-ORIGIN ATTENTION BEAM POINTS TO THE BODY PART DRIVING EACH TRANSITION'
  }
};
const EXPERIMENT_KEYS = Object.keys(EXPERIMENT_INFO);
const AXIS_IDLE_COLOR = new THREE.Color(0xff304c);
const AXIS_CONTACT_COLOR = new THREE.Color(0xffffff);
const AXIS_CONTACT_DISTANCE = 0.24;
const AXIS_TOUCH_DISTANCE = 0.055;
const ENERGY_HEAT_LINKS = [
  ['body', 'head'],
  ['body', 'leftArm'],
  ['leftArm', 'leftHand'],
  ['body', 'rightArm'],
  ['rightArm', 'rightHand'],
  ['body', 'leftLeg'],
  ['leftLeg', 'leftFoot'],
  ['body', 'rightLeg'],
  ['rightLeg', 'rightFoot']
];
const SPACE_PANEL_DEFINITIONS = [
  { id: 'betweenLegs', color: 0xff4938, depth: 0.09 },
  { id: 'leftArmLeg', color: 0xff3528, depth: 0.078 },
  { id: 'rightArmLeg', color: 0xff3528, depth: 0.078 },
  { id: 'leftArmHead', color: 0xff5940, depth: 0.07 },
  { id: 'rightArmHead', color: 0xff5940, depth: 0.07 }
];
const AXES = [
  { key: 'x', label: 'X', color: '#65f3ff' },
  { key: 'y', label: 'Y', color: '#b7ff63' },
  { key: 'z', label: 'Z', color: '#ff6fae' }
];
const AVERAGE_AXIS = { key: 'average', label: 'AVG', color: '#f4f4ef' };
const GRAPH_SERIES = [...AXES, AVERAGE_AXIS];
const EXTRA_MODEL_URLS = import.meta.glob('../models/*.glb', {
  eager: true,
  query: '?url',
  import: 'default'
});
const INDEXED_MOVEMENTS = posture.slice(0, MODEL_COUNT).map((movement, index) => ({
  ...movement,
  id: String(index + 1),
  fileName: `${index + 1}.glb`,
  modelNumber: index + 1,
  source: 'indexed',
  url: `/${index + 1}.glb`
}));
const EXTRA_MOVEMENTS = Object.entries(EXTRA_MODEL_URLS)
  .map(([path, url]) => {
    const fileName = path.split('/').at(-1);
    return {
      id: fileName,
      fileName,
      modelNumber: null,
      source: 'models',
      url
    };
  })
  .sort((first, second) => first.fileName.localeCompare(second.fileName, undefined, {
    numeric: true,
    sensitivity: 'base'
  }));
const MOVEMENTS = [...INDEXED_MOVEMENTS, ...EXTRA_MOVEMENTS];

const TRACK_DEFINITIONS = [
  {
    id: 'leftHand',
    label: 'L HAND',
    bones: ['LeftHand'],
    anchor: 'LeftHand',
    color: '#65f3ff'
  },
  {
    id: 'rightHand',
    label: 'R HAND',
    bones: ['RightHand'],
    anchor: 'RightHand',
    color: '#26bdd1'
  },
  {
    id: 'leftArm',
    label: 'L ARM',
    bones: ['LeftArm', 'LeftForeArm'],
    anchor: 'LeftForeArm',
    color: '#b7ff63'
  },
  {
    id: 'rightArm',
    label: 'R ARM',
    bones: ['RightArm', 'RightForeArm'],
    anchor: 'RightForeArm',
    color: '#75d33f'
  },
  {
    id: 'leftLeg',
    label: 'L LEG',
    bones: ['LeftUpLeg', 'LeftLeg'],
    anchor: 'LeftLeg',
    color: '#ffcc66'
  },
  {
    id: 'rightLeg',
    label: 'R LEG',
    bones: ['RightUpLeg', 'RightLeg'],
    anchor: 'RightLeg',
    color: '#e9913e'
  },
  {
    id: 'leftFoot',
    label: 'L FOOT',
    bones: ['LeftFoot'],
    anchor: 'LeftFoot',
    color: '#ffe0a1'
  },
  {
    id: 'rightFoot',
    label: 'R FOOT',
    bones: ['RightFoot'],
    anchor: 'RightFoot',
    color: '#ff9b67'
  },
  {
    id: 'head',
    label: 'HEAD',
    bones: ['Head'],
    anchor: 'Head',
    color: '#ff6fae'
  },
  {
    id: 'body',
    label: 'BODY',
    bones: ['Hips', 'Spine', 'Spine1', 'Spine2'],
    anchor: 'Spine2',
    color: '#a98bff'
  }
];

const ui = {
  appShell: document.querySelector('.app-shell'),
  select: document.querySelector('#dance-select'),
  statusDetail: document.querySelector('#status-detail'),
  sceneWrap: document.querySelector('#scene-wrap'),
  threeCanvas: document.querySelector('#three-canvas'),
  loading: document.querySelector('#loading-state'),
  loadingLabel: document.querySelector('#loading-state p'),
  loadingProgress: document.querySelector('#loading-progress'),
  frameReadout: document.querySelector('#frame-readout'),
  signalList: document.querySelector('#signal-list'),
  elbowAngle: document.querySelector('#elbow-angle'),
  kneeAngle: document.querySelector('#knee-angle'),
  torsoAngle: document.querySelector('#torso-angle'),
  playButton: document.querySelector('#play-button'),
  currentTime: document.querySelector('#current-time'),
  totalTime: document.querySelector('#total-time'),
  timeline: document.querySelector('#timeline'),
  resetButton: document.querySelector('#reset-button'),
  speedButtons: [...document.querySelectorAll('[data-speed]')],
  cameraOrbitToggle: document.querySelector('#camera-orbit-toggle'),
  cameraOrbitStatus: document.querySelector('#camera-orbit-status'),
  cameraSpeedButtons: [...document.querySelectorAll('[data-camera-speed]')],
  cameraDirectionButtons: [...document.querySelectorAll('[data-camera-direction]')],
  avatarMoveButtons: [...document.querySelectorAll('[data-avatar-move]')],
  avatarPositionReadout: document.querySelector('#avatar-position-readout'),
  visualizationMenuToggle: document.querySelector('#visualization-menu-toggle'),
  visualizationMenuStatus: document.querySelector('#visualization-menu-status'),
  visualizationMenuPanel: document.querySelector('#visualization-menu-panel'),
  experimentButtons: [...document.querySelectorAll('[data-experiment]')],
  experimentDescription: document.querySelector('#experiment-description'),
  traceModeButtons: [...document.querySelectorAll('[data-trace-mode]')],
  traceWidthButtons: [...document.querySelectorAll('[data-trace-width]')],
  traceVisibilityButtons: [...document.querySelectorAll('[data-trace-visible]')],
  traceDotButtons: [...document.querySelectorAll('[data-trace-dots]')],
  traceSmoothingButtons: [...document.querySelectorAll('[data-trace-smoothing]')],
  graphModeButtons: [...document.querySelectorAll('[data-graph-mode]')],
  graphKeys: [...document.querySelectorAll('[data-graph-key]')],
  cameraControlsToggle: document.querySelector('#camera-controls-toggle'),
  cameraControlsStatus: document.querySelector('#camera-controls-status'),
  cameraControlsPanel: document.querySelector('#camera-controls-panel'),
  lineControlsToggle: document.querySelector('#line-controls-toggle'),
  lineControlsStatus: document.querySelector('#line-controls-status'),
  lineControlsPanel: document.querySelector('#line-controls-panel'),
  lineDisplayToggle: document.querySelector('#line-display-toggle'),
  lineDisplayStatus: document.querySelector('#line-display-status'),
  bodyPointsToggle: document.querySelector('#body-points-toggle'),
  bodyPointsStatus: document.querySelector('#body-points-status'),
  floorLightButtons: [...document.querySelectorAll('[data-floor-light]')],
  traceSampleRateButtons: [...document.querySelectorAll('[data-trace-sample-rate]')],
  analysisPanel: document.querySelector('.analysis-panel'),
  analysisResizer: document.querySelector('#analysis-resizer')
};

const state = {
  movementIndex: 0,
  loadToken: 0,
  root: null,
  modelContainer: null,
  mixer: null,
  action: null,
  clip: null,
  bones: new Map(),
  trackers: [],
  playing: true,
  speed: 1,
  cameraOrbit: false,
  cameraOrbitSpeed: 1,
  cameraOrbitDirection: 1,
  avatarOffsetX: 0,
  avatarOffsetY: 0,
  activeExperiments: new Set(),
  visualizationMenuOpen: false,
  experimentVisuals: null,
  experimentFocusId: null,
  experimentFocusElapsed: 0,
  experimentTime: 0,
  traceMode: 'permanent',
  traceWidth: 1.25,
  traceVisible: false,
  bodyPointsVisible: true,
  traceDots: true,
  traceSmoothing: false,
  traceSampleRate: 20,
  floorLight: 'off',
  graphMode: 'all',
  cameraControlsOpen: false,
  lineControlsOpen: false,
  analysisWidth: 390,
  panelResizeStartX: 0,
  panelResizeStartWidth: 390,
  panelResizing: false,
  duration: 0,
  clipStart: 0,
  lastClipTime: 0,
  sampleElapsed: 0,
  trailElapsed: 0,
  ready: false
};

const renderer = new THREE.WebGLRenderer({
  canvas: ui.threeCanvas,
  antialias: true,
  alpha: false,
  stencil: true,
  powerPreference: 'high-performance'
});
renderer.setClearColor(0x050607, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050607);
scene.fog = new THREE.Fog(0x050607, 7.5, 16);

const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 100);
const controls = new OrbitControls(camera, ui.threeCanvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 3.8;
controls.maxDistance = 11;
controls.minPolarAngle = Math.PI * 0.18;
controls.maxPolarAngle = Math.PI * 0.78;
controls.autoRotate = false;
controls.autoRotateSpeed = 2;

const ambient = new THREE.HemisphereLight(0xd9f8ff, 0x07080b, 2.4);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xfff5e8, 3.7);
keyLight.position.set(4.5, 7, 5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -4;
keyLight.shadow.camera.right = 4;
keyLight.shadow.camera.top = 5;
keyLight.shadow.camera.bottom = -1;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x65f3ff, 3.2);
rimLight.position.set(-4, 3.5, -4);
scene.add(rimLight);

const fillLight = new THREE.DirectionalLight(0xa98bff, 1.15);
fillLight.position.set(4, 1.5, -3);
scene.add(fillLight);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(14, 14),
  new THREE.MeshBasicMaterial({ color: 0x000000, toneMapped: false })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.012;
ground.receiveShadow = false;
scene.add(ground);

const grid = new THREE.GridHelper(12, 24, 0x25383c, 0x13191c);
grid.material.transparent = true;
grid.material.opacity = FLOOR_LIGHT_LEVELS.off.gridOpacity;
grid.position.y = 0;
scene.add(grid);

const floorRings = [];
for (const radius of [1.2, 2.2, 3.2]) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.006, radius + 0.006, 128),
    new THREE.MeshBasicMaterial({
      color: 0x65f3ff,
      transparent: true,
      opacity: FLOOR_LIGHT_LEVELS.off.ringOpacity,
      side: THREE.DoubleSide
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.003;
  scene.add(ring);
  floorRings.push(ring);
}

const analysisObjects = new THREE.Group();
scene.add(analysisObjects);

const experimentalObjects = new THREE.Group();
scene.add(experimentalObjects);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
dracoLoader.setDecoderConfig({ type: 'wasm' });
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);

const clock = new THREE.Clock();
const tempVector = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempVectorC = new THREE.Vector3();
const tempColor = new THREE.Color();
const ENERGY_SURFACE_RADII = new Float32Array(TRACK_DEFINITIONS.map(({ id }) => ({
  body: 0.27,
  head: 0.19,
  leftArm: 0.18,
  rightArm: 0.18,
  leftHand: 0.14,
  rightHand: 0.14,
  leftLeg: 0.22,
  rightLeg: 0.22,
  leftFoot: 0.16,
  rightFoot: 0.16
}[id] ?? 0.18)));
const energySurfaceUniforms = {
  enabled: { value: 0 },
  positions: { value: TRACK_DEFINITIONS.map(() => new THREE.Vector3()) },
  levels: { value: new Float32Array(TRACK_DEFINITIONS.length) },
  radii: { value: ENERGY_SURFACE_RADII },
  bodyHeight: { value: DISPLAY_HEIGHT }
};

function populateMovementSelector() {
  const indexedGroup = document.createElement('optgroup');
  indexedGroup.label = '59 INDEXED MOVEMENTS';
  const modelFolderGroup = document.createElement('optgroup');
  modelFolderGroup.label = '/MODELS · FILE NAME INDEX';

  INDEXED_MOVEMENTS.forEach((movement) => {
    const option = document.createElement('option');
    option.value = movement.id;
    option.textContent = `${String(movement.modelNumber).padStart(2, '0')} · ${movement.thai} — ${movement.english.trim()}`;
    indexedGroup.append(option);
  });

  EXTRA_MOVEMENTS.forEach((movement) => {
    const option = document.createElement('option');
    option.value = movement.id;
    option.textContent = movement.fileName;
    modelFolderGroup.append(option);
  });

  ui.select.append(indexedGroup, modelFolderGroup);
  ui.statusDetail.textContent = `10 SIGNALS · ${MOVEMENTS.length} MODELS`;
}

function populateSignalRows() {
  ui.signalList.innerHTML = TRACK_DEFINITIONS.map(
    ({ id, label, color }) => `
      <div class="signal-row" data-signal="${id}" style="--signal-color:${color}">
        <div class="signal-row__top">
          <span class="signal-row__label"><i></i>${label}</span>
          <span class="signal-row__axes">
            ${GRAPH_SERIES.map(({ key, label: axisLabel }) => `
              <span class="signal-axis signal-axis--${key}">
                <b>${axisLabel}</b><em class="signal-axis__value" data-axis-value="${key}">+0.000</em>
              </span>`).join('')}
          </span>
        </div>
        <canvas class="signal-row__chart" aria-hidden="true"></canvas>
      </div>`
  ).join('');
}

function setLoading(message = 'LOADING MOTION MODEL', progress = '0%', isError = false) {
  ui.loading.classList.remove('hidden');
  ui.loading.classList.toggle('error', isError);
  ui.loadingLabel.textContent = message;
  ui.loadingProgress.textContent = progress;
}

function hideLoading() {
  ui.loading.classList.add('hidden');
}

function updateMovementInformation(movement) {
  if (movement.source === 'indexed') {
    document.title = `${movement.thai} — Cyber Subin Motion Atlas`;
    return;
  }

  document.title = `${movement.fileName} — Cyber Subin Motion Atlas`;
}

function disposeObject(object) {
  object?.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((material) => material.dispose?.());
    else child.material?.dispose?.();
  });
}

function clearCurrentModel() {
  state.ready = false;
  energySurfaceUniforms.enabled.value = 0;
  energySurfaceUniforms.levels.value.fill(0);
  if (state.root) {
    scene.remove(state.modelContainer ?? state.root);
    disposeObject(state.root);
  }
  while (analysisObjects.children.length) {
    const child = analysisObjects.children.at(-1);
    analysisObjects.remove(child);
    child.geometry?.dispose?.();
    child.material?.dispose?.();
  }
  disposeObject(experimentalObjects);
  experimentalObjects.clear();
  state.mixer?.stopAllAction();
  state.root = null;
  state.modelContainer = null;
  state.mixer = null;
  state.action = null;
  state.clip = null;
  state.bones = new Map();
  state.trackers = [];
  state.experimentVisuals = null;
  state.experimentFocusId = null;
  state.experimentFocusElapsed = 0;
  state.duration = 0;
  state.clipStart = 0;
  resetMetricReadouts();
}

function resetMetricReadouts() {
  for (const definition of TRACK_DEFINITIONS) {
    const row = ui.signalList.querySelector(`[data-signal="${definition.id}"]`);
    row.querySelectorAll('.signal-axis__value').forEach((value) => {
      value.textContent = '+0.000';
    });
    const chart = row.querySelector('.signal-row__chart');
    chart.getContext('2d').clearRect(0, 0, chart.width, chart.height);
  }
  ui.elbowAngle.textContent = '—°';
  ui.kneeAngle.textContent = '—°';
  ui.torsoAngle.textContent = '—°';
}

function chooseClip(animations, modelNumber) {
  if (!Number.isInteger(modelNumber)) return animations.at(-1);
  const exactName = new RegExp(`^no0*${modelNumber}(?:_|$)`, 'i');
  return animations.find((clip) => exactName.test(clip.name)) ?? animations.at(-1);
}

function getTrimmedClipStart(clip) {
  const sampledTimes = [];
  for (const track of clip.tracks) {
    const limit = Math.min(3, track.times.length);
    for (let index = 0; index < limit; index += 1) sampledTimes.push(track.times[index]);
  }
  sampledTimes.sort((a, b) => a - b);
  const uniqueTimes = sampledTimes.filter(
    (time, index) => index === 0 || Math.abs(time - sampledTimes[index - 1]) > 0.0001
  );
  const start = uniqueTimes[1] ?? uniqueTimes[0] ?? 0;
  return THREE.MathUtils.clamp(start, 0, Math.max(0, clip.duration - 0.001));
}

function installEnergySurfaceShader(material) {
  const previousCompile = material.onBeforeCompile;
  const segmentHeatShader = ENERGY_HEAT_LINKS.map(([startId, endId]) => {
    const startIndex = TRACK_DEFINITIONS.findIndex(({ id }) => id === startId);
    const endIndex = TRACK_DEFINITIONS.findIndex(({ id }) => id === endId);
    return `
      {
        vec3 segmentVector = uEnergyPositions[${endIndex}] - uEnergyPositions[${startIndex}];
        float segmentLengthSquared = max(dot(segmentVector, segmentVector), 0.0001);
        float segmentProgress = clamp(
          dot(vEnergyWorldPosition - uEnergyPositions[${startIndex}], segmentVector) / segmentLengthSquared,
          0.0,
          1.0
        );
        vec3 segmentPoint = uEnergyPositions[${startIndex}] + segmentVector * segmentProgress;
        float segmentRadius = mix(
          uEnergyRadii[${startIndex}],
          uEnergyRadii[${endIndex}],
          segmentProgress
        ) * uEnergyBodyHeight * 0.72;
        float segmentDistance = distance(vEnergyWorldPosition, segmentPoint) / max(0.001, segmentRadius);
        float segmentInfluence = 1.0 - smoothstep(0.08, 1.0, segmentDistance);
        float segmentWeight = segmentInfluence * segmentInfluence * 0.86;
        weightedHeat += mix(
          uEnergyLevels[${startIndex}],
          uEnergyLevels[${endIndex}],
          segmentProgress
        ) * segmentWeight;
        totalWeight += segmentWeight;
        localCoverage = max(localCoverage, segmentInfluence);
      }
    `;
  }).join('\n');
  material.onBeforeCompile = (shader, rendererContext) => {
    previousCompile?.(shader, rendererContext);
    shader.uniforms.uEnergyEnabled = energySurfaceUniforms.enabled;
    shader.uniforms.uEnergyPositions = energySurfaceUniforms.positions;
    shader.uniforms.uEnergyLevels = energySurfaceUniforms.levels;
    shader.uniforms.uEnergyRadii = energySurfaceUniforms.radii;
    shader.uniforms.uEnergyBodyHeight = energySurfaceUniforms.bodyHeight;
    shader.vertexShader = `varying vec3 vEnergyWorldPosition;\n${shader.vertexShader}`
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvEnergyWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
    shader.fragmentShader = `
      uniform float uEnergyEnabled;
      uniform vec3 uEnergyPositions[${TRACK_DEFINITIONS.length}];
      uniform float uEnergyLevels[${TRACK_DEFINITIONS.length}];
      uniform float uEnergyRadii[${TRACK_DEFINITIONS.length}];
      uniform float uEnergyBodyHeight;
      varying vec3 vEnergyWorldPosition;

      vec3 cyberSubinEnergyRamp(float heat) {
        vec3 coolBlue = vec3(0.035, 0.16, 1.0);
        vec3 warmOrange = vec3(1.0, 0.30, 0.015);
        vec3 hotRed = vec3(1.0, 0.035, 0.015);
        vec3 blueToOrange = mix(coolBlue, warmOrange, smoothstep(0.12, 0.66, heat));
        return mix(blueToOrange, hotRed, smoothstep(0.68, 0.98, heat));
      }
    ${shader.fragmentShader}`.replace(
      '#include <opaque_fragment>',
      `
        if (uEnergyEnabled > 0.5) {
          float totalWeight = 0.0;
          float weightedHeat = 0.0;
          float localCoverage = 0.0;
          for (int energyIndex = 0; energyIndex < ${TRACK_DEFINITIONS.length}; energyIndex += 1) {
            float radius = max(0.001, uEnergyRadii[energyIndex] * uEnergyBodyHeight);
            float normalizedDistance = distance(vEnergyWorldPosition, uEnergyPositions[energyIndex]) / radius;
            float influence = 1.0 - smoothstep(0.06, 1.0, normalizedDistance);
            float weight = influence * influence;
            weightedHeat += uEnergyLevels[energyIndex] * weight;
            totalWeight += weight;
            localCoverage = max(localCoverage, influence);
          }
          ${segmentHeatShader}
          float accumulatedHeat = totalWeight > 0.0001
            ? (weightedHeat / totalWeight) * localCoverage
            : 0.0;
          vec3 heatColor = cyberSubinEnergyRamp(accumulatedHeat);
          float surfaceMix = 0.72 + localCoverage * 0.22;
          outgoingLight = mix(outgoingLight, heatColor, surfaceMix);
        }
        #include <opaque_fragment>
      `
    );
  };
  material.customProgramCacheKey = () => 'cyber-subin-accumulated-energy-surface-v2';
}

function styleModel(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const styled = materials.map((source) => {
      const material = source.clone();
      if (material.color) material.color.set('#c7c9c5');
      if ('roughness' in material) material.roughness = 0.52;
      if ('metalness' in material) material.metalness = 0.16;
      if ('emissive' in material) {
        material.emissive.set('#071012');
        material.emissiveIntensity = 0.18;
      }
      material.side = THREE.DoubleSide;
      material.stencilWrite = true;
      material.stencilRef = 1;
      material.stencilFunc = THREE.AlwaysStencilFunc;
      material.stencilFail = THREE.KeepStencilOp;
      material.stencilZFail = THREE.KeepStencilOp;
      material.stencilZPass = THREE.ReplaceStencilOp;
      installEnergySurfaceShader(material);
      return material;
    });
    child.material = Array.isArray(child.material) ? styled : styled[0];
  });
}

function normalizeModel(root) {
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = DISPLAY_HEIGHT / Math.max(size.y, 0.001);
  root.scale.multiplyScalar(scale);
  root.position.x -= center.x * scale;
  root.position.y -= bounds.min.y * scale;
  root.position.z -= center.z * scale;
  root.updateMatrixWorld(true);
}

function indexBones(root) {
  const bones = new Map();
  root.traverse((object) => {
    if (object.name) bones.set(object.name, object);
  });
  return bones;
}

function createTrackers() {
  state.trackers = TRACK_DEFINITIONS.map((definition) => {
    const trackedBones = definition.bones.map((name) => state.bones.get(name)).filter(Boolean);
    const anchorBone = state.bones.get(definition.anchor) ?? trackedBones[0];
    const color = new THREE.Color(definition.color);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.027, 14, 14),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false })
    );
    marker.renderOrder = 12;
    marker.visible = state.bodyPointsVisible;
    analysisObjects.add(marker);

    const trailGeometry = new LineSegmentsGeometry();
    const trailLinePositions = new Float32Array((TRAIL_RENDER_LENGTH - 1) * 6);
    const trailLineColors = new Float32Array((TRAIL_RENDER_LENGTH - 1) * 6);
    trailGeometry.setPositions(trailLinePositions);
    trailGeometry.setColors(trailLineColors);
    trailGeometry.instanceCount = 0;
    const trail = new LineSegments2(
      trailGeometry,
      new LineMaterial({
        color: 0xffffff,
        linewidth: state.traceWidth,
        vertexColors: true,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        alphaToCoverage: true
      })
    );
    trail.frustumCulled = false;
    trail.renderOrder = 8;
    trail.visible = state.traceVisible;
    analysisObjects.add(trail);

    const trailDotsGeometry = new THREE.BufferGeometry();
    const trailPointPositions = new Float32Array(TRAIL_LENGTH * 3);
    const trailPointColors = new Float32Array(TRAIL_LENGTH * 3);
    trailDotsGeometry.setAttribute('position', new THREE.BufferAttribute(trailPointPositions, 3));
    trailDotsGeometry.setAttribute('color', new THREE.BufferAttribute(trailPointColors, 3));
    trailDotsGeometry.setDrawRange(0, 0);
    const trailDots = new THREE.Points(
      trailDotsGeometry,
      new THREE.PointsMaterial({
        color: 0xffffff,
        vertexColors: true,
        size: 0.024,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    trailDots.frustumCulled = false;
    trailDots.renderOrder = 9;
    trailDots.visible = state.traceVisible && state.traceDots;
    analysisObjects.add(trailDots);

    return {
      definition,
      trackedBones,
      anchorBone,
      marker,
      trail,
      trailDots,
      color,
      trailPoints: [],
      trailLinePositions,
      trailLineColors,
      trailPointPositions,
      trailPointColors,
      hasTrailPoint: false,
      history: Object.fromEntries(GRAPH_SERIES.map(({ key }) => [key, new Array(SIGNAL_WINDOW).fill(0)])),
      position: new THREE.Vector3(),
      anchorPosition: new THREE.Vector3(),
      previousAnchorPosition: new THREE.Vector3(),
      trailInterpolationPoint: new THREE.Vector3(),
      motionPreviousPosition: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      speed: 0,
      previousSpeed: 0,
      acceleration: 0,
      energyLevel: 0,
      curveHistory: [],
      coordinateOrigin: new THREE.Vector3(),
      coordinate: new THREE.Vector3()
    };
  });
}

function updateExperimentDescription() {
  const activeKeys = EXPERIMENT_KEYS.filter((key) => state.activeExperiments.has(key));
  if (!activeKeys.length) {
    ui.experimentDescription.textContent = 'MOVEMENT LENSES OFF · SELECT ONE OR COMBINE MULTIPLE VIEWS';
    return;
  }

  if (activeKeys.length === 1) {
    const info = EXPERIMENT_INFO[activeKeys[0]];
    const focusTracker = state.trackers.find((tracker) => tracker.definition.id === state.experimentFocusId);
    const focus = activeKeys[0] === 'relations' && focusTracker
      ? ` · CURRENT FOCUS ${focusTracker.definition.label}`
      : '';
    ui.experimentDescription.textContent = `${info.label} · ${info.description}${focus}`;
    return;
  }

  ui.experimentDescription.textContent = `${activeKeys.length} LENSES ACTIVE · ${activeKeys
    .map((key) => EXPERIMENT_INFO[key].label)
    .join(' + ')}`;
}

function updateExperimentVisibility() {
  for (const button of ui.experimentButtons) {
    const key = button.dataset.experiment;
    const active = key === 'off'
      ? state.activeExperiments.size === 0
      : key === 'all'
        ? state.activeExperiments.size === EXPERIMENT_KEYS.length
        : state.activeExperiments.has(key);
    button.classList.toggle('active', active);
  }

  if (state.experimentVisuals) {
    for (const key of EXPERIMENT_KEYS) {
      state.experimentVisuals[key].group.visible = state.activeExperiments.has(key);
    }
  }
  energySurfaceUniforms.enabled.value = state.activeExperiments.has('energy') ? 1 : 0;
  updateExperimentDescription();
}

function toggleExperiment(key) {
  if (key === 'off') state.activeExperiments.clear();
  else if (key === 'all') EXPERIMENT_KEYS.forEach((experimentKey) => state.activeExperiments.add(experimentKey));
  else if (state.activeExperiments.has(key)) state.activeExperiments.delete(key);
  else if (EXPERIMENT_INFO[key]) state.activeExperiments.add(key);
  updateExperimentVisibility();
}

function createExperimentalVisuals() {
  const energyGroup = new THREE.Group();

  const curvesGroup = new THREE.Group();
  const curveLines = new Map();
  const curveTrackerIds = new Set(['leftHand', 'rightHand', 'leftFoot', 'rightFoot', 'head', 'body']);
  for (const tracker of state.trackers.filter((candidate) => curveTrackerIds.has(candidate.definition.id))) {
    const placeholderCurve = new THREE.LineCurve3(
      new THREE.Vector3(),
      new THREE.Vector3(0, 0.001, 0)
    );
    const line = new THREE.Mesh(
      new THREE.TubeGeometry(placeholderCurve, 2, 0.006, 6, false),
      new THREE.MeshBasicMaterial({
        color: tracker.color.clone().lerp(new THREE.Color(0xd9ffff), 0.28),
        transparent: true,
        opacity: 0.82,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending
      })
    );
    const startCap = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), line.material);
    const endCap = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), line.material);
    line.frustumCulled = false;
    line.renderOrder = 14;
    startCap.renderOrder = 14;
    endCap.renderOrder = 14;
    curvesGroup.add(line, startCap, endCap);
    curveLines.set(tracker.definition.id, {
      line,
      caps: [startCap, endCap],
      curveStrength: 0,
      strokeVisible: false,
      lastGeometryUpdate: -Infinity
    });
  }

  const axesGroup = new THREE.Group();
  const axisItems = [];
  const axisBoneNames = [
    'Hips', 'Spine2', 'Head',
    'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
    'LeftLeg', 'LeftFoot', 'RightLeg', 'RightFoot'
  ];
  for (const boneName of axisBoneNames) {
    const bone = state.bones.get(boneName);
    if (!bone) continue;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.044, 20, 16),
      new THREE.MeshBasicMaterial({
        color: AXIS_IDLE_COLOR,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false
      })
    );
    marker.renderOrder = 19;
    axesGroup.add(marker);
    axisItems.push({
      bone,
      marker,
      worldPosition: new THREE.Vector3(),
      contactAmount: 0
    });
  }

  const syncGroup = new THREE.Group();
  const syncPairDefinitions = [
    { start: 'leftHand', end: 'rightHand', mirrorX: true },
    { start: 'leftArm', end: 'rightArm', mirrorX: true },
    { start: 'leftLeg', end: 'rightLeg', mirrorX: true },
    { start: 'leftFoot', end: 'rightFoot', mirrorX: true },
    { start: 'leftHand', end: 'leftArm', mirrorX: false },
    { start: 'rightHand', end: 'rightArm', mirrorX: false },
    { start: 'leftArm', end: 'leftLeg', mirrorX: false },
    { start: 'rightArm', end: 'rightLeg', mirrorX: false },
    { start: 'leftLeg', end: 'leftFoot', mirrorX: false },
    { start: 'rightLeg', end: 'rightFoot', mirrorX: false },
    { start: 'leftHand', end: 'rightFoot', mirrorX: true },
    { start: 'rightHand', end: 'leftFoot', mirrorX: true },
    { start: 'leftArm', end: 'rightLeg', mirrorX: true },
    { start: 'rightArm', end: 'leftLeg', mirrorX: true }
  ];
  const syncPairs = syncPairDefinitions.map(({ start, end, mirrorX }) => ({
    start: state.trackers.find((tracker) => tracker.definition.id === start),
    end: state.trackers.find((tracker) => tracker.definition.id === end),
    mirrorX
  })).filter((pair) => pair.start && pair.end);
  const syncPositions = new Float32Array(syncPairs.length * 6);
  const syncColors = new Float32Array(syncPairs.length * 6);
  const syncGeometry = new LineSegmentsGeometry();
  syncGeometry.setPositions(syncPositions);
  syncGeometry.setColors(syncColors);
  syncGeometry.instanceCount = syncPairs.length;
  const syncLines = new LineSegments2(
    syncGeometry,
    new LineMaterial({
      color: 0xffffff,
      linewidth: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthTest: false,
      alphaToCoverage: true
    })
  );
  syncLines.renderOrder = 15;
  syncGroup.add(syncLines);
  const syncNodeIds = [...new Set(syncPairDefinitions.flatMap(({ start, end }) => [start, end]))];
  const syncNodes = new Map();
  for (const trackerId of syncNodeIds) {
    const tracker = state.trackers.find((candidate) => candidate.definition.id === trackerId);
    if (!tracker) continue;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 16, 14),
      new THREE.MeshBasicMaterial({
        color: 0x65f3ff,
        transparent: true,
        opacity: 0.94,
        depthTest: false,
        blending: THREE.NormalBlending
      })
    );
    marker.renderOrder = 16;
    syncGroup.add(marker);
    syncNodes.set(trackerId, { tracker, marker, synchronyTotal: 0, relationshipCount: 0 });
  }

  const spaceGroup = new THREE.Group();
  const spaceBox = new THREE.Box3(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 2, 0.5));
  const spacePanels = SPACE_PANEL_DEFINITIONS.map((definition, index) => {
    const baseColor = new THREE.Color(definition.color);
    const material = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      emissive: baseColor.clone().multiplyScalar(0.12),
      emissiveIntensity: 0.32,
      roughness: 0.56,
      metalness: 0,
      clearcoat: 0.35,
      clearcoatRoughness: 0.5,
      transmission: 0.03,
      ior: 1.18,
      thickness: 0.08,
      transparent: true,
      opacity: 0.78,
      depthTest: true,
      depthWrite: false,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp,
      side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 7 + (index % 2);
    mesh.visible = false;
    spaceGroup.add(mesh);
    return { definition, mesh, phase: index * 0.83 };
  });

  const relationsGroup = new THREE.Group();
  const relationPositions = new Float32Array(6);
  const relationColors = new Float32Array(6);
  const relationGeometry = new LineSegmentsGeometry();
  relationGeometry.setPositions(relationPositions);
  relationGeometry.setColors(relationColors);
  relationGeometry.instanceCount = 1;
  const relationBeam = new LineSegments2(
    relationGeometry,
    new LineMaterial({
      color: 0xffffff,
      linewidth: 3.6,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthTest: false,
      alphaToCoverage: true
    })
  );
  relationBeam.renderOrder = 18;
  const relationHalo = new THREE.Mesh(
    new THREE.RingGeometry(0.085, 0.14, 48),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      depthTest: false,
      blending: THREE.AdditiveBlending
    })
  );
  const relationCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 14, 14),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false })
  );
  relationHalo.renderOrder = 20;
  relationCore.renderOrder = 20;
  relationsGroup.add(relationBeam, relationHalo, relationCore);

  for (const group of [energyGroup, curvesGroup, axesGroup, syncGroup, spaceGroup, relationsGroup]) {
    experimentalObjects.add(group);
  }

  state.experimentVisuals = {
    energy: {
      group: energyGroup,
      box: new THREE.Box3()
    },
    curves: { group: curvesGroup, lines: curveLines },
    axes: {
      group: axesGroup,
      items: axisItems
    },
    sync: {
      group: syncGroup,
      pairs: syncPairs,
      nodes: syncNodes,
      lines: syncLines,
      positions: syncPositions,
      colors: syncColors
    },
    space: {
      group: spaceGroup,
      box: spaceBox,
      panels: spacePanels,
      bodyHeight: DISPLAY_HEIGHT,
      lastUpdate: -Infinity
    },
    relations: { group: relationsGroup, beam: relationBeam, positions: relationPositions, colors: relationColors, halo: relationHalo, core: relationCore }
  };
  updateExperimentVisibility();
}

function updateEnergyVisuals(delta) {
  const visuals = state.experimentVisuals.energy;
  const heatDelta = THREE.MathUtils.clamp(delta, 1 / 240, 1 / 20);
  const trackers = Object.fromEntries(
    state.trackers.map((tracker) => [tracker.definition.id, tracker])
  );
  visuals.box.setFromPoints(state.trackers.map((tracker) => tracker.anchorPosition));
  visuals.box.getSize(tempVectorC);
  const bodyHeight = Math.max(0.6, tempVectorC.y);
  const bonePosition = (name, fallback) => state.bones.get(name)?.getWorldPosition(new THREE.Vector3())
    ?? fallback;
  const hips = bonePosition('Hips', trackers.body?.anchorPosition ?? new THREE.Vector3());
  const head = trackers.head?.anchorPosition ?? hips;
  const body = trackers.body?.anchorPosition ?? hips;
  const leftHip = bonePosition('LeftUpLeg', hips);
  const rightHip = bonePosition('RightUpLeg', hips);
  const leftKnee = bonePosition('LeftLeg', trackers.leftLeg?.anchorPosition ?? leftHip);
  const rightKnee = bonePosition('RightLeg', trackers.rightLeg?.anchorPosition ?? rightHip);
  const leftFoot = trackers.leftFoot?.anchorPosition ?? hips;
  const rightFoot = trackers.rightFoot?.anchorPosition ?? hips;
  const leftShoulder = bonePosition('LeftArm', trackers.leftArm?.anchorPosition ?? body);
  const rightShoulder = bonePosition('RightArm', trackers.rightArm?.anchorPosition ?? body);
  const leftElbow = bonePosition('LeftForeArm', trackers.leftArm?.anchorPosition ?? leftShoulder);
  const rightElbow = bonePosition('RightForeArm', trackers.rightArm?.anchorPosition ?? rightShoulder);
  const leftHand = trackers.leftHand?.anchorPosition ?? leftElbow;
  const rightHand = trackers.rightHand?.anchorPosition ?? rightElbow;
  const horizontalDistance = (first, second) => Math.hypot(first.x - second.x, first.z - second.z);
  const weightedCenter = (entries) => {
    const center = new THREE.Vector3();
    let totalWeight = 0;
    entries.forEach(([position, weight]) => {
      center.addScaledVector(position, weight);
      totalWeight += weight;
    });
    return center.multiplyScalar(1 / Math.max(0.0001, totalWeight));
  };

  // A raised knee can demand substantial isometric effort even when the foot is
  // tucked near the support leg, so both knee and foot height contribute.
  const leftFootLift = THREE.MathUtils.clamp(
    (leftFoot.y - rightFoot.y) / (bodyHeight * 0.24),
    0,
    1
  );
  const rightFootLift = THREE.MathUtils.clamp(
    (rightFoot.y - leftFoot.y) / (bodyHeight * 0.24),
    0,
    1
  );
  const leftKneeLift = THREE.MathUtils.clamp(
    (leftKnee.y - rightKnee.y) / (bodyHeight * 0.18),
    0,
    1
  );
  const rightKneeLift = THREE.MathUtils.clamp(
    (rightKnee.y - leftKnee.y) / (bodyHeight * 0.18),
    0,
    1
  );
  const leftLift = Math.max(leftFootLift, leftKneeLift);
  const rightLift = Math.max(rightFootLift, rightKneeLift);
  const leftLegCenter = weightedCenter([[leftKnee, 0.58], [leftFoot, 0.42]]);
  const rightLegCenter = weightedCenter([[rightKnee, 0.58], [rightFoot, 0.42]]);
  const leftLegTorque = THREE.MathUtils.clamp(
    horizontalDistance(leftLegCenter, leftHip) / (bodyHeight * 0.3),
    0,
    1
  );
  const rightLegTorque = THREE.MathUtils.clamp(
    horizontalDistance(rightLegCenter, rightHip) / (bodyHeight * 0.3),
    0,
    1
  );
  const leftRaisedLoad = THREE.MathUtils.clamp(
    leftLift * (0.62 + leftLegTorque * 0.38),
    0,
    1
  );
  const rightRaisedLoad = THREE.MathUtils.clamp(
    rightLift * (0.62 + rightLegTorque * 0.38),
    0,
    1
  );
  const raisedLoad = Math.max(leftRaisedLoad, rightRaisedLoad);
  const supportFoot = leftLift > rightLift ? rightFoot : leftFoot;
  const leftArmCenter = weightedCenter([[leftElbow, 0.58], [leftHand, 0.42]]);
  const rightArmCenter = weightedCenter([[rightElbow, 0.58], [rightHand, 0.42]]);
  const leftArmTorque = THREE.MathUtils.clamp(
    horizontalDistance(leftArmCenter, leftShoulder) / (bodyHeight * 0.28),
    0,
    1
  );
  const rightArmTorque = THREE.MathUtils.clamp(
    horizontalDistance(rightArmCenter, rightShoulder) / (bodyHeight * 0.28),
    0,
    1
  );
  const leftArmElevation = THREE.MathUtils.clamp(
    (leftArmCenter.y - hips.y) / (bodyHeight * 0.48),
    0,
    1
  );
  const rightArmElevation = THREE.MathUtils.clamp(
    (rightArmCenter.y - hips.y) / (bodyHeight * 0.48),
    0,
    1
  );
  const leftArmLoad = THREE.MathUtils.clamp(leftArmTorque * 0.82 + leftArmElevation * 0.18, 0, 1);
  const rightArmLoad = THREE.MathUtils.clamp(rightArmTorque * 0.82 + rightArmElevation * 0.18, 0, 1);
  const centerOfMass = weightedCenter([
    [body, 0.42],
    [hips, 0.18],
    [head, 0.08],
    [leftLegCenter, 0.11],
    [rightLegCenter, 0.11],
    [leftArmCenter, 0.05],
    [rightArmCenter, 0.05]
  ]);
  const balanceOffset = raisedLoad > 0.08
    ? THREE.MathUtils.clamp(horizontalDistance(centerOfMass, supportFoot) / (bodyHeight * 0.14), 0, 1)
    : 0;
  const torsoRise = Math.max(bodyHeight * 0.2, Math.abs(head.y - hips.y));
  const torsoLean = THREE.MathUtils.clamp(horizontalDistance(head, hips) / torsoRise, 0, 1);
  const coreLoad = THREE.MathUtils.clamp(
    raisedLoad * 0.82
      + balanceOffset * 0.42
      + torsoLean * 0.22
      + Math.max(leftArmLoad, rightArmLoad) * 0.12,
    0,
    1
  );
  const leftKneeAngle = angleAt(
    state.bones.get('LeftUpLeg'),
    state.bones.get('LeftLeg'),
    state.bones.get('LeftFoot')
  );
  const rightKneeAngle = angleAt(
    state.bones.get('RightUpLeg'),
    state.bones.get('RightLeg'),
    state.bones.get('RightFoot')
  );
  const leftKneeBend = leftKneeAngle == null
    ? 0
    : THREE.MathUtils.clamp((168 - leftKneeAngle) / 88, 0, 1);
  const rightKneeBend = rightKneeAngle == null
    ? 0
    : THREE.MathUtils.clamp((168 - rightKneeAngle) / 88, 0, 1);
  const effortByPart = {
    body: coreLoad,
    head: THREE.MathUtils.clamp(torsoLean * 0.58 + coreLoad * 0.18, 0, 1),
    leftArm: leftArmLoad,
    leftHand: leftArmLoad * 0.28,
    rightArm: rightArmLoad,
    rightHand: rightArmLoad * 0.28,
    leftLeg: THREE.MathUtils.clamp(
      leftRaisedLoad * 0.42 + rightRaisedLoad * 0.62 + leftKneeBend * 0.22,
      0,
      1
    ),
    leftFoot: THREE.MathUtils.clamp(leftRaisedLoad * 0.12 + rightRaisedLoad * 0.2, 0, 1),
    rightLeg: THREE.MathUtils.clamp(
      rightRaisedLoad * 0.42 + leftRaisedLoad * 0.62 + rightKneeBend * 0.22,
      0,
      1
    ),
    rightFoot: THREE.MathUtils.clamp(rightRaisedLoad * 0.12 + leftRaisedLoad * 0.2, 0, 1)
  };

  state.trackers.forEach((tracker, index) => {
    const speedCue = THREE.MathUtils.clamp(tracker.speed / 1.4, 0, 1);
    const accelerationCue = THREE.MathUtils.clamp(Math.abs(tracker.acceleration) / 24, 0, 1);
    const postureLoad = effortByPart[tracker.definition.id] ?? 0;
    const loadedMotion = (speedCue * 0.025 + accelerationCue * 0.06) * postureLoad;
    const effort = THREE.MathUtils.clamp(postureLoad + loadedMotion, 0, 1);
    const heatGain = Math.pow(effort, 1.3) * (0.24 + effort * 0.42) * heatDelta;
    const cooldownRate = (0.12 + tracker.energyLevel * 0.08) * (1 - effort * 0.9);
    tracker.energyLevel = THREE.MathUtils.clamp(
      tracker.energyLevel + heatGain - cooldownRate * heatDelta,
      0,
      1
    );
    energySurfaceUniforms.positions.value[index].copy(tracker.anchorPosition);
    energySurfaceUniforms.levels.value[index] = tracker.energyLevel;
  });

  energySurfaceUniforms.bodyHeight.value = bodyHeight;
}

function updateCurveVisuals() {
  const visuals = state.experimentVisuals.curves;
  for (const [trackerId, item] of visuals.lines) {
    const { line, caps } = item;
    const tracker = state.trackers.find((candidate) => candidate.definition.id === trackerId);
    const history = tracker?.curveHistory ?? [];
    if (history.length < 3) {
      line.visible = false;
      caps.forEach((cap) => { cap.visible = false; });
      continue;
    }

    if (state.experimentTime - item.lastGeometryUpdate >= 1 / 24) {
      const silkyHistory = history.map((point, index) => {
        if (history.length < 5 || index === 0 || index === history.length - 1) return point.clone();
        const start = Math.max(0, index - 2);
        const end = Math.min(history.length - 1, index + 2);
        const smoothed = new THREE.Vector3();
        let totalWeight = 0;
        for (let sample = start; sample <= end; sample += 1) {
          const weight = 3 - Math.abs(index - sample);
          smoothed.addScaledVector(history[sample], weight);
          totalWeight += weight;
        }
        return smoothed.multiplyScalar(1 / totalWeight);
      });
      const strokePoints = silkyHistory.filter(
        (point, index) => index === 0 || point.distanceToSquared(silkyHistory[index - 1]) > 0.0000005
      );
      item.strokeVisible = strokePoints.length >= 3;
      item.lastGeometryUpdate = state.experimentTime;
      if (!item.strokeVisible) {
        line.visible = false;
        caps.forEach((cap) => { cap.visible = false; });
        continue;
      }

      const curve = new THREE.CatmullRomCurve3(strokePoints, false, 'centripetal', 0.5);
      const tubularSegments = Math.max(12, Math.min(180, (strokePoints.length - 1) * 3));
      line.geometry.dispose();
      const lineRadius = 0.0052;
      line.geometry = new THREE.TubeGeometry(
        curve,
        tubularSegments,
        lineRadius,
        6,
        false
      );
      caps[0].position.copy(strokePoints[0]);
      caps[1].position.copy(strokePoints.at(-1));
      caps[0].scale.setScalar(lineRadius);
      caps[1].scale.setScalar(lineRadius);
    }

    line.visible = item.strokeVisible;
    line.material.opacity = 0.72;
    caps.forEach((cap) => {
      cap.visible = item.strokeVisible;
      cap.material.opacity = 0.72;
    });
  }
}

function updateAxisVisuals() {
  const visuals = state.experimentVisuals.axes;
  const itemCount = visuals.items.length;
  const parent = Array.from({ length: itemCount }, (_, index) => index);
  const findRoot = (index) => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== index) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const merge = (firstIndex, secondIndex) => {
    const firstRoot = findRoot(firstIndex);
    const secondRoot = findRoot(secondIndex);
    if (firstRoot !== secondRoot) parent[secondRoot] = firstRoot;
  };

  visuals.items.forEach((item) => {
    item.bone.getWorldPosition(item.worldPosition);
    item.marker.visible = true;
    item.contactAmount = 0;
  });

  for (let firstIndex = 0; firstIndex < itemCount; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < itemCount; secondIndex += 1) {
      const distance = visuals.items[firstIndex].worldPosition.distanceTo(
        visuals.items[secondIndex].worldPosition
      );
      if (distance < AXIS_CONTACT_DISTANCE) merge(firstIndex, secondIndex);
    }
  }

  const clusters = new Map();
  visuals.items.forEach((item, index) => {
    const root = findRoot(index);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(item);
  });

  for (const cluster of clusters.values()) {
    const center = new THREE.Vector3();
    cluster.forEach((item) => center.add(item.worldPosition));
    center.multiplyScalar(1 / cluster.length);
    const representative = cluster.reduce((closest, item) => (
      item.worldPosition.distanceToSquared(center) < closest.worldPosition.distanceToSquared(center)
        ? item
        : closest
    ));

    let minimumDistance = Infinity;
    for (let firstIndex = 0; firstIndex < cluster.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < cluster.length; secondIndex += 1) {
        minimumDistance = Math.min(
          minimumDistance,
          cluster[firstIndex].worldPosition.distanceTo(cluster[secondIndex].worldPosition)
        );
      }
    }
    const contactAmount = cluster.length > 1
      ? 1 - THREE.MathUtils.smoothstep(minimumDistance, AXIS_TOUCH_DISTANCE, AXIS_CONTACT_DISTANCE)
      : 0;

    cluster.forEach((item) => {
      item.marker.visible = item === representative;
    });
    representative.marker.position.copy(center);
    representative.marker.material.color.lerpColors(
      AXIS_IDLE_COLOR,
      AXIS_CONTACT_COLOR,
      contactAmount
    );
    representative.marker.scale.setScalar(1 + contactAmount * 0.32);
    representative.marker.material.opacity = 1;
  }
}

function updateSyncVisuals() {
  const visuals = state.experimentVisuals.sync;
  const asynchronousColor = new THREE.Color(0xff6f91);
  const synchronousColor = new THREE.Color(0x65f3ff);
  visuals.nodes.forEach((node) => {
    node.synchronyTotal = 0;
    node.relationshipCount = 0;
  });

  visuals.pairs.forEach((pair, index) => {
    const offset = index * 6;
    visuals.positions[offset] = pair.start.anchorPosition.x;
    visuals.positions[offset + 1] = pair.start.anchorPosition.y;
    visuals.positions[offset + 2] = pair.start.anchorPosition.z;
    visuals.positions[offset + 3] = pair.end.anchorPosition.x;
    visuals.positions[offset + 4] = pair.end.anchorPosition.y;
    visuals.positions[offset + 5] = pair.end.anchorPosition.z;

    const speedMaximum = Math.max(0.12, pair.start.speed, pair.end.speed);
    const speedSimilarity = 1 - Math.abs(pair.start.speed - pair.end.speed) / speedMaximum;
    let directionSimilarity = 1;
    if (pair.start.speed > 0.04 && pair.end.speed > 0.04) {
      tempVectorB.copy(pair.start.velocity).normalize();
      tempVectorC.copy(pair.end.velocity).normalize();
      if (pair.mirrorX) tempVectorC.x *= -1;
      directionSimilarity = (tempVectorB.dot(tempVectorC) + 1) / 2;
    }
    const accelerationMaximum = Math.max(
      0.5,
      Math.abs(pair.start.acceleration),
      Math.abs(pair.end.acceleration)
    );
    const accelerationSimilarity = 1 - Math.abs(
      Math.abs(pair.start.acceleration) - Math.abs(pair.end.acceleration)
    ) / accelerationMaximum;
    const synchrony = THREE.MathUtils.clamp(
      speedSimilarity * 0.46 + directionSimilarity * 0.36 + accelerationSimilarity * 0.18,
      0,
      1
    );
    tempColor.lerpColors(asynchronousColor, synchronousColor, synchrony);
    for (let vertex = 0; vertex < 2; vertex += 1) {
      const colorOffset = offset + vertex * 3;
      visuals.colors[colorOffset] = tempColor.r;
      visuals.colors[colorOffset + 1] = tempColor.g;
      visuals.colors[colorOffset + 2] = tempColor.b;
    }
    const startNode = visuals.nodes.get(pair.start.definition.id);
    const endNode = visuals.nodes.get(pair.end.definition.id);
    if (startNode) {
      startNode.synchronyTotal += synchrony;
      startNode.relationshipCount += 1;
    }
    if (endNode) {
      endNode.synchronyTotal += synchrony;
      endNode.relationshipCount += 1;
    }
  });
  visuals.nodes.forEach((node) => {
    const synchrony = node.relationshipCount
      ? node.synchronyTotal / node.relationshipCount
      : 0;
    node.marker.position.copy(node.tracker.anchorPosition);
    node.marker.material.color.lerpColors(asynchronousColor, synchronousColor, synchrony);
    node.marker.scale.setScalar(0.9 + synchrony * 0.42);
  });
  visuals.lines.geometry.attributes.instanceStart.data.needsUpdate = true;
  visuals.lines.geometry.attributes.instanceColorStart.data.needsUpdate = true;
}

function measurePointToSegment(px, py, pz, ax, ay, az, bx, by, bz, output) {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const denominator = abx * abx + aby * aby + abz * abz;
  const t = denominator > 0.0000001
    ? THREE.MathUtils.clamp((apx * abx + apy * aby + apz * abz) / denominator, 0, 1)
    : 0;
  const dx = px - (ax + abx * t);
  const dy = py - (ay + aby * t);
  const dz = pz - (az + abz * t);
  output[0] = dx * dx + dy * dy + dz * dz;
  output[1] = t;
}

function getSpaceBoneRadius(name, bodyHeight) {
  if (/Head/i.test(name)) return bodyHeight * 0.105;
  if (/Neck/i.test(name)) return bodyHeight * 0.058;
  if (/Spine2/i.test(name)) return bodyHeight * 0.12;
  if (/Hips|Spine/i.test(name)) return bodyHeight * 0.11;
  if (/UpLeg/i.test(name)) return bodyHeight * 0.068;
  if (/Leg/i.test(name)) return bodyHeight * 0.052;
  if (/Foot|Toe/i.test(name)) return bodyHeight * 0.054;
  if (/Shoulder/i.test(name)) return bodyHeight * 0.05;
  if (/Arm/i.test(name)) return bodyHeight * 0.046;
  if (/Hand/i.test(name)) return bodyHeight * 0.041;
  return bodyHeight * 0.05;
}

function updateSpaceJellies(visuals, boxSize) {
  const bodyHeight = Math.max(0.6, visuals.bodyHeight);
  const min = visuals.box.min;
  const sizeX = Math.max(0.2, boxSize.x);
  const sizeY = Math.max(0.2, boxSize.y);
  const sizeZ = Math.max(0.2, boxSize.z);
  const time = state.experimentTime;
  const segmentMeasurement = new Float64Array(2);
  const trackers = Object.fromEntries(
    state.trackers.map((tracker) => [tracker.definition.id, tracker])
  );
  const normalizePosition = (position) => [
    THREE.MathUtils.clamp((position.x - min.x) / sizeX, 0.055, 0.945),
    THREE.MathUtils.clamp((position.y - min.y) / sizeY, 0.055, 0.945),
    THREE.MathUtils.clamp((position.z - min.z) / sizeZ, 0.055, 0.945)
  ];

  const boneNodes = new Map();
  SPACE_BONE_CHAINS.flat().forEach((name) => {
    const bone = state.bones.get(name);
    if (!bone || boneNodes.has(name)) return;
    boneNodes.set(name, {
      position: bone.getWorldPosition(new THREE.Vector3()),
      radius: getSpaceBoneRadius(name, bodyHeight)
    });
  });
  const clearanceSpheres = boneNodes.size
    ? [...boneNodes.values()]
    : state.trackers.map((tracker) => ({
        position: tracker.anchorPosition,
        radius: (SPACE_CLEARANCE_RADII[tracker.definition.id] ?? 0.06) * bodyHeight
      }));
  const clearanceCapsules = [];
  SPACE_BONE_CHAINS.forEach((chain) => {
    for (let index = 0; index < chain.length - 1; index += 1) {
      const start = boneNodes.get(chain[index]);
      const end = boneNodes.get(chain[index + 1]);
      if (start && end) clearanceCapsules.push({ start, end });
    }
  });

  const resolution = visuals.jellies[0]?.jelly.size ?? 22;
  const fieldSize = resolution * resolution * resolution;
  if (visuals.clearanceField.length !== fieldSize) {
    visuals.clearanceField = new Float32Array(fieldSize);
  }
  const clearanceStart = bodyHeight * 0.006;
  const clearanceEnd = bodyHeight * 0.03;
  for (let z = 0; z < resolution; z += 1) {
    const nz = z / (resolution - 1);
    const wz = min.z + nz * sizeZ;
    for (let y = 0; y < resolution; y += 1) {
      const ny = y / (resolution - 1);
      const wy = min.y + ny * sizeY;
      const rowOffset = z * resolution * resolution + y * resolution;
      for (let x = 0; x < resolution; x += 1) {
        const nx = x / (resolution - 1);
        const wx = min.x + nx * sizeX;
        let minimumClearance = Infinity;
        for (const sphere of clearanceSpheres) {
          const dx = wx - sphere.position.x;
          const dy = wy - sphere.position.y;
          const dz = wz - sphere.position.z;
          minimumClearance = Math.min(
            minimumClearance,
            Math.sqrt(dx * dx + dy * dy + dz * dz) - sphere.radius
          );
        }
        for (const capsule of clearanceCapsules) {
          measurePointToSegment(
            wx,
            wy,
            wz,
            capsule.start.position.x,
            capsule.start.position.y,
            capsule.start.position.z,
            capsule.end.position.x,
            capsule.end.position.y,
            capsule.end.position.z,
            segmentMeasurement
          );
          const radius = THREE.MathUtils.lerp(
            capsule.start.radius,
            capsule.end.radius,
            segmentMeasurement[1]
          );
          minimumClearance = Math.min(minimumClearance, Math.sqrt(segmentMeasurement[0]) - radius);
        }
        const clearanceT = THREE.MathUtils.clamp(
          (minimumClearance - clearanceStart) / (clearanceEnd - clearanceStart),
          0,
          1
        );
        visuals.clearanceField[rowOffset + x] = clearanceT * clearanceT * (3 - 2 * clearanceT);
      }
    }
  }

  visuals.jellies.forEach(({ jelly }) => {
    jelly.visible = false;
  });
  const sources = visuals.jellies.map(({ definition, jelly, phase }) => {
    const startTracker = trackers[definition.start];
    const endTracker = definition.end ? trackers[definition.end] : null;
    if (!startTracker || (definition.end && !endTracker)) {
      return null;
    }
    const rawStart = normalizePosition(startTracker.anchorPosition);
    const rawEnd = endTracker ? normalizePosition(endTracker.anchorPosition) : [...rawStart];
    const end = [...rawEnd];
    if (definition.face === 'left') end[0] = 0.06;
    if (definition.face === 'right') end[0] = 0.94;
    if (definition.face === 'top') end[1] = 0.94;
    if (definition.face === 'bottom') end[1] = 0.06;
    if (definition.face === 'front') end[2] = 0.06;
    if (definition.face === 'back') end[2] = 0.94;
    // Sources deliberately begin inside their bounding body parts and finish at
    // the opposing body/box boundary. The clearance mask carves the body back
    // out, leaving a cast of the void that remains attached to its boundaries.
    const startInset = 0;
    const endInset = 0;
    const start = rawStart.map((value, axis) => THREE.MathUtils.lerp(value, end[axis], startInset));
    const insetEnd = end.map((value, axis) => THREE.MathUtils.lerp(value, rawStart[axis], endInset));
    const sourceLength = Math.hypot(
      insetEnd[0] - start[0],
      insetEnd[1] - start[1],
      insetEnd[2] - start[2]
    );
    const adaptiveRadius = THREE.MathUtils.clamp(
      definition.radius + sourceLength * definition.inflate,
      definition.radius,
      0.205
    );
    return { definition, jelly, phase, start, end: insetEnd, radius: adaptiveRadius };
  }).filter(Boolean);

  sources.forEach((source) => {
    const { definition, jelly, phase, start, end, radius } = source;
    jelly.visible = true;
    jelly.reset();
    for (let z = 0; z < resolution; z += 1) {
      const nz = z / (resolution - 1);
      const wz = min.z + nz * sizeZ;
      for (let y = 0; y < resolution; y += 1) {
        const ny = y / (resolution - 1);
        const wy = min.y + ny * sizeY;
        const rowOffset = z * jelly.size2 + y * resolution;
        for (let x = 0; x < resolution; x += 1) {
          const nx = x / (resolution - 1);
          measurePointToSegment(nx, ny, nz, ...start, ...end, segmentMeasurement);
          const sourceProgress = segmentMeasurement[1];
          const sourceDepth = THREE.MathUtils.lerp(start[2], end[2], sourceProgress);
          const depthDelta = nz - sourceDepth;
          const breathingRadius = radius * (
            1 + Math.sin(time * 1.72 + phase + sourceProgress * 5.1) * 0.12
          );
          const sourceDistance = segmentMeasurement[0] + depthDelta * depthDelta * 1.45;
          const sourceScore = sourceDistance / (breathingRadius * breathingRadius);
          let nearestOtherScore = Infinity;
          for (const other of sources) {
            if (other === source) continue;
            measurePointToSegment(nx, ny, nz, ...other.start, ...other.end, segmentMeasurement);
            const otherDepth = THREE.MathUtils.lerp(other.start[2], other.end[2], segmentMeasurement[1]);
            const otherDepthDelta = nz - otherDepth;
            const otherDistance = segmentMeasurement[0] + otherDepthDelta * otherDepthDelta * 1.45;
            nearestOtherScore = Math.min(
              nearestOtherScore,
              otherDistance / (other.radius * other.radius)
            );
          }
          const ownership = Number.isFinite(nearestOtherScore)
            ? THREE.MathUtils.clamp((nearestOtherScore - sourceScore + 0.22) / 0.44, 0, 1)
            : 1;
          let jellyField = Math.exp(-sourceScore / 1.05) * definition.strength;
          const organicPulse = 1 + (
            Math.sin(nx * 12.7 + time * 1.18 + phase)
            * Math.sin(ny * 10.9 - time * 0.82)
            * Math.cos(nz * 11.8 + time * 0.97)
          ) * 0.18;
          jellyField *= organicPulse;
          jelly.field[rowOffset + x] = Math.max(0, jellyField)
            * ownership
            * visuals.clearanceField[rowOffset + x];
        }
      }
    }
    jelly.update();
    const baseOpacity = definition.face ? 0.18 : 0.31;
    jelly.material.opacity = baseOpacity + (Math.sin(time * 1.42 + phase) + 1) * 0.035;
    jelly.material.emissiveIntensity = (definition.face ? 0.38 : 0.5)
      + (Math.sin(time * 1.76 + phase) + 1) * 0.11;
  });
}

function insetSpacePair(firstPoint, secondPoint, horizontalAxis, bodyHeight) {
  let left = firstPoint;
  let right = secondPoint;
  if (left.dot(horizontalAxis) > right.dot(horizontalAxis)) {
    [left, right] = [right, left];
  }
  const distance = left.distanceTo(right);
  if (distance < 0.0001) return [left.clone(), right.clone()];
  const inset = Math.min(distance * 0.28, bodyHeight * 0.022);
  const amount = inset / distance;
  return [
    left.clone().lerp(right, amount),
    right.clone().lerp(left, amount)
  ];
}

function updateFlatSpacePanel(
  panel,
  boundaryPoints,
  horizontalAxis,
  verticalAxis,
  depthAxis,
  bodyHeight
) {
  if (boundaryPoints.length < 3 || boundaryPoints.some((point) => !point)) {
    panel.mesh.visible = false;
    return;
  }

  const boundaryCenter = boundaryPoints.reduce(
    (sum, point) => sum.add(point),
    new THREE.Vector3()
  ).multiplyScalar(1 / boundaryPoints.length);
  const projected = boundaryPoints.map((point) => {
    const relative = point.clone().sub(boundaryCenter);
    return new THREE.Vector2(relative.dot(horizontalAxis), relative.dot(verticalAxis));
  });
  const signedArea = projected.reduce((area, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return area + point.x * next.y - next.x * point.y;
  }, 0) * 0.5;
  if (Math.abs(signedArea) < bodyHeight * bodyHeight * 0.0028) {
    panel.mesh.visible = false;
    return;
  }
  const orientedBoundary = boundaryPoints.map((point) => point.clone());
  if (signedArea < 0) orientedBoundary.reverse();
  const contourCurve = new THREE.CatmullRomCurve3(
    orientedBoundary,
    true,
    'centripetal',
    0.42
  );
  const contour = contourCurve.getSpacedPoints(48);
  if (
    contour.length > 3
    && contour[0].distanceToSquared(contour[contour.length - 1]) < 0.0000001
  ) {
    contour.pop();
  }
  if (contour.length < 3) {
    panel.mesh.visible = false;
    return;
  }

  const center = contour.reduce(
    (sum, point) => sum.add(point),
    new THREE.Vector3()
  ).multiplyScalar(1 / contour.length);
  const panelNormal = new THREE.Vector3();
  contour.forEach((point, index) => {
    const current = point.clone().sub(center);
    const next = contour[(index + 1) % contour.length].clone().sub(center);
    panelNormal.add(current.cross(next));
  });
  if (panelNormal.lengthSq() < 0.000001) panelNormal.copy(depthAxis);
  panelNormal.normalize();
  if (panelNormal.dot(depthAxis) < 0) panelNormal.multiplyScalar(-1);

  const depth = Math.max(0.08, bodyHeight * (panel.definition.depth ?? 0.078));
  const bevelDepth = Math.min(depth * 0.24, bodyHeight * 0.016);
  const layers = [
    { offset: -depth * 0.5, scale: 0.955 },
    { offset: -depth * 0.5 + bevelDepth, scale: 1 },
    { offset: depth * 0.5 - bevelDepth, scale: 1 },
    { offset: depth * 0.5, scale: 0.955 }
  ];
  const hullPoints = [];
  layers.forEach((layer) => {
    contour.forEach((point) => {
      const relative = point.clone().sub(center);
      const warpedDepth = relative.dot(panelNormal);
      const inPlane = relative.addScaledVector(panelNormal, -warpedDepth);
      inPlane.multiplyScalar(layer.scale);
      inPlane.addScaledVector(panelNormal, warpedDepth + layer.offset);
      hullPoints.push(inPlane);
    });
  });
  const geometry = new ConvexGeometry(hullPoints);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  panel.mesh.geometry.dispose();
  panel.mesh.geometry = geometry;
  panel.mesh.position.copy(center);
  panel.mesh.quaternion.identity();
  const pulse = 1 + Math.sin(state.experimentTime * 1.35 + panel.phase) * 0.014;
  panel.mesh.scale.setScalar(pulse);
  panel.mesh.material.opacity = 0.74
    + (Math.sin(state.experimentTime * 1.18 + panel.phase) + 1) * 0.025;
  panel.mesh.visible = true;
}

function updateSpaceVisuals() {
  const visuals = state.experimentVisuals.space;
  visuals.box.setFromPoints(state.trackers.map((tracker) => tracker.anchorPosition));
  visuals.box.getSize(tempVectorC);
  visuals.bodyHeight = Math.max(0.6, tempVectorC.y);
  if (state.experimentTime - visuals.lastUpdate < 1 / 18) return;
  visuals.lastUpdate = state.experimentTime;

  const bodyHeight = visuals.bodyHeight;
  const trackers = Object.fromEntries(
    state.trackers.map((tracker) => [tracker.definition.id, tracker])
  );
  const trackerPoint = (id) => trackers[id]?.anchorPosition?.clone() ?? null;
  const bonePoint = (name, fallback) => {
    const bone = state.bones.get(name);
    return bone ? bone.getWorldPosition(new THREE.Vector3()) : fallback?.clone() ?? null;
  };
  const hips = bonePoint('Hips', trackerPoint('body'));
  const head = bonePoint('Head', trackerPoint('head'));
  const leftShoulder = bonePoint('LeftArm', trackerPoint('leftArm'));
  const rightShoulder = bonePoint('RightArm', trackerPoint('rightArm'));
  const leftElbow = bonePoint('LeftForeArm', trackerPoint('leftArm'));
  const rightElbow = bonePoint('RightForeArm', trackerPoint('rightArm'));
  const leftHand = bonePoint('LeftHand', trackerPoint('leftHand'));
  const rightHand = bonePoint('RightHand', trackerPoint('rightHand'));
  const leftHip = bonePoint('LeftUpLeg', hips);
  const rightHip = bonePoint('RightUpLeg', hips);
  const leftKnee = bonePoint('LeftLeg', trackerPoint('leftLeg'));
  const rightKnee = bonePoint('RightLeg', trackerPoint('rightLeg'));
  const leftFoot = bonePoint('LeftFoot', trackerPoint('leftFoot'));
  const rightFoot = bonePoint('RightFoot', trackerPoint('rightFoot'));

  const requiredPoints = [
    hips, head,
    leftShoulder, rightShoulder,
    leftElbow, rightElbow,
    leftHand, rightHand,
    leftHip, rightHip,
    leftKnee, rightKnee,
    leftFoot, rightFoot
  ];
  if (requiredPoints.some((point) => !point)) {
    visuals.panels.forEach((panel) => { panel.mesh.visible = false; });
    return;
  }
  const verticalAxis = head.clone().sub(hips).normalize();
  if (verticalAxis.lengthSq() < 0.5) verticalAxis.set(0, 1, 0);
  const horizontalAxis = rightShoulder.clone().sub(leftShoulder);
  horizontalAxis.addScaledVector(verticalAxis, -horizontalAxis.dot(verticalAxis));
  if (horizontalAxis.lengthSq() < 0.0001) horizontalAxis.set(1, 0, 0);
  horizontalAxis.normalize();
  const depthAxis = horizontalAxis.clone().cross(verticalAxis).normalize();
  horizontalAxis.copy(verticalAxis).cross(depthAxis).normalize();

  const hipPair = insetSpacePair(leftHip, rightHip, horizontalAxis, bodyHeight);
  const kneePair = insetSpacePair(leftKnee, rightKnee, horizontalAxis, bodyHeight);
  const footPair = insetSpacePair(leftFoot, rightFoot, horizontalAxis, bodyHeight);
  const leftHeadEdge = head.clone().addScaledVector(horizontalAxis, -bodyHeight * 0.085);
  const rightHeadEdge = head.clone().addScaledVector(horizontalAxis, bodyHeight * 0.085);
  const leftTopOuter = leftHand.clone()
    .addScaledVector(verticalAxis, bodyHeight * 0.19)
    .addScaledVector(horizontalAxis, -bodyHeight * 0.035);
  const rightTopOuter = rightHand.clone()
    .addScaledVector(verticalAxis, bodyHeight * 0.19)
    .addScaledVector(horizontalAxis, bodyHeight * 0.035);
  const leftTopInner = leftHeadEdge.clone().addScaledVector(verticalAxis, bodyHeight * 0.18);
  const rightTopInner = rightHeadEdge.clone().addScaledVector(verticalAxis, bodyHeight * 0.18);
  const armClearance = bodyHeight * 0.022;
  const leftArmLower = [leftHand, leftElbow, leftShoulder].map(
    (point) => point.clone().addScaledVector(verticalAxis, -armClearance)
  );
  const rightArmLower = [rightHand, rightElbow, rightShoulder].map(
    (point) => point.clone().addScaledVector(verticalAxis, -armClearance)
  );
  const leftArmUpper = [leftShoulder, leftElbow, leftHand].map(
    (point) => point.clone().addScaledVector(verticalAxis, armClearance)
  );
  const rightArmUpper = [rightShoulder, rightElbow, rightHand].map(
    (point) => point.clone().addScaledVector(verticalAxis, armClearance)
  );

  const panelPoints = {
    betweenLegs: [
      hipPair[0], kneePair[0], footPair[0],
      footPair[1], kneePair[1], hipPair[1]
    ],
    leftArmLeg: [...leftArmLower, leftHip, leftKnee, leftFoot],
    rightArmLeg: [...rightArmLower, rightHip, rightKnee, rightFoot],
    leftArmHead: [leftHeadEdge, ...leftArmUpper, leftTopOuter, leftTopInner],
    rightArmHead: [rightHeadEdge, ...rightArmUpper, rightTopOuter, rightTopInner]
  };
  visuals.panels.forEach((panel) => {
    updateFlatSpacePanel(
      panel,
      panelPoints[panel.definition.id] ?? [],
      horizontalAxis,
      verticalAxis,
      depthAxis,
      bodyHeight
    );
  });
}

function updateRelationVisuals(delta) {
  const visuals = state.experimentVisuals.relations;
  state.experimentFocusElapsed += delta;
  if (!state.experimentFocusId || state.experimentFocusElapsed >= 0.34) {
    const candidates = state.trackers.filter(
      (tracker) => tracker.definition.id !== 'body' && tracker.definition.id !== 'head'
    );
    const focusTracker = candidates.reduce((current, tracker) => {
      const score = tracker.speed + Math.max(0, tracker.acceleration) * 0.035;
      const currentScore = current
        ? current.speed + Math.max(0, current.acceleration) * 0.035
        : -Infinity;
      return score > currentScore ? tracker : current;
    }, null);
    const nextFocusId = focusTracker?.definition.id ?? null;
    if (nextFocusId !== state.experimentFocusId) {
      state.experimentFocusId = nextFocusId;
      updateExperimentDescription();
    }
    state.experimentFocusElapsed = 0;
  }

  const head = state.trackers.find((tracker) => tracker.definition.id === 'head');
  const focus = state.trackers.find((tracker) => tracker.definition.id === state.experimentFocusId);
  if (!head || !focus) return;
  visuals.positions[0] = head.anchorPosition.x;
  visuals.positions[1] = head.anchorPosition.y;
  visuals.positions[2] = head.anchorPosition.z;
  visuals.positions[3] = focus.anchorPosition.x;
  visuals.positions[4] = focus.anchorPosition.y;
  visuals.positions[5] = focus.anchorPosition.z;
  tempColor.copy(focus.color);
  visuals.colors.set([0.65, 0.65, 0.65, tempColor.r, tempColor.g, tempColor.b]);
  visuals.beam.geometry.attributes.instanceStart.data.needsUpdate = true;
  visuals.beam.geometry.attributes.instanceColorStart.data.needsUpdate = true;

  const focusIntensity = THREE.MathUtils.clamp(focus.speed / 2.2 + Math.max(0, focus.acceleration) / 28, 0, 1);
  visuals.beam.visible = true;
  visuals.beam.material.opacity = 1;
  visuals.halo.position.copy(focus.anchorPosition);
  visuals.halo.quaternion.copy(camera.quaternion);
  visuals.halo.material.color.copy(tempColor);
  visuals.halo.scale.setScalar(0.8 + focusIntensity * 1.7);
  visuals.core.position.copy(focus.anchorPosition);
  visuals.core.material.color.copy(tempColor);
}

function updateExperimentalVisuals(delta) {
  if (!state.experimentVisuals) return;
  state.experimentTime += delta;
  if (state.activeExperiments.has('energy')) updateEnergyVisuals(delta);
  if (state.activeExperiments.has('curves')) updateCurveVisuals();
  if (state.activeExperiments.has('axes')) updateAxisVisuals();
  if (state.activeExperiments.has('sync')) updateSyncVisuals();
  if (state.activeExperiments.has('space')) updateSpaceVisuals();
  if (state.activeExperiments.has('relations')) updateRelationVisuals(delta);
}

function clearTrailGeometry(tracker) {
  tracker.trailPoints.length = 0;
  tracker.hasTrailPoint = false;
  updateTrailGeometry(tracker);
}

function createSmoothedTrailPoints(visiblePoints) {
  if (!state.traceSmoothing || visiblePoints.length < 3) return visiblePoints;

  const renderedPoints = [];
  let segmentStart = 0;
  while (segmentStart < visiblePoints.length) {
    let segmentEnd = segmentStart + 1;
    while (segmentEnd < visiblePoints.length && visiblePoints[segmentEnd].connect) segmentEnd += 1;
    const segment = visiblePoints.slice(segmentStart, segmentEnd);

    if (segment.length < 3) {
      segment.forEach((entry, index) => {
        renderedPoints.push({ point: entry.point, connect: index > 0 });
      });
    } else {
      const curve = new THREE.CatmullRomCurve3(
        segment.map((entry) => entry.point),
        false,
        'centripetal',
        0.5
      );
      const divisions = (segment.length - 1) * 2;
      curve.getPoints(divisions).forEach((point, index) => {
        renderedPoints.push({ point, connect: index > 0 });
      });
    }
    segmentStart = segmentEnd;
  }

  return renderedPoints.slice(-TRAIL_RENDER_LENGTH);
}

function updateTrailGeometry(tracker) {
  const durationSeconds = TRACE_DURATION_SECONDS[state.traceMode];
  const pointLimit = Number.isFinite(durationSeconds)
    ? Math.max(2, Math.round(durationSeconds * state.traceSampleRate))
    : Infinity;
  const visiblePoints = Number.isFinite(pointLimit)
    ? tracker.trailPoints.slice(-pointLimit)
    : tracker.trailPoints;
  const renderedLinePoints = createSmoothedTrailPoints(visiblePoints);
  const shouldFade = state.traceMode !== 'permanent';
  const pointDenominator = Math.max(1, visiblePoints.length - 1);
  const lineDenominator = Math.max(1, renderedLinePoints.length - 1);
  let segmentCount = 0;

  const getIntensity = (index, denominator) => shouldFade
    ? Math.max(0.025, Math.pow(index / denominator, 1.7))
    : 1;
  const writeColor = (target, offset, intensity) => {
    target[offset] = tracker.color.r * intensity;
    target[offset + 1] = tracker.color.g * intensity;
    target[offset + 2] = tracker.color.b * intensity;
  };

  visiblePoints.forEach((entry, index) => {
    const intensity = getIntensity(index, pointDenominator);
    const pointOffset = index * 3;
    tracker.trailPointPositions[pointOffset] = entry.point.x;
    tracker.trailPointPositions[pointOffset + 1] = entry.point.y;
    tracker.trailPointPositions[pointOffset + 2] = entry.point.z;
    writeColor(tracker.trailPointColors, pointOffset, intensity);
  });

  renderedLinePoints.forEach((entry, index) => {
    if (index === 0 || !entry.connect) return;
    const intensity = getIntensity(index, lineDenominator);
    const previous = renderedLinePoints[index - 1];
    const lineOffset = segmentCount * 6;
    tracker.trailLinePositions[lineOffset] = previous.point.x;
    tracker.trailLinePositions[lineOffset + 1] = previous.point.y;
    tracker.trailLinePositions[lineOffset + 2] = previous.point.z;
    tracker.trailLinePositions[lineOffset + 3] = entry.point.x;
    tracker.trailLinePositions[lineOffset + 4] = entry.point.y;
    tracker.trailLinePositions[lineOffset + 5] = entry.point.z;
    writeColor(tracker.trailLineColors, lineOffset, getIntensity(index - 1, lineDenominator));
    writeColor(tracker.trailLineColors, lineOffset + 3, intensity);
    segmentCount += 1;
  });

  tracker.trail.geometry.attributes.instanceStart.data.needsUpdate = true;
  tracker.trail.geometry.attributes.instanceColorStart.data.needsUpdate = true;
  tracker.trail.geometry.instanceCount = segmentCount;
  tracker.trailDots.geometry.attributes.position.needsUpdate = true;
  tracker.trailDots.geometry.attributes.color.needsUpdate = true;
  tracker.trailDots.geometry.setDrawRange(0, visiblePoints.length);
}

function appendTrailPoint(tracker, point, connectToPrevious = true, refreshGeometry = true) {
  tracker.trailPoints.push({
    point: point.clone(),
    connect: connectToPrevious && tracker.hasTrailPoint
  });
  if (tracker.trailPoints.length > TRAIL_LENGTH) {
    tracker.trailPoints.shift();
    if (tracker.trailPoints[0]) tracker.trailPoints[0].connect = false;
  }
  tracker.hasTrailPoint = true;
  if (refreshGeometry) updateTrailGeometry(tracker);
}

function getAveragePosition(objects, target) {
  target.set(0, 0, 0);
  if (!objects.length) return target;
  for (const object of objects) {
    object.getWorldPosition(tempVector);
    target.add(tempVector);
  }
  return target.multiplyScalar(1 / objects.length);
}

function resetTrackerSamples({ preserveTrails = false } = {}) {
  state.sampleElapsed = 0;
  state.trailElapsed = 0;
  state.root?.updateMatrixWorld(true);
  for (const tracker of state.trackers) {
    getAveragePosition(tracker.trackedBones, tracker.position);
    tracker.anchorBone?.getWorldPosition(tracker.anchorPosition);
    tracker.marker.position.copy(tracker.anchorPosition);
    tracker.previousAnchorPosition.copy(tracker.anchorPosition);
    tracker.motionPreviousPosition.copy(tracker.anchorPosition);
    tracker.velocity.set(0, 0, 0);
    tracker.speed = 0;
    tracker.previousSpeed = 0;
    tracker.acceleration = 0;
    tracker.energyLevel = 0;
    tracker.curveHistory.length = 0;
    tracker.curveHistory.push(tracker.anchorPosition.clone());
    tracker.coordinateOrigin.copy(tracker.anchorPosition);
    tracker.coordinate.set(0, 0, 0);
    for (const { key } of GRAPH_SERIES) tracker.history[key].fill(0);
    if (!preserveTrails) clearTrailGeometry(tracker);
    else tracker.hasTrailPoint = false;
    appendTrailPoint(tracker, tracker.anchorPosition, false);
  }
}

function applyAvatarScreenOffset() {
  const width = Math.max(1, ui.sceneWrap.clientWidth);
  const height = Math.max(1, ui.sceneWrap.clientHeight);
  const screenX = (state.avatarOffsetX / 2.4) * width * 0.32;
  const screenY = (state.avatarOffsetY / 1.8) * height * 0.28;

  if (Math.abs(screenX) < 0.01 && Math.abs(screenY) < 0.01) {
    camera.clearViewOffset();
  } else {
    camera.setViewOffset(width, height, -screenX, screenY, width, height);
  }
  camera.updateProjectionMatrix();
}

function fitCamera() {
  camera.position.set(4.65 + state.avatarOffsetX, 2.55 + state.avatarOffsetY, 7.25);
  controls.target.set(state.avatarOffsetX, 1.48 + state.avatarOffsetY, 0);
  controls.update();
  applyAvatarScreenOffset();
}

function centerCharacter() {
  const hips = state.bones.get('Hips');
  if (!state.root || !hips) return;
  state.root.updateMatrixWorld(true);
  hips.getWorldPosition(tempVector);
  state.root.position.x += state.avatarOffsetX - tempVector.x;
  state.root.position.z -= tempVector.z;
  state.root.updateMatrixWorld(true);
}

function prepareModel(gltf, movement) {
  clearCurrentModel();
  const root = gltf.scene;
  styleModel(root);

  const clip = chooseClip(gltf.animations, movement.modelNumber);
  if (!clip) throw new Error(`Model ${movement.fileName} does not contain an animation clip.`);
  const clipStart = getTrimmedClipStart(clip);

  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();
  action.time = clipStart;
  mixer.update(0);

  normalizeModel(root);
  const modelContainer = new THREE.Group();
  modelContainer.position.set(state.avatarOffsetX, state.avatarOffsetY, 0);
  modelContainer.add(root);
  scene.add(modelContainer);

  state.root = root;
  state.modelContainer = modelContainer;
  state.mixer = mixer;
  state.action = action;
  state.clip = clip;
  state.duration = clip.duration;
  state.clipStart = clipStart;
  state.bones = indexBones(root);
  state.lastClipTime = clipStart;
  centerCharacter();
  createTrackers();
  resetTrackerSamples();
  createExperimentalVisuals();
  fitCamera();

  ui.timeline.min = String(clipStart);
  ui.timeline.max = String(clip.duration);
  ui.timeline.value = String(clipStart);
  const playableDuration = Math.max(0, clip.duration - clipStart);
  ui.totalTime.textContent = formatTime(playableDuration);
  ui.statusDetail.textContent = `${state.trackers.filter((tracker) => tracker.trackedBones.length).length} SIGNALS · ${state.bones.size} NODES`;
  state.ready = true;
  setPlaying(true);
  hideLoading();
}

function loadModel(movementIndex) {
  const movement = MOVEMENTS[movementIndex];
  if (!movement) return;

  state.movementIndex = movementIndex;
  ui.select.value = movement.id;
  updateMovementInformation(movement);
  setLoading();
  const token = ++state.loadToken;

  gltfLoader.load(
    movement.url,
    (gltf) => {
      if (token !== state.loadToken) {
        disposeObject(gltf.scene);
        return;
      }
      try {
        prepareModel(gltf, movement);
      } catch (error) {
        console.error(error);
        setLoading('MODEL COULD NOT BE PREPARED', 'CHECK CONSOLE', true);
      }
    },
    (event) => {
      if (token !== state.loadToken) return;
      const percentage = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
      ui.loadingProgress.textContent = event.total ? `${percentage}%` : `${Math.round(event.loaded / 1024)} KB`;
    },
    (error) => {
      if (token !== state.loadToken) return;
      console.error(error);
      setLoading('MODEL COULD NOT BE LOADED', movement.fileName.toUpperCase(), true);
    }
  );

  const urlState = new URL(window.location.href);
  urlState.searchParams.set('movement', movement.id);
  window.history.replaceState({}, '', urlState);
}

function formatTime(seconds) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${remainder.toFixed(2).padStart(5, '0')}`;
}

function setPlaying(playing) {
  state.playing = playing;
  ui.playButton.classList.toggle('paused', !playing);
  ui.playButton.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
}

function setCameraOrbit(enabled) {
  state.cameraOrbit = enabled;
  controls.autoRotate = enabled;
  ui.cameraOrbitToggle.classList.toggle('active', enabled);
  ui.cameraOrbitToggle.setAttribute('aria-pressed', String(enabled));
  ui.cameraOrbitToggle.setAttribute('aria-label', enabled ? 'Stop automatic camera rotation' : 'Start automatic camera rotation');
  ui.cameraOrbitStatus.textContent = enabled ? 'ON' : 'OFF';
}

function setCameraOrbitSpeed(speed, activeButton) {
  state.cameraOrbitSpeed = speed;
  controls.autoRotateSpeed = speed * 2 * state.cameraOrbitDirection;
  ui.cameraSpeedButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
}

function setCameraOrbitDirection(direction, activeButton) {
  state.cameraOrbitDirection = direction;
  controls.autoRotateSpeed = state.cameraOrbitSpeed * 2 * direction;
  ui.cameraDirectionButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
}

function setAvatarPosition(nextX, nextY) {
  const clampedX = THREE.MathUtils.clamp(nextX, -2.4, 2.4);
  const clampedY = THREE.MathUtils.clamp(nextY, -1.2, 1.8);
  const deltaX = clampedX - state.avatarOffsetX;
  const deltaY = clampedY - state.avatarOffsetY;
  state.avatarOffsetX = clampedX;
  state.avatarOffsetY = clampedY;

  if (state.modelContainer) {
    state.modelContainer.position.set(clampedX, clampedY, 0);
    state.modelContainer.updateMatrixWorld(true);
  }

  if (deltaX || deltaY) {
    tempVector.set(deltaX, deltaY, 0);
    for (const tracker of state.trackers) {
      tracker.trailPoints.forEach((entry) => entry.point.add(tempVector));
      tracker.position.add(tempVector);
      tracker.anchorPosition.add(tempVector);
      tracker.previousAnchorPosition.add(tempVector);
      tracker.motionPreviousPosition.add(tempVector);
      tracker.coordinateOrigin.add(tempVector);
      tracker.marker.position.add(tempVector);
      tracker.curveHistory.forEach((point) => point.add(tempVector));
      updateTrailGeometry(tracker);
    }
    camera.position.add(tempVector);
    controls.target.add(tempVector);
    controls.update();
  }

  applyAvatarScreenOffset();

  const formatOffset = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
  ui.avatarPositionReadout.textContent = `X ${formatOffset(clampedX)} · Y ${formatOffset(clampedY)}`;
}

function moveAvatar(direction) {
  const step = 0.22;
  if (direction === 'left') setAvatarPosition(state.avatarOffsetX - step, state.avatarOffsetY);
  if (direction === 'right') setAvatarPosition(state.avatarOffsetX + step, state.avatarOffsetY);
  if (direction === 'up') setAvatarPosition(state.avatarOffsetX, state.avatarOffsetY + step);
  if (direction === 'down') setAvatarPosition(state.avatarOffsetX, state.avatarOffsetY - step);
  if (direction === 'center') setAvatarPosition(0, 0);
}

function setTraceMode(mode, activeButton) {
  if (!(mode in TRACE_DURATION_SECONDS)) return;
  state.traceMode = mode;
  ui.traceModeButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
  state.trackers.forEach(updateTrailGeometry);
}

function setTraceVisibility(visible) {
  state.traceVisible = visible;
  ui.traceVisibilityButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.traceVisible === String(visible));
  });
  ui.lineDisplayToggle.setAttribute('aria-pressed', String(visible));
  ui.lineDisplayToggle.setAttribute('aria-label', visible ? 'Turn line display off' : 'Turn line display on');
  ui.lineDisplayStatus.textContent = visible ? 'ON' : 'OFF';
  state.trackers.forEach((tracker) => {
    tracker.trail.visible = visible;
    tracker.trailDots.visible = visible && state.traceDots;
  });
}

function setBodyPointsVisibility(visible) {
  state.bodyPointsVisible = visible;
  ui.bodyPointsToggle.setAttribute('aria-pressed', String(visible));
  ui.bodyPointsToggle.setAttribute('aria-label', visible ? 'Hide colored body points' : 'Show colored body points');
  ui.bodyPointsStatus.textContent = visible ? 'ON' : 'OFF';
  state.trackers.forEach((tracker) => {
    tracker.marker.visible = visible;
  });
}

function setTraceDots(showDots, activeButton) {
  state.traceDots = showDots;
  ui.traceDotButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
  state.trackers.forEach((tracker) => {
    tracker.trailDots.visible = state.traceVisible && showDots;
  });
}

function setTraceSmoothing(smooth, activeButton) {
  state.traceSmoothing = smooth;
  ui.traceSmoothingButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
  state.trackers.forEach(updateTrailGeometry);
}

function setTraceSampleRate(rate, activeButton) {
  state.traceSampleRate = rate;
  state.trailElapsed = 0;
  ui.traceSampleRateButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
  state.trackers.forEach(updateTrailGeometry);
}

function setFloorLight(level, activeButton) {
  const preset = FLOOR_LIGHT_LEVELS[level];
  if (!preset) return;
  state.floorLight = level;
  ground.material.color.setHex(preset.color);
  grid.material.opacity = preset.gridOpacity;
  floorRings.forEach((ring) => {
    ring.material.opacity = preset.ringOpacity;
  });
  ui.floorLightButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
}

function setCameraControlsOpen(open) {
  state.cameraControlsOpen = open;
  ui.cameraControlsToggle.setAttribute('aria-expanded', String(open));
  ui.cameraControlsStatus.textContent = open ? 'HIDE' : 'SHOW';
  ui.cameraControlsPanel.hidden = !open;
}

function setLineControlsOpen(open) {
  state.lineControlsOpen = open;
  ui.lineControlsToggle.setAttribute('aria-expanded', String(open));
  ui.lineControlsStatus.textContent = open ? 'HIDE' : 'SHOW';
  ui.lineControlsPanel.hidden = !open;
}

function setVisualizationMenu(open) {
  state.visualizationMenuOpen = open;
  ui.visualizationMenuToggle.setAttribute('aria-expanded', String(open));
  ui.visualizationMenuStatus.textContent = open ? 'HIDE' : 'SHOW';
  ui.visualizationMenuPanel.hidden = !open;
}

function getMaximumAnalysisWidth() {
  return Math.max(300, Math.min(760, window.innerWidth - 420));
}

function setAnalysisWidth(width) {
  const maximum = getMaximumAnalysisWidth();
  state.analysisWidth = THREE.MathUtils.clamp(width, 300, maximum);
  ui.appShell.style.setProperty('--analysis-width', `${state.analysisWidth}px`);
  ui.analysisResizer.setAttribute('aria-valuenow', String(Math.round(state.analysisWidth)));
  ui.analysisResizer.setAttribute('aria-valuemax', String(Math.round(maximum)));
}

function setTraceWidth(width, activeButton) {
  state.traceWidth = width;
  ui.traceWidthButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
  for (const tracker of state.trackers) {
    tracker.trail.material.linewidth = width;
    tracker.trailDots.material.size = 0.018 + width * 0.004;
  }
}

function setGraphMode(mode, activeButton) {
  if (!['all', 'x', 'y', 'z', 'average'].includes(mode)) return;
  state.graphMode = mode;
  ui.graphModeButtons.forEach((button) => button.classList.toggle('active', button === activeButton));

  document.querySelectorAll('.signal-axis').forEach((readout) => {
    const key = readout.querySelector('[data-axis-value]')?.dataset.axisValue;
    readout.hidden = mode === 'all' ? key === 'average' : key !== mode;
  });
  ui.graphKeys.forEach((key) => {
    const keyMode = key.dataset.graphKey;
    key.hidden = mode === 'all' ? keyMode === 'average' : keyMode !== mode;
  });
}

function resetExperience() {
  if (state.action) {
    state.action.reset().play();
    state.action.time = state.clipStart;
    state.mixer.update(0);
    state.lastClipTime = state.clipStart;
    centerCharacter();
    resetTrackerSamples();
  }
  setPlaying(true);
  fitCamera();
}

function angleAt(first, center, last) {
  if (!first || !center || !last) return null;
  const a = first.getWorldPosition(new THREE.Vector3()).sub(center.getWorldPosition(new THREE.Vector3())).normalize();
  const b = last.getWorldPosition(new THREE.Vector3()).sub(center.getWorldPosition(new THREE.Vector3())).normalize();
  return THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1)));
}

function updateJointGeometry() {
  const elbow = angleAt(state.bones.get('RightArm'), state.bones.get('RightForeArm'), state.bones.get('RightHand'));
  const knee = angleAt(state.bones.get('RightUpLeg'), state.bones.get('RightLeg'), state.bones.get('RightFoot'));
  const hips = state.bones.get('Hips');
  const head = state.bones.get('Head');
  let torsoLean = null;
  if (hips && head) {
    const hipsPosition = hips.getWorldPosition(new THREE.Vector3());
    const bodyAxis = head.getWorldPosition(new THREE.Vector3()).sub(hipsPosition).normalize();
    torsoLean = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(bodyAxis.dot(THREE.Object3D.DEFAULT_UP), -1, 1)));
  }

  ui.elbowAngle.textContent = elbow == null ? '—°' : `${Math.round(elbow)}°`;
  ui.kneeAngle.textContent = knee == null ? '—°' : `${Math.round(knee)}°`;
  ui.torsoAngle.textContent = torsoLean == null ? '—°' : `${Math.round(torsoLean)}°`;
}

function updateMotionSignals(delta, shouldSample, trailSampling = null) {
  if (!state.root || !state.ready) return;
  state.root.updateMatrixWorld(true);
  const motionDelta = THREE.MathUtils.clamp(delta, 1 / 240, 0.12);

  for (const tracker of state.trackers) {
    getAveragePosition(tracker.trackedBones, tracker.position);
    tracker.anchorBone?.getWorldPosition(tracker.anchorPosition);
    tracker.marker.position.copy(tracker.anchorPosition);

    tracker.velocity.subVectors(tracker.anchorPosition, tracker.motionPreviousPosition).divideScalar(motionDelta);
    tracker.speed = tracker.velocity.length();
    tracker.acceleration = (tracker.speed - tracker.previousSpeed) / motionDelta;
    tracker.previousSpeed = tracker.speed;
    tracker.motionPreviousPosition.copy(tracker.anchorPosition);
    const lastCurvePoint = tracker.curveHistory.at(-1);
    if (!lastCurvePoint || lastCurvePoint.distanceToSquared(tracker.anchorPosition) > 0.000016) {
      tracker.curveHistory.push(tracker.anchorPosition.clone());
      if (tracker.curveHistory.length > CURVE_HISTORY_LENGTH) tracker.curveHistory.shift();
    }

    tracker.coordinate.copy(tracker.anchorPosition).sub(tracker.coordinateOrigin).multiplyScalar(1 / DISPLAY_HEIGHT);
    const average = (tracker.coordinate.x + tracker.coordinate.y + tracker.coordinate.z) / 3;

    if (shouldSample) {
      for (const { key } of AXES) {
        tracker.history[key].push(tracker.coordinate[key]);
        if (tracker.history[key].length > SIGNAL_WINDOW) tracker.history[key].shift();
      }
      tracker.history.average.push(average);
      if (tracker.history.average.length > SIGNAL_WINDOW) tracker.history.average.shift();
    }

    if (trailSampling?.count > 0) {
      for (let sampleIndex = 0; sampleIndex < trailSampling.count; sampleIndex += 1) {
        const sampleTime = trailSampling.interval * (sampleIndex + 1) - trailSampling.elapsedBeforeFrame;
        const interpolation = THREE.MathUtils.clamp(sampleTime / trailSampling.frameDelta, 0, 1);
        tracker.trailInterpolationPoint.lerpVectors(
          tracker.previousAnchorPosition,
          tracker.anchorPosition,
          interpolation
        );
        appendTrailPoint(tracker, tracker.trailInterpolationPoint, true, false);
      }
      updateTrailGeometry(tracker);
    }
    tracker.previousAnchorPosition.copy(tracker.anchorPosition);

    const row = ui.signalList.querySelector(`[data-signal="${tracker.definition.id}"]`);
    for (const { key } of AXES) {
      const value = Math.abs(tracker.coordinate[key]) < 0.0005 ? 0 : tracker.coordinate[key];
      row.querySelector(`[data-axis-value="${key}"]`).textContent = `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;
    }
    const displayAverage = Math.abs(average) < 0.0005 ? 0 : average;
    row.querySelector('[data-axis-value="average"]').textContent = `${displayAverage >= 0 ? '+' : ''}${displayAverage.toFixed(3)}`;
  }

  updateJointGeometry();
  updateExperimentalVisuals(motionDelta);
}

function drawSignalCharts() {
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  for (const tracker of state.trackers) {
    const row = ui.signalList.querySelector(`[data-signal="${tracker.definition.id}"]`);
    const canvas = row?.querySelector('.signal-row__chart');
    if (!canvas) continue;
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    if (canvas.width !== Math.round(width * pixelRatio) || canvas.height !== Math.round(height * pixelRatio)) {
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
    }

    const context = canvas.getContext('2d');
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.strokeStyle = 'rgba(255,255,255,.055)';
    context.lineWidth = 1;
    for (const ratio of [0.25, 0.5, 0.75]) {
      const gridY = height * ratio;
      context.beginPath();
      context.moveTo(0, gridY);
      context.lineTo(width, gridY);
      context.stroke();
    }

    const visibleSeries = state.graphMode === 'all'
      ? AXES
      : GRAPH_SERIES.filter(({ key }) => key === state.graphMode);
    const allValues = visibleSeries.flatMap(({ key }) => tracker.history[key]);
    const maxValue = Math.max(0.04, ...allValues.map((value) => Math.abs(value))) * 1.12;
    for (const { key, color } of visibleSeries) {
      const history = tracker.history[key];
      context.strokeStyle = color;
      context.lineWidth = 1.35;
      context.beginPath();
      history.forEach((value, index) => {
        const x = (index / Math.max(1, history.length - 1)) * width;
        const y = height / 2 - (value / maxValue) * (height * 0.42);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.stroke();
    }
  }
}

function resize() {
  const width = ui.sceneWrap.clientWidth;
  const height = ui.sceneWrap.clientHeight;
  const pixelRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  applyAvatarScreenOffset();

}

function updateTransport() {
  const absoluteTime = state.action?.time ?? state.clipStart;
  const time = Math.max(0, absoluteTime - state.clipStart);
  const playableDuration = Math.max(0, state.duration - state.clipStart);
  ui.currentTime.textContent = formatTime(time);
  ui.frameReadout.textContent = `T+ ${time.toFixed(2).padStart(5, '0')} S`;
  if (!ui.timeline.matches(':active')) ui.timeline.value = String(absoluteTime);
  const progress = playableDuration ? (time / playableDuration) * 100 : 0;
  ui.timeline.style.setProperty('--progress', `${progress}%`);
}

function animate() {
  const rawDelta = Math.min(clock.getDelta(), 0.08);

  if (state.ready && state.mixer && state.action && state.playing) {
    state.mixer.update(rawDelta * state.speed);
    const clipTime = state.action.time;
    const looped = clipTime + 0.03 < state.lastClipTime;
    if (looped) {
      state.action.time = state.clipStart;
      state.mixer.update(0);
      state.lastClipTime = state.clipStart;
    } else {
      state.lastClipTime = clipTime;
    }
    centerCharacter();
    if (looped) resetTrackerSamples();

    state.sampleElapsed += rawDelta;
    const trailElapsedBeforeFrame = state.trailElapsed;
    state.trailElapsed += rawDelta;
    const shouldSample = state.sampleElapsed >= 1 / 30;
    const trailInterval = 1 / state.traceSampleRate;
    const trailSampleCount = Math.floor(state.trailElapsed / trailInterval);
    if (shouldSample) {
      state.sampleElapsed = 0;
    }
    if (trailSampleCount > 0) state.trailElapsed %= trailInterval;
    updateMotionSignals(rawDelta * state.speed, shouldSample, trailSampleCount > 0 ? {
      count: trailSampleCount,
      interval: trailInterval,
      elapsedBeforeFrame: trailElapsedBeforeFrame,
      frameDelta: rawDelta
    } : null);
  } else if (state.ready) {
    updateMotionSignals(rawDelta, false, false);
  }

  controls.update(rawDelta);
  updateTransport();
  drawSignalCharts();
  renderer.render(scene, camera);
}

ui.select.addEventListener('change', () => {
  const movementIndex = MOVEMENTS.findIndex((movement) => movement.id === ui.select.value);
  if (movementIndex >= 0) loadModel(movementIndex);
});
ui.playButton.addEventListener('click', () => setPlaying(!state.playing));
ui.resetButton.addEventListener('click', resetExperience);
ui.sceneWrap.addEventListener('dblclick', fitCamera);
ui.cameraOrbitToggle.addEventListener('click', () => setCameraOrbit(!state.cameraOrbit));
ui.cameraControlsToggle.addEventListener('click', () => setCameraControlsOpen(!state.cameraControlsOpen));
ui.lineControlsToggle.addEventListener('click', () => setLineControlsOpen(!state.lineControlsOpen));
ui.visualizationMenuToggle.addEventListener('click', () => setVisualizationMenu(!state.visualizationMenuOpen));

ui.timeline.addEventListener('input', () => {
  if (!state.action || !state.mixer) return;
  state.action.time = Number(ui.timeline.value);
  state.mixer.update(0);
  state.lastClipTime = state.action.time;
  centerCharacter();
  resetTrackerSamples({ preserveTrails: true });
  updateMotionSignals(1 / 30, false, false);
});

for (const button of ui.speedButtons) {
  button.addEventListener('click', () => {
    state.speed = Number(button.dataset.speed);
    ui.speedButtons.forEach((candidate) => candidate.classList.toggle('active', candidate === button));
  });
}

for (const button of ui.cameraSpeedButtons) {
  button.addEventListener('click', () => setCameraOrbitSpeed(Number(button.dataset.cameraSpeed), button));
}

for (const button of ui.cameraDirectionButtons) {
  button.addEventListener('click', () => setCameraOrbitDirection(Number(button.dataset.cameraDirection), button));
}

for (const button of ui.avatarMoveButtons) {
  button.addEventListener('click', () => moveAvatar(button.dataset.avatarMove));
}

for (const button of ui.experimentButtons) {
  button.addEventListener('click', () => toggleExperiment(button.dataset.experiment));
}

for (const button of ui.traceModeButtons) {
  button.addEventListener('click', () => setTraceMode(button.dataset.traceMode, button));
}

for (const button of ui.traceWidthButtons) {
  button.addEventListener('click', () => setTraceWidth(Number(button.dataset.traceWidth), button));
}

for (const button of ui.traceVisibilityButtons) {
  button.addEventListener('click', () => setTraceVisibility(button.dataset.traceVisible === 'true'));
}

ui.lineDisplayToggle.addEventListener('click', () => setTraceVisibility(!state.traceVisible));
ui.bodyPointsToggle.addEventListener('click', () => setBodyPointsVisibility(!state.bodyPointsVisible));

for (const button of ui.traceDotButtons) {
  button.addEventListener('click', () => setTraceDots(button.dataset.traceDots === 'true', button));
}

for (const button of ui.traceSmoothingButtons) {
  button.addEventListener('click', () => setTraceSmoothing(button.dataset.traceSmoothing === 'true', button));
}

for (const button of ui.graphModeButtons) {
  button.addEventListener('click', () => setGraphMode(button.dataset.graphMode, button));
}

for (const button of ui.floorLightButtons) {
  button.addEventListener('click', () => setFloorLight(button.dataset.floorLight, button));
}

for (const button of ui.traceSampleRateButtons) {
  button.addEventListener('click', () => setTraceSampleRate(Number(button.dataset.traceSampleRate), button));
}

ui.analysisResizer.addEventListener('pointerdown', (event) => {
  if (window.innerWidth <= 860) return;
  state.panelResizing = true;
  state.panelResizeStartX = event.clientX;
  state.panelResizeStartWidth = ui.analysisPanel.getBoundingClientRect().width;
  ui.analysisResizer.setPointerCapture(event.pointerId);
  document.body.classList.add('resizing-panel');
});

ui.analysisResizer.addEventListener('pointermove', (event) => {
  if (!state.panelResizing) return;
  const dragDistance = event.clientX - state.panelResizeStartX;
  setAnalysisWidth(state.panelResizeStartWidth - dragDistance);
});

const finishPanelResize = (event) => {
  if (!state.panelResizing) return;
  state.panelResizing = false;
  document.body.classList.remove('resizing-panel');
  if (ui.analysisResizer.hasPointerCapture(event.pointerId)) {
    ui.analysisResizer.releasePointerCapture(event.pointerId);
  }
};
ui.analysisResizer.addEventListener('pointerup', finishPanelResize);
ui.analysisResizer.addEventListener('pointercancel', finishPanelResize);
ui.analysisResizer.addEventListener('mousedown', (event) => {
  if (state.panelResizing || window.innerWidth <= 860) return;
  state.panelResizing = true;
  state.panelResizeStartX = event.clientX;
  state.panelResizeStartWidth = ui.analysisPanel.getBoundingClientRect().width;
  document.body.classList.add('resizing-panel');
});
window.addEventListener('mousemove', (event) => {
  if (!state.panelResizing) return;
  const dragDistance = event.clientX - state.panelResizeStartX;
  setAnalysisWidth(state.panelResizeStartWidth - dragDistance);
});
window.addEventListener('mouseup', () => {
  if (!state.panelResizing) return;
  state.panelResizing = false;
  document.body.classList.remove('resizing-panel');
});
ui.analysisResizer.addEventListener('dblclick', () => setAnalysisWidth(390));
ui.analysisResizer.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'ArrowLeft') setAnalysisWidth(state.analysisWidth + 24);
  if (event.key === 'ArrowRight') setAnalysisWidth(state.analysisWidth - 24);
  if (event.key === 'Home') setAnalysisWidth(300);
  if (event.key === 'End') setAnalysisWidth(getMaximumAnalysisWidth());
});

window.addEventListener('keydown', (event) => {
  const interactive = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(document.activeElement?.tagName);
  if (interactive) return;
  if (event.code === 'Space') {
    event.preventDefault();
    setPlaying(!state.playing);
  } else if (event.key === 'ArrowRight') {
    loadModel((state.movementIndex + 1) % MOVEMENTS.length);
  } else if (event.key === 'ArrowLeft') {
    loadModel((state.movementIndex - 1 + MOVEMENTS.length) % MOVEMENTS.length);
  } else if (event.key.toLowerCase() === 'r') {
    resetExperience();
  } else if (event.key.toLowerCase() === 'c') {
    setCameraOrbit(!state.cameraOrbit);
  }
});

window.addEventListener('resize', () => {
  setAnalysisWidth(state.analysisWidth);
  resize();
});
new ResizeObserver(resize).observe(ui.sceneWrap);

populateMovementSelector();
populateSignalRows();
setGraphMode('all', ui.graphModeButtons.find((button) => button.dataset.graphMode === 'all'));
setFloorLight('off', ui.floorLightButtons.find((button) => button.dataset.floorLight === 'off'));
setTraceSampleRate(20, ui.traceSampleRateButtons.find((button) => button.dataset.traceSampleRate === '20'));
setCameraControlsOpen(false);
setLineControlsOpen(false);
setVisualizationMenu(false);
setAnalysisWidth(390);
fitCamera();
resize();
renderer.setAnimationLoop(animate);

const requestedMovement = new URLSearchParams(window.location.search).get('movement');
const requestedIndex = MOVEMENTS.findIndex((movement) => movement.id === requestedMovement);
loadModel(requestedIndex >= 0 ? requestedIndex : 0);
