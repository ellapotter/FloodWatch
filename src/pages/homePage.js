import { createMissionCard } from '../components/missionCard.js';
import { createNavigation } from '../components/navigation.js';
import { createProgressPanel } from '../components/progressPanel.js';
import { missions } from '../game/missions.js';
import { getMissionStatus, loadProgress } from '../game/progress.js';

const gameSteps = [
  ['Observe', 'Watch how the network behaves.'],
  ['Investigate', 'Examine network devices and packets to collect information.'],
  ['Report', 'Identify the attack using the evidence collected.'],
  ['Defend', 'Choose an appropriate mitigation strategy.'],
  ['Complete', 'Restore the network and finish the mission.'],
];

export function renderHomePage() {
  const page = document.createElement('div');
  const main = document.createElement('main');
  const progress = loadProgress();

  main.className = 'page-layout home-layout';
  main.innerHTML = `
    <div class="home-primary">
      <section class="panel" aria-labelledby="introduction-title">
        <h1 id="introduction-title">You are a Network Defender</h1>
        <p>
          Your job is to monitor network traffic, identify attacks, and choose the right defenses
          to keep the web server available. Complete the missions in order while learning how
          different denial-of-service attacks affect a network.
        </p>
      </section>

      <section class="panel" aria-labelledby="missions-title">
        <h2 id="missions-title">Mission Selection</h2>
        <div class="mission-list"></div>
      </section>
    </div>

    <aside class="home-sidebar" aria-label="Game information">
      <section class="panel" aria-labelledby="flow-title">
        <h2 id="flow-title">Game Flow Overview</h2>
        <ol class="game-flow">
          ${gameSteps.map(([title, description]) => `<li><strong>${title}</strong> – ${description}</li>`).join('')}
        </ol>
      </section>
    </aside>
  `;

  const missionList = main.querySelector('.mission-list');
  missions.forEach((mission) => {
    missionList.append(createMissionCard(mission, getMissionStatus(mission, progress)));
  });
  main.querySelector('.home-sidebar').append(createProgressPanel(progress));
  page.append(createNavigation(), main);
  return page;
}
