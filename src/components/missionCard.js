import { getMissionDisplayTitle } from '../game/missions.js';

export function createMissionCard(mission, status) {
  const article = document.createElement('article');
  const isLocked = status === 'Locked';
  const buttonLabel = status === 'Completed' ? 'Replay mission' : 'Enter mission';

  article.className = 'mission-card';
  article.innerHTML = `
    <h3>${getMissionDisplayTitle(mission)}</h3>
    <button type="button" ${isLocked ? 'disabled' : ''}>${isLocked ? 'Locked' : buttonLabel}</button>
  `;

  if (!isLocked) {
    article.querySelector('button').addEventListener('click', () => {
      window.location.hash = `mission/${mission.id}`;
    });
  }

  return article;
}
