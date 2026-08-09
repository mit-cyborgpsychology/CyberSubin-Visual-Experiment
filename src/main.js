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
import {
  createExternalSpacePointCloud,
  updateExternalSpacePointCloud
} from './external-space.js';
import { readViewStateFromParams, writeViewStateToParams } from './view-url.js';
import { posture } from '../59.ts';
import './styles.css';

const PAGE_PARAMS = new URLSearchParams(window.location.search);
const GRID_STATE_KEY = 'cyber-subin-six-avatar-state';
const EMBEDDED_VIEW = PAGE_PARAMS.get('embedded') === '1';
const EMBEDDED_TRANSPORT_SOURCE = !EMBEDDED_VIEW || PAGE_PARAMS.get('transport') !== '0';
const RETURN_TO_GRID = PAGE_PARAMS.get('from') === 'grid';
const REQUESTED_PROGRESS = PAGE_PARAMS.has('progress') ? Number(PAGE_PARAMS.get('progress')) : null;
const REQUESTED_PLAYING = PAGE_PARAMS.has('playing') ? PAGE_PARAMS.get('playing') !== 'false' : null;
const REQUESTED_SPEED = PAGE_PARAMS.has('speed') ? Number(PAGE_PARAMS.get('speed')) : null;
const REQUESTED_URL_VIEW_STATE = readViewStateFromParams(PAGE_PARAMS);
let REQUESTED_GRID_CELL_STATE = null;
if (RETURN_TO_GRID) {
  try {
    const storedGridState = JSON.parse(window.sessionStorage.getItem(GRID_STATE_KEY));
    const focusedIndex = Number(storedGridState?.focusedIndex);
    if (Number.isInteger(focusedIndex) && focusedIndex >= 0 && focusedIndex < 6) {
      REQUESTED_GRID_CELL_STATE = storedGridState.cells?.[focusedIndex] ?? null;
    }
  } catch {
    REQUESTED_GRID_CELL_STATE = null;
  }
}
document.body.classList.toggle('embedded-view', EMBEDDED_VIEW);

const DISPLAY_HEIGHT = 3;
const DEFAULT_CAMERA_OFFSET = new THREE.Vector3(4.65, 1.07, 7.25);
const DEFAULT_CAMERA_DIRECTION = DEFAULT_CAMERA_OFFSET.clone().normalize();
const EMBEDDED_CAMERA_DISTANCE = new THREE.Vector3(2.15, 0.88, 6.15).length();
const EMBEDDED_CAMERA_OFFSET = DEFAULT_CAMERA_DIRECTION.clone().multiplyScalar(EMBEDDED_CAMERA_DISTANCE);
const SIGNAL_WINDOW = 270;
const TRAIL_INITIAL_CAPACITY = EMBEDDED_VIEW ? 256 : 4096;
const TRAIL_INITIAL_RENDER_CAPACITY = TRAIL_INITIAL_CAPACITY * 2;
const FADING_TRAIL_RETENTION_LIMIT = 4096;
const CURVE_HISTORY_LENGTH = 108;
const MODEL_COUNT = 59;
const DEFAULT_MOVEMENT_ID = '59';
const DEFAULT_SPEED = 3;
const DEFAULT_AVATAR_COLOR = 'lightGrey';
const DEFAULT_SURFACE_MODE = 'smooth';
const DEFAULT_LIGHTING_PRESET = 'top';
const DEFAULT_LIGHTING_COLOR = 'cool';
const TRACE_DURATION_SECONDS = {
  permanent: Infinity,
  long: 15,
  medium: 8,
  short: 3,
  brief: 1.5,
  instant: 1
};
const FLOOR_LIGHT_LEVELS = {
  off: { color: 0x000000 },
  low: { color: 0x020303 },
  medium: { color: 0x050708 },
  high: { color: 0x162226 }
};
const AVATAR_COLORS = {
  pearl: '#c7c9c5',
  cyan: '#65f3ff',
  blue: '#3977ff',
  violet: '#a56cff',
  magenta: '#ff4fbc',
  gold: '#e7ad4f',
  lime: '#a8ff3e',
  coral: '#ff6f61',
  black: '#111315',
  darkGrey: '#34383d',
  grey: '#7a8085',
  lightGrey: '#d9dcde'
};
const LIGHTING_PRESETS = {
  studio: {
    hemisphere: ['#d8dde0', '#050607', 2.4],
    key: ['#f6f3ee', 3.7, [4.5, 7, 5]],
    rim: ['#e8edf0', 3.2, [-4, 3.5, -4]],
    fill: ['#b8bdc1', 1.15, [4, 1.5, -3]],
    exposure: 1.15
  },
  bright: {
    hemisphere: ['#eef1f2', '#0b0c0d', 4.2],
    key: ['#fffdfa', 6.4, [3.5, 7.5, 5.5]],
    rim: ['#edf0f2', 2.5, [-4, 4, -4]],
    fill: ['#d7d9db', 2.8, [4, 2, -2]],
    exposure: 1.3
  },
  softFront: {
    hemisphere: ['#c5c9cb', '#040505', 1.6],
    key: ['#f7f4ef', 2.7, [0, 4.8, 5.8]],
    rim: ['#e0e4e6', 0.85, [-3, 3, -4]],
    fill: ['#adb1b4', 0.55, [3, 2, -1]],
    exposure: 1.08
  },
  side: {
    hemisphere: ['#9ca2a5', '#030405', 1.35],
    key: ['#f5f1eb', 6.2, [-5.5, 3.2, 1.5]],
    rim: ['#dce1e3', 1.1, [4.5, 3, -4]],
    fill: ['#92979a', 0.25, [4, 1, 2]],
    exposure: 1.08
  },
  highSide: {
    hemisphere: ['#858b8e', '#020303', 0.7],
    key: ['#f5f2ec', 4.5, [-4.8, 6.8, 1.8]],
    rim: ['#e1e5e7', 1.4, [3, 4, -4]],
    fill: ['#969b9e', 0.22, [3, 1.5, 2]],
    exposure: 1.02
  },
  cross: {
    hemisphere: ['#91979a', '#020303', 0.85],
    key: ['#f7f4ef', 3.6, [-4, 5, 3.5]],
    rim: ['#e7eaec', 3, [4, 4, -3.5]],
    fill: ['#9b9fa2', 0.25, [0, 2, 4]],
    exposure: 1.05
  },
  lowKey: {
    hemisphere: ['#777d80', '#010203', 0.52],
    key: ['#e5e3df', 1.65, [-3.8, 5.5, 3]],
    rim: ['#e2e6e8', 3.8, [4, 3.8, -4.5]],
    fill: ['#858a8d', 0.16, [3, 1.5, -2]],
    exposure: 0.98
  },
  top: {
    hemisphere: ['#686d70', '#010203', 0.38],
    key: ['#f4f3ef', 5.2, [0, 8, 0.5]],
    rim: ['#e1e5e7', 1.8, [-3.5, 3.5, -4]],
    fill: ['#7e8386', 0.12, [3, 1, 1]],
    exposure: 1.02
  },
  rim: {
    hemisphere: ['#656b6e', '#020304', 0.72],
    key: ['#deddda', 0.65, [2, 6, 4]],
    rim: ['#eef1f2', 7.4, [-3.5, 4.5, -5.5]],
    fill: ['#a7aaac', 0.65, [4.5, 2, -3]],
    exposure: 1.12
  },
  softSilhouette: {
    hemisphere: ['#484d50', '#000000', 0.38],
    key: ['#a5a8aa', 0.32, [1.5, 5.5, 4]],
    rim: ['#edf0f1', 7.8, [0, 4.2, -5.8]],
    fill: ['#858a8d', 0.18, [4, 1.8, -3]],
    exposure: 1.05
  },
  backlight: {
    hemisphere: ['#3c4144', '#000000', 0.3],
    key: ['#868b8e', 0.24, [-2, 5, 3.5]],
    rim: ['#f0f2f3', 7.2, [0, 3.5, -5.5]],
    fill: ['#797e81', 0.1, [3.5, 1.5, -2]],
    exposure: 1
  },
  silhouette: {
    hemisphere: ['#25292b', '#000000', 0.2],
    key: ['#484d50', 0.15, [0, 5, 5]],
    rim: ['#f2f3f4', 8.8, [0, 4, -6]],
    fill: ['#000000', 0, [4, 2, -3]],
    exposure: 0.92
  }
};
const LIGHTING_COLOR_PRESETS = {
  neutral: null,
  ivory: { light: '#f0e9dd', ground: '#090806' },
  warm: { light: '#e8c6a7', ground: '#0d0805' },
  amber: { light: '#d8bc88', ground: '#0c0904' },
  cool: { light: '#b7c9d3', ground: '#05080a' },
  mist: { light: '#bdd2d0', ground: '#040909' },
  sage: { light: '#c4d0b9', ground: '#060904' },
  blush: { light: '#d8bdc2', ground: '#0b0608' },
  lavender: { light: '#c8c0d6', ground: '#070609' },
  // Keep old shared URLs valid, but map their saturated names to restrained tints.
  cyan: { light: '#bdd2d0', ground: '#040909' },
  magenta: { light: '#c8c0d6', ground: '#070609' },
  red: { light: '#d8bdc2', ground: '#0b0608' }
};
const AVATAR_POINT_BUDGET = EMBEDDED_VIEW ? 6000 : 22000;
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
    description: 'UNIFIED RED BILATERAL + SAME-SIDE + CROSS-BODY LINKS REVEAL LIMB SYNCHRONY'
  },
  space: {
    label: 'EXTERNAL BODY SPACES',
    description: 'A LIVE 3D POINT CLOUD FILLS THE OUTER BODY HULL WHILE EVERY BODY SURFACE CARVES OUT THE NEGATIVE SPACE'
  },
  relations: {
    label: 'SHIFTING RELATIONS',
    description: 'A HEAD-ORIGIN ATTENTION BEAM POINTS TO THE BODY PART DRIVING EACH TRANSITION'
  }
};
const EXPERIMENT_KEYS = Object.keys(EXPERIMENT_INFO);
const EXPERIMENT_RED = new THREE.Color(0xfb5c50);
const CURVE_LINE_RADIUS = 0.0072;
const SYNC_LINE_WIDTH = 1.8;
const AXIS_IDLE_COLOR = EXPERIMENT_RED.clone();
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
  gridViewLink: document.querySelector('#grid-view-link'),
  resetAll: document.querySelector('#reset-all'),
  hideControlButtons: document.querySelector('#hide-control-buttons'),
  hideAllUi: document.querySelector('#hide-all-ui'),
  select: document.querySelector('#dance-select'),
  sceneWrap: document.querySelector('#scene-wrap'),
  threeCanvas: document.querySelector('#three-canvas'),
  loading: document.querySelector('#loading-state'),
  loadingLabel: document.querySelector('#loading-state p'),
  loadingProgress: document.querySelector('#loading-progress'),
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
  avatarStyleToggle: document.querySelector('#avatar-style-toggle'),
  avatarStyleClose: document.querySelector('#avatar-style-close'),
  avatarStyleStatus: document.querySelector('#avatar-style-status'),
  avatarStylePanel: document.querySelector('#avatar-style-panel'),
  avatarColorButtons: [...document.querySelectorAll('[data-avatar-color]')],
  avatarSurfaceButtons: [...document.querySelectorAll('[data-avatar-surface]')],
  lightingPresetButtons: [...document.querySelectorAll('[data-lighting-preset]')],
  lightingColorButtons: [...document.querySelectorAll('[data-lighting-color]')],
  cameraOrbitToggle: document.querySelector('#camera-orbit-toggle'),
  cameraOrbitStatus: document.querySelector('#camera-orbit-status'),
  cameraSpeedButtons: [...document.querySelectorAll('[data-camera-speed]')],
  cameraDirectionButtons: [...document.querySelectorAll('[data-camera-direction]')],
  avatarMoveButtons: [...document.querySelectorAll('[data-avatar-move]')],
  avatarPositionReadout: document.querySelector('#avatar-position-readout'),
  visualizationMenuToggle: document.querySelector('#visualization-menu-toggle'),
  visualizationMenuClose: document.querySelector('#visualization-menu-close'),
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
  cameraControlsClose: document.querySelector('#camera-controls-close'),
  cameraControlsStatus: document.querySelector('#camera-controls-status'),
  cameraControlsPanel: document.querySelector('#camera-controls-panel'),
  lineControlsToggle: document.querySelector('#line-controls-toggle'),
  lineControlsClose: document.querySelector('#line-controls-close'),
  lineControlsStatus: document.querySelector('#line-controls-status'),
  lineControlsPanel: document.querySelector('#line-controls-panel'),
  lineDisplayToggle: document.querySelector('#line-display-toggle'),
  lineDisplayStatus: document.querySelector('#line-display-status'),
  bodyPointsToggle: document.querySelector('#body-points-toggle'),
  bodyPointsStatus: document.querySelector('#body-points-status'),
  floorLightButtons: [...document.querySelectorAll('[data-floor-light]')],
  traceSampleRateButtons: [...document.querySelectorAll('[data-trace-sample-rate]')],
  analysisPanel: document.querySelector('.analysis-panel'),
  analysisPanelToggle: document.querySelector('#analysis-panel-toggle'),
  analysisPanelClose: document.querySelector('#analysis-panel-close'),
  analysisPanelStatus: document.querySelector('#analysis-panel-status'),
  analysisResizer: document.querySelector('#analysis-resizer')
};

const state = {
  movementIndex: MODEL_COUNT - 1,
  loadToken: 0,
  root: null,
  modelContainer: null,
  mixer: null,
  action: null,
  clip: null,
  bones: new Map(),
  trackers: [],
  playing: true,
  speed: DEFAULT_SPEED,
  avatarStyleOpen: false,
  avatarColor: DEFAULT_AVATAR_COLOR,
  surfaceMode: DEFAULT_SURFACE_MODE,
  lightingPreset: DEFAULT_LIGHTING_PRESET,
  lightingColor: DEFAULT_LIGHTING_COLOR,
  skeletonGroup: null,
  skeletonBones: [],
  skeletonConnections: [],
  skeletonLine: null,
  skeletonLinePositions: null,
  skeletonJoints: null,
  pointCloudGroup: null,
  pointCloudEntries: [],
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
  bodyPointsVisible: false,
  traceDots: false,
  traceSmoothing: true,
  traceSampleRate: 30,
  floorLight: 'off',
  graphMode: 'all',
  cameraControlsOpen: false,
  lineControlsOpen: false,
  analysisVisible: true,
  analysisWidth: 390,
  panelResizeStartX: 0,
  panelResizeStartWidth: 390,
  panelResizing: false,
  embeddedTransportElapsed: 0,
  embeddedEffectElapsed: 0,
  initialTransportPending: !EMBEDDED_VIEW && (REQUESTED_PROGRESS !== null || REQUESTED_PLAYING !== null),
  initialViewStatePending: !EMBEDDED_VIEW && Boolean(REQUESTED_URL_VIEW_STATE || REQUESTED_GRID_CELL_STATE?.view),
  duration: 0,
  clipStart: 0,
  lastClipTime: 0,
  sampleElapsed: 0,
  trailElapsed: 0,
  ready: false,
  resetAllPending: false
};

let shareUrlElapsed = 0;
let lastShareableUrl = '';

const renderer = new THREE.WebGLRenderer({
  canvas: ui.threeCanvas,
  antialias: true,
  alpha: false,
  stencil: true,
  powerPreference: 'high-performance'
});
renderer.setClearColor(0x050607, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, EMBEDDED_VIEW ? 1.5 : 2));
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
keyLight.shadow.mapSize.set(EMBEDDED_VIEW ? 512 : 1024, EMBEDDED_VIEW ? 512 : 1024);
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
const tempAvatarVertex = new THREE.Vector3();
const tempAvatarMatrix = new THREE.Matrix4();
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
  clearAvatarRepresentations();
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
  state.embeddedEffectElapsed = 0;
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
    child.userData.cyberSubinBaseVisible = child.visible;
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

function clearAvatarRepresentations() {
  if (state.skeletonGroup) {
    scene.remove(state.skeletonGroup);
    disposeObject(state.skeletonGroup);
  }
  if (state.pointCloudGroup) {
    scene.remove(state.pointCloudGroup);
    disposeObject(state.pointCloudGroup);
  }
  state.skeletonGroup = null;
  state.skeletonBones = [];
  state.skeletonConnections = [];
  state.skeletonLine = null;
  state.skeletonLinePositions = null;
  state.skeletonJoints = null;
  state.pointCloudGroup = null;
  state.pointCloudEntries = [];
}

function updateAvatarPointCloud() {
  if (!state.pointCloudGroup?.visible) return;
  for (const entry of state.pointCloudEntries) {
    entry.source.updateWorldMatrix(true, false);
    for (let pointIndex = 0; pointIndex < entry.vertexIndices.length; pointIndex += 1) {
      entry.source.getVertexPosition(entry.vertexIndices[pointIndex], tempAvatarVertex);
      tempAvatarVertex.applyMatrix4(entry.source.matrixWorld);
      const offset = pointIndex * 3;
      entry.positions[offset] = tempAvatarVertex.x;
      entry.positions[offset + 1] = tempAvatarVertex.y;
      entry.positions[offset + 2] = tempAvatarVertex.z;
    }
    entry.points.geometry.attributes.position.needsUpdate = true;
  }
}

function updateAvatarSkeleton() {
  if (!state.skeletonGroup?.visible || !state.skeletonLine || !state.skeletonJoints) return;
  state.root?.updateMatrixWorld(true);

  for (let index = 0; index < state.skeletonConnections.length; index += 1) {
    const connection = state.skeletonConnections[index];
    connection.parent.getWorldPosition(tempVector);
    connection.child.getWorldPosition(tempVectorB);
    const offset = index * 6;
    state.skeletonLinePositions[offset] = tempVector.x;
    state.skeletonLinePositions[offset + 1] = tempVector.y;
    state.skeletonLinePositions[offset + 2] = tempVector.z;
    state.skeletonLinePositions[offset + 3] = tempVectorB.x;
    state.skeletonLinePositions[offset + 4] = tempVectorB.y;
    state.skeletonLinePositions[offset + 5] = tempVectorB.z;
  }
  const linePositionAttribute = state.skeletonLine.geometry.attributes.instanceStart;
  if (linePositionAttribute?.data) linePositionAttribute.data.needsUpdate = true;

  for (let index = 0; index < state.skeletonBones.length; index += 1) {
    state.skeletonBones[index].getWorldPosition(tempVector);
    tempAvatarMatrix.makeTranslation(tempVector.x, tempVector.y, tempVector.z);
    state.skeletonJoints.setMatrixAt(index, tempAvatarMatrix);
  }
  state.skeletonJoints.instanceMatrix.needsUpdate = true;
}

function createAvatarRepresentations(root) {
  const sourceMeshes = [];
  let totalVertices = 0;
  root.traverse((child) => {
    const position = child.isMesh ? child.geometry?.attributes?.position : null;
    if (!position || child.userData.cyberSubinBaseVisible === false) return;
    sourceMeshes.push(child);
    totalVertices += position.count;
  });

  const stride = Math.max(1, Math.ceil(totalVertices / AVATAR_POINT_BUDGET));
  const pointCloudGroup = new THREE.Group();
  pointCloudGroup.name = 'CyberSubinAvatarPointCloud';
  pointCloudGroup.visible = false;

  state.pointCloudEntries = sourceMeshes.map((source) => {
    const vertexCount = source.geometry.attributes.position.count;
    const vertexIndices = [];
    for (let index = 0; index < vertexCount; index += stride) vertexIndices.push(index);
    const positions = new Float32Array(vertexIndices.length * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: AVATAR_COLORS[state.avatarColor],
        size: EMBEDDED_VIEW ? 0.02 : 0.018,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.98,
        depthWrite: false
      })
    );
    points.frustumCulled = false;
    points.renderOrder = 6;
    pointCloudGroup.add(points);
    return { source, vertexIndices, positions, points };
  });
  state.pointCloudGroup = pointCloudGroup;
  scene.add(pointCloudGroup);

  const skeletonBones = [];
  root.traverse((child) => {
    if (child.isBone) skeletonBones.push(child);
  });
  const skeletonConnections = skeletonBones
    .filter((bone) => bone.parent?.isBone)
    .map((bone) => ({ parent: bone.parent, child: bone }));
  const skeletonLinePositions = new Float32Array(skeletonConnections.length * 6);
  const skeletonLineGeometry = new LineSegmentsGeometry();
  skeletonLineGeometry.setPositions(skeletonLinePositions);
  skeletonLineGeometry.instanceCount = skeletonConnections.length;
  const skeletonLine = new LineSegments2(
    skeletonLineGeometry,
    new LineMaterial({
      color: AVATAR_COLORS[state.avatarColor],
      linewidth: EMBEDDED_VIEW ? 3.2 : 4.8,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      alphaToCoverage: true,
      toneMapped: false
    })
  );
  skeletonLine.frustumCulled = false;
  skeletonLine.renderOrder = 18;

  const skeletonJoints = new THREE.InstancedMesh(
    new THREE.SphereGeometry(EMBEDDED_VIEW ? 0.027 : 0.034, 14, 12),
    new THREE.MeshBasicMaterial({
      color: AVATAR_COLORS[state.avatarColor],
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    }),
    skeletonBones.length
  );
  skeletonJoints.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  skeletonJoints.frustumCulled = false;
  skeletonJoints.renderOrder = 19;

  const skeletonGroup = new THREE.Group();
  skeletonGroup.name = 'CyberSubinAvatarSkeleton';
  skeletonGroup.add(skeletonLine, skeletonJoints);
  skeletonGroup.visible = false;
  state.skeletonGroup = skeletonGroup;
  state.skeletonBones = skeletonBones;
  state.skeletonConnections = skeletonConnections;
  state.skeletonLine = skeletonLine;
  state.skeletonLinePositions = skeletonLinePositions;
  state.skeletonJoints = skeletonJoints;
  scene.add(skeletonGroup);
}

function applyAvatarAppearance() {
  const avatarColor = AVATAR_COLORS[state.avatarColor] ?? AVATAR_COLORS.pearl;
  const showMesh = ['smooth', 'rough'].includes(state.surfaceMode);
  state.root?.traverse((child) => {
    if (!child.isMesh) return;
    child.visible = showMesh && child.userData.cyberSubinBaseVisible !== false;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      material.color?.set(avatarColor);
      if ('roughness' in material) material.roughness = state.surfaceMode === 'rough' ? 0.96 : 0.38;
      if ('metalness' in material) material.metalness = state.surfaceMode === 'rough' ? 0.01 : 0.14;
      if ('flatShading' in material) material.flatShading = state.surfaceMode === 'rough';
      if ('emissive' in material) {
        material.emissive.set(state.surfaceMode === 'rough' ? '#030506' : '#071012');
        material.emissiveIntensity = state.surfaceMode === 'rough' ? 0.05 : 0.18;
      }
      material.needsUpdate = true;
    }
  });

  if (state.pointCloudGroup) state.pointCloudGroup.visible = state.surfaceMode === 'points';
  for (const entry of state.pointCloudEntries) entry.points.material.color.set(avatarColor);
  if (state.skeletonGroup) {
    state.skeletonGroup.visible = state.surfaceMode === 'skeleton';
    state.skeletonLine?.material.color.set(avatarColor);
    state.skeletonJoints?.material.color.set(avatarColor);
  }
  if (state.surfaceMode === 'points') updateAvatarPointCloud();
  if (state.surfaceMode === 'skeleton') updateAvatarSkeleton();
}

function closePeerControlMenus(except) {
  if (except !== 'avatar' && state.avatarStyleOpen) setAvatarStyleOpen(false);
  if (except !== 'camera' && state.cameraControlsOpen) setCameraControlsOpen(false);
  if (except !== 'line' && state.lineControlsOpen) setLineControlsOpen(false);
  if (except !== 'visualization' && state.visualizationMenuOpen) setVisualizationMenu(false);
}

function setAvatarStyleOpen(open) {
  if (open) closePeerControlMenus('avatar');
  state.avatarStyleOpen = open;
  ui.avatarStyleToggle.setAttribute('aria-expanded', String(open));
  ui.avatarStyleStatus.textContent = open ? 'OPEN' : 'SHOW';
  ui.avatarStylePanel.hidden = !open;
}

function setAvatarColor(color, activeButton) {
  if (!(color in AVATAR_COLORS)) return;
  state.avatarColor = color;
  ui.avatarColorButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
  applyAvatarAppearance();
}

function setAvatarSurface(surface, activeButton) {
  if (!['smooth', 'rough', 'points', 'skeleton'].includes(surface)) return;
  state.surfaceMode = surface;
  ui.avatarSurfaceButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
  applyAvatarAppearance();
}

function applyLightingSetup() {
  const preset = LIGHTING_PRESETS[state.lightingPreset];
  if (!preset) return;
  const color = LIGHTING_COLOR_PRESETS[state.lightingColor];
  const lightColor = color?.light;
  ambient.color.set(lightColor ?? preset.hemisphere[0]);
  ambient.groundColor.set(color?.ground ?? preset.hemisphere[1]);
  ambient.intensity = preset.hemisphere[2];
  keyLight.color.set(lightColor ?? preset.key[0]);
  keyLight.intensity = preset.key[1];
  keyLight.position.fromArray(preset.key[2]);
  rimLight.color.set(lightColor ?? preset.rim[0]);
  rimLight.intensity = preset.rim[1];
  rimLight.position.fromArray(preset.rim[2]);
  fillLight.color.set(lightColor ?? preset.fill[0]);
  fillLight.intensity = preset.fill[1];
  fillLight.position.fromArray(preset.fill[2]);
  renderer.toneMappingExposure = preset.exposure;
}

function setLightingPreset(name, activeButton) {
  if (!(name in LIGHTING_PRESETS)) return;
  state.lightingPreset = name;
  applyLightingSetup();
  ui.lightingPresetButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
}

function setLightingColor(name, activeButton) {
  if (!(name in LIGHTING_COLOR_PRESETS)) return;
  state.lightingColor = name;
  applyLightingSetup();
  ui.lightingColorButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
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
    const trailLinePositions = new Float32Array(TRAIL_INITIAL_RENDER_CAPACITY * 6);
    const trailLineColors = new Float32Array(TRAIL_INITIAL_RENDER_CAPACITY * 6);
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
    const trailPointPositions = new Float32Array(TRAIL_INITIAL_CAPACITY * 3);
    const trailPointColors = new Float32Array(TRAIL_INITIAL_CAPACITY * 3);
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
      trailLineCapacity: TRAIL_INITIAL_RENDER_CAPACITY,
      trailPointPositions,
      trailPointColors,
      trailPointCapacity: TRAIL_INITIAL_CAPACITY,
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

function setExperimentModes(keys) {
  state.activeExperiments.clear();
  for (const key of keys) {
    if (EXPERIMENT_INFO[key]) state.activeExperiments.add(key);
  }
  updateExperimentVisibility();
}

function setExperimentMode(key) {
  setExperimentModes(key === 'all' ? EXPERIMENT_KEYS : [key]);

  if (EMBEDDED_VIEW) {
    const urlState = new URL(window.location.href);
    urlState.searchParams.set('effect', EXPERIMENT_INFO[key] || key === 'all' ? key : 'off');
    window.history.replaceState({}, '', urlState);
  }
}

function getGridEffectValue(experiments) {
  if (!experiments.length) return 'off';
  if (experiments.length === EXPERIMENT_KEYS.length) return 'all';
  if (experiments.length === 1) return experiments[0];
  return 'custom';
}

function getCurrentViewState(
  experiments = EXPERIMENT_KEYS.filter((key) => state.activeExperiments.has(key))
) {
  return {
    experiments: [...experiments],
    avatarColor: state.avatarColor,
    surfaceMode: state.surfaceMode,
    lightingPreset: state.lightingPreset,
    lightingColor: state.lightingColor,
    traceVisible: state.traceVisible,
    bodyPointsVisible: state.bodyPointsVisible,
    traceMode: state.traceMode,
    traceWidth: state.traceWidth,
    traceDots: state.traceDots,
    traceSmoothing: state.traceSmoothing,
    traceSampleRate: state.traceSampleRate,
    floorLight: state.floorLight,
    avatarOffsetX: state.avatarOffsetX,
    avatarOffsetY: state.avatarOffsetY,
    cameraOrbit: state.cameraOrbit,
    cameraOrbitSpeed: state.cameraOrbitSpeed,
    cameraOrbitDirection: state.cameraOrbitDirection,
    cameraPosition: camera.position.toArray(),
    cameraTarget: controls.target.toArray(),
    analysisVisible: state.analysisVisible,
    analysisWidth: state.analysisWidth,
    graphMode: state.graphMode,
    avatarStyleOpen: state.avatarStyleOpen,
    cameraControlsOpen: state.cameraControlsOpen,
    lineControlsOpen: state.lineControlsOpen,
    visualizationMenuOpen: state.visualizationMenuOpen,
    controlsHidden: document.body.classList.contains('controls-hidden'),
    interfaceHidden: document.body.classList.contains('interface-hidden')
  };
}

function syncShareableUrl() {
  if (EMBEDDED_VIEW || !state.ready) return;
  const url = new URL(window.location.href);
  const experiments = EXPERIMENT_KEYS.filter((key) => state.activeExperiments.has(key));
  const currentTime = Math.max(0, (state.action?.time ?? state.clipStart) - state.clipStart);
  const duration = Math.max(0, state.duration - state.clipStart);
  const progress = duration ? THREE.MathUtils.clamp(currentTime / duration, 0, 1) : 0;
  const movement = MOVEMENTS[state.movementIndex];

  if (movement) url.searchParams.set('movement', movement.id);
  url.searchParams.set('effect', getGridEffectValue(experiments));
  url.searchParams.set('speed', String(state.speed));
  url.searchParams.set('progress', String(Number(progress.toFixed(6))));
  url.searchParams.set('playing', String(state.playing));
  writeViewStateToParams(url.searchParams, getCurrentViewState(experiments));

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  if (nextUrl === lastShareableUrl) return;
  lastShareableUrl = nextUrl;
  window.history.replaceState({}, '', nextUrl);
}

function applyViewState(view) {
  if (!view || typeof view !== 'object') return;
  if (Array.isArray(view.experiments)) setExperimentModes(view.experiments);
  if (view.avatarColor) {
    setAvatarColor(view.avatarColor, ui.avatarColorButtons.find((button) => button.dataset.avatarColor === view.avatarColor));
  }
  if (view.surfaceMode) {
    setAvatarSurface(view.surfaceMode, ui.avatarSurfaceButtons.find((button) => button.dataset.avatarSurface === view.surfaceMode));
  }
  if (view.lightingPreset) {
    setLightingPreset(view.lightingPreset, ui.lightingPresetButtons.find((button) => button.dataset.lightingPreset === view.lightingPreset));
  }
  if (view.lightingColor) {
    setLightingColor(view.lightingColor, ui.lightingColorButtons.find((button) => button.dataset.lightingColor === view.lightingColor));
  }
  if (typeof view.traceVisible === 'boolean') setTraceVisibility(view.traceVisible);
  if (typeof view.bodyPointsVisible === 'boolean') setBodyPointsVisibility(view.bodyPointsVisible);
  if (view.traceMode) setTraceMode(view.traceMode, ui.traceModeButtons.find((button) => button.dataset.traceMode === view.traceMode));
  if (Number.isFinite(Number(view.traceWidth))) {
    const width = Number(view.traceWidth);
    setTraceWidth(width, ui.traceWidthButtons.find((button) => Number(button.dataset.traceWidth) === width));
  }
  if (typeof view.traceDots === 'boolean') {
    setTraceDots(view.traceDots, ui.traceDotButtons.find((button) => button.dataset.traceDots === String(view.traceDots)));
  }
  if (typeof view.traceSmoothing === 'boolean') {
    setTraceSmoothing(view.traceSmoothing, ui.traceSmoothingButtons.find((button) => button.dataset.traceSmoothing === String(view.traceSmoothing)));
  }
  if (Number.isFinite(Number(view.traceSampleRate))) {
    const rate = Number(view.traceSampleRate);
    setTraceSampleRate(rate, ui.traceSampleRateButtons.find((button) => Number(button.dataset.traceSampleRate) === rate));
  }
  if (view.floorLight) setFloorLight(view.floorLight, ui.floorLightButtons.find((button) => button.dataset.floorLight === view.floorLight));
  if (Number.isFinite(Number(view.avatarOffsetX)) && Number.isFinite(Number(view.avatarOffsetY))) {
    setAvatarPosition(Number(view.avatarOffsetX), Number(view.avatarOffsetY));
  }
  if (Number.isFinite(Number(view.cameraOrbitSpeed))) {
    const speed = Number(view.cameraOrbitSpeed);
    setCameraOrbitSpeed(speed, ui.cameraSpeedButtons.find((button) => Number(button.dataset.cameraSpeed) === speed));
  }
  if ([1, -1].includes(Number(view.cameraOrbitDirection))) {
    const direction = Number(view.cameraOrbitDirection);
    setCameraOrbitDirection(direction, ui.cameraDirectionButtons.find((button) => Number(button.dataset.cameraDirection) === direction));
  }
  if (typeof view.cameraOrbit === 'boolean') setCameraOrbit(view.cameraOrbit);
  const hasSavedCamera = Array.isArray(view.cameraPosition)
    && view.cameraPosition.length === 3
    && Array.isArray(view.cameraTarget)
    && view.cameraTarget.length === 3;
  if (hasSavedCamera && EMBEDDED_VIEW) {
    const savedPosition = new THREE.Vector3().fromArray(view.cameraPosition);
    const savedTarget = new THREE.Vector3().fromArray(view.cameraTarget);
    const savedDirection = savedPosition.sub(savedTarget);
    if (savedDirection.lengthSq() < 0.000001) savedDirection.copy(EMBEDDED_CAMERA_OFFSET);
    savedDirection.normalize();
    const centerY = getEmbeddedAvatarCenterY();
    controls.target.set(state.avatarOffsetX, centerY, 0);
    camera.position.copy(controls.target).addScaledVector(savedDirection, EMBEDDED_CAMERA_DISTANCE);
  } else if (hasSavedCamera) {
    camera.position.fromArray(view.cameraPosition);
    controls.target.fromArray(view.cameraTarget);
  }
  controls.update();
  applyAvatarScreenOffset();
  if (typeof view.analysisVisible === 'boolean') setAnalysisVisibility(view.analysisVisible);
  if (Number.isFinite(Number(view.analysisWidth))) setAnalysisWidth(Number(view.analysisWidth));
  if (view.graphMode) setGraphMode(view.graphMode, ui.graphModeButtons.find((button) => button.dataset.graphMode === view.graphMode));
  if (typeof view.avatarStyleOpen === 'boolean') setAvatarStyleOpen(view.avatarStyleOpen);
  if (typeof view.cameraControlsOpen === 'boolean') setCameraControlsOpen(view.cameraControlsOpen);
  if (typeof view.lineControlsOpen === 'boolean') setLineControlsOpen(view.lineControlsOpen);
  if (typeof view.visualizationMenuOpen === 'boolean') setVisualizationMenu(view.visualizationMenuOpen);
  if (typeof view.controlsHidden === 'boolean') setControlButtonsHidden(view.controlsHidden);
  if (typeof view.interfaceHidden === 'boolean') setInterfaceHidden(view.interfaceHidden);
}

function persistFocusedGridState() {
  if (!RETURN_TO_GRID || state.resetAllPending) return;
  try {
    const storedGridState = JSON.parse(window.sessionStorage.getItem(GRID_STATE_KEY));
    const focusedIndex = Number(storedGridState?.focusedIndex);
    if (!Array.isArray(storedGridState?.cells) || !Number.isInteger(focusedIndex) || focusedIndex < 0 || focusedIndex >= 6) return;

    const experiments = EXPERIMENT_KEYS.filter((key) => state.activeExperiments.has(key));
    const currentTime = Math.max(0, (state.action?.time ?? state.clipStart) - state.clipStart);
    const duration = Math.max(0, state.duration - state.clipStart);
    storedGridState.cells[focusedIndex] = {
      ...storedGridState.cells[focusedIndex],
      movement: MOVEMENTS[state.movementIndex]?.id ?? storedGridState.cells[focusedIndex].movement,
      effect: getGridEffectValue(experiments),
      effects: experiments,
      view: getCurrentViewState(experiments)
    };
    storedGridState.transport = {
      playing: state.playing,
      speed: state.speed,
      progress: duration ? currentTime / duration : 0
    };
    window.sessionStorage.setItem(GRID_STATE_KEY, JSON.stringify(storedGridState));
  } catch {
    // Returning still works if temporary browser storage is unavailable.
  }
}

function resetAllSingleView() {
  state.resetAllPending = true;
  try {
    window.sessionStorage.removeItem(GRID_STATE_KEY);
  } catch {
    // Reloading the clean route still resets this view if temporary storage is unavailable.
  }
  window.location.assign(`/?movement=${DEFAULT_MOVEMENT_ID}`);
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
      new THREE.TubeGeometry(placeholderCurve, 2, CURVE_LINE_RADIUS, 6, false),
      new THREE.MeshBasicMaterial({
        color: EXPERIMENT_RED,
        transparent: true,
        opacity: 0.92,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
        toneMapped: false
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
        depthWrite: false,
        toneMapped: false
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
      color: EXPERIMENT_RED,
      linewidth: SYNC_LINE_WIDTH,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthTest: false,
      alphaToCoverage: true,
      toneMapped: false
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
        color: EXPERIMENT_RED,
        transparent: true,
        opacity: 0.94,
        depthTest: false,
        blending: THREE.NormalBlending,
        toneMapped: false
      })
    );
    marker.renderOrder = 16;
    syncGroup.add(marker);
    syncNodes.set(trackerId, { tracker, marker, synchronyTotal: 0, relationshipCount: 0 });
  }

  const spaceVisuals = createExternalSpacePointCloud({ embedded: EMBEDDED_VIEW });
  const spaceGroup = spaceVisuals.group;

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
      color: EXPERIMENT_RED,
      linewidth: 3.6,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthTest: false,
      alphaToCoverage: true,
      toneMapped: false
    })
  );
  relationBeam.renderOrder = 18;
  const relationHalo = new THREE.Mesh(
    new THREE.RingGeometry(0.085, 0.14, 48),
    new THREE.MeshBasicMaterial({
      color: EXPERIMENT_RED,
      transparent: true,
      opacity: 0.96,
      side: THREE.DoubleSide,
      depthTest: false,
      blending: THREE.NormalBlending,
      toneMapped: false
    })
  );
  const relationCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 14, 14),
    new THREE.MeshBasicMaterial({
      color: EXPERIMENT_RED,
      transparent: true,
      opacity: 1,
      depthTest: false,
      toneMapped: false
    })
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
    space: spaceVisuals,
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
      const lineRadius = CURVE_LINE_RADIUS;
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
    line.material.opacity = 0.92;
    caps.forEach((cap) => {
      cap.visible = item.strokeVisible;
      cap.material.opacity = 0.92;
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
    for (let vertex = 0; vertex < 2; vertex += 1) {
      const colorOffset = offset + vertex * 3;
      visuals.colors[colorOffset] = EXPERIMENT_RED.r;
      visuals.colors[colorOffset + 1] = EXPERIMENT_RED.g;
      visuals.colors[colorOffset + 2] = EXPERIMENT_RED.b;
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
    node.marker.material.color.copy(EXPERIMENT_RED);
    node.marker.scale.setScalar(0.9 + synchrony * 0.42);
  });
  visuals.lines.geometry.attributes.instanceStart.data.needsUpdate = true;
  visuals.lines.geometry.attributes.instanceColorStart.data.needsUpdate = true;
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
  visuals.colors.set([
    EXPERIMENT_RED.r,
    EXPERIMENT_RED.g,
    EXPERIMENT_RED.b,
    EXPERIMENT_RED.r,
    EXPERIMENT_RED.g,
    EXPERIMENT_RED.b
  ]);
  visuals.beam.geometry.attributes.instanceStart.data.needsUpdate = true;
  visuals.beam.geometry.attributes.instanceColorStart.data.needsUpdate = true;

  const focusIntensity = THREE.MathUtils.clamp(focus.speed / 2.2 + Math.max(0, focus.acceleration) / 28, 0, 1);
  visuals.beam.visible = true;
  visuals.beam.material.opacity = 1;
  visuals.halo.position.copy(focus.anchorPosition);
  visuals.halo.quaternion.copy(camera.quaternion);
  visuals.halo.material.color.copy(EXPERIMENT_RED);
  visuals.halo.scale.setScalar(0.8 + focusIntensity * 1.7);
  visuals.core.position.copy(focus.anchorPosition);
  visuals.core.material.color.copy(EXPERIMENT_RED);
}

function updateExperimentalVisuals(delta) {
  if (!state.experimentVisuals) return;
  state.experimentTime += delta;
  if (state.activeExperiments.has('energy')) updateEnergyVisuals(delta);
  if (state.activeExperiments.has('curves')) updateCurveVisuals();
  if (state.activeExperiments.has('axes')) updateAxisVisuals();
  if (state.activeExperiments.has('sync')) updateSyncVisuals();
  if (state.activeExperiments.has('space')) {
    updateExternalSpacePointCloud(state.experimentVisuals.space, {
      bones: state.bones,
      trackers: state.trackers,
      time: state.experimentTime,
      pixelRatio: renderer.getPixelRatio(),
      displayHeight: DISPLAY_HEIGHT
    });
  }
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

  return renderedPoints;
}

function growTrailCapacity(currentCapacity, requiredCapacity) {
  let capacity = Math.max(2, currentCapacity);
  while (capacity < requiredCapacity) capacity *= 2;
  return capacity;
}

function ensureTrailGeometryCapacity(tracker, pointCount, lineSegmentCount) {
  if (pointCount > tracker.trailPointCapacity) {
    tracker.trailPointCapacity = growTrailCapacity(tracker.trailPointCapacity, pointCount);
    tracker.trailPointPositions = new Float32Array(tracker.trailPointCapacity * 3);
    tracker.trailPointColors = new Float32Array(tracker.trailPointCapacity * 3);
    tracker.trailDots.geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(tracker.trailPointPositions, 3)
    );
    tracker.trailDots.geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(tracker.trailPointColors, 3)
    );
  }

  if (lineSegmentCount > tracker.trailLineCapacity) {
    tracker.trailLineCapacity = growTrailCapacity(tracker.trailLineCapacity, lineSegmentCount);
    tracker.trailLinePositions = new Float32Array(tracker.trailLineCapacity * 6);
    tracker.trailLineColors = new Float32Array(tracker.trailLineCapacity * 6);
    const expandedGeometry = new LineSegmentsGeometry();
    expandedGeometry.setPositions(tracker.trailLinePositions);
    expandedGeometry.setColors(tracker.trailLineColors);
    expandedGeometry.instanceCount = 0;
    tracker.trail.geometry.dispose();
    tracker.trail.geometry = expandedGeometry;
  }
}

function updateTrailGeometry(tracker) {
  if (!state.traceVisible) return;
  const durationSeconds = TRACE_DURATION_SECONDS[state.traceMode];
  const pointLimit = Number.isFinite(durationSeconds)
    ? Math.max(2, Math.round(durationSeconds * state.traceSampleRate))
    : Infinity;
  const visiblePoints = Number.isFinite(pointLimit)
    ? tracker.trailPoints.slice(-pointLimit)
    : tracker.trailPoints;
  const renderedLinePoints = createSmoothedTrailPoints(visiblePoints);
  ensureTrailGeometryCapacity(
    tracker,
    visiblePoints.length,
    Math.max(0, renderedLinePoints.length - 1)
  );
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
  if (state.traceMode !== 'permanent' && tracker.trailPoints.length > FADING_TRAIL_RETENTION_LIMIT) {
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
  const analysisInset = !EMBEDDED_VIEW
    && state.analysisVisible
    && !document.body.classList.contains('interface-hidden')
    && window.innerWidth > 860
    ? Math.min(state.analysisWidth, width * 0.72)
    : 0;
  const analysisCenterShift = -analysisInset / 2;
  const screenX = (state.avatarOffsetX / 2.4) * width * 0.32 + analysisCenterShift;
  const screenY = (state.avatarOffsetY / 1.8) * height * 0.28;

  if (Math.abs(screenX) < 0.01 && Math.abs(screenY) < 0.01) {
    camera.clearViewOffset();
  } else {
    camera.setViewOffset(width, height, -screenX, screenY, width, height);
  }
  camera.updateProjectionMatrix();
}

function getEmbeddedAvatarCenterY() {
  if (state.trackers.length > 0) {
    let minimumY = Infinity;
    let maximumY = -Infinity;
    for (const tracker of state.trackers) {
      minimumY = Math.min(minimumY, tracker.anchorPosition.y);
      maximumY = Math.max(maximumY, tracker.anchorPosition.y);
    }
    if (Number.isFinite(minimumY) && Number.isFinite(maximumY)) {
      return (minimumY + maximumY) * 0.5;
    }
  }

  const head = state.bones.get('Head');
  const leftFoot = state.bones.get('LeftFoot');
  const rightFoot = state.bones.get('RightFoot');
  const hips = state.bones.get('Hips');
  if (!head || !hips) return 1.22 + state.avatarOffsetY;

  head.getWorldPosition(tempVector);
  hips.getWorldPosition(tempVectorB);
  let lowerY = Math.min(0, tempVectorB.y);
  if (leftFoot) {
    leftFoot.getWorldPosition(tempVectorC);
    lowerY = tempVectorC.y;
  }
  if (rightFoot) {
    rightFoot.getWorldPosition(tempVectorC);
    lowerY = Math.min(lowerY, tempVectorC.y);
  }
  return (tempVector.y + lowerY) * 0.5;
}

function fitCamera() {
  if (EMBEDDED_VIEW) {
    const centerY = getEmbeddedAvatarCenterY();
    camera.position.copy(EMBEDDED_CAMERA_OFFSET)
      .add(new THREE.Vector3(state.avatarOffsetX, centerY, 0));
    controls.target.set(state.avatarOffsetX, centerY, 0);
  } else {
    const centerY = 1.48 + state.avatarOffsetY;
    camera.position.copy(DEFAULT_CAMERA_OFFSET)
      .add(new THREE.Vector3(state.avatarOffsetX, centerY, 0));
    controls.target.set(state.avatarOffsetX, 1.48 + state.avatarOffsetY, 0);
  }
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
  createAvatarRepresentations(root);
  applyAvatarAppearance();
  createTrackers();
  resetTrackerSamples();
  createExperimentalVisuals();
  fitCamera();

  ui.timeline.min = String(clipStart);
  ui.timeline.max = String(clip.duration);
  ui.timeline.value = String(clipStart);
  const playableDuration = Math.max(0, clip.duration - clipStart);
  ui.totalTime.textContent = formatTime(playableDuration);
  state.ready = true;
  setPlaying(true);

  if (state.initialViewStatePending) {
    state.initialViewStatePending = false;
    applyViewState({
      ...(REQUESTED_GRID_CELL_STATE?.view ?? {}),
      ...(REQUESTED_URL_VIEW_STATE ?? {})
    });
  }

  if (state.initialTransportPending) {
    state.initialTransportPending = false;
    if (Number.isFinite(REQUESTED_PROGRESS)) seekToProgress(REQUESTED_PROGRESS);
    if (REQUESTED_PLAYING !== null) setPlaying(REQUESTED_PLAYING);
  }

  hideLoading();

  if (EMBEDDED_VIEW) {
    window.parent.postMessage({
      source: 'cyber-subin-avatar',
      type: 'ready',
      movementId: movement.id,
      viewState: getCurrentViewState()
    }, window.location.origin);
  }
}

function loadModel(movementIndex) {
  const movement = MOVEMENTS[movementIndex];
  if (!movement) return;

  state.movementIndex = movementIndex;
  ui.select.value = movement.id;
  if (RETURN_TO_GRID) {
    ui.gridViewLink.textContent = 'GRID VIEW';
    ui.gridViewLink.setAttribute('aria-label', 'Return to the six-avatar grid');
    ui.gridViewLink.href = '/grid.html?restore=1';
  } else {
    ui.gridViewLink.textContent = 'GRID VIEW';
    ui.gridViewLink.removeAttribute('aria-label');
    ui.gridViewLink.href = `/grid.html?movement=${encodeURIComponent(movement.id)}`;
  }
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

function setPlaybackSpeed(speed) {
  if (!Number.isFinite(speed) || speed <= 0) return;
  state.speed = speed;
  ui.speedButtons.forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.speed) === speed);
  });
}

function seekToProgress(progress) {
  if (!state.action || !state.mixer) return;
  const normalizedProgress = THREE.MathUtils.clamp(Number(progress) || 0, 0, 1);
  const playableDuration = Math.max(0, state.duration - state.clipStart);
  state.action.time = state.clipStart + playableDuration * normalizedProgress;
  state.mixer.update(0);
  state.lastClipTime = state.action.time;
  centerCharacter();
  resetTrackerSamples({ preserveTrails: true });
  updateMotionSignals(1 / 30, false, false);
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
  if (state.surfaceMode === 'points') updateAvatarPointCloud();
  if (state.surfaceMode === 'skeleton') updateAvatarSkeleton();

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
  ui.lineDisplayToggle.setAttribute('aria-label', visible ? 'Turn trace display off' : 'Turn trace display on');
  ui.lineDisplayStatus.textContent = visible ? 'ON' : 'OFF';
  if (!visible) state.trailElapsed = 0;
  state.trackers.forEach((tracker) => {
    if (visible) updateTrailGeometry(tracker);
    else tracker.hasTrailPoint = false;
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
  ui.floorLightButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
}

function setCameraControlsOpen(open) {
  if (open) closePeerControlMenus('camera');
  state.cameraControlsOpen = open;
  ui.cameraControlsToggle.setAttribute('aria-expanded', String(open));
  ui.cameraControlsStatus.textContent = open ? 'OPEN' : 'SHOW';
  ui.cameraControlsPanel.hidden = !open;
}

function setLineControlsOpen(open) {
  if (open) closePeerControlMenus('line');
  state.lineControlsOpen = open;
  ui.lineControlsToggle.setAttribute('aria-expanded', String(open));
  ui.lineControlsStatus.textContent = open ? 'OPEN' : 'SHOW';
  ui.lineControlsPanel.hidden = !open;
}

function setInterfaceHidden(hidden) {
  document.body.classList.toggle('interface-hidden', hidden);
  ui.hideAllUi.textContent = hidden ? 'EXIT PRESENTATION' : 'PRESENTATION MODE';
  ui.hideAllUi.setAttribute('aria-pressed', String(hidden));
  ui.hideAllUi.setAttribute('aria-label', hidden ? 'Exit presentation mode' : 'Enter presentation mode');
  requestAnimationFrame(resize);
}

function setControlButtonsHidden(hidden) {
  document.body.classList.toggle('controls-hidden', hidden);
  ui.hideControlButtons.textContent = hidden ? 'SHOW BUTTONS' : 'HIDE BUTTONS';
  ui.hideControlButtons.setAttribute('aria-pressed', String(hidden));
  ui.hideControlButtons.setAttribute('aria-label', hidden ? 'Show interface control buttons' : 'Hide interface control buttons');
}

function setVisualizationMenu(open) {
  if (open) closePeerControlMenus('visualization');
  state.visualizationMenuOpen = open;
  ui.visualizationMenuToggle.setAttribute('aria-expanded', String(open));
  ui.visualizationMenuStatus.textContent = open ? 'OPEN' : 'SHOW';
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
  applyAvatarScreenOffset();
}

function setAnalysisVisibility(visible) {
  state.analysisVisible = visible;
  ui.analysisPanel.hidden = !visible;
  ui.analysisPanelToggle.setAttribute('aria-expanded', String(visible));
  ui.analysisPanelStatus.textContent = visible ? 'OPEN' : 'SHOW';
  ui.appShell.classList.toggle('analysis-hidden', !visible);

  if (!visible && state.panelResizing) {
    state.panelResizing = false;
    document.body.classList.remove('resizing-panel');
  }

  requestAnimationFrame(resize);
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

    if (!EMBEDDED_VIEW) {
      const row = ui.signalList.querySelector(`[data-signal="${tracker.definition.id}"]`);
      for (const { key } of AXES) {
        const value = Math.abs(tracker.coordinate[key]) < 0.0005 ? 0 : tracker.coordinate[key];
        row.querySelector(`[data-axis-value="${key}"]`).textContent = `${value >= 0 ? '+' : ''}${value.toFixed(3)}`;
      }
      const displayAverage = Math.abs(average) < 0.0005 ? 0 : average;
      row.querySelector('[data-axis-value="average"]').textContent = `${displayAverage >= 0 ? '+' : ''}${displayAverage.toFixed(3)}`;
    }
  }

  if (!EMBEDDED_VIEW) updateJointGeometry();
  if (EMBEDDED_VIEW) {
    state.embeddedEffectElapsed += motionDelta;
    if (state.embeddedEffectElapsed >= 1 / 30) {
      updateExperimentalVisuals(state.embeddedEffectElapsed);
      state.embeddedEffectElapsed = 0;
    }
  } else {
    updateExperimentalVisuals(motionDelta);
  }
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
  const pixelRatio = Math.min(window.devicePixelRatio, EMBEDDED_VIEW ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height, false);
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  applyAvatarScreenOffset();

}

function updateTransport() {
  if (EMBEDDED_VIEW) return;
  const absoluteTime = state.action?.time ?? state.clipStart;
  const time = Math.max(0, absoluteTime - state.clipStart);
  const playableDuration = Math.max(0, state.duration - state.clipStart);
  ui.currentTime.textContent = formatTime(time);
  if (!ui.timeline.matches(':active')) ui.timeline.value = String(absoluteTime);
  const progress = playableDuration ? (time / playableDuration) * 100 : 0;
  ui.timeline.style.setProperty('--progress', `${progress}%`);
}

function notifyEmbeddedTransport(delta) {
  if (!EMBEDDED_VIEW || !EMBEDDED_TRANSPORT_SOURCE || !state.ready) return;
  state.embeddedTransportElapsed += delta;
  if (state.embeddedTransportElapsed < 0.1) return;
  state.embeddedTransportElapsed = 0;

  const currentTime = Math.max(0, (state.action?.time ?? state.clipStart) - state.clipStart);
  const duration = Math.max(0, state.duration - state.clipStart);
  window.parent.postMessage({
    source: 'cyber-subin-avatar',
    type: 'transport',
    currentTime,
    duration,
    progress: duration ? currentTime / duration : 0,
    playing: state.playing,
    speed: state.speed
  }, window.location.origin);
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
    if (looped) resetTrackerSamples({ preserveTrails: true });

    if (!EMBEDDED_VIEW) state.sampleElapsed += rawDelta;
    const trailElapsedBeforeFrame = state.trailElapsed;
    if (state.traceVisible) state.trailElapsed += rawDelta;
    const shouldSample = !EMBEDDED_VIEW && state.sampleElapsed >= 1 / 30;
    const trailInterval = 1 / state.traceSampleRate;
    const trailSampleCount = state.traceVisible
      ? Math.floor(state.trailElapsed / trailInterval)
      : 0;
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
  if (!EMBEDDED_VIEW && state.ready) {
    shareUrlElapsed += rawDelta;
    if (shareUrlElapsed >= 0.25) {
      shareUrlElapsed = 0;
      syncShareableUrl();
    }
  }
  if (state.ready && state.surfaceMode === 'points') updateAvatarPointCloud();
  if (state.ready && state.surfaceMode === 'skeleton') updateAvatarSkeleton();
  updateTransport();
  if (!EMBEDDED_VIEW) drawSignalCharts();
  renderer.render(scene, camera);
  notifyEmbeddedTransport(rawDelta);
}

ui.select.addEventListener('change', () => {
  const movementIndex = MOVEMENTS.findIndex((movement) => movement.id === ui.select.value);
  if (movementIndex >= 0) loadModel(movementIndex);
});
ui.playButton.addEventListener('click', () => setPlaying(!state.playing));
ui.resetButton.addEventListener('click', resetExperience);
ui.sceneWrap.addEventListener('dblclick', fitCamera);
ui.avatarStyleToggle.addEventListener('click', () => setAvatarStyleOpen(!state.avatarStyleOpen));
ui.avatarStyleClose.addEventListener('click', () => setAvatarStyleOpen(false));
ui.cameraOrbitToggle.addEventListener('click', () => setCameraOrbit(!state.cameraOrbit));
ui.cameraControlsToggle.addEventListener('click', () => setCameraControlsOpen(!state.cameraControlsOpen));
ui.cameraControlsClose.addEventListener('click', () => setCameraControlsOpen(false));
ui.lineControlsToggle.addEventListener('click', () => setLineControlsOpen(!state.lineControlsOpen));
ui.lineControlsClose.addEventListener('click', () => setLineControlsOpen(false));
ui.visualizationMenuToggle.addEventListener('click', () => setVisualizationMenu(!state.visualizationMenuOpen));
ui.visualizationMenuClose.addEventListener('click', () => setVisualizationMenu(false));

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
  button.addEventListener('click', () => setPlaybackSpeed(Number(button.dataset.speed)));
}

for (const button of ui.avatarColorButtons) {
  button.addEventListener('click', () => setAvatarColor(button.dataset.avatarColor, button));
}

for (const button of ui.avatarSurfaceButtons) {
  button.addEventListener('click', () => setAvatarSurface(button.dataset.avatarSurface, button));
}

for (const button of ui.lightingPresetButtons) {
  button.addEventListener('click', () => setLightingPreset(button.dataset.lightingPreset, button));
}

for (const button of ui.lightingColorButtons) {
  button.addEventListener('click', () => setLightingColor(button.dataset.lightingColor, button));
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

if (EMBEDDED_VIEW) {
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    if (event.data?.source !== 'cyber-subin-grid') return;

    if (event.data.action === 'movement') {
      const movementIndex = MOVEMENTS.findIndex((movement) => movement.id === event.data.value);
      if (movementIndex >= 0) loadModel(movementIndex);
    } else if (event.data.action === 'effect') {
      setExperimentMode(event.data.value);
    } else if (event.data.action === 'restart') {
      resetExperience();
    } else if (event.data.action === 'speed') {
      setPlaybackSpeed(Number(event.data.value));
    } else if (event.data.action === 'playing') {
      setPlaying(Boolean(event.data.value));
    } else if (event.data.action === 'seek') {
      seekToProgress(event.data.value);
    } else if (event.data.action === 'viewState') {
      applyViewState(event.data.value);
    }
  });
}

if (RETURN_TO_GRID) {
  ui.gridViewLink.addEventListener('click', persistFocusedGridState);
  window.addEventListener('pagehide', persistFocusedGridState);
}

ui.analysisPanelToggle.addEventListener('click', () => setAnalysisVisibility(!state.analysisVisible));
ui.analysisPanelClose.addEventListener('click', () => setAnalysisVisibility(false));
ui.resetAll.addEventListener('click', resetAllSingleView);
ui.hideControlButtons.addEventListener('click', () => setControlButtonsHidden(!document.body.classList.contains('controls-hidden')));
ui.hideAllUi.addEventListener('click', () => setInterfaceHidden(!document.body.classList.contains('interface-hidden')));

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
  if (event.key === 'Escape') {
    closePeerControlMenus(null);
    if (state.analysisVisible) setAnalysisVisibility(false);
    event.preventDefault();
    return;
  }
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
setTraceMode('permanent', ui.traceModeButtons.find((button) => button.dataset.traceMode === 'permanent'));
setTraceDots(false, ui.traceDotButtons.find((button) => button.dataset.traceDots === 'false'));
setTraceSmoothing(true, ui.traceSmoothingButtons.find((button) => button.dataset.traceSmoothing === 'true'));
setTraceSampleRate(30, ui.traceSampleRateButtons.find((button) => button.dataset.traceSampleRate === '30'));
setAvatarStyleOpen(false);
setAvatarColor(DEFAULT_AVATAR_COLOR, ui.avatarColorButtons.find((button) => button.dataset.avatarColor === DEFAULT_AVATAR_COLOR));
setAvatarSurface(DEFAULT_SURFACE_MODE, ui.avatarSurfaceButtons.find((button) => button.dataset.avatarSurface === DEFAULT_SURFACE_MODE));
setLightingPreset(DEFAULT_LIGHTING_PRESET, ui.lightingPresetButtons.find((button) => button.dataset.lightingPreset === DEFAULT_LIGHTING_PRESET));
setLightingColor(DEFAULT_LIGHTING_COLOR, ui.lightingColorButtons.find((button) => button.dataset.lightingColor === DEFAULT_LIGHTING_COLOR));
setCameraControlsOpen(false);
setLineControlsOpen(false);
setVisualizationMenu(false);
setTraceVisibility(false);
setBodyPointsVisibility(false);
setAnalysisWidth(390);
setAnalysisVisibility(true);
fitCamera();
resize();
renderer.setAnimationLoop(animate);

const requestedEffect = PAGE_PARAMS.get('effect');
if (PAGE_PARAMS.has('effect')) setExperimentMode(requestedEffect);
setPlaybackSpeed(Number.isFinite(REQUESTED_SPEED) && REQUESTED_SPEED > 0 ? REQUESTED_SPEED : DEFAULT_SPEED);
const requestedMovement = PAGE_PARAMS.get('movement');
const requestedIndex = MOVEMENTS.findIndex((movement) => movement.id === requestedMovement);
const defaultMovementIndex = MOVEMENTS.findIndex((movement) => movement.id === DEFAULT_MOVEMENT_ID);
loadModel(requestedIndex >= 0 ? requestedIndex : defaultMovementIndex);
