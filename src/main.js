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
import {
  FLOW_FIELD_GRADIENTS,
  createFlowField,
  resetFlowField,
  setFlowFieldOptions,
  updateFlowField
} from './flow-field.js';
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
const PLAYBACK_SPEED_OPTIONS = Object.freeze([0.05, 0.1, 0.5, 1, 1.5, 2, 3, 4, 5]);
const DEFAULT_AVATAR_COLOR = 'lightGrey';
const DEFAULT_AVATAR_GRADIENT_COLOR = '#d9dcde';
const DEFAULT_SURFACE_MODE = 'smooth';
const DEFAULT_LIGHTING_PRESET = 'top';
const DEFAULT_LIGHTING_COLOR = 'cool';
const DEFAULT_LIGHTING_CUSTOM_COLOR = '#b7c9d3';
const DEFAULT_LIGHTING_INTENSITY = 1;
const DEFAULT_FLOW_FIELD_SPEED = 1;
const DEFAULT_FLOW_FIELD_COUNT = 4800;
const DEFAULT_FLOW_FIELD_GRADIENT = 'ocean';
const DEFAULT_FLOW_FIELD_COLORS = Object.freeze([...FLOW_FIELD_GRADIENTS[DEFAULT_FLOW_FIELD_GRADIENT]]);
const DEFAULT_FLOW_FIELD_THICKNESS = 1.5;
const DEFAULT_FLOW_FIELD_OPACITY = 1;
const DEFAULT_FLOW_FIELD_TRAIL_LENGTH = 1;
const DEFAULT_FLOW_FIELD_TRAIL_FADE = 0.8;
const DEFAULT_FLOW_FIELD_STROKE_LENGTH = 1;
const DEFAULT_FLOW_FIELD_CURVATURE = 1;
const DEFAULT_FLOW_FIELD_COLOR_VARIATION = 1;
const DEFAULT_FLOW_FIELD_INFLUENCE = 1;
const DEFAULT_FLOW_FIELD_BODY_FLOW = 1;
const DEFAULT_FLOW_FIELD_RECOVERY = 1;
const DEFAULT_FLOW_FIELD_PROXIMITY_FADE = 1;
const DEFAULT_FLOW_FIELD_CONCENTRATION = 1;
const SEQUENCE_TRANSITION_DURATION = 1.2;
const INITIAL_POSE_TRIM_SECONDS = 0.35;
const MAX_SEQUENCE_LENGTH = 24;
let sequenceEntryCounter = 0;
const FLOW_FIELD_SLIDER_CONFIG = Object.freeze({
  thickness: {
    stateKey: 'flowFieldThickness',
    optionKey: 'thickness',
    format: (value) => `${Number(value.toFixed(2))} PX`
  },
  opacity: {
    stateKey: 'flowFieldOpacity',
    optionKey: 'opacity',
    format: (value) => `${Math.round(value * 100)}%`
  },
  trailLength: {
    stateKey: 'flowFieldTrailLength',
    optionKey: 'trailLength',
    format: (value) => `${value.toFixed(2)}×`
  },
  trailFade: {
    stateKey: 'flowFieldTrailFade',
    optionKey: 'trailFade',
    format: (value) => `${Math.round(value * 100)}%`
  },
  strokeLength: {
    stateKey: 'flowFieldStrokeLength',
    optionKey: 'strokeLength',
    format: (value) => `${value.toFixed(2)}×`
  },
  curvature: {
    stateKey: 'flowFieldCurvature',
    optionKey: 'curvature',
    format: (value) => `${value.toFixed(2)}×`
  },
  speed: {
    stateKey: 'flowFieldSpeed',
    optionKey: 'speed',
    format: (value) => `${value.toFixed(2)}×`
  },
  count: {
    stateKey: 'flowFieldCount',
    optionKey: 'count',
    format: (value) => Math.round(value).toLocaleString()
  },
  colorVariation: {
    stateKey: 'flowFieldColorVariation',
    optionKey: 'colorVariation',
    format: (value) => `${value.toFixed(2)}×`
  },
  influence: {
    stateKey: 'flowFieldInfluence',
    optionKey: 'influence',
    format: (value) => `${value.toFixed(2)}×`
  },
  bodyFlow: {
    stateKey: 'flowFieldBodyFlow',
    optionKey: 'bodyFlow',
    format: (value) => `${value.toFixed(2)}×`
  },
  recovery: {
    stateKey: 'flowFieldRecovery',
    optionKey: 'recovery',
    format: (value) => `${value.toFixed(2)}×`
  },
  proximityFade: {
    stateKey: 'flowFieldProximityFade',
    optionKey: 'proximityFade',
    format: (value) => value <= 0.001 ? 'OFF' : `${value.toFixed(2)}×`
  },
  concentration: {
    stateKey: 'flowFieldConcentration',
    optionKey: 'concentration',
    format: (value) => value <= 0.001 ? 'UNIFORM' : `${value.toFixed(2)}×`
  }
});
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

function createSequenceEntry(movementId, transition = {}) {
  const normalizedId = String(movementId);
  if (!INDEXED_MOVEMENTS.some((movement) => movement.id === normalizedId)) return null;
  sequenceEntryCounter += 1;
  return {
    uid: `sequence-${Date.now().toString(36)}-${sequenceEntryCounter.toString(36)}`,
    movementId: normalizedId,
    transitionDuration: THREE.MathUtils.clamp(
      Number(transition.duration) || SEQUENCE_TRANSITION_DURATION,
      0.2,
      5
    ),
    transitionEasing: transition.easing === 'linear' ? 'linear' : 'ease',
    playbackSpeed: PLAYBACK_SPEED_OPTIONS.includes(Number(transition.speed))
      ? Number(transition.speed)
      : DEFAULT_SPEED
  };
}

function parseSequenceEntries(value) {
  return String(value ?? '')
    .split(',')
    .map((movementId) => createSequenceEntry(movementId.trim()))
    .filter(Boolean)
    .slice(0, MAX_SEQUENCE_LENGTH);
}

function getSequenceMovement(entry) {
  return INDEXED_MOVEMENTS.find((movement) => movement.id === entry?.movementId) ?? null;
}

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
  viewerOptions: document.querySelector('#viewer-options'),
  effectMenuSlot: document.querySelector('#effect-menu-slot'),
  effectMenuStack: document.querySelector('.effect-menu-stack'),
  select: document.querySelector('#dance-select'),
  addToSequence: document.querySelector('#add-to-sequence'),
  sequenceTimelineToggle: document.querySelector('#sequence-timeline-toggle'),
  sequenceTimelineToggleStatus: document.querySelector('#sequence-timeline-toggle-status'),
  sequenceTimelinePanel: document.querySelector('#sequence-timeline-panel'),
  sequenceTimelineClose: document.querySelector('#sequence-timeline-close'),
  sequenceTrack: document.querySelector('#sequence-track'),
  sequenceStatus: document.querySelector('#sequence-status'),
  sequencePlay: document.querySelector('#sequence-play'),
  sequenceClear: document.querySelector('#sequence-clear'),
  axisWidget: document.querySelector('.axis-widget'),
  sequenceDurationButtons: [...document.querySelectorAll('[data-sequence-duration]')],
  sequenceEasingButtons: [...document.querySelectorAll('[data-sequence-easing]')],
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
  speedControlLabel: document.querySelector('#speed-control-label'),
  applySequenceSpeedAll: document.querySelector('#apply-sequence-speed-all'),
  avatarStyleToggle: document.querySelector('#avatar-style-toggle'),
  avatarStyleClose: document.querySelector('#avatar-style-close'),
  avatarStyleStatus: document.querySelector('#avatar-style-status'),
  avatarStylePanel: document.querySelector('#avatar-style-panel'),
  avatarColorButtons: [...document.querySelectorAll('[data-avatar-color]')],
  avatarSolidColorInput: document.querySelector('#avatar-solid-color'),
  avatarGradientInputs: [...document.querySelectorAll('[data-avatar-gradient-stop]')],
  avatarSurfaceButtons: [...document.querySelectorAll('[data-avatar-surface]')],
  lightingPresetButtons: [...document.querySelectorAll('[data-lighting-preset]')],
  lightingColorButtons: [...document.querySelectorAll('[data-lighting-color]')],
  lightingCustomColorInput: document.querySelector('#lighting-custom-color'),
  lightingIntensityInput: document.querySelector('#lighting-intensity'),
  lightingIntensityValue: document.querySelector('#lighting-intensity-value'),
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
  flowFieldMenuToggle: document.querySelector('#flow-field-menu-toggle'),
  flowFieldMenuClose: document.querySelector('#flow-field-menu-close'),
  flowFieldMenuStatus: document.querySelector('#flow-field-menu-status'),
  flowFieldMenuPanel: document.querySelector('#flow-field-menu-panel'),
  flowFieldDisplayToggle: document.querySelector('#flow-field-display-toggle'),
  flowFieldDisplayStatus: document.querySelector('#flow-field-display-status'),
  flowFieldResetButton: document.querySelector('#flow-field-reset'),
  flowFieldColorInputs: [...document.querySelectorAll('[data-flow-color-stop]')],
  flowFieldEnabledButtons: [...document.querySelectorAll('[data-flow-enabled]')],
  flowFieldSliders: [...document.querySelectorAll('[data-flow-field-slider]')],
  flowFieldValues: new Map(
    [...document.querySelectorAll('[data-flow-value]')]
      .map((output) => [output.dataset.flowValue, output])
  ),
  flowFieldGradientButtons: [...document.querySelectorAll('[data-flow-gradient]')],
  flowFieldDescription: document.querySelector('#flow-field-description'),
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
  bodyCenteringToggle: document.querySelector('#body-centering-toggle'),
  bodyCenteringStatus: document.querySelector('#body-centering-status'),
  floorLightButtons: [...document.querySelectorAll('[data-floor-light]')],
  traceSampleRateButtons: [...document.querySelectorAll('[data-trace-sample-rate]')],
  analysisPanel: document.querySelector('.analysis-panel'),
  analysisPanelToggle: document.querySelector('#analysis-panel-toggle'),
  analysisPanelClose: document.querySelector('#analysis-panel-close'),
  analysisPanelStatus: document.querySelector('#analysis-panel-status'),
  analysisResizer: document.querySelector('#analysis-resizer')
};

if (ui.effectMenuSlot && ui.effectMenuStack) ui.effectMenuSlot.append(ui.effectMenuStack);

const state = {
  movementIndex: MODEL_COUNT - 1,
  loadToken: 0,
  root: null,
  modelContainer: null,
  modelMovementId: null,
  mixer: null,
  action: null,
  clip: null,
  sequence: [],
  sequenceTimelineOpen: false,
  sequenceActive: false,
  sequenceReady: false,
  sequencePreparing: false,
  sequenceLoadToken: 0,
  sequenceActions: [],
  sequenceIndex: 0,
  sequenceTransition: null,
  sequencePendingStartIndex: 0,
  sequencePendingPreviewIndex: null,
  sequencePendingProgress: null,
  sequenceResumePlaying: null,
  sequenceLoopMode: 'loop',
  sequenceEnded: false,
  sequenceTransitionDuration: SEQUENCE_TRANSITION_DURATION,
  sequenceTransitionEasing: 'ease',
  bones: new Map(),
  trackers: [],
  playing: true,
  speed: DEFAULT_SPEED,
  avatarStyleOpen: false,
  avatarColor: DEFAULT_AVATAR_COLOR,
  avatarGradientTop: DEFAULT_AVATAR_GRADIENT_COLOR,
  avatarGradientMiddle: DEFAULT_AVATAR_GRADIENT_COLOR,
  avatarGradientBottom: DEFAULT_AVATAR_GRADIENT_COLOR,
  surfaceMode: DEFAULT_SURFACE_MODE,
  lightingPreset: DEFAULT_LIGHTING_PRESET,
  lightingColor: DEFAULT_LIGHTING_COLOR,
  lightingCustomColor: DEFAULT_LIGHTING_CUSTOM_COLOR,
  lightingIntensity: DEFAULT_LIGHTING_INTENSITY,
  skeletonGroup: null,
  skeletonBones: [],
  skeletonConnections: [],
  skeletonLine: null,
  skeletonLinePositions: null,
  skeletonLineColors: null,
  skeletonJoints: null,
  pointCloudGroup: null,
  pointCloudEntries: [],
  cameraOrbit: false,
  cameraOrbitSpeed: 1,
  cameraOrbitDirection: 1,
  avatarOffsetX: 0,
  avatarOffsetY: 0,
  bodyCenterLocked: true,
  activeExperiments: new Set(),
  visualizationMenuOpen: false,
  flowFieldEnabled: false,
  flowFieldMenuOpen: false,
  flowFieldSpeed: DEFAULT_FLOW_FIELD_SPEED,
  flowFieldCount: DEFAULT_FLOW_FIELD_COUNT,
  flowFieldGradient: DEFAULT_FLOW_FIELD_GRADIENT,
  flowFieldColorStart: DEFAULT_FLOW_FIELD_COLORS[0],
  flowFieldColorMiddle: DEFAULT_FLOW_FIELD_COLORS[1],
  flowFieldColorEnd: DEFAULT_FLOW_FIELD_COLORS[2],
  flowFieldThickness: DEFAULT_FLOW_FIELD_THICKNESS,
  flowFieldOpacity: DEFAULT_FLOW_FIELD_OPACITY,
  flowFieldTrailLength: DEFAULT_FLOW_FIELD_TRAIL_LENGTH,
  flowFieldTrailFade: DEFAULT_FLOW_FIELD_TRAIL_FADE,
  flowFieldStrokeLength: DEFAULT_FLOW_FIELD_STROKE_LENGTH,
  flowFieldCurvature: DEFAULT_FLOW_FIELD_CURVATURE,
  flowFieldColorVariation: DEFAULT_FLOW_FIELD_COLOR_VARIATION,
  flowFieldInfluence: DEFAULT_FLOW_FIELD_INFLUENCE,
  flowFieldBodyFlow: DEFAULT_FLOW_FIELD_BODY_FLOW,
  flowFieldRecovery: DEFAULT_FLOW_FIELD_RECOVERY,
  flowFieldProximityFade: DEFAULT_FLOW_FIELD_PROXIMITY_FADE,
  flowFieldConcentration: DEFAULT_FLOW_FIELD_CONCENTRATION,
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
controls.enableDamping = false;
controls.enablePan = false;
controls.minDistance = 3.8;
controls.maxDistance = 20;
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

const flowFieldVisual = createFlowField({ maxParticles: EMBEDDED_VIEW ? 1600 : 7200 });
setFlowFieldOptions(flowFieldVisual, {
  enabled: false,
  speed: DEFAULT_FLOW_FIELD_SPEED,
  count: DEFAULT_FLOW_FIELD_COUNT,
  gradient: DEFAULT_FLOW_FIELD_GRADIENT,
  thickness: DEFAULT_FLOW_FIELD_THICKNESS,
  opacity: DEFAULT_FLOW_FIELD_OPACITY,
  trailLength: DEFAULT_FLOW_FIELD_TRAIL_LENGTH,
  trailFade: DEFAULT_FLOW_FIELD_TRAIL_FADE,
  strokeLength: DEFAULT_FLOW_FIELD_STROKE_LENGTH,
  curvature: DEFAULT_FLOW_FIELD_CURVATURE,
  colorVariation: DEFAULT_FLOW_FIELD_COLOR_VARIATION,
  influence: DEFAULT_FLOW_FIELD_INFLUENCE,
  bodyFlow: DEFAULT_FLOW_FIELD_BODY_FLOW,
  recovery: DEFAULT_FLOW_FIELD_RECOVERY,
  proximityFade: DEFAULT_FLOW_FIELD_PROXIMITY_FADE,
  concentration: DEFAULT_FLOW_FIELD_CONCENTRATION
});
scene.add(flowFieldVisual.group);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
dracoLoader.setDecoderConfig({ type: 'wasm' });
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const sequenceClipCache = new Map();

const clock = new THREE.Clock();
const tempVector = new THREE.Vector3();
const tempVectorB = new THREE.Vector3();
const tempVectorC = new THREE.Vector3();
const axisWidgetQuaternion = new THREE.Quaternion();
const axisWidgetDirection = new THREE.Vector3();
const AXIS_WIDGET_ORIGIN = Object.freeze({ x: 21, y: 21 });
const AXIS_WIDGET_AXES = Object.freeze([
  Object.freeze({ key: 'x', direction: new THREE.Vector3(1, 0, 0) }),
  Object.freeze({ key: 'y', direction: new THREE.Vector3(0, 1, 0) }),
  Object.freeze({ key: 'z', direction: new THREE.Vector3(0, 0, 1) })
]);
const flowFieldCenter = new THREE.Vector3(0, DISPLAY_HEIGHT * 0.5, 0);
const flowFieldDirection = new THREE.Vector3(1, 0, 0);
const flowFieldViewDirection = new THREE.Vector3(0, 0, -1);
const tempAvatarVertex = new THREE.Vector3();
const tempAvatarMatrix = new THREE.Matrix4();
const tempColor = new THREE.Color();
const tempAvatarGradientColor = new THREE.Color();
const customLightingGroundColor = new THREE.Color();
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
const avatarGradientUniforms = {
  enabled: { value: 0 },
  top: { value: new THREE.Color(DEFAULT_AVATAR_GRADIENT_COLOR) },
  middle: { value: new THREE.Color(DEFAULT_AVATAR_GRADIENT_COLOR) },
  bottom: { value: new THREE.Color(DEFAULT_AVATAR_GRADIENT_COLOR) },
  minY: { value: 0 },
  maxY: { value: DISPLAY_HEIGHT }
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
  flowFieldVisual.group.visible = false;
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
  state.sequenceLoadToken += 1;
  state.sequenceReady = false;
  state.sequencePreparing = false;
  state.sequenceActions = [];
  state.sequenceTransition = null;
  state.mixer?.stopAllAction();
  state.root = null;
  state.modelContainer = null;
  state.modelMovementId = null;
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
    const limit = Math.min(24, track.times.length);
    for (let index = 0; index < limit; index += 1) sampledTimes.push(track.times[index]);
  }
  sampledTimes.sort((a, b) => a - b);
  const uniqueTimes = sampledTimes.filter(
    (time, index) => index === 0 || Math.abs(time - sampledTimes[index - 1]) > 0.0001
  );
  const firstTime = uniqueTimes[0] ?? 0;
  const trimTarget = firstTime + INITIAL_POSE_TRIM_SECONDS;
  const start = uniqueTimes.find((time) => time + 0.0001 >= trimTarget)
    ?? uniqueTimes.at(-1)
    ?? firstTime;
  return THREE.MathUtils.clamp(start, 0, Math.max(0, clip.duration - 0.001));
}

function escapeSequenceMarkup(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getSequenceIds() {
  return state.sequence.map((entry) => entry.movementId);
}

function getSequenceRuntime(index = state.sequenceIndex) {
  return state.sequenceActions[index] ?? null;
}

function getSequenceTransitionDuration(fromIndex, toIndex) {
  const from = getSequenceRuntime(fromIndex);
  const to = getSequenceRuntime(toIndex);
  const requestedDuration = state.sequence[fromIndex]?.transitionDuration
    ?? state.sequenceTransitionDuration;
  if (!from || !to) return requestedDuration;
  return Math.max(0.08, Math.min(
    requestedDuration,
    from.playableDuration * 0.36,
    to.playableDuration * 0.36
  ));
}

function getSequenceBlendWeight(progress, easing = 'ease') {
  const normalized = THREE.MathUtils.clamp(progress, 0, 1);
  if (easing === 'linear') return normalized;
  return normalized * normalized * (3 - 2 * normalized);
}

function getSequenceTransitionEasing(index) {
  return state.sequence[index]?.transitionEasing === 'linear' ? 'linear' : 'ease';
}

function updateSequenceTransitionControls() {
  ui.sequenceDurationButtons.forEach((button) => {
    button.classList.toggle('active', Math.abs(Number(button.dataset.sequenceDuration) - state.sequenceTransitionDuration) < 0.001);
  });
  ui.sequenceEasingButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.sequenceEasing === state.sequenceTransitionEasing);
  });
}

function setSequenceTransitionDuration(value) {
  const nextDuration = THREE.MathUtils.clamp(Number(value) || SEQUENCE_TRANSITION_DURATION, 0.2, 5);
  if (state.sequenceTransition) {
    const progress = state.sequenceTransition.duration
      ? state.sequenceTransition.elapsed / state.sequenceTransition.duration
      : 0;
    state.sequenceTransitionDuration = nextDuration;
    state.sequenceTransition.duration = getSequenceTransitionDuration(
      state.sequenceTransition.fromIndex,
      state.sequenceTransition.toIndex
    );
    state.sequenceTransition.elapsed = state.sequenceTransition.duration * progress;
  } else {
    state.sequenceTransitionDuration = nextDuration;
  }
  updateSequenceTransitionControls();
  if (state.sequenceReady) {
    ui.timeline.max = String(getSequenceTotalDuration());
    ui.totalTime.textContent = formatTime(getSequenceTotalDuration());
  }
  renderSequenceTimeline();
}

function setSequenceTransitionEasing(value) {
  state.sequenceTransitionEasing = value === 'linear' ? 'linear' : 'ease';
  updateSequenceTransitionControls();
}

function getSequenceOffsets() {
  const offsets = [];
  let offset = 0;
  for (let index = 0; index < state.sequenceActions.length; index += 1) {
    offsets.push(offset);
    if (index < state.sequenceActions.length - 1) {
      offset += state.sequenceActions[index].playableDuration
        - getSequenceTransitionDuration(index, index + 1);
    }
  }
  return offsets;
}

function getSequenceTotalDuration() {
  if (!state.sequenceActions.length) return 0;
  const offsets = getSequenceOffsets();
  return offsets.at(-1) + state.sequenceActions.at(-1).playableDuration;
}

function getSequenceElapsedTime() {
  const runtime = getSequenceRuntime();
  if (!runtime) return 0;
  const offsets = getSequenceOffsets();
  if (state.sequenceTransition) {
    const transition = state.sequenceTransition;
    const from = getSequenceRuntime(transition.fromIndex);
    return (offsets[transition.fromIndex] ?? 0)
      + from.playableDuration
      - transition.duration
      + transition.elapsed;
  }
  return (offsets[state.sequenceIndex] ?? 0)
    + THREE.MathUtils.clamp(runtime.action.time - runtime.clipStart, 0, runtime.playableDuration);
}

function updateSequenceProgressIndicators() {
  const active = state.sequenceActive && state.sequenceReady && state.sequenceActions.length > 0;
  const transition = active ? state.sequenceTransition : null;
  const currentIndex = active ? state.sequenceIndex : -1;
  const visibleMovement = MOVEMENTS[state.movementIndex];
  const inactivePreview = !active
    && state.sequenceTimelineOpen
    && state.ready
    && state.action
    && state.sequence.length > 0;

  ui.sequenceTrack.querySelectorAll('[data-sequence-index]').forEach((card) => {
    const index = Number(card.dataset.sequenceIndex);
    let progress = 0;

    if (active) {
      if (transition) {
        progress = index <= transition.fromIndex ? 1 : 0;
      } else if (index < currentIndex) {
        progress = 1;
      } else if (index === currentIndex) {
        const runtime = getSequenceRuntime(index);
        progress = runtime
          ? THREE.MathUtils.clamp(
              (runtime.action.time - runtime.clipStart) / runtime.playableDuration,
              0,
              1
            )
          : 0;
      }
    } else if (
      inactivePreview
      && index === state.sequenceIndex
      && state.sequence[index]?.movementId === visibleMovement?.id
    ) {
      const playableDuration = Math.max(0.001, state.duration - state.clipStart);
      progress = THREE.MathUtils.clamp(
        (state.action.time - state.clipStart) / playableDuration,
        0,
        1
      );
    }

    card.style.setProperty('--sequence-box-progress', String(progress));
  });

  ui.sequenceTrack.querySelectorAll('[data-sequence-transition-card]').forEach((card) => {
    const index = Number(card.dataset.sequenceTransitionCard);
    let progress = 0;

    if (active) {
      if (transition) {
        if (index < transition.fromIndex) {
          progress = 1;
        } else if (index === transition.fromIndex) {
          progress = transition.duration
            ? THREE.MathUtils.clamp(transition.elapsed / transition.duration, 0, 1)
            : 1;
        }
      } else if (index < currentIndex) {
        progress = 1;
      }
    }

    card.style.setProperty('--sequence-box-progress', String(progress));
  });
}

function setSequenceTimelineOpen(open) {
  state.sequenceTimelineOpen = Boolean(open) && !EMBEDDED_VIEW;
  ui.sequenceTimelinePanel.hidden = !state.sequenceTimelineOpen;
  ui.sequenceTimelineToggle.setAttribute('aria-expanded', String(state.sequenceTimelineOpen));
  ui.sequenceTimelineToggleStatus.textContent = state.sequenceTimelineOpen ? 'HIDE' : 'SHOW';
  ui.speedControlLabel.textContent = state.sequence.length && state.sequenceTimelineOpen
    ? 'CURRENT'
    : 'SPEED';
  document.body.classList.toggle('sequence-timeline-open', state.sequenceTimelineOpen);
}

function updateAddToSequenceAvailability() {
  const movement = MOVEMENTS.find((candidate) => candidate.id === ui.select.value);
  const available = movement?.source === 'indexed' && state.sequence.length < MAX_SEQUENCE_LENGTH;
  ui.addToSequence.disabled = !available;
  ui.addToSequence.title = available
    ? `Add movement ${movement.modelNumber} to the sequence`
    : state.sequence.length >= MAX_SEQUENCE_LENGTH
      ? `Sequence limit reached (${MAX_SEQUENCE_LENGTH})`
      : 'Only indexed movements 1–59 can be sequenced';
}

function renderSequenceTimeline() {
  updateAddToSequenceAvailability();
  ui.speedControlLabel.textContent = state.sequence.length && state.sequenceTimelineOpen
    ? 'CURRENT'
    : 'SPEED';
  ui.applySequenceSpeedAll.disabled = state.sequence.length === 0;
  ui.applySequenceSpeedAll.title = state.sequence.length
    ? `Apply ${state.speed}× to every movement in this sequence`
    : 'Add movements to a sequence first';
  ui.sequencePlay.disabled = state.sequence.length === 0 || state.sequencePreparing;
  ui.sequencePlay.textContent = state.sequenceActive ? 'STOP SEQUENCE' : 'PLAY SEQUENCE';

  if (state.sequencePreparing) {
    ui.sequenceStatus.textContent = `LOADING ${state.sequence.length} MOVEMENT${state.sequence.length === 1 ? '' : 'S'}…`;
  } else if (state.sequenceActive && state.sequence.length) {
    const activeNumber = Math.min(state.sequenceIndex + 1, state.sequence.length);
    ui.sequenceStatus.textContent = state.sequenceEnded
      ? 'SEQUENCE COMPLETE · FINAL POSE HELD'
      : state.sequenceTransition?.preview
      ? `PREVIEWING ${String(state.sequenceTransition.fromIndex + 1).padStart(2, '0')} → ${String(state.sequenceTransition.toIndex + 1).padStart(2, '0')}`
      : `SEQUENCE ON · ${String(activeNumber).padStart(2, '0')} / ${String(state.sequence.length).padStart(2, '0')}`;
  } else {
    ui.sequenceStatus.textContent = state.sequence.length
      ? `${state.sequence.length} MOVEMENT${state.sequence.length === 1 ? '' : 'S'} · INDIVIDUAL TRANSITION CONTROLS`
      : 'EMPTY · ADD MOVEMENTS 1–59';
  }

  if (!state.sequence.length) {
    ui.sequenceTrack.innerHTML = `
      <button class="sequence-empty-add" type="button" data-sequence-action="add">
        <span>＋</span>
        <strong>ADD THE SELECTED MOVEMENT</strong>
        <small>BUILD A LOOP FROM INDEXED POSES 1–59</small>
      </button>`;
    return;
  }

  const movementOptions = INDEXED_MOVEMENTS.map((movement) => (
    `<option value="${movement.id}">${String(movement.modelNumber).padStart(2, '0')} · ${escapeSequenceMarkup(movement.english.trim())}</option>`
  )).join('');

  ui.sequenceTrack.innerHTML = state.sequence.map((entry, index) => {
    const movement = getSequenceMovement(entry);
    const active = (state.sequenceActive || state.sequenceTimelineOpen) && index === state.sequenceIndex;
    const nextIndex = (index + 1) % state.sequence.length;
    const transitionActive = state.sequenceTransition?.fromIndex === index;
    const transitionDuration = entry.transitionDuration ?? SEQUENCE_TRANSITION_DURATION;
    const transitionEasing = entry.transitionEasing === 'linear' ? 'linear' : 'ease';
    const playbackSpeed = entry.playbackSpeed ?? DEFAULT_SPEED;
    const isLast = index === state.sequence.length - 1;
    const playbackSpeedOptions = PLAYBACK_SPEED_OPTIONS.map((speed) => (
      `<option value="${speed}" ${Math.abs(playbackSpeed - speed) < 0.001 ? 'selected' : ''}>${speed}×</option>`
    )).join('');
    return `
      <article class="sequence-clip${active ? ' active' : ''}" data-sequence-index="${index}">
        <div class="sequence-clip__toolbar">
          <span>${String(index + 1).padStart(2, '0')}</span>
          <button type="button" data-sequence-action="left" aria-label="Move sequence item ${index + 1} left" ${index === 0 ? 'disabled' : ''}>←</button>
          <button type="button" data-sequence-action="right" aria-label="Move sequence item ${index + 1} right" ${index === state.sequence.length - 1 ? 'disabled' : ''}>→</button>
          <button type="button" data-sequence-action="remove" aria-label="Remove sequence item ${index + 1}">×</button>
        </div>
        <button class="sequence-clip__preview" type="button" data-sequence-action="jump" aria-label="Jump to movement ${movement.modelNumber}">
          <span>${String(movement.modelNumber).padStart(2, '0')}</span>
          <strong>${escapeSequenceMarkup(movement.thai)}</strong>
          <small>${escapeSequenceMarkup(movement.english.trim())}</small>
        </button>
        <label>
          <span>EDIT</span>
          <select data-sequence-movement aria-label="Edit sequence item ${index + 1}">
            ${movementOptions.replace(`value="${movement.id}"`, `value="${movement.id}" selected`)}
          </select>
        </label>
        <label class="sequence-clip__speed">
          <span>SPEED</span>
          <select data-sequence-playback-speed="${index}" aria-label="Movement ${index + 1} playback speed">
            ${playbackSpeedOptions}
          </select>
        </label>
        <i class="sequence-box-progress" aria-hidden="true"></i>
      </article>
      <article
        class="sequence-transition${transitionActive ? ' active' : ''}${isLast ? ' sequence-transition--loop' : ''}"
        data-sequence-transition-card="${index}"
      >
        ${isLast ? `
          <div class="sequence-loop-mode" role="group" aria-label="Sequence ending behavior">
            <button class="${state.sequenceLoopMode === 'loop' ? 'active' : ''}" type="button" data-sequence-loop-mode="loop">LOOP</button>
            <button class="${state.sequenceLoopMode === 'end' ? 'active' : ''}" type="button" data-sequence-loop-mode="end">END</button>
          </div>` : ''}
        <button
          class="sequence-transition__preview"
          type="button"
          data-sequence-transition="${index}"
          ${isLast && state.sequenceLoopMode === 'end' ? 'disabled' : ''}
          aria-label="Preview transition from sequence item ${index + 1} to ${nextIndex + 1}"
        >
          <span aria-hidden="true">${isLast
            ? state.sequenceLoopMode === 'loop'
              ? `<svg class="sequence-loop-arrow" viewBox="0 0 52 40"><path d="M15 4 5 12l10 8M6 12h28c8 0 13 5 13 12s-5 12-13 12H6" /></svg>`
              : '■'
            : `<svg class="sequence-transition-arrow" viewBox="0 0 52 40"><path d="M7 20h36M34 11l9 9-9 9" /></svg>`}</span>
          <strong>${isLast ? (state.sequenceLoopMode === 'loop' ? 'LOOP TO 01' : 'END SEQUENCE') : 'TRANSITION'}</strong>
          <small>${isLast && state.sequenceLoopMode === 'end' ? 'HOLD FINAL POSE' : 'CLICK TO PREVIEW'}</small>
        </button>
        <label class="sequence-transition__speed">
          <span>SPEED</span>
          <select data-sequence-transition-duration="${index}" aria-label="Transition ${index + 1} speed">
            <option value="0.4" ${Math.abs(transitionDuration - 0.4) < 0.001 ? 'selected' : ''}>FAST · 0.4S</option>
            <option value="0.8" ${Math.abs(transitionDuration - 0.8) < 0.001 ? 'selected' : ''}>QUICK · 0.8S</option>
            <option value="1.2" ${Math.abs(transitionDuration - 1.2) < 0.001 ? 'selected' : ''}>SMOOTH · 1.2S</option>
            <option value="2.4" ${Math.abs(transitionDuration - 2.4) < 0.001 ? 'selected' : ''}>SLOW · 2.4S</option>
          </select>
        </label>
        <div class="sequence-transition__curve" role="group" aria-label="Transition ${index + 1} interpolation">
          <button class="${transitionEasing === 'linear' ? 'active' : ''}" type="button" data-sequence-transition-easing="linear" data-sequence-transition-index="${index}">LINEAR</button>
          <button class="${transitionEasing === 'ease' ? 'active' : ''}" type="button" data-sequence-transition-easing="ease" data-sequence-transition-index="${index}">EASE</button>
        </div>
        <i class="sequence-box-progress" aria-hidden="true"></i>
      </article>`;
  }).join('') + `
    <button class="sequence-track-add" type="button" data-sequence-action="add" ${state.sequence.length >= MAX_SEQUENCE_LENGTH ? 'disabled' : ''}>
      <span>＋</span><strong>ADD SELECTED</strong>
    </button>`;
  updateSequenceProgressIndicators();
}

function loadSequenceClipData(entry) {
  const movement = getSequenceMovement(entry);
  if (!movement) return Promise.reject(new Error('Sequence movement is unavailable.'));
  if (sequenceClipCache.has(movement.id)) return sequenceClipCache.get(movement.id);

  const request = new Promise((resolve, reject) => {
    gltfLoader.load(
      movement.url,
      (gltf) => {
        try {
          const sourceClip = chooseClip(gltf.animations, movement.modelNumber);
          if (!sourceClip) throw new Error(`Movement ${movement.id} has no animation clip.`);
          const clip = sourceClip.clone();
          clip.name = `sequence-source-${movement.id}`;
          const clipStart = getTrimmedClipStart(clip);
          resolve({ movement, clip, clipStart });
        } catch (error) {
          reject(error);
        } finally {
          disposeObject(gltf.scene);
        }
      },
      undefined,
      reject
    );
  }).catch((error) => {
    sequenceClipCache.delete(movement.id);
    throw error;
  });

  sequenceClipCache.set(movement.id, request);
  return request;
}

function updateSequenceRuntimeSelection(runtime, index) {
  if (!runtime) return;
  state.sequenceIndex = index;
  state.action = runtime.action;
  state.clip = runtime.clip;
  state.duration = runtime.clip.duration;
  state.clipStart = runtime.clipStart;
  state.lastClipTime = runtime.action.time;
  const movementIndex = MOVEMENTS.findIndex((movement) => movement.id === runtime.movement.id);
  if (movementIndex >= 0) state.movementIndex = movementIndex;
  ui.select.value = runtime.movement.id;
  const playbackSpeed = state.sequence[index]?.playbackSpeed ?? DEFAULT_SPEED;
  state.speed = playbackSpeed;
  updatePlaybackSpeedButtons(playbackSpeed);
  updateMovementInformation(runtime.movement);
  updateAddToSequenceAvailability();
}

function setSequenceRuntime(index, localTime = 0, { preserveTrails = false } = {}) {
  const runtime = getSequenceRuntime(index);
  if (!runtime || !state.mixer) return;
  state.mixer.stopAllAction();
  state.sequenceTransition = null;
  state.sequenceEnded = false;
  runtime.action.reset();
  runtime.action.enabled = true;
  runtime.action.setEffectiveTimeScale(1);
  runtime.action.setEffectiveWeight(1);
  runtime.action.setLoop(THREE.LoopOnce, 1);
  runtime.action.clampWhenFinished = true;
  runtime.action.play();
  runtime.action.time = runtime.clipStart + THREE.MathUtils.clamp(localTime, 0, runtime.playableDuration);
  state.mixer.update(0);
  updateSequenceRuntimeSelection(runtime, index);
  centerCharacter();
  resetTrackerSamples({ preserveTrails });
  updateMotionSignals(1 / 30, false, false);
  renderSequenceTimeline();
}

async function initializeSequencePlayback() {
  if (state.sequencePreparing || !state.sequenceActive || !state.sequence.length || !state.root || !state.mixer) return;
  const token = ++state.sequenceLoadToken;
  const resumePlaying = state.sequenceResumePlaying ?? state.playing;
  setPlaying(false);
  state.sequencePreparing = true;
  state.sequenceReady = false;
  state.sequenceResumePlaying = resumePlaying;
  renderSequenceTimeline();

  try {
    const entries = [...state.sequence];
    const sources = await Promise.all(entries.map(loadSequenceClipData));
    if (token !== state.sequenceLoadToken || !state.sequenceActive) return;

    state.mixer.stopAllAction();
    state.sequenceActions = sources.map((source, index) => {
      const clip = source.clip.clone();
      clip.name = `sequence-${entries[index].uid}`;
      const action = state.mixer.clipAction(clip);
      const loopClip = clip.clone();
      loopClip.name = `sequence-loop-${entries[index].uid}`;
      const loopAction = state.mixer.clipAction(loopClip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.enabled = true;
      return {
        entry: entries[index],
        movement: source.movement,
        clip,
        clipStart: source.clipStart,
        playableDuration: Math.max(0.001, clip.duration - source.clipStart),
        action,
        loopAction
      };
    });
    state.sequencePreparing = false;
    state.sequenceReady = true;

    const startIndex = THREE.MathUtils.clamp(
      Number(state.sequencePendingStartIndex) || 0,
      0,
      state.sequenceActions.length - 1
    );
    setSequenceRuntime(startIndex, 0);
    ui.timeline.min = '0';
    ui.timeline.max = String(getSequenceTotalDuration());
    ui.timeline.value = String(getSequenceElapsedTime());
    ui.totalTime.textContent = formatTime(getSequenceTotalDuration());

    if (Number.isFinite(state.sequencePendingProgress)) {
      const pendingProgress = state.sequencePendingProgress;
      state.sequencePendingProgress = null;
      seekSequenceToProgress(pendingProgress);
    }

    const previewIndex = state.sequencePendingPreviewIndex;
    state.sequencePendingPreviewIndex = null;
    if (Number.isInteger(previewIndex)) previewSequenceTransition(previewIndex);
    else setPlaying(state.sequenceResumePlaying ?? true);
    state.sequenceResumePlaying = null;
    renderSequenceTimeline();
  } catch (error) {
    if (token !== state.sequenceLoadToken) return;
    console.error(error);
    state.sequencePreparing = false;
    state.sequenceReady = false;
    state.sequenceActive = false;
    ui.sequenceStatus.textContent = 'SEQUENCE COULD NOT BE PREPARED';
    setPlaying(false);
    renderSequenceTimeline();
  }
}

function startSequence({ startIndex = 0, previewIndex = null } = {}) {
  if (!state.sequence.length) return;
  if (state.sequenceResumePlaying === null) state.sequenceResumePlaying = state.playing;
  state.sequenceActive = true;
  state.sequenceEnded = false;
  state.sequencePendingStartIndex = startIndex;
  state.sequencePendingPreviewIndex = previewIndex;
  state.sequenceTransition = null;
  if (!EMBEDDED_VIEW) setSequenceTimelineOpen(true);
  renderSequenceTimeline();

  const firstMovement = getSequenceMovement(state.sequence[0]);
  if (!firstMovement) return;
  if (state.modelMovementId !== firstMovement.id || !state.ready) {
    const movementIndex = MOVEMENTS.findIndex((movement) => movement.id === firstMovement.id);
    if (movementIndex >= 0) {
      setLoading('PREPARING SEQUENCE', `01 / ${String(state.sequence.length).padStart(2, '0')}`);
      loadModel(movementIndex);
    }
    return;
  }
  void initializeSequencePlayback();
}

function stopSequence({ reloadModel = true } = {}) {
  state.sequenceLoadToken += 1;
  state.sequenceActive = false;
  state.sequenceReady = false;
  state.sequencePreparing = false;
  state.sequenceTransition = null;
  state.sequenceEnded = false;
  state.sequenceActions = [];
  state.sequenceResumePlaying = null;
  state.sequencePendingProgress = null;
  renderSequenceTimeline();
  if (!reloadModel || !state.ready) return;
  const movementIndex = MOVEMENTS.findIndex((movement) => movement.id === ui.select.value);
  if (movementIndex >= 0) loadModel(movementIndex);
}

function applySequenceValue(value, active = state.sequenceActive) {
  const nextEntries = parseSequenceEntries(value);
  const wasActive = Boolean(active) && nextEntries.length > 0;
  state.sequenceLoadToken += 1;
  state.sequence = nextEntries;
  state.sequenceActive = wasActive;
  state.sequenceReady = false;
  state.sequencePreparing = false;
  state.sequenceActions = [];
  state.sequenceTransition = null;
  renderSequenceTimeline();
  if (wasActive) startSequence();
}

function refreshSequenceAfterEdit(preferredIndex = 0) {
  state.sequenceLoadToken += 1;
  state.sequenceReady = false;
  state.sequenceActions = [];
  state.sequenceTransition = null;
  renderSequenceTimeline();
  if (state.sequenceActive && state.sequence.length) startSequence({ startIndex: preferredIndex });
  else if (!state.sequence.length) stopSequence({ reloadModel: false });
}

function addSelectedMovementToSequence() {
  const entry = createSequenceEntry(ui.select.value);
  if (!entry || state.sequence.length >= MAX_SEQUENCE_LENGTH) return;
  entry.playbackSpeed = state.speed;
  state.sequence.push(entry);
  setSequenceTimelineOpen(true);
  refreshSequenceAfterEdit(state.sequence.length - 1);
}

function removeSequenceEntry(index) {
  if (!state.sequence[index]) return;
  state.sequence.splice(index, 1);
  refreshSequenceAfterEdit(Math.max(0, Math.min(index, state.sequence.length - 1)));
}

function moveSequenceEntry(index, direction) {
  const targetIndex = index + direction;
  if (!state.sequence[index] || !state.sequence[targetIndex]) return;
  [state.sequence[index], state.sequence[targetIndex]] = [state.sequence[targetIndex], state.sequence[index]];
  refreshSequenceAfterEdit(targetIndex);
}

function editSequenceEntry(index, movementId) {
  if (!state.sequence[index] || !INDEXED_MOVEMENTS.some((movement) => movement.id === movementId)) return;
  state.sequence[index].movementId = movementId;
  refreshSequenceAfterEdit(index);
}

function setSequenceEntryTransitionDuration(index, value) {
  const entry = state.sequence[index];
  if (!entry) return;
  entry.transitionDuration = THREE.MathUtils.clamp(Number(value) || SEQUENCE_TRANSITION_DURATION, 0.2, 5);
  if (state.sequenceTransition?.fromIndex === index) {
    const progress = state.sequenceTransition.duration
      ? state.sequenceTransition.elapsed / state.sequenceTransition.duration
      : 0;
    state.sequenceTransition.duration = getSequenceTransitionDuration(index, state.sequenceTransition.toIndex);
    state.sequenceTransition.elapsed = state.sequenceTransition.duration * progress;
  }
  if (state.sequenceReady) {
    ui.timeline.max = String(getSequenceTotalDuration());
    ui.totalTime.textContent = formatTime(getSequenceTotalDuration());
  }
  renderSequenceTimeline();
}

function setSequenceEntryTransitionEasing(index, value) {
  const entry = state.sequence[index];
  if (!entry) return;
  entry.transitionEasing = value === 'linear' ? 'linear' : 'ease';
  if (state.sequenceTransition?.fromIndex === index) {
    state.sequenceTransition.easing = entry.transitionEasing;
  }
  renderSequenceTimeline();
}

function setSequenceEntryPlaybackSpeed(index, value) {
  const entry = state.sequence[index];
  const speed = Number(value);
  if (!entry || !PLAYBACK_SPEED_OPTIONS.includes(speed)) return;
  entry.playbackSpeed = speed;
  if ((state.sequenceActive || state.sequenceTimelineOpen) && state.sequenceIndex === index) {
    state.speed = speed;
    updatePlaybackSpeedButtons(speed);
  }
  renderSequenceTimeline();
}

function setSequenceLoopMode(value) {
  state.sequenceLoopMode = value === 'end' ? 'end' : 'loop';
  if (state.sequenceLoopMode === 'loop') state.sequenceEnded = false;
  renderSequenceTimeline();
}

function applyPlaybackSpeedToAllSequenceEntries() {
  if (!state.sequence.length) return;
  state.sequence.forEach((entry) => {
    entry.playbackSpeed = state.speed;
  });
  renderSequenceTimeline();
}

function clearSequence() {
  const wasActive = state.sequenceActive;
  state.sequence = [];
  state.sequenceLoadToken += 1;
  state.sequenceActive = false;
  state.sequenceReady = false;
  state.sequencePreparing = false;
  state.sequenceActions = [];
  state.sequenceResumePlaying = null;
  state.sequencePendingProgress = null;
  state.sequenceTransition = null;
  state.sequenceEnded = false;
  renderSequenceTimeline();
  if (wasActive && state.ready) {
    const movementIndex = MOVEMENTS.findIndex((movement) => movement.id === ui.select.value);
    if (movementIndex >= 0) loadModel(movementIndex);
  }
}

function beginSequenceTransition(fromIndex, preview = false) {
  if (!state.sequenceActions.length || state.sequenceTransition) return false;
  const toIndex = (fromIndex + 1) % state.sequenceActions.length;
  const from = getSequenceRuntime(fromIndex);
  const to = getSequenceRuntime(toIndex);
  if (!from || !to) return false;
  const selfLoop = fromIndex === toIndex;
  if (selfLoop && state.sequenceLoopMode === 'end') return false;
  const duration = getSequenceTransitionDuration(fromIndex, toIndex);
  const fromAction = from.action;
  const toAction = selfLoop ? to.loopAction : to.action;

  toAction.reset();
  toAction.enabled = true;
  toAction.setEffectiveTimeScale(1);
  toAction.setEffectiveWeight(0);
  toAction.setLoop(THREE.LoopOnce, 1);
  toAction.clampWhenFinished = true;
  toAction.play();
  toAction.time = to.clipStart;
  fromAction.enabled = true;
  fromAction.setEffectiveWeight(1);
  state.sequenceTransition = {
    fromIndex,
    toIndex,
    duration,
    elapsed: 0,
    easing: getSequenceTransitionEasing(fromIndex),
    preview,
    selfLoop,
    fromAction,
    toAction
  };
  renderSequenceTimeline();
  return true;
}

function previewSequenceTransition(fromIndex) {
  if (!state.sequence.length) return;
  const normalizedIndex = THREE.MathUtils.clamp(Number(fromIndex) || 0, 0, state.sequence.length - 1);
  if (normalizedIndex === state.sequence.length - 1 && state.sequenceLoopMode === 'end') return;
  if (!state.sequenceActive || !state.sequenceReady) {
    state.sequenceResumePlaying = true;
    startSequence({ startIndex: normalizedIndex, previewIndex: normalizedIndex });
    return;
  }
  const from = getSequenceRuntime(normalizedIndex);
  if (!from) return;
  const toIndex = (normalizedIndex + 1) % state.sequenceActions.length;
  const duration = getSequenceTransitionDuration(normalizedIndex, toIndex);
  state.mixer.stopAllAction();
  from.action.reset();
  from.action.enabled = true;
  from.action.setEffectiveWeight(1);
  from.action.setLoop(THREE.LoopOnce, 1);
  from.action.clampWhenFinished = true;
  from.action.play();
  from.action.time = Math.max(from.clipStart, from.clip.duration - duration);
  state.mixer.update(0);
  updateSequenceRuntimeSelection(from, normalizedIndex);
  state.sequenceTransition = null;
  beginSequenceTransition(normalizedIndex, true);
  centerCharacter();
  resetTrackerSamples({ preserveTrails: true });
  setPlaying(true);
}

function jumpToSequenceClip(index) {
  const normalizedIndex = THREE.MathUtils.clamp(Number(index) || 0, 0, Math.max(0, state.sequence.length - 1));
  if (!state.sequenceActive || !state.sequenceReady) {
    state.sequenceResumePlaying = false;
    startSequence({ startIndex: normalizedIndex });
    return;
  }
  setSequenceRuntime(normalizedIndex, 0, { preserveTrails: true });
  setPlaying(false);
}

function seekSequenceToProgress(progress) {
  if (!state.sequenceReady || !state.sequenceActions.length) return;
  const normalizedProgress = THREE.MathUtils.clamp(Number(progress) || 0, 0, 1);
  const totalDuration = getSequenceTotalDuration();
  const requestedTime = totalDuration * normalizedProgress;
  const offsets = getSequenceOffsets();
  let index = 0;
  for (let candidate = 1; candidate < offsets.length; candidate += 1) {
    if (requestedTime >= offsets[candidate]) index = candidate;
    else break;
  }
  const runtime = getSequenceRuntime(index);
  setSequenceRuntime(index, Math.min(runtime.playableDuration, requestedTime - offsets[index]), { preserveTrails: true });
}

function advanceSequencePlayback(delta) {
  if (state.sequenceTransition) {
    const transition = state.sequenceTransition;
    const from = getSequenceRuntime(transition.fromIndex);
    const to = getSequenceRuntime(transition.toIndex);
    transition.elapsed = Math.min(transition.duration, transition.elapsed + delta);
    const blendWeight = getSequenceBlendWeight(
      transition.duration ? transition.elapsed / transition.duration : 1,
      transition.easing
    );
    transition.fromAction.setEffectiveWeight(1 - blendWeight);
    transition.toAction.setEffectiveWeight(blendWeight);
    state.mixer.update(delta);
    if (transition.elapsed + 0.0001 < transition.duration) return false;

    transition.fromAction.stop();
    transition.toAction.enabled = true;
    transition.toAction.setEffectiveWeight(1);
    if (transition.selfLoop) {
      to.action = transition.toAction;
      to.loopAction = transition.fromAction;
    }
    updateSequenceRuntimeSelection(to, transition.toIndex);
    state.sequenceTransition = null;
    const looped = transition.toIndex === 0;
    if (looped) resetTrackerSamples();
    if (transition.preview) setPlaying(false);
    renderSequenceTimeline();
    return looped;
  }

  state.mixer.update(delta);
  const runtime = getSequenceRuntime();
  if (!runtime) return false;
  const isLast = state.sequenceIndex === state.sequenceActions.length - 1;
  if (
    isLast
    && state.sequenceLoopMode === 'end'
    && runtime.action.time >= runtime.clip.duration - 0.001
  ) {
    runtime.action.time = runtime.clip.duration;
    state.mixer.update(0);
    state.lastClipTime = runtime.clip.duration;
    state.sequenceEnded = true;
    setPlaying(false);
    renderSequenceTimeline();
    return false;
  }

  const nextIndex = (state.sequenceIndex + 1) % state.sequenceActions.length;
  const transitionDuration = getSequenceTransitionDuration(state.sequenceIndex, nextIndex);
  if (runtime.action.time >= runtime.clip.duration - transitionDuration) {
    beginSequenceTransition(state.sequenceIndex, false);
  }
  state.lastClipTime = runtime.action.time;
  return false;
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
    shader.uniforms.uAvatarGradientEnabled = avatarGradientUniforms.enabled;
    shader.uniforms.uAvatarGradientTop = avatarGradientUniforms.top;
    shader.uniforms.uAvatarGradientMiddle = avatarGradientUniforms.middle;
    shader.uniforms.uAvatarGradientBottom = avatarGradientUniforms.bottom;
    shader.uniforms.uAvatarGradientMinY = avatarGradientUniforms.minY;
    shader.uniforms.uAvatarGradientMaxY = avatarGradientUniforms.maxY;
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
      uniform float uAvatarGradientEnabled;
      uniform vec3 uAvatarGradientTop;
      uniform vec3 uAvatarGradientMiddle;
      uniform vec3 uAvatarGradientBottom;
      uniform float uAvatarGradientMinY;
      uniform float uAvatarGradientMaxY;
      varying vec3 vEnergyWorldPosition;

      vec3 cyberSubinAvatarGradient(float heightAmount) {
        float resolvedHeight = clamp(heightAmount, 0.0, 1.0);
        if (resolvedHeight < 0.5) {
          return mix(uAvatarGradientBottom, uAvatarGradientMiddle, resolvedHeight * 2.0);
        }
        return mix(uAvatarGradientMiddle, uAvatarGradientTop, (resolvedHeight - 0.5) * 2.0);
      }

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
        if (uAvatarGradientEnabled > 0.5) {
          float avatarHeight = (vEnergyWorldPosition.y - uAvatarGradientMinY)
            / max(0.001, uAvatarGradientMaxY - uAvatarGradientMinY);
          outgoingLight *= cyberSubinAvatarGradient(avatarHeight);
        }
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
  material.customProgramCacheKey = () => 'cyber-subin-avatar-gradient-energy-surface-v3';
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
      material.fog = false;
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
  state.skeletonLineColors = null;
  state.skeletonJoints = null;
  state.pointCloudGroup = null;
  state.pointCloudEntries = [];
}

function updateAvatarPointCloud() {
  if (!state.pointCloudGroup?.visible) return;
  const gradientEnabled = state.avatarColor === 'custom';
  const solidColor = getAvatarRepresentationColor();
  for (const entry of state.pointCloudEntries) {
    entry.source.updateWorldMatrix(true, false);
    for (let pointIndex = 0; pointIndex < entry.vertexIndices.length; pointIndex += 1) {
      entry.source.getVertexPosition(entry.vertexIndices[pointIndex], tempAvatarVertex);
      tempAvatarVertex.applyMatrix4(entry.source.matrixWorld);
      const offset = pointIndex * 3;
      entry.positions[offset] = tempAvatarVertex.x;
      entry.positions[offset + 1] = tempAvatarVertex.y;
      entry.positions[offset + 2] = tempAvatarVertex.z;
      const color = gradientEnabled
        ? getAvatarGradientColor(tempAvatarVertex.y, tempColor)
        : tempColor.set(solidColor);
      entry.colors[offset] = color.r;
      entry.colors[offset + 1] = color.g;
      entry.colors[offset + 2] = color.b;
    }
    entry.points.geometry.attributes.position.needsUpdate = true;
    entry.points.geometry.attributes.color.needsUpdate = true;
  }
}

function updateAvatarSkeleton() {
  if (!state.skeletonGroup?.visible || !state.skeletonLine || !state.skeletonJoints) return;
  state.root?.updateMatrixWorld(true);
  const gradientEnabled = state.avatarColor === 'custom';
  const solidColor = getAvatarRepresentationColor();

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
    const startColor = gradientEnabled
      ? getAvatarGradientColor(tempVector.y, tempColor)
      : tempColor.set(solidColor);
    state.skeletonLineColors[offset] = startColor.r;
    state.skeletonLineColors[offset + 1] = startColor.g;
    state.skeletonLineColors[offset + 2] = startColor.b;
    const endColor = gradientEnabled
      ? getAvatarGradientColor(tempVectorB.y, tempColor)
      : tempColor.set(solidColor);
    state.skeletonLineColors[offset + 3] = endColor.r;
    state.skeletonLineColors[offset + 4] = endColor.g;
    state.skeletonLineColors[offset + 5] = endColor.b;
  }
  const linePositionAttribute = state.skeletonLine.geometry.attributes.instanceStart;
  if (linePositionAttribute?.data) linePositionAttribute.data.needsUpdate = true;
  const lineColorAttribute = state.skeletonLine.geometry.attributes.instanceColorStart;
  if (lineColorAttribute?.data) lineColorAttribute.data.needsUpdate = true;

  for (let index = 0; index < state.skeletonBones.length; index += 1) {
    state.skeletonBones[index].getWorldPosition(tempVector);
    tempAvatarMatrix.makeTranslation(tempVector.x, tempVector.y, tempVector.z);
    state.skeletonJoints.setMatrixAt(index, tempAvatarMatrix);
    const jointColor = gradientEnabled
      ? getAvatarGradientColor(tempVector.y, tempColor)
      : tempColor.set(solidColor);
    state.skeletonJoints.setColorAt(index, jointColor);
  }
  state.skeletonJoints.instanceMatrix.needsUpdate = true;
  if (state.skeletonJoints.instanceColor) state.skeletonJoints.instanceColor.needsUpdate = true;
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
    const colors = new Float32Array(vertexIndices.length * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: '#ffffff',
        vertexColors: true,
        size: EMBEDDED_VIEW ? 0.02 : 0.018,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.98,
        depthWrite: false,
        fog: false
      })
    );
    points.frustumCulled = false;
    points.renderOrder = 6;
    pointCloudGroup.add(points);
    return { source, vertexIndices, positions, colors, points };
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
  const skeletonLineColors = new Float32Array(skeletonConnections.length * 6);
  const skeletonLineGeometry = new LineSegmentsGeometry();
  skeletonLineGeometry.setPositions(skeletonLinePositions);
  skeletonLineGeometry.setColors(skeletonLineColors);
  skeletonLineGeometry.instanceCount = skeletonConnections.length;
  const skeletonLine = new LineSegments2(
    skeletonLineGeometry,
    new LineMaterial({
      color: '#ffffff',
      vertexColors: true,
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
      color: '#ffffff',
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      fog: false
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
  state.skeletonLineColors = skeletonLineColors;
  state.skeletonJoints = skeletonJoints;
  scene.add(skeletonGroup);
}

function getAvatarRepresentationColor() {
  return state.avatarColor === 'custom'
    ? state.avatarGradientMiddle
    : AVATAR_COLORS[state.avatarColor] ?? AVATAR_COLORS.pearl;
}

function getAvatarGradientColor(worldY, target) {
  const height = THREE.MathUtils.clamp(
    (worldY - state.avatarOffsetY) / DISPLAY_HEIGHT,
    0,
    1
  );
  if (height < 0.5) {
    return target
      .set(state.avatarGradientBottom)
      .lerp(tempAvatarGradientColor.set(state.avatarGradientMiddle), height * 2);
  }
  return target
    .set(state.avatarGradientMiddle)
    .lerp(tempAvatarGradientColor.set(state.avatarGradientTop), (height - 0.5) * 2);
}

function applyAvatarAppearance() {
  const gradientEnabled = state.avatarColor === 'custom';
  const avatarColor = gradientEnabled
    ? '#ffffff'
    : AVATAR_COLORS[state.avatarColor] ?? AVATAR_COLORS.pearl;
  avatarGradientUniforms.enabled.value = gradientEnabled ? 1 : 0;
  avatarGradientUniforms.top.value.set(state.avatarGradientTop);
  avatarGradientUniforms.middle.value.set(state.avatarGradientMiddle);
  avatarGradientUniforms.bottom.value.set(state.avatarGradientBottom);
  avatarGradientUniforms.minY.value = state.avatarOffsetY;
  avatarGradientUniforms.maxY.value = state.avatarOffsetY + DISPLAY_HEIGHT;
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
  for (const entry of state.pointCloudEntries) entry.points.material.color.set('#ffffff');
  if (state.skeletonGroup) {
    state.skeletonGroup.visible = state.surfaceMode === 'skeleton';
    state.skeletonLine?.material.color.set('#ffffff');
    state.skeletonJoints?.material.color.set('#ffffff');
  }
  if (state.surfaceMode === 'points') updateAvatarPointCloud();
  if (state.surfaceMode === 'skeleton') updateAvatarSkeleton();
}

function closePeerControlMenus(except) {
  if (except !== 'avatar' && state.avatarStyleOpen) setAvatarStyleOpen(false);
  if (except !== 'camera' && state.cameraControlsOpen) setCameraControlsOpen(false);
  if (except !== 'line' && state.lineControlsOpen) setLineControlsOpen(false);
  if (except !== 'visualization' && state.visualizationMenuOpen) setVisualizationMenu(false);
  if (except !== 'flowField' && state.flowFieldMenuOpen) setFlowFieldMenu(false);
}

function setAvatarStyleOpen(open) {
  if (open) closePeerControlMenus('avatar');
  state.avatarStyleOpen = open;
  ui.avatarStyleToggle.setAttribute('aria-expanded', String(open));
  ui.avatarStyleStatus.textContent = open ? 'OPEN' : 'SHOW';
  ui.avatarStylePanel.hidden = !open;
  applyAvatarScreenOffset();
}

function setAvatarColor(color, activeButton) {
  if (!(color in AVATAR_COLORS)) return;
  state.avatarColor = color;
  const resolvedColor = AVATAR_COLORS[color];
  state.avatarGradientTop = resolvedColor;
  state.avatarGradientMiddle = resolvedColor;
  state.avatarGradientBottom = resolvedColor;
  ui.avatarGradientInputs.forEach((input) => {
    input.value = resolvedColor;
  });
  ui.avatarSolidColorInput.value = resolvedColor;
  ui.avatarColorButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
  applyAvatarAppearance();
}

function setAvatarSolidColor(color) {
  const resolvedColor = normalizeHexColor(color, state.avatarGradientMiddle);
  ui.avatarSolidColorInput.value = resolvedColor;
  setAvatarGradientColors([resolvedColor, resolvedColor, resolvedColor]);
}

function setAvatarGradientColors(colors) {
  const fallbacks = [
    state.avatarGradientTop,
    state.avatarGradientMiddle,
    state.avatarGradientBottom
  ];
  const resolvedColors = fallbacks.map((fallback, index) => (
    normalizeHexColor(colors?.[index], fallback)
  ));
  [state.avatarGradientTop, state.avatarGradientMiddle, state.avatarGradientBottom] = resolvedColors;
  state.avatarColor = 'custom';
  ui.avatarGradientInputs.forEach((input, index) => {
    input.value = resolvedColors[index];
  });
  ui.avatarSolidColorInput.value = resolvedColors[1];
  ui.avatarColorButtons.forEach((button) => button.classList.remove('active'));
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
  const color = state.lightingColor === 'custom'
    ? {
        light: state.lightingCustomColor,
        ground: customLightingGroundColor.set(state.lightingCustomColor).multiplyScalar(0.035)
      }
    : LIGHTING_COLOR_PRESETS[state.lightingColor];
  const lightColor = color?.light;
  const intensity = state.lightingIntensity;
  ambient.color.set(lightColor ?? preset.hemisphere[0]);
  ambient.groundColor.set(color?.ground ?? preset.hemisphere[1]);
  ambient.intensity = preset.hemisphere[2] * intensity;
  keyLight.color.set(lightColor ?? preset.key[0]);
  keyLight.intensity = preset.key[1] * intensity;
  keyLight.position.fromArray(preset.key[2]);
  rimLight.color.set(lightColor ?? preset.rim[0]);
  rimLight.intensity = preset.rim[1] * intensity;
  rimLight.position.fromArray(preset.rim[2]);
  fillLight.color.set(lightColor ?? preset.fill[0]);
  fillLight.intensity = preset.fill[1] * intensity;
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
  const selectedColor = LIGHTING_COLOR_PRESETS[name]?.light ?? LIGHTING_PRESETS[state.lightingPreset]?.key[0];
  if (selectedColor) ui.lightingCustomColorInput.value = selectedColor;
  applyLightingSetup();
  ui.lightingColorButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
}

function setCustomLightingColor(color) {
  const resolvedColor = normalizeHexColor(color, state.lightingCustomColor);
  state.lightingColor = 'custom';
  state.lightingCustomColor = resolvedColor;
  ui.lightingCustomColorInput.value = resolvedColor;
  ui.lightingColorButtons.forEach((button) => button.classList.remove('active'));
  applyLightingSetup();
}

function setLightingIntensity(value) {
  const minimum = Number(ui.lightingIntensityInput.min);
  const maximum = Number(ui.lightingIntensityInput.max);
  const intensity = THREE.MathUtils.clamp(Number(value) || 0, minimum, maximum);
  const progress = ((intensity - minimum) / Math.max(0.001, maximum - minimum)) * 100;
  state.lightingIntensity = Number(intensity.toFixed(2));
  ui.lightingIntensityInput.value = String(state.lightingIntensity);
  ui.lightingIntensityInput.style.setProperty('--flow-slider-progress', `${progress}%`);
  ui.lightingIntensityValue.textContent = `${Math.round(state.lightingIntensity * 100)}%`;
  applyLightingSetup();
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
    avatarGradientTop: state.avatarGradientTop,
    avatarGradientMiddle: state.avatarGradientMiddle,
    avatarGradientBottom: state.avatarGradientBottom,
    surfaceMode: state.surfaceMode,
    lightingPreset: state.lightingPreset,
    lightingColor: state.lightingColor,
    lightingCustomColor: state.lightingCustomColor,
    lightingIntensity: state.lightingIntensity,
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
    bodyCenterLocked: state.bodyCenterLocked,
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
    flowFieldEnabled: state.flowFieldEnabled,
    flowFieldMenuOpen: state.flowFieldMenuOpen,
    sequence: getSequenceIds().join(','),
    sequenceActive: state.sequenceActive,
    sequenceTimelineOpen: state.sequenceTimelineOpen,
    sequenceTransitionDuration: state.sequenceTransitionDuration,
    sequenceTransitionEasing: state.sequenceTransitionEasing,
    sequenceTransitionDurations: state.sequence.map((entry) => entry.transitionDuration).join(','),
    sequenceTransitionEasings: state.sequence.map((entry) => entry.transitionEasing).join(','),
    sequencePlaybackSpeeds: state.sequence.map((entry) => entry.playbackSpeed).join(','),
    sequenceLoopMode: state.sequenceLoopMode,
    flowFieldSpeed: state.flowFieldSpeed,
    flowFieldCount: state.flowFieldCount,
    flowFieldGradient: state.flowFieldGradient,
    flowFieldColorStart: state.flowFieldColorStart,
    flowFieldColorMiddle: state.flowFieldColorMiddle,
    flowFieldColorEnd: state.flowFieldColorEnd,
    flowFieldThickness: state.flowFieldThickness,
    flowFieldOpacity: state.flowFieldOpacity,
    flowFieldTrailLength: state.flowFieldTrailLength,
    flowFieldTrailFade: state.flowFieldTrailFade,
    flowFieldStrokeLength: state.flowFieldStrokeLength,
    flowFieldCurvature: state.flowFieldCurvature,
    flowFieldColorVariation: state.flowFieldColorVariation,
    flowFieldInfluence: state.flowFieldInfluence,
    flowFieldBodyFlow: state.flowFieldBodyFlow,
    flowFieldRecovery: state.flowFieldRecovery,
    flowFieldProximityFade: state.flowFieldProximityFade,
    flowFieldConcentration: state.flowFieldConcentration,
    controlsHidden: document.body.classList.contains('controls-hidden'),
    interfaceHidden: document.body.classList.contains('interface-hidden')
  };
}

function syncShareableUrl() {
  if (EMBEDDED_VIEW || !state.ready) return;
  const url = new URL(window.location.href);
  const experiments = EXPERIMENT_KEYS.filter((key) => state.activeExperiments.has(key));
  const { progress } = getPlaybackTiming();
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
  if (view.avatarColor === 'custom') {
    setAvatarGradientColors([
      view.avatarGradientTop,
      view.avatarGradientMiddle,
      view.avatarGradientBottom
    ]);
  } else if (view.avatarColor) {
    setAvatarColor(view.avatarColor, ui.avatarColorButtons.find((button) => button.dataset.avatarColor === view.avatarColor));
  }
  if (view.surfaceMode) {
    setAvatarSurface(view.surfaceMode, ui.avatarSurfaceButtons.find((button) => button.dataset.avatarSurface === view.surfaceMode));
  }
  if (view.lightingPreset) {
    setLightingPreset(view.lightingPreset, ui.lightingPresetButtons.find((button) => button.dataset.lightingPreset === view.lightingPreset));
  }
  if (view.lightingColor === 'custom') {
    setCustomLightingColor(view.lightingCustomColor);
  } else if (view.lightingColor) {
    setLightingColor(view.lightingColor, ui.lightingColorButtons.find((button) => button.dataset.lightingColor === view.lightingColor));
  }
  if (Number.isFinite(Number(view.lightingIntensity))) setLightingIntensity(view.lightingIntensity);
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
  if (typeof view.bodyCenterLocked === 'boolean') setBodyCenterLocked(view.bodyCenterLocked);
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
  if (Number.isFinite(Number(view.sequenceTransitionDuration))) {
    setSequenceTransitionDuration(Number(view.sequenceTransitionDuration));
  }
  if (typeof view.sequenceTransitionEasing === 'string') {
    setSequenceTransitionEasing(view.sequenceTransitionEasing);
  }
  if (typeof view.sequenceLoopMode === 'string') {
    setSequenceLoopMode(view.sequenceLoopMode);
  }
  if (typeof view.sequence === 'string') {
    const nextSequenceIds = parseSequenceEntries(view.sequence).map((entry) => entry.movementId);
    const nextDurations = String(view.sequenceTransitionDurations ?? '')
      .split(',')
      .map(Number);
    const nextEasings = String(view.sequenceTransitionEasings ?? '').split(',');
    const nextPlaybackSpeeds = String(view.sequencePlaybackSpeeds ?? '')
      .split(',')
      .map(Number);
    const nextEntries = nextSequenceIds.map((movementId, index) => createSequenceEntry(movementId, {
      duration: Number.isFinite(nextDurations[index]) && nextDurations[index] > 0
        ? nextDurations[index]
        : view.sequenceTransitionDuration,
      easing: nextEasings[index] || view.sequenceTransitionEasing,
      speed: PLAYBACK_SPEED_OPTIONS.includes(nextPlaybackSpeeds[index])
        ? nextPlaybackSpeeds[index]
        : state.speed
    })).filter(Boolean);
    const currentDurations = state.sequence.map((entry) => entry.transitionDuration).join(',');
    const currentEasings = state.sequence.map((entry) => entry.transitionEasing).join(',');
    const currentPlaybackSpeeds = state.sequence.map((entry) => entry.playbackSpeed).join(',');
    const sequenceChanged = nextSequenceIds.join(',') !== getSequenceIds().join(',')
      || nextEntries.map((entry) => entry.transitionDuration).join(',') !== currentDurations
      || nextEntries.map((entry) => entry.transitionEasing).join(',') !== currentEasings
      || nextEntries.map((entry) => entry.playbackSpeed).join(',') !== currentPlaybackSpeeds;
    if (sequenceChanged) {
      state.sequenceLoadToken += 1;
      state.sequence = nextEntries;
      state.sequenceReady = false;
      state.sequencePreparing = false;
      state.sequenceActions = [];
      state.sequenceTransition = null;
      renderSequenceTimeline();
    }
    if (view.sequenceActive && state.sequence.length && (sequenceChanged || !state.sequenceActive)) {
      startSequence();
    } else if (view.sequenceActive === false && state.sequenceActive) {
      stopSequence({ reloadModel: !EMBEDDED_VIEW });
    }
  }
  if (typeof view.sequenceTimelineOpen === 'boolean') setSequenceTimelineOpen(view.sequenceTimelineOpen);
  const flowFieldViewControls = {
    thickness: view.flowFieldThickness,
    opacity: view.flowFieldOpacity,
    trailLength: view.flowFieldTrailLength,
    trailFade: view.flowFieldTrailFade,
    strokeLength: view.flowFieldStrokeLength,
    curvature: view.flowFieldCurvature,
    speed: view.flowFieldSpeed,
    count: view.flowFieldCount,
    colorVariation: view.flowFieldColorVariation,
    influence: view.flowFieldInfluence,
    bodyFlow: view.flowFieldBodyFlow,
    recovery: view.flowFieldRecovery,
    proximityFade: view.flowFieldProximityFade,
    concentration: view.flowFieldConcentration
  };
  for (const [control, value] of Object.entries(flowFieldViewControls)) {
    if (Number.isFinite(Number(value))) setFlowFieldSlider(control, Number(value));
  }
  if (view.flowFieldGradient === 'custom') {
    setFlowFieldColors([
      view.flowFieldColorStart,
      view.flowFieldColorMiddle,
      view.flowFieldColorEnd
    ]);
  } else if (view.flowFieldGradient) {
    setFlowFieldGradient(view.flowFieldGradient, ui.flowFieldGradientButtons.find((button) => button.dataset.flowGradient === view.flowFieldGradient));
  }
  if (typeof view.flowFieldEnabled === 'boolean') setFlowFieldEnabled(view.flowFieldEnabled);
  if (typeof view.flowFieldMenuOpen === 'boolean') setFlowFieldMenu(view.flowFieldMenuOpen);
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
    const { progress } = getPlaybackTiming();
    storedGridState.cells[focusedIndex] = {
      ...storedGridState.cells[focusedIndex],
      movement: state.sequenceActive && state.sequence.length
        ? state.sequence[0].movementId
        : MOVEMENTS[state.movementIndex]?.id ?? storedGridState.cells[focusedIndex].movement,
      effect: getGridEffectValue(experiments),
      effects: experiments,
      view: getCurrentViewState(experiments)
    };
    storedGridState.transport = {
      playing: state.playing,
      speed: state.speed,
      progress
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
  state.experimentTime += delta;
  if (state.flowFieldEnabled && !EMBEDDED_VIEW) {
    let minimumY = Infinity;
    let maximumY = -Infinity;
    let centerZ = 0;
    for (const tracker of state.trackers) {
      minimumY = Math.min(minimumY, tracker.anchorPosition.y);
      maximumY = Math.max(maximumY, tracker.anchorPosition.y);
      centerZ += tracker.anchorPosition.z;
    }
    flowFieldCenter.set(
      state.avatarOffsetX,
      Number.isFinite(minimumY) && Number.isFinite(maximumY)
        ? (minimumY + maximumY) * 0.5
        : DISPLAY_HEIGHT * 0.5 + state.avatarOffsetY,
      state.trackers.length ? centerZ / state.trackers.length : 0
    );
    camera.updateMatrixWorld();
    flowFieldDirection.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    camera.getWorldDirection(flowFieldViewDirection);
    updateFlowField(flowFieldVisual, {
      delta,
      time: state.experimentTime,
      trackers: state.trackers,
      center: flowFieldCenter,
      flowDirection: flowFieldDirection,
      viewDirection: flowFieldViewDirection
    });
  }
  if (!state.experimentVisuals) return;
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
  const interfaceVisible = !document.body.classList.contains('interface-hidden');
  const wideLayout = window.innerWidth > 860;
  const analysisInset = !EMBEDDED_VIEW
    && state.analysisVisible
    && interfaceVisible
    && wideLayout
    ? Math.min(state.analysisWidth, width * 0.72)
    : 0;
  const leftPanelOpen = state.avatarStyleOpen
    || state.cameraControlsOpen
    || state.lineControlsOpen
    || state.visualizationMenuOpen
    || state.flowFieldMenuOpen;
  let leftInset = 0;
  if (
    !EMBEDDED_VIEW
    && leftPanelOpen
    && interfaceVisible
    && wideLayout
    && !document.body.classList.contains('controls-hidden')
    && ui.viewerOptions
  ) {
    const sceneBounds = ui.sceneWrap.getBoundingClientRect();
    const leftPanelBounds = ui.viewerOptions.getBoundingClientRect();
    leftInset = THREE.MathUtils.clamp(
      leftPanelBounds.right - sceneBounds.left,
      0,
      width * 0.72
    );
  }
  const interfaceCenterShift = (leftInset - analysisInset) / 2;
  const screenX = (state.avatarOffsetX / 2.4) * width * 0.32 + interfaceCenterShift;
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

function updateAxisWidget() {
  if (!ui.axisWidget || EMBEDDED_VIEW) return;

  axisWidgetQuaternion.copy(camera.quaternion).invert();
  for (const axis of AXIS_WIDGET_AXES) {
    axisWidgetDirection.copy(axis.direction).applyQuaternion(axisWidgetQuaternion);
    const screenX = axisWidgetDirection.x;
    const screenY = -axisWidgetDirection.y;
    const planarLength = Math.hypot(screenX, screenY);
    const angle = planarLength > 0.0001 ? Math.atan2(screenY, screenX) : 0;
    const lineLength = 7 + planarLength * 12;
    const labelDistance = lineLength + 5;

    ui.axisWidget.style.setProperty(`--axis-${axis.key}-angle`, `${angle}rad`);
    ui.axisWidget.style.setProperty(`--axis-${axis.key}-length`, `${lineLength.toFixed(2)}px`);
    ui.axisWidget.style.setProperty(
      `--axis-${axis.key}-label-x`,
      `${(AXIS_WIDGET_ORIGIN.x + Math.cos(angle) * labelDistance).toFixed(2)}px`
    );
    ui.axisWidget.style.setProperty(
      `--axis-${axis.key}-label-y`,
      `${(AXIS_WIDGET_ORIGIN.y + Math.sin(angle) * labelDistance).toFixed(2)}px`
    );
  }
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
  if (!state.bodyCenterLocked) return;
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
  state.modelMovementId = movement.id;
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
  flowFieldCenter.set(state.avatarOffsetX, DISPLAY_HEIGHT * 0.5 + state.avatarOffsetY, 0);
  resetFlowField(flowFieldVisual, flowFieldCenter);
  setFlowFieldOptions(flowFieldVisual, { enabled: state.flowFieldEnabled && !EMBEDDED_VIEW });
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

  const firstSequenceMovement = getSequenceMovement(state.sequence[0]);
  if (state.sequenceActive && firstSequenceMovement?.id === movement.id) {
    void initializeSequencePlayback();
  }

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

function getPlaybackTiming() {
  if (state.sequenceActive && state.sequenceReady) {
    const duration = getSequenceTotalDuration();
    const currentTime = THREE.MathUtils.clamp(getSequenceElapsedTime(), 0, duration);
    return {
      currentTime,
      duration,
      progress: duration ? currentTime / duration : 0
    };
  }
  const currentTime = Math.max(0, (state.action?.time ?? state.clipStart) - state.clipStart);
  const duration = Math.max(0, state.duration - state.clipStart);
  return {
    currentTime,
    duration,
    progress: duration ? currentTime / duration : 0
  };
}

function setPlaying(playing) {
  if (playing && state.sequenceEnded && state.sequenceActive && state.sequenceReady) {
    setSequenceRuntime(0, 0, { preserveTrails: true });
  }
  state.playing = playing;
  if (state.sequencePreparing) state.sequenceResumePlaying = playing;
  ui.playButton.classList.toggle('paused', !playing);
  ui.playButton.setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation');
}

function updatePlaybackSpeedButtons(speed) {
  ui.speedButtons.forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.speed) === speed);
  });
}

function setPlaybackSpeed(speed) {
  if (!Number.isFinite(speed) || speed <= 0) return;
  state.speed = speed;
  if ((state.sequenceActive || state.sequenceTimelineOpen) && state.sequence[state.sequenceIndex]) {
    state.sequence[state.sequenceIndex].playbackSpeed = speed;
    renderSequenceTimeline();
  }
  updatePlaybackSpeedButtons(speed);
}

function seekToProgress(progress) {
  if (state.sequenceActive) {
    const normalizedProgress = THREE.MathUtils.clamp(Number(progress) || 0, 0, 1);
    if (!state.sequenceReady) {
      state.sequencePendingProgress = normalizedProgress;
      return;
    }
    seekSequenceToProgress(normalizedProgress);
    return;
  }
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

function setBodyCenterLocked(locked) {
  const nextLocked = Boolean(locked);
  const changed = state.bodyCenterLocked !== nextLocked;
  state.bodyCenterLocked = nextLocked;
  ui.bodyCenteringToggle.setAttribute('aria-pressed', String(nextLocked));
  ui.bodyCenteringToggle.setAttribute(
    'aria-label',
    nextLocked ? 'Allow the avatar to move through space' : 'Fix the avatar in the center'
  );
  ui.bodyCenteringStatus.textContent = nextLocked ? 'FIXED CENTER' : 'MOVE IN SPACE';
  if (nextLocked && state.root) {
    centerCharacter();
    state.root.updateMatrixWorld(true);
  }
  if (changed && state.ready) {
    resetTrackerSamples({ preserveTrails: true });
    updateMotionSignals(1 / 30, false, false);
  }
}

function setAvatarPosition(nextX, nextY) {
  const clampedX = THREE.MathUtils.clamp(nextX, -2.4, 2.4);
  const clampedY = THREE.MathUtils.clamp(nextY, -1.2, 1.8);
  const deltaX = clampedX - state.avatarOffsetX;
  const deltaY = clampedY - state.avatarOffsetY;
  state.avatarOffsetX = clampedX;
  state.avatarOffsetY = clampedY;
  avatarGradientUniforms.minY.value = clampedY;
  avatarGradientUniforms.maxY.value = clampedY + DISPLAY_HEIGHT;

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
  applyAvatarScreenOffset();
}

function setLineControlsOpen(open) {
  if (open) closePeerControlMenus('line');
  state.lineControlsOpen = open;
  ui.lineControlsToggle.setAttribute('aria-expanded', String(open));
  ui.lineControlsStatus.textContent = open ? 'OPEN' : 'SHOW';
  ui.lineControlsPanel.hidden = !open;
  applyAvatarScreenOffset();
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
  requestAnimationFrame(resize);
}

function setVisualizationMenu(open) {
  if (open) closePeerControlMenus('visualization');
  state.visualizationMenuOpen = open;
  ui.visualizationMenuToggle.setAttribute('aria-expanded', String(open));
  ui.visualizationMenuStatus.textContent = open ? 'OPEN' : 'SHOW';
  ui.visualizationMenuPanel.hidden = !open;
  applyAvatarScreenOffset();
}

function updateFlowFieldDescription() {
  if (!state.flowFieldEnabled) {
    ui.flowFieldDescription.textContent = 'OFF · ENABLE PARTICLES TO REVEAL MOVEMENT-GENERATED CURRENTS + DECAYING TURBULENT STREAMS';
    return;
  }
  const gradient = state.flowFieldGradient.toUpperCase();
  const proximity = state.flowFieldProximityFade <= 0.001
    ? 'EVEN VISIBILITY'
    : `${state.flowFieldProximityFade.toFixed(2)}× PROXIMITY FADE`;
  const concentration = state.flowFieldConcentration <= 0.001
    ? 'UNIFORM FIELD'
    : `${state.flowFieldConcentration.toFixed(2)}× AVATAR CONCENTRATION`;
  const opacity = `${Math.round(state.flowFieldOpacity * 100)}% OPACITY`;
  ui.flowFieldDescription.textContent = `${state.flowFieldCount.toLocaleString()} STROKES · ${state.flowFieldSpeed.toFixed(2)}× FLOW · ${state.flowFieldCurvature.toFixed(2)}× CURVE INERTIA · ${state.flowFieldBodyFlow.toFixed(2)}× AVATAR WRAP · ${state.flowFieldInfluence.toFixed(2)}× WAKE · ${opacity} · ${concentration} · ${proximity} · ${gradient}`;
}

function setFlowFieldMenu(open) {
  if (open) closePeerControlMenus('flowField');
  state.flowFieldMenuOpen = open;
  ui.flowFieldMenuToggle.setAttribute('aria-expanded', String(open));
  ui.flowFieldMenuStatus.textContent = open ? 'OPEN' : state.flowFieldEnabled ? 'ON' : 'SHOW';
  ui.flowFieldMenuPanel.hidden = !open;
  applyAvatarScreenOffset();
}

function setFlowFieldEnabled(enabled) {
  state.flowFieldEnabled = Boolean(enabled);
  ui.flowFieldDisplayToggle.setAttribute('aria-pressed', String(state.flowFieldEnabled));
  ui.flowFieldDisplayToggle.setAttribute(
    'aria-label',
    state.flowFieldEnabled ? 'Hide flow field' : 'Show flow field'
  );
  ui.flowFieldDisplayStatus.textContent = state.flowFieldEnabled ? 'ON' : 'OFF';
  ui.flowFieldEnabledButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.flowEnabled === String(state.flowFieldEnabled));
  });
  setFlowFieldOptions(flowFieldVisual, {
    enabled: state.flowFieldEnabled && state.ready && !EMBEDDED_VIEW
  });
  if (state.flowFieldEnabled && !flowFieldVisual.initialized) {
    flowFieldCenter.set(state.avatarOffsetX, DISPLAY_HEIGHT * 0.5 + state.avatarOffsetY, 0);
    resetFlowField(flowFieldVisual, flowFieldCenter);
  }
  if (!state.flowFieldMenuOpen) ui.flowFieldMenuStatus.textContent = state.flowFieldEnabled ? 'ON' : 'SHOW';
  updateFlowFieldDescription();
}

function resetFlowFieldParticles() {
  flowFieldCenter.set(state.avatarOffsetX, DISPLAY_HEIGHT * 0.5 + state.avatarOffsetY, 0);
  resetFlowField(flowFieldVisual, flowFieldCenter);
}

function setFlowFieldSlider(control, value) {
  const config = FLOW_FIELD_SLIDER_CONFIG[control];
  const input = ui.flowFieldSliders.find((candidate) => candidate.dataset.flowFieldSlider === control);
  const numericValue = Number(value);
  if (!config || !input || !Number.isFinite(numericValue)) return;
  const minimum = Number(input.min);
  const maximum = Number(input.max);
  const resolvedValue = control === 'count'
    ? Math.round(THREE.MathUtils.clamp(numericValue, minimum, maximum) / 100) * 100
    : Number(THREE.MathUtils.clamp(numericValue, minimum, maximum).toFixed(3));
  const progress = ((resolvedValue - minimum) / Math.max(0.0001, maximum - minimum)) * 100;

  state[config.stateKey] = resolvedValue;
  input.value = String(resolvedValue);
  input.style.setProperty('--flow-slider-progress', `${progress}%`);
  const output = ui.flowFieldValues.get(control);
  if (output) output.textContent = config.format(resolvedValue);
  setFlowFieldOptions(flowFieldVisual, { [config.optionKey]: resolvedValue });
  updateFlowFieldDescription();
}

function normalizeHexColor(value, fallback) {
  const candidate = String(value ?? '').trim();
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate.toLowerCase() : fallback;
}

function setFlowFieldColors(colors) {
  const fallbacks = [
    state.flowFieldColorStart,
    state.flowFieldColorMiddle,
    state.flowFieldColorEnd
  ];
  const resolvedColors = fallbacks.map((fallback, index) => (
    normalizeHexColor(colors?.[index], fallback)
  ));
  [state.flowFieldColorStart, state.flowFieldColorMiddle, state.flowFieldColorEnd] = resolvedColors;
  state.flowFieldGradient = 'custom';
  ui.flowFieldColorInputs.forEach((input, index) => {
    input.value = resolvedColors[index];
  });
  ui.flowFieldGradientButtons.forEach((button) => button.classList.remove('active'));
  setFlowFieldOptions(flowFieldVisual, { colors: resolvedColors });
  updateFlowFieldDescription();
}

function setFlowFieldGradient(gradient, activeButton) {
  if (!(gradient in FLOW_FIELD_GRADIENTS)) return;
  state.flowFieldGradient = gradient;
  const colors = FLOW_FIELD_GRADIENTS[gradient];
  [state.flowFieldColorStart, state.flowFieldColorMiddle, state.flowFieldColorEnd] = colors;
  ui.flowFieldColorInputs.forEach((input, index) => {
    input.value = colors[index];
  });
  ui.flowFieldGradientButtons.forEach((button) => button.classList.toggle('active', button === activeButton));
  setFlowFieldOptions(flowFieldVisual, { gradient });
  updateFlowFieldDescription();
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
  if (state.sequenceActive && state.sequenceReady) {
    setSequenceRuntime(0, 0);
  } else if (state.action) {
    state.action.reset().play();
    state.action.time = state.clipStart;
    state.mixer.update(0);
    state.lastClipTime = state.clipStart;
    centerCharacter();
    resetTrackerSamples();
  }
  flowFieldCenter.set(state.avatarOffsetX, DISPLAY_HEIGHT * 0.5 + state.avatarOffsetY, 0);
  resetFlowField(flowFieldVisual, flowFieldCenter);
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
  const timing = getPlaybackTiming();
  ui.currentTime.textContent = formatTime(timing.currentTime);
  ui.totalTime.textContent = formatTime(timing.duration);
  if (!ui.timeline.matches(':active')) {
    ui.timeline.value = state.sequenceActive && state.sequenceReady
      ? String(timing.currentTime)
      : String(state.action?.time ?? state.clipStart);
  }
  ui.timeline.style.setProperty('--progress', `${timing.progress * 100}%`);
}

function notifyEmbeddedTransport(delta) {
  if (!EMBEDDED_VIEW || !EMBEDDED_TRANSPORT_SOURCE || !state.ready) return;
  state.embeddedTransportElapsed += delta;
  if (state.embeddedTransportElapsed < 0.1) return;
  state.embeddedTransportElapsed = 0;

  const { currentTime, duration, progress } = getPlaybackTiming();
  window.parent.postMessage({
    source: 'cyber-subin-avatar',
    type: 'transport',
    currentTime,
    duration,
    progress,
    playing: state.playing,
    speed: state.speed
  }, window.location.origin);
}

function animate() {
  const rawDelta = Math.min(clock.getDelta(), 0.08);

  if (state.ready && state.mixer && state.action && state.playing) {
    let looped = false;
    if (state.sequenceActive && state.sequenceReady) {
      looped = advanceSequencePlayback(rawDelta * state.speed);
    } else {
      state.mixer.update(rawDelta * state.speed);
      const clipTime = state.action.time;
      looped = clipTime + 0.03 < state.lastClipTime;
      if (looped) {
        state.action.time = state.clipStart;
        state.mixer.update(0);
        state.lastClipTime = state.clipStart;
      } else {
        state.lastClipTime = clipTime;
      }
    }
    centerCharacter();
    if (looped && !(state.sequenceActive && state.sequenceReady)) resetTrackerSamples();

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
  updateAxisWidget();
  if (!EMBEDDED_VIEW && state.ready) {
    shareUrlElapsed += rawDelta;
    if (shareUrlElapsed >= 0.25) {
      shareUrlElapsed = 0;
      syncShareableUrl();
    }
  }
  if (state.ready && state.surfaceMode === 'points') updateAvatarPointCloud();
  if (state.ready && state.surfaceMode === 'skeleton') updateAvatarSkeleton();
  updateSequenceProgressIndicators();
  updateTransport();
  if (!EMBEDDED_VIEW) drawSignalCharts();
  renderer.render(scene, camera);
  notifyEmbeddedTransport(rawDelta);
}

ui.select.addEventListener('change', () => {
  const movementIndex = MOVEMENTS.findIndex((movement) => movement.id === ui.select.value);
  updateAddToSequenceAvailability();
  if (movementIndex >= 0) {
    if (state.sequenceActive) stopSequence({ reloadModel: false });
    loadModel(movementIndex);
  }
});
ui.addToSequence.addEventListener('click', addSelectedMovementToSequence);
ui.sequenceTimelineToggle.addEventListener('click', () => setSequenceTimelineOpen(!state.sequenceTimelineOpen));
ui.sequenceTimelineClose.addEventListener('click', () => setSequenceTimelineOpen(false));
ui.sequencePlay.addEventListener('click', () => {
  if (state.sequenceActive) stopSequence();
  else {
    state.sequenceResumePlaying = true;
    startSequence();
  }
});
ui.sequenceClear.addEventListener('click', clearSequence);
ui.applySequenceSpeedAll.addEventListener('click', applyPlaybackSpeedToAllSequenceEntries);
for (const button of ui.sequenceDurationButtons) {
  button.addEventListener('click', () => setSequenceTransitionDuration(button.dataset.sequenceDuration));
}
for (const button of ui.sequenceEasingButtons) {
  button.addEventListener('click', () => setSequenceTransitionEasing(button.dataset.sequenceEasing));
}
ui.sequenceTrack.addEventListener('click', (event) => {
  const loopModeButton = event.target.closest('[data-sequence-loop-mode]');
  if (loopModeButton) {
    setSequenceLoopMode(loopModeButton.dataset.sequenceLoopMode);
    return;
  }
  const easingButton = event.target.closest('[data-sequence-transition-easing]');
  if (easingButton) {
    setSequenceEntryTransitionEasing(
      Number(easingButton.dataset.sequenceTransitionIndex),
      easingButton.dataset.sequenceTransitionEasing
    );
    return;
  }
  const transitionButton = event.target.closest('[data-sequence-transition]');
  if (transitionButton) {
    previewSequenceTransition(Number(transitionButton.dataset.sequenceTransition));
    return;
  }
  const actionButton = event.target.closest('[data-sequence-action]');
  if (!actionButton) return;
  const index = Number(actionButton.closest('[data-sequence-index]')?.dataset.sequenceIndex);
  if (actionButton.dataset.sequenceAction === 'add') addSelectedMovementToSequence();
  if (actionButton.dataset.sequenceAction === 'remove') removeSequenceEntry(index);
  if (actionButton.dataset.sequenceAction === 'left') moveSequenceEntry(index, -1);
  if (actionButton.dataset.sequenceAction === 'right') moveSequenceEntry(index, 1);
  if (actionButton.dataset.sequenceAction === 'jump') jumpToSequenceClip(index);
});
ui.sequenceTrack.addEventListener('change', (event) => {
  const playbackSpeed = event.target.closest('[data-sequence-playback-speed]');
  if (playbackSpeed) {
    setSequenceEntryPlaybackSpeed(
      Number(playbackSpeed.dataset.sequencePlaybackSpeed),
      playbackSpeed.value
    );
    return;
  }
  const transitionDuration = event.target.closest('[data-sequence-transition-duration]');
  if (transitionDuration) {
    setSequenceEntryTransitionDuration(
      Number(transitionDuration.dataset.sequenceTransitionDuration),
      transitionDuration.value
    );
    return;
  }
  const select = event.target.closest('[data-sequence-movement]');
  if (!select) return;
  const index = Number(select.closest('[data-sequence-index]')?.dataset.sequenceIndex);
  editSequenceEntry(index, select.value);
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
ui.flowFieldMenuToggle.addEventListener('click', () => setFlowFieldMenu(!state.flowFieldMenuOpen));
ui.flowFieldMenuClose.addEventListener('click', () => setFlowFieldMenu(false));
ui.flowFieldDisplayToggle.addEventListener('click', () => setFlowFieldEnabled(!state.flowFieldEnabled));
ui.flowFieldResetButton.addEventListener('click', resetFlowFieldParticles);

ui.timeline.addEventListener('input', () => {
  if (!state.action || !state.mixer) return;
  if (state.sequenceActive) {
    const totalDuration = getSequenceTotalDuration();
    seekSequenceToProgress(totalDuration ? Number(ui.timeline.value) / totalDuration : 0);
    return;
  }
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

ui.avatarSolidColorInput.addEventListener('input', () => {
  setAvatarSolidColor(ui.avatarSolidColorInput.value);
});

for (const input of ui.avatarGradientInputs) {
  input.addEventListener('input', () => {
    const colors = ui.avatarGradientInputs.map((candidate) => candidate.value);
    setAvatarGradientColors(colors);
  });
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

ui.lightingCustomColorInput.addEventListener('input', () => {
  setCustomLightingColor(ui.lightingCustomColorInput.value);
});

ui.lightingIntensityInput.addEventListener('input', () => {
  setLightingIntensity(ui.lightingIntensityInput.value);
});

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

for (const button of ui.flowFieldEnabledButtons) {
  button.addEventListener('click', () => setFlowFieldEnabled(button.dataset.flowEnabled === 'true'));
}

for (const input of ui.flowFieldSliders) {
  input.addEventListener('input', () => setFlowFieldSlider(input.dataset.flowFieldSlider, input.value));
}

for (const input of ui.flowFieldColorInputs) {
  input.addEventListener('input', () => {
    const colors = ui.flowFieldColorInputs.map((candidate) => candidate.value);
    setFlowFieldColors(colors);
  });
}

for (const button of ui.flowFieldGradientButtons) {
  button.addEventListener('click', () => setFlowFieldGradient(button.dataset.flowGradient, button));
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
ui.bodyCenteringToggle.addEventListener('click', () => setBodyCenterLocked(!state.bodyCenterLocked));

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
    if (state.sequenceActive) stopSequence({ reloadModel: false });
    loadModel((state.movementIndex + 1) % MOVEMENTS.length);
  } else if (event.key === 'ArrowLeft') {
    if (state.sequenceActive) stopSequence({ reloadModel: false });
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
setLightingIntensity(DEFAULT_LIGHTING_INTENSITY);
setCameraControlsOpen(false);
setLineControlsOpen(false);
setVisualizationMenu(false);
setFlowFieldSlider('thickness', DEFAULT_FLOW_FIELD_THICKNESS);
setFlowFieldSlider('opacity', DEFAULT_FLOW_FIELD_OPACITY);
setFlowFieldSlider('trailLength', DEFAULT_FLOW_FIELD_TRAIL_LENGTH);
setFlowFieldSlider('trailFade', DEFAULT_FLOW_FIELD_TRAIL_FADE);
setFlowFieldSlider('strokeLength', DEFAULT_FLOW_FIELD_STROKE_LENGTH);
setFlowFieldSlider('curvature', DEFAULT_FLOW_FIELD_CURVATURE);
setFlowFieldSlider('speed', DEFAULT_FLOW_FIELD_SPEED);
setFlowFieldSlider('count', DEFAULT_FLOW_FIELD_COUNT);
setFlowFieldSlider('colorVariation', DEFAULT_FLOW_FIELD_COLOR_VARIATION);
setFlowFieldSlider('influence', DEFAULT_FLOW_FIELD_INFLUENCE);
setFlowFieldSlider('bodyFlow', DEFAULT_FLOW_FIELD_BODY_FLOW);
setFlowFieldSlider('recovery', DEFAULT_FLOW_FIELD_RECOVERY);
setFlowFieldSlider('proximityFade', DEFAULT_FLOW_FIELD_PROXIMITY_FADE);
setFlowFieldSlider('concentration', DEFAULT_FLOW_FIELD_CONCENTRATION);
setFlowFieldGradient(DEFAULT_FLOW_FIELD_GRADIENT, ui.flowFieldGradientButtons.find((button) => button.dataset.flowGradient === DEFAULT_FLOW_FIELD_GRADIENT));
setFlowFieldEnabled(false);
setFlowFieldMenu(false);
setTraceVisibility(false);
setBodyPointsVisibility(false);
setBodyCenterLocked(true);
renderSequenceTimeline();
setSequenceTimelineOpen(false);
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
