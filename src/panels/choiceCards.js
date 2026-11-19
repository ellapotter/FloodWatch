import { setGlossaryText } from '../glossary/glossaryText.js';

/** Renders the accessible radio-card pattern shared by report and mitigation forms. */
export function renderChoiceCards(container, {
  choices,
  inputName,
  selectedChoiceId,
  cardClass,
  includeDescriptions = false,
  onSelect,
}) {
  const cards = choices.map((choice) => {
    const card = document.createElement('label');
    card.className = cardClass;

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = inputName;
    input.value = choice.id;
    input.checked = selectedChoiceId === choice.id;
    input.addEventListener('change', () => onSelect(choice.id));

    const name = document.createElement('strong');
    name.textContent = choice.name;
    const heading = document.createElement('span');
    heading.className = 'choice-heading';
    heading.append(input, name);
    card.append(heading);

    if (includeDescriptions) {
      const description = document.createElement('p');
      setGlossaryText(description, choice.description);
      card.append(description);
    }
    return card;
  });

  container.replaceChildren(...cards);
}
