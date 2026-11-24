
import { createReportState } from '../game/gameEngine.js';
import { createEvidenceList } from './investigationPanel.js';
import { renderChoiceCards, shuffleChoices } from './choiceCards.js';
import {
  decorateHeading,
  panelIconMappings,
} from '../icons/iconSystem.js';


export function createReportAttackPanel({
  configuration,
  onClose,
  onCorrect,
  onContinueToMitigation,
}) {
  const container = document.createElement('div');
  const section = document.createElement('dialog');
  const feedbackDialog = document.createElement('dialog');
  const reportState = createReportState(configuration);
  let activeFeedback = null;
  let choiceOrder = [];
  section.className = 'panel report-panel';
  feedbackDialog.className = 'panel feedback-dialog';
  container.append(section, feedbackDialog);

  section.addEventListener('cancel', (event) => {
    event.preventDefault();
    onClose();
  });

  feedbackDialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (!activeFeedback?.isCorrect) feedbackDialog.close();
  });

  function showFeedback(result) {
    activeFeedback = result;
    feedbackDialog.classList.toggle('is-correct', result.isCorrect);
    feedbackDialog.classList.toggle('is-incorrect', !result.isCorrect);
    feedbackDialog.innerHTML = `
      <h2>${result.isCorrect ? 'Correct Identification' : 'Incorrect Identification'}</h2>
      <p></p>
      <button type="button" class="feedback-action ${result.isCorrect ? 'button--primary' : 'button--secondary'}">
        ${result.isCorrect ? 'Continue to Mitigation' : 'Review Choices'}
      </button>
    `;
    feedbackDialog.querySelector('p').textContent = result.message;


    feedbackDialog.querySelector('.feedback-action').addEventListener('click', () => {
      feedbackDialog.close();
      activeFeedback = null;
      if (result.isCorrect) {
        if (section.open) section.close();
        onContinueToMitigation();
      }
    });

    feedbackDialog.showModal();
  }

  function render(evidenceItems = []) {
    const state = reportState.getState();
    section.innerHTML = `
      <div class="section-heading">
        <h2>Report Attack</h2>
        <button class="report-close button--secondary" type="button" aria-label="Close report and return to Network Observer">&times;</button>
      </div>
      <p class="report-prompt"></p>

      <section class="report-evidence" aria-labelledby="report-evidence-title">
        <h3 id="report-evidence-title">Evidence Available for Review</h3>
        <div class="report-evidence-content"></div>
      </section>

      <form class="report-form">
        <fieldset ${state.isCorrect ? 'disabled' : ''}>
          <legend>Select one attack</legend>
          <div class="attack-choices"></div>
        </fieldset>
        <button class="submit-report button--primary" type="submit" ${!state.selectedChoiceId || state.isCorrect ? 'disabled' : ''}>
          Submit Report
        </button>
      </form>

    `;

    section.querySelector('.report-prompt').textContent = configuration.prompt;
    decorateHeading(section.querySelector('.section-heading h2'), panelIconMappings.report);
    const evidenceContent = section.querySelector('.report-evidence-content');
    if (evidenceItems.length) {
      evidenceContent.append(createEvidenceList(
        evidenceItems,
        'evidence-list evidence-list--review',
        { enableGlossary: false },
      ));
    } else {
      const empty = document.createElement('p');
      empty.textContent = 'No evidence has been collected.';
      evidenceContent.append(empty);
    }

    const choices = section.querySelector('.attack-choices');
    renderChoiceCards(choices, {
      choices: choiceOrder,
      inputName: 'attack-choice',
      selectedChoiceId: state.selectedChoiceId,
      cardClass: 'attack-choice',
      includeDescriptions: true,
      enableGlossary: false,
      onSelect(choiceId) {
        reportState.select(choiceId);
        section.querySelector('.submit-report').disabled = false;
      },
    });

    section.querySelector('.report-close').addEventListener('click', onClose);
    // Checks the selected attack and opens the matching feedback dialog.
    section.querySelector('.report-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const result = reportState.submit();
      if (!result) return;
      if (result.isCorrect) onCorrect();
      render(evidenceItems);
      showFeedback(result);
    });
  }

  return {
    element: container,
   
    open(evidenceItems) {
      choiceOrder = shuffleChoices(configuration.choices);
      render(evidenceItems);
      if (!section.open) section.showModal();
    },
   
    close() {
      if (feedbackDialog.open) feedbackDialog.close();
      activeFeedback = null;
      if (section.open) section.close();
    },
    
    reset() {
      reportState.reset();
      choiceOrder = [];
      if (feedbackDialog.open) feedbackDialog.close();
      activeFeedback = null;
      if (section.open) section.close();
      section.replaceChildren();
      feedbackDialog.replaceChildren();
    },
    getState: reportState.getState,
  };
}
