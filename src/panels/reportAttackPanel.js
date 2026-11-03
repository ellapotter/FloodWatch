
import { createReportState } from '../game/gameEngine.js';
import { setGlossaryText } from '../glossary/glossaryText.js';


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
    feedbackDialog.innerHTML = `
      <h2>${result.isCorrect ? 'Correct Identification' : 'Incorrect Identification'}</h2>
      <p></p>
      <button type="button" class="feedback-action">
        ${result.isCorrect ? 'Continue to Mitigation' : 'Review Choices'}
      </button>
    `;
    setGlossaryText(feedbackDialog.querySelector('p'), result.message);


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
        <button class="report-close" type="button" aria-label="Close report and return to Network Observer">&times;</button>
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
        <button class="submit-report" type="submit" ${!state.selectedChoiceId || state.isCorrect ? 'disabled' : ''}>
          Submit Report
        </button>
      </form>

    `;

    setGlossaryText(section.querySelector('.report-prompt'), configuration.prompt);
    const evidenceContent = section.querySelector('.report-evidence-content');
    if (evidenceItems.length) {
      const list = document.createElement('ul');
      evidenceItems.forEach((evidence) => {
        const item = document.createElement('li');
        setGlossaryText(item, evidence.description);
        list.append(item);
      });
      evidenceContent.append(list);
    } else {
      const empty = document.createElement('p');
      empty.textContent = 'No evidence has been collected.';
      evidenceContent.append(empty);
    }

    const choices = section.querySelector('.attack-choices');
    configuration.choices.forEach((choice) => {
      const card = document.createElement('div');
      card.className = 'attack-choice';
      const choiceLabel = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'attack-choice';
      input.value = choice.id;
      input.checked = state.selectedChoiceId === choice.id;
      const name = document.createElement('strong');
      name.textContent = choice.name;
      choiceLabel.append(input, name);
      const description = document.createElement('p');
      setGlossaryText(description, choice.description);
      card.append(choiceLabel, description);
      choices.append(card);
    });

    section.querySelector('.report-close').addEventListener('click', onClose);
    section.querySelectorAll('input[name="attack-choice"]').forEach((input) => {
      // Stores the selected attack and enables report submission.
      input.addEventListener('change', () => {
        reportState.select(input.value);
        section.querySelector('.submit-report').disabled = false;
      });
    });
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
      if (feedbackDialog.open) feedbackDialog.close();
      activeFeedback = null;
      if (section.open) section.close();
      section.replaceChildren();
      feedbackDialog.replaceChildren();
    },
    getState: reportState.getState,
  };
}
