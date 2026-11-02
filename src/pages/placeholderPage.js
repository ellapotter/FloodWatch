import { createNavigation } from '../components/navigation.js';
import { findMission, getMissionDisplayTitle } from '../game/missions.js';
import { getMissionStatus, loadProgress } from '../game/progress.js';

function createPlaceholder(title, message) {
  const page = document.createElement('div');
  const main = document.createElement('main');
  main.className = 'page-layout';
  main.innerHTML = `
    <section class="panel placeholder" aria-labelledby="placeholder-title">
      <h1 id="placeholder-title">${title}</h1>
      <p>${message}</p>
      <a class="button-link" href="#home">Return to Home</a>
    </section>
  `;
  page.append(createNavigation(), main);
  return page;
}

export function renderPlaceholderPage(title, message) {
  return createPlaceholder(title, message);
}

export function renderMissionPage(missionId) {
  const mission = findMission(missionId);

  if (!mission || getMissionStatus(mission, loadProgress()) === 'Locked') {
    return createPlaceholder('Mission Locked', 'Complete the earlier missions before entering this mission.');
  }

  return createPlaceholder(getMissionDisplayTitle(mission), 'This mission has not been implemented yet.');
}
