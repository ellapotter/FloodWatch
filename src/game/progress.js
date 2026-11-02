import { missions } from './missions.js';

const STORAGE_KEY = 'floodwatch-progress';
const initialProgress = { completedMissionIds: [] };

export function loadProgress() {
  try {
    const savedProgress = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const validMissionIds = new Set(missions.map((mission) => mission.id));
    const completedMissionIds = Array.isArray(savedProgress?.completedMissionIds)
      ? savedProgress.completedMissionIds.filter((id) => validMissionIds.has(id))
      : [];

    return { completedMissionIds: [...new Set(completedMissionIds)] };
  } catch {
    return { ...initialProgress };
  }
}

export function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function getMissionStatus(mission, progress) {
  if (progress.completedMissionIds.includes(mission.id)) {
    return 'Completed';
  }

  if (mission.level === 1) {
    return 'Available';
  }

  const requiredMissions = missions.filter(
    (requiredMission) => requiredMission.level < mission.level && !requiredMission.isFinal,
  );
  const requirementsComplete = requiredMissions.every((requiredMission) =>
    progress.completedMissionIds.includes(requiredMission.id),
  );

  return requirementsComplete ? 'Available' : 'Locked';
}

export function getProgressSummary(progress) {
  const completedCount = missions.filter((mission) =>
    progress.completedMissionIds.includes(mission.id),
  ).length;
  const currentMission = missions.find(
    (mission) => getMissionStatus(mission, progress) === 'Available',
  );

  return {
    completedCount,
    currentMission,
    totalMissions: missions.length,
  };
}
