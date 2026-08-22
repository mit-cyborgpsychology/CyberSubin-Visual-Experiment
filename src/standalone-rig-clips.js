function clipSampleCount(clip) {
  return (clip?.tracks ?? []).reduce((sum, track) => sum + (track?.times?.length ?? 0), 0);
}

function clipTrackCount(clip) {
  return clip?.tracks?.length ?? 0;
}

function selectMostCompleteClip(clips) {
  return clips.reduce((bestClip, candidate) => {
    const trackDifference = clipTrackCount(candidate) - clipTrackCount(bestClip);
    if (trackDifference > 0) return candidate;
    if (trackDifference < 0) return bestClip;
    return clipSampleCount(candidate) > clipSampleCount(bestClip) ? candidate : bestClip;
  }, null);
}

const CENTIMETER_DISPLACEMENT_FILES = new Set([
  'bruneifull.glb',
  'myanmarfull.glb',
  'thailandpart2full.glb'
]);

function normalizeStandalonePositionTracks(clip, fileName) {
  const normalizedFileName = String(fileName).split(/[\\/]/).at(-1).toLowerCase();
  if (!CENTIMETER_DISPLACEMENT_FILES.has(normalizedFileName)) return clip;

  const playbackClip = clip.clone();
  playbackClip.name = `${clip.name}-${normalizedFileName.replace(/\.glb$/i, '')}Playback`;

  for (const track of playbackClip.tracks ?? []) {
    if (!/\.position$/i.test(track?.name ?? '')) continue;
    if (!track.values || track.values.length < 6 || track.values.length % 3 !== 0) continue;

    const originX = track.values[0];
    const originY = track.values[1];
    const originZ = track.values[2];
    for (let offset = 3; offset < track.values.length; offset += 3) {
      track.values[offset] = originX + (track.values[offset] - originX) * 0.01;
      track.values[offset + 1] = originY + (track.values[offset + 1] - originY) * 0.01;
      track.values[offset + 2] = originZ + (track.values[offset + 2] - originZ) * 0.01;
    }
  }

  return playbackClip;
}

export function chooseStandaloneRigClip(animations) {
  const clips = Array.isArray(animations) ? animations.filter(Boolean) : [];
  const retargetedClips = clips.filter((clip) => /^Action(?:\.\d+)?$/i.test(clip.name ?? ''));
  return selectMostCompleteClip(retargetedClips) ?? selectMostCompleteClip(clips);
}

export function prepareStandaloneRigClip(animations, fileName = '') {
  const selectedClip = chooseStandaloneRigClip(animations);
  if (!selectedClip) return selectedClip;

  const normalizedClip = normalizeStandalonePositionTracks(selectedClip, fileName);
  if (!/^Vietnamfull\.glb$/i.test(fileName)) return normalizedClip;
  const vietnamSourceClip = animations.find((clip) => /\|VIETNAM_FULL(?:_|$)/i.test(clip.name ?? ''));
  if (!vietnamSourceClip || vietnamSourceClip.duration >= normalizedClip.duration) return normalizedClip;
  const playbackClip = normalizedClip.clone();
  playbackClip.name = `${normalizedClip.name}-VietnamPlayback`;
  playbackClip.trim(0, vietnamSourceClip.duration);
  playbackClip.duration = vietnamSourceClip.duration;
  return playbackClip;
}
