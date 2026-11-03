/**
 * Builds the mitigation panel and status panel
 */
import { createMitigationState } from '../game/gameEngine.js';
import { setGlossaryText } from '../glossary/glossaryText.js';

// Creates the mitigation choices and the panel that displays their results.
export function createMitigationPanel({ configuration, onCorrect }) {
  const section = document.createElement('section');
  const statusSection = document.createElement('section');
  const mitigationState = createMitigationState(configuration);
  let recoveryState = 'inactive';
  section.className = 'panel mitigation-panel';
  statusSection.className = 'panel mitigation-status';

  // Displays either the identified attack or the latest mitigation result.
  function renderStatus() {
    const state = mitigationState.getState();

    if (!state.feedback) {
      statusSection.innerHTML = `
        <h2></h2>
        <p></p>
      `;
      statusSection.querySelector('h2').textContent = configuration.identifiedAttack.name;
      setGlossaryText(
        statusSection.querySelector('p'),
        configuration.identifiedAttack.description,
      );
      return;
    }

    statusSection.innerHTML = `
      <h2>Mitigation Result</h2>
      <p class="mitigation-feedback ${state.feedback.isCorrect ? 'feedback-correct' : ''}"></p>
      ${state.isSuccessful && recoveryState === 'recovering' ? '<p class="recovery-state"><strong>SYN Cookie Protection: Active</strong><br>Network recovery in progress.</p>' : ''}
      ${state.isSuccessful && recoveryState === 'complete' ? '<p class="recovery-state"><strong>Network recovery complete.</strong></p>' : ''}
    `;
    setGlossaryText(statusSection.querySelector('.mitigation-feedback'), state.feedback.message);
  }

  // Builds the mitigation form from the mission's choices.
  function render() {
    const state = mitigationState.getState();
    section.innerHTML = `
      <div class="section-heading">
        <div>
          <h2>Choose a Mitigation</h2>
          <p class="mitigation-instructions"></p>
        </div>
      </div>

      <form class="mitigation-form">
        <fieldset ${state.isSuccessful ? 'disabled' : ''}>
          <legend>Select one defense</legend>
          <div class="mitigation-choices"></div>
        </fieldset>
        <button class="apply-mitigation" type="submit" ${!state.selectedChoiceId || state.isSuccessful ? 'disabled' : ''}>
          Apply Mitigation
        </button>
      </form>
    `;

    setGlossaryText(section.querySelector('.mitigation-instructions'), configuration.instructions);
    const choices = section.querySelector('.mitigation-choices');
    configuration.choices.forEach((choice) => {
      const card = document.createElement('div');
      card.className = 'mitigation-choice';
      const choiceLabel = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'mitigation-choice';
      input.value = choice.id;
      input.checked = state.selectedChoiceId === choice.id;
      const name = document.createElement('strong');
      name.textContent = choice.name;
      choiceLabel.append(input, name);
      card.append(choiceLabel);
      choices.append(card);
    });

    section.querySelectorAll('input[name="mitigation-choice"]').forEach((input) => {
      // Stores the newly selected defense and enables the Apply button.
      input.addEventListener('change', () => {
        mitigationState.select(input.value);
        section.querySelector('.apply-mitigation').disabled = false;
      });
    });
    // Checks the selected defense and displays its result.
    section.querySelector('.mitigation-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const result = mitigationState.apply();
      if (!result) return;
      if (result.isCorrect) onCorrect();
      render();
      renderStatus();
    });
  }

  render();
  renderStatus();
  return {
    element: section,
    statusElement: statusSection,
    // Restores the mitigation interface to its initial state.
    reset() {
      mitigationState.reset();
      recoveryState = 'inactive';
      render();
      renderStatus();
    },
    // Updates the message shown while the network recovers.
    setRecoveryState(nextState) {
      recoveryState = nextState;
      renderStatus();
    },
    getState: mitigationState.getState,
  };
}
