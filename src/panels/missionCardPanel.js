import { levelOneMission } from '../game/levels/levelOneMission.js';
//import { levelTwoMission } from '../game/levels/levelTwoMission.js';
import {
  createIcon,
  decorateHeading,
  missionIconMappings,
  missionStatusIconMappings,
} from '../icons/iconSystem.js';

export const missions = [
  {
    id: 'syn-flood',
    route: 'level-1',
    level: 1,
    title: 'SYN Flood',
    description: 'Learn how incomplete TCP connections can prevent users from reaching a server.',
    definition: levelOneMission,
  },
  {
    id: 'udp-flood',
    route: 'level-2',
    level: 2,
    title: 'UDP Flood',
    description: 'Learn how a large amount of UDP traffic can overwhelm a network.',
    definition: levelTwoMission,
  },
  {
    id: 'http-flood',
    route: 'level-3',
    level: 3,
    title: 'HTTP Flood',
    description: 'Learn how repeated website requests can overload a web server.',
  },
  {
    id: 'dns-amplification',
    route: 'level-4',
    level: 4,
    title: 'DNS Amplification',
    description: 'Learn how DNS responses can be redirected to overwhelm a target.',
  },
  {
    id: 'final-mission',
    route: 'final',
    level: 5,
    title: 'Final Mission',
    description: 'Use what you learned to identify and defend against multiple attacks.',
    isFinal: true,
  },
];

const levelNames = ['One', 'Two', 'Three', 'Four'];

// Returns basic information for any planned mission.
export function findMission(missionId) {
  return missions.find((mission) => mission.id === missionId);
}

// Resolves a neutral public URL segment without exposing the attack type.
export function findMissionByRoute(route) {
  return missions.find((mission) => mission.route === route);
}

export function getMissionRoute(missionId) {
  return findMission(missionId)?.route ?? null;
}

// Returns the playable implementation when a mission has been developed.
export function findMissionDefinition(missionId) {
  return findMission(missionId)?.definition ?? null;
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

// Keeps mission-specific details hidden until the player completes the mission.
export function getMissionCardPresentation(mission, status) {
  const completed = status === 'Completed';
  return {
    title: completed ? getMissionCardTitle(mission) : getMissionDisplayTitle(mission),
    description: completed ? mission.description : '',
    icon: completed
      ? missionIconMappings[mission.id]
      : status === 'Locked' ? 'lock' : 'shield-alert',
  };
}

// Creates a mission-selection card and enables it when the mission is available.
export function createMissionCardPanel(mission, status) {
  const article = document.createElement('article');
  const isLocked = status === 'Locked';
  const isCompleted = status === 'Completed';
  const buttonLabel = status === 'Completed' ? 'Replay' : 'Play';
  const presentation = getMissionCardPresentation(mission, status);

  article.className = `mission-card mission-card--${status.toLowerCase()}${mission.isFinal ? ' mission-card--final' : ''}`;
  article.dataset.status = status;
  article.innerHTML = `
    <div class="mission-card__header">
      <div class="mission-card__icon" aria-hidden="true"></div>
      <span class="mission-card__status">${status}</span>
    </div>
    <h3>${presentation.title}</h3>
    ${isCompleted
      ? `<p>${presentation.description}</p>`
      : isLocked
        ? '<p class="mission-card__locked-note">Complete earlier missions to unlock.</p>'
        : ''}
    <button class="mission-card__action" type="button" ${isLocked ? 'disabled' : ''}>${isLocked ? 'Locked' : buttonLabel}</button>
  `;
  article.querySelector('.mission-card__icon').append(
    createIcon(presentation.icon, { size: 27 }),
  );
  article.querySelector('.mission-card__action').prepend(
    createIcon(missionStatusIconMappings[status], { size: 17 }),
  );
  if (!isLocked) article.querySelector('.mission-card__action').classList.add('button--primary');

  if (!isLocked) {
    // Opens this mission when the player selects an available card.
    article.querySelector('.mission-card__action').addEventListener('click', () => {
      window.location.hash = `mission/${mission.route}`;
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

    const progress = { completedMissionIds: [...new Set(completedMissionIds)] };
    if (savedProgress?.allLevelsUnlocked === true) progress.allLevelsUnlocked = true;
    return progress;
  } catch {
    return { ...initialProgress };
  }
}

// Writes the supplied mission progress to browser storage.
export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // The current session can continue even when browser storage is unavailable.
  }
  return progress;
}

// Adds a valid mission to the completed list without creating duplicates.
export function markMissionCompleted(missionId) {
  const progress = loadProgress();
  const validMission = missions.some((mission) => mission.id === missionId);

  if (!validMission || progress.completedMissionIds.includes(missionId)) {
    return progress;
  }

  const updatedProgress = {
    ...progress,
    completedMissionIds: [...progress.completedMissionIds, missionId],
  };
  saveProgress(updatedProgress);
  return updatedProgress;
}

// Enables every mission without marking unplayed missions as completed.
export function unlockAllLevels() {
  const unlockedProgress = { ...loadProgress(), allLevelsUnlocked: true };
  saveProgress(unlockedProgress);
  return unlockedProgress;
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
  if (progress.allLevelsUnlocked === true) return 'Available';
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
