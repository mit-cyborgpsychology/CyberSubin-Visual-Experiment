const LEFT_FINGER_TRACKERS = Object.freeze([
  'leftThumb',
  'leftIndexFinger',
  'leftMiddleFinger',
  'leftRingFinger',
  'leftPinkyFinger'
]);

const RIGHT_FINGER_TRACKERS = Object.freeze([
  'rightThumb',
  'rightIndexFinger',
  'rightMiddleFinger',
  'rightRingFinger',
  'rightPinkyFinger'
]);

const INDEX_FINGER_TRACKERS = Object.freeze(['leftIndexFinger', 'rightIndexFinger']);
const OTHER_FINGER_TRACKERS = Object.freeze([
  ...LEFT_FINGER_TRACKERS.filter((id) => id !== 'leftIndexFinger'),
  ...RIGHT_FINGER_TRACKERS.filter((id) => id !== 'rightIndexFinger')
]);

function fingerEdgeDefinition(side, finger, id, label, color) {
  const prefix = `${side}Hand${finger}`;
  return Object.freeze({
    id,
    label,
    bones: Object.freeze([`${prefix}4_end`, `${prefix}4`, `${prefix}3`]),
    anchor: `${prefix}3`,
    edgePairs: Object.freeze([
      Object.freeze({ anchor: `${prefix}4_end`, from: `${prefix}4`, extension: 0 }),
      Object.freeze({ anchor: `${prefix}4`, from: `${prefix}3`, extension: 0.82 }),
      Object.freeze({ anchor: `${prefix}3`, from: `${prefix}2`, extension: 0.82 })
    ]),
    color
  });
}

export const TRACE_EXTRA_DEFINITIONS = Object.freeze([
  fingerEdgeDefinition('Left', 'Thumb', 'leftThumb', 'L THUMB', '#2fa9ff'),
  fingerEdgeDefinition('Left', 'Index', 'leftIndexFinger', 'L INDEX', '#43b4ff'),
  fingerEdgeDefinition('Left', 'Middle', 'leftMiddleFinger', 'L MIDDLE', '#57bfff'),
  fingerEdgeDefinition('Left', 'Ring', 'leftRingFinger', 'L RING', '#6bcaff'),
  fingerEdgeDefinition('Left', 'Pinky', 'leftPinkyFinger', 'L PINKY', '#7fd5ff'),
  fingerEdgeDefinition('Right', 'Thumb', 'rightThumb', 'R THUMB', '#2aa4fb'),
  fingerEdgeDefinition('Right', 'Index', 'rightIndexFinger', 'R INDEX', '#3eaffb'),
  fingerEdgeDefinition('Right', 'Middle', 'rightMiddleFinger', 'R MIDDLE', '#52bafb'),
  fingerEdgeDefinition('Right', 'Ring', 'rightRingFinger', 'R RING', '#66c5fb'),
  fingerEdgeDefinition('Right', 'Pinky', 'rightPinkyFinger', 'R PINKY', '#7ad0fb'),
  { id: 'bottom', label: 'BOTTOM', bones: ['Hips'], anchor: 'Hips', color: '#f4f4ef' }
]);

function footEdgePairs(side) {
  return Object.freeze([
    Object.freeze({ anchor: `${side}Toe_End_end`, from: `${side}Toe_End`, extension: 0 }),
    Object.freeze({ anchor: `${side}Toe_End`, from: `${side}ToeBase`, extension: 0 })
  ]);
}

export const TRACE_FOOT_EDGE_PAIRS = Object.freeze({
  left: footEdgePairs('Left'),
  right: footEdgePairs('Right')
});

export const TRACE_PART_TRACKER_IDS = Object.freeze({
  body: Object.freeze(['body']),
  bottom: Object.freeze(['bottom']),
  indexFinger: INDEX_FINGER_TRACKERS,
  otherFingers: OTHER_FINGER_TRACKERS,
  hand: Object.freeze(['leftHand', 'rightHand']),
  arm: Object.freeze(['leftArm', 'rightArm']),
  leg: Object.freeze(['leftLeg', 'rightLeg']),
  feet: Object.freeze(['leftFoot', 'rightFoot']),
  head: Object.freeze(['head'])
});

export const DEFAULT_TRACE_PARTS = Object.freeze([
  'body',
  'bottom',
  'indexFinger',
  'arm',
  'leg',
  'feet',
  'head'
]);

export const ALL_TRACE_PARTS = Object.freeze(Object.keys(TRACE_PART_TRACKER_IDS));

export const TRACE_PART_PRESETS = Object.freeze({
  default: DEFAULT_TRACE_PARTS,
  allFingers: Object.freeze(['indexFinger', 'otherFingers']),
  fingersHandsArms: Object.freeze(['indexFinger', 'otherFingers', 'hand', 'arm']),
  fullBody: ALL_TRACE_PARTS
});

export function resolveTraceEdgePair(definition, hasBone) {
  const containsBone = typeof hasBone === 'function'
    ? hasBone
    : (name) => hasBone?.has(name);
  return definition.edgePairs?.find(({ anchor, from }) => (
    containsBone(anchor) && containsBone(from)
  )) ?? null;
}

export function tracePartsMatch(parts, expectedParts) {
  const selected = parts instanceof Set ? parts : new Set(parts);
  return selected.size === expectedParts.length
    && expectedParts.every((part) => selected.has(part));
}

export function tracePartsIncludeTracker(trackerId, parts) {
  return [...parts].some((part) => TRACE_PART_TRACKER_IDS[part]?.includes(trackerId));
}
