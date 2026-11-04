import { setGlossaryText } from '../glossary/glossaryText.js';
import { decorateHeading, panelIconMappings } from '../icons/iconSystem.js';

// Creates the mission summary shown after the network has recovered.
export function createMissionCompletionPanel({
  attackName,
  defenseName,
  attackSummary,
  defenseSummary,
  onReturnHome,
  onContinue,
  continueLabel = 'Continue to Next Level',
}) {
  const section = document.createElement('section');
  section.className = 'panel mission-completion';
  section.hidden = true;
  section.innerHTML = `
    <h1 id="mission-completed-title" tabindex="-1">Mission Completed</h1>
    <section aria-labelledby="completion-attack-title">
      <h2 id="completion-attack-title"></h2>
      <p data-summary="attack"></p>
    </section>
    <section aria-labelledby="completion-defense-title">
      <h2 id="completion-defense-title"></h2>
      <p data-summary="defense"></p>
    </section>
    <div class="mission-completion__actions">
      <button type="button" data-action="home">Return to Home</button>
      ${onContinue ? '<button type="button" data-action="continue"></button>' : ''}
    </div>
  `;
  section.setAttribute('role', 'region');
  section.setAttribute('aria-labelledby', 'mission-completed-title');
  decorateHeading(
    section.querySelector('#mission-completed-title'),
    panelIconMappings.completion,
    { size: 24 },
  );
  section.querySelector('#completion-attack-title').textContent = attackName;
  section.querySelector('#completion-defense-title').textContent = defenseName;
  setGlossaryText(section.querySelector('[data-summary="attack"]'), attackSummary);
  setGlossaryText(section.querySelector('[data-summary="defense"]'), defenseSummary);

  section.querySelector('[data-action="home"]').addEventListener('click', onReturnHome);
  const continueButton = section.querySelector('[data-action="continue"]');
  if (continueButton) {
    continueButton.textContent = continueLabel;
    continueButton.addEventListener('click', onContinue);
  }

  return {
    element: section,
    // Displays the completion summary.
    show() {
      section.hidden = false;
      section.querySelector('#mission-completed-title').focus();
    },
    // Hides the summary when a mission is restarted.
    hide() {
      section.hidden = true;
    },
  };
}
