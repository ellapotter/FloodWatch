import { levelOneMission } from '../game/levels/levelOneMission.js';
import {
  createIcon,
  decorateHeading,
  missionIconMappings,
  missionStatusIconMappings,
} from '../icons/iconSystem.js';

export const missions = [
  {
    id: 'syn-flood',
    level: 1,
    title: 'SYN Flood',
    description: 'Learn how incomplete TCP connections can prevent users from reaching a server.',
  },
  {
    id: 'udp-flood',
    level: 2,
    title: 'UDP Flood',
    description: 'Learn how a large amount of UDP traffic can overwhelm a network.',
  },
  {
    id: 'http-flood',
    level: 3,
    title: 'HTTP Flood',
    description: 'Learn how repeated website requests can overload a web server.',
  },
  {
    id: 'dns-amplification',
    level: 4,
    title: 'DNS Amplification',
    description: 'Learn how DNS responses can be redirected to overwhelm a target.',
  },
  {
    id: 'final-mission',
    level: 5,
    title: 'Final Mission',
    description: 'Use what you learned to identify and defend against multiple attacks.',
    isFinal: true,
  },
];

const missionDefinitions = new Map([
  [levelOneMission.id, levelOneMission],
]);

const levelNames = ['One', 'Two', 'Three', 'Four'];

// Returns basic information for any planned mission.
export function findMission(missionId) {
  return missions.find((mission) => mission.id === missionId);
}

// Returns the playable implementation when a mission has been developed.
export function findMissionDefinition(missionId) {
  return missionDefinitions.get(missionId) ?? null;
}

// Returns the level name displayed on mission cards and placeholder pages.
export function getMissionDisplayTitle(mission) {
  return mission.isFinal ? 'Final Mission' : `Level ${levelNames[mission.level - 1]}`;
}

export function getMissionCardTitle(mission) {
  return mission.isFinal
    ? getMissionDisplayTitle(mission)
    : `Level ${mission.level}: ${mission.title}`;
}

// Creates a mission-selection card and enables it when the mission is available.
export function createMissionCardPanel(mission, status) {
  const article = document.createElement('article');
  const isLocked = status === 'Locked';
  const isCompleted = status === 'Completed';
  const buttonLabel = status === 'Completed' ? 'Replay' : 'Play';

  article.className = 'mission-card';
  article.innerHTML = `
    <div class="mission-card__icon" aria-hidden="true"></div>
    <h3>${isCompleted ? getMissionCardTitle(mission) : getMissionDisplayTitle(mission)}</h3>
    ${isCompleted ? `<p>${mission.description}</p>` : ''}
    <button class="mission-card__action" type="button" ${isLocked ? 'disabled' : ''}>${isLocked ? 'Locked' : buttonLabel}</button>
  `;
  article.querySelector('.mission-card__icon').append(
    createIcon(missionIconMappings[mission.id], { size: 27 }),
  );
  article.querySelector('.mission-card__action').prepend(
    createIcon(missionStatusIconMappings[status], { size: 17 }),
  );

  if (!isLocked) {
    // Opens this mission when the player selects an available card.
    article.querySelector('.mission-card__action').addEventListener('click', () => {
      window.location.hash = `mission/${mission.id}`;
    });
  }

  return article;
}

const STORAGE_KEY = 'floodwatch-progress';
const initialProgress = { completedMissionIds: [] };

// Loads saved progress and removes unknown or duplicate mission IDs.
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

// Writes the supplied mission progress to browser storage.
export function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// Adds a valid mission to the completed list without creating duplicates.
export function markMissionCompleted(missionId) {
  const progress = loadProgress();
  const validMission = missions.some((mission) => mission.id === missionId);

  if (!validMission || progress.completedMissionIds.includes(missionId)) {
    return progress;
  }

  const updatedProgress = {
    completedMissionIds: [...progress.completedMissionIds, missionId],
  };
  saveProgress(updatedProgress);
  return updatedProgress;
}

// Clears all completed missions while leaving settings unchanged.
export function resetProgress() {
  const resetState = { ...initialProgress, completedMissionIds: [] };
  saveProgress(resetState);
  return resetState;
}

// Determines whether a mission is completed, available, or still locked.
export function getMissionStatus(mission, progress) {
  if (progress.completedMissionIds.includes(mission.id)) return 'Completed';
  if (mission.level === 1) return 'Available';

  const requiredMissions = missions.filter(
    (requiredMission) => requiredMission.level < mission.level && !requiredMission.isFinal,
  );
  const requirementsComplete = requiredMissions.every((requiredMission) =>
    progress.completedMissionIds.includes(requiredMission.id),
  );

  return requirementsComplete ? 'Available' : 'Locked';
}

// Builds the counts and current mission displayed in the progress panel.
export function getProgressSummary(progress) {
  const completedCount = missions.filter((mission) =>
    progress.completedMissionIds.includes(mission.id),
  ).length;
  const currentMission = missions.find(
    (mission) => getMissionStatus(mission, progress) === 'Available',
  );

  return { completedCount, currentMission, totalMissions: missions.length };
}

// Creates the home-page panel that summarizes completed and available missions.
export function createProgressPanel(progress) {
  const summary = getProgressSummary(progress);
  const section = document.createElement('section');
  section.className = 'panel';
  section.setAttribute('aria-labelledby', 'progress-title');
  section.innerHTML = `
    <h2 id="progress-title">Your Progress</h2>
    <dl class="progress-details">
      <div><dt>Total missions</dt><dd>${summary.totalMissions}</dd></div>
      <div><dt>Completed missions</dt><dd>${summary.completedCount}</dd></div>
      <div><dt>Current available mission</dt><dd>${summary.currentMission ? getMissionDisplayTitle(summary.currentMission) : 'All complete'}</dd></div>
    </dl>
    <label for="mission-progress">Mission progress</label>
    <progress id="mission-progress" value="${summary.completedCount}" max="${summary.totalMissions}">
      ${summary.completedCount} of ${summary.totalMissions}
    </progress>
  `;
  decorateHeading(section.querySelector('#progress-title'), 'circle-check');
  return section;
}
