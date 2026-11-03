/**
 * Finds glossary terms in content throughout the game and makes them clickable to show their defintions
 */
import { networkGlossary } from './networkGlossary.js';

let glossaryPopup;
let glossaryPopupTitle;
let glossaryPopupDefinition;
let returnFocusTo;

// Creates the shared glossary dialog the first time a definition is opened.
function ensureGlossaryPopup() {
  if (glossaryPopup) return glossaryPopup;

  glossaryPopup = document.createElement('dialog');
  glossaryPopup.className = 'panel glossary-popup';
  glossaryPopup.setAttribute('aria-labelledby', 'glossary-popup-title');

  glossaryPopupTitle = document.createElement('h2');
  glossaryPopupTitle.id = 'glossary-popup-title';
  glossaryPopupDefinition = document.createElement('p');
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'Close';
  // Closes the glossary dialog from its button.
  closeButton.addEventListener('click', () => glossaryPopup.close());

  glossaryPopup.append(glossaryPopupTitle, glossaryPopupDefinition, closeButton);
  // Returns focus to the glossary term that opened the dialog.
  glossaryPopup.addEventListener('close', () => {
    if (returnFocusTo?.isConnected) returnFocusTo.focus();
    returnFocusTo = null;
  });
  document.body.append(glossaryPopup);
  return glossaryPopup;
}

// Displays glossary definition
function openGlossaryPopup(glossaryEntry, trigger) {
  const dialog = ensureGlossaryPopup();
  returnFocusTo = trigger;
  glossaryPopupTitle.textContent = glossaryEntry.term;
  glossaryPopupDefinition.textContent = glossaryEntry.definition;
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('button').focus();
}

function isWordCharacter(character) {
  return Boolean(character) && /[\p{L}\p{N}]/u.test(character);
}

// Builds searchable glossary terms.
function buildMatches(glossary) {
  return glossary
    .flatMap((glossaryEntry) =>
      [glossaryEntry.term, ...glossaryEntry.aliases].map((text) => ({
        text,
        normalized: text.toLocaleLowerCase(),
        glossaryEntry,
      })))
    .sort((first, second) => second.text.length - first.text.length);
}


 // Splits text into plain text and glossary term segments.
export function findGlossaryMatches(text, glossary = networkGlossary) {
  if (!text) return [];
  const matches = buildMatches(glossary);
  const normalizedText = text.toLocaleLowerCase();
  const segments = [];
  let plainTextStart = 0;
  let index = 0;

  while (index < text.length) {
    const glossaryTerm = matches.find(({ normalized }) => {
      if (!normalizedText.startsWith(normalized, index)) return false;
      const before = text[index - 1];
      const after = text[index + normalized.length];
      return !isWordCharacter(before) && !isWordCharacter(after);
    });

    if (!glossaryTerm) {
      index += 1;
      continue;
    }

    if (plainTextStart < index) {
      segments.push({ type: 'text', text: text.slice(plainTextStart, index) });
    }
    const end = index + glossaryTerm.text.length;
    segments.push({
      type: 'term',
      text: text.slice(index, end),
      glossaryEntry: glossaryTerm.glossaryEntry,
    });
    index = end;
    plainTextStart = end;
  }

  if (plainTextStart < text.length) {
    segments.push({ type: 'text', text: text.slice(plainTextStart) });
  }
  return segments;
}

// Converts matched text segments into clickable glossary text
export function createGlossaryFragment(text) {
  const fragment = document.createDocumentFragment();
  findGlossaryMatches(text).forEach((segment) => {
    if (segment.type === 'text') {
      fragment.append(document.createTextNode(segment.text));
      return;
    }

    const term = document.createElement('button');
    term.type = 'button';
    term.className = 'glossary-term';
    term.dataset.glossaryId = segment.glossaryEntry.id;
    term.textContent = segment.text;
    term.setAttribute('aria-label', `${segment.text}: open definition`);
    // Opens the matching definition without triggering a parent control.
    term.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openGlossaryPopup(segment.glossaryEntry, term);
    });
    fragment.append(term);
  });
  return fragment;
}

// Replaces an element's contents with glossary-enabled text.
export function setGlossaryText(element, text) {
  element.replaceChildren(createGlossaryFragment(text));
}

const skippedElements = new Set([
  'BUTTON',
  'INPUT',
  'OPTION',
  'SCRIPT',
  'SELECT',
  'STYLE',
  'TEXTAREA',
]);


export function applyGlossaryTerms(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (
      node.nodeValue.trim()
      && parent
      && !skippedElements.has(parent.tagName)
      && !parent.closest('.glossary-term, .glossary-popup')
    ) {
      textNodes.push(node);
    }
    node = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const segments = findGlossaryMatches(textNode.nodeValue);
    if (!segments.some((segment) => segment.type === 'term')) return;
    textNode.replaceWith(createGlossaryFragment(textNode.nodeValue));
  });
}
