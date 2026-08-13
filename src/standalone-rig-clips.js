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

export function chooseStandaloneRigClip(animations) {
  const clips = Array.isArray(animations) ? animations.filter(Boolean) : [];
  const retargetedClips = clips.filter((clip) => /^Action(?:\.\d+)?$/i.test(clip.name ?? ''));
  return selectMostCompleteClip(retargetedClips) ?? selectMostCompleteClip(clips);
}

export function prepareStandaloneRigClip(animations, fileName = '') {
  const selectedClip = chooseStandaloneRigClip(animations);
  if (!selectedClip || !/^Vietnamfull\.glb$/i.test(fileName)) return selectedClip;
  const vietnamSourceClip = animations.find((clip) => /\|VIETNAM_FULL(?:_|$)/i.test(clip.name ?? ''));
  if (!vietnamSourceClip || vietnamSourceClip.duration >= selectedClip.duration) return selectedClip;
  const playbackClip = selectedClip.clone();
  playbackClip.name = `${selectedClip.name}-VietnamPlayback`;
  playbackClip.trim(0, vietnamSourceClip.duration);
  playbackClip.duration = vietnamSourceClip.duration;
  return playbackClip;
}
