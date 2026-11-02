import { getProgressSummary } from '../game/progress.js';
import { getMissionDisplayTitle } from '../game/missions.js';

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
  return section;
}
