import { setGlossaryText } from '../glossary/glossaryText.js';

// Returns a shuffled copy so mission configuration order and answer IDs stay unchanged.
export function shuffleChoices(choices, random = Math.random) {
  const shuffled = [...choices];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/** Renders the accessible radio-card pattern shared by report and mitigation forms. */
export function renderChoiceCards(container, {
  choices,
  inputName,
  selectedChoiceId,
  cardClass,
  includeDescriptions = false,
  enableGlossary = true,
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
      if (enableGlossary) setGlossaryText(description, choice.description);
      else description.textContent = choice.description;
      card.append(description);
    }
    return card;
  });

  container.replaceChildren(...cards);
}
