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
export function findGlossaryMatches(
  text,
  glossary = networkGlossary,
  linkedEntryIds = new Set(),
) {
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

    const end = index + glossaryTerm.text.length;
    if (!linkedEntryIds.has(glossaryTerm.glossaryEntry.id)) {
      if (plainTextStart < index) {
        segments.push({ type: 'text', text: text.slice(plainTextStart, index) });
      }
      segments.push({
        type: 'term',
        text: text.slice(index, end),
        glossaryEntry: glossaryTerm.glossaryEntry,
      });
      linkedEntryIds.add(glossaryTerm.glossaryEntry.id);
      plainTextStart = end;
    }
    index = end;
  }

  if (plainTextStart < text.length) {
    segments.push({ type: 'text', text: text.slice(plainTextStart) });
  }
  return segments;
}

// Converts matched text segments into clickable glossary text
export function createGlossaryFragment(text, linkedEntryIds = new Set()) {
  const fragment = document.createDocumentFragment();
  findGlossaryMatches(text, networkGlossary, linkedEntryIds).forEach((segment) => {
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
  'A',
  'BUTTON',
  'CODE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'INPUT',
  'LABEL',
  'LEGEND',
  'OPTION',
  'PRE',
  'SCRIPT',
  'SELECT',
  'STYLE',
  'SUMMARY',
  'TEXTAREA',
]);

const semanticScopeSelector = [
  'p',
  'li',
  'dd',
  'dt',
  'figcaption',
  'blockquote',
  'div',
  'section',
  'article',
].join(',');

function getGlossaryScope(element, root) {
  return element.closest(semanticScopeSelector) ?? root;
}

export function applyGlossaryTerms(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  let node = walker.nextNode();
  while (node) {
    const parent = node.parentElement;
    if (
      node.nodeValue.trim()
      && parent
      && !parent.closest([...skippedElements].map((tag) => tag.toLowerCase()).join(','))
      && !parent.closest('.glossary-term, .glossary-popup')
    ) {
      textNodes.push(node);
    }
    node = walker.nextNode();
  }

  const linkedIdsByScope = new Map();
  root.querySelectorAll('.glossary-term[data-glossary-id]').forEach((term) => {
    const scope = getGlossaryScope(term.parentElement, root);
    if (!linkedIdsByScope.has(scope)) linkedIdsByScope.set(scope, new Set());
    linkedIdsByScope.get(scope).add(term.dataset.glossaryId);
  });

  textNodes.forEach((textNode) => {
    const scope = getGlossaryScope(textNode.parentElement, root);
    if (!linkedIdsByScope.has(scope)) linkedIdsByScope.set(scope, new Set());
    const linkedEntryIds = linkedIdsByScope.get(scope);
    const previousLinkedCount = linkedEntryIds.size;
    const fragment = createGlossaryFragment(textNode.nodeValue, linkedEntryIds);
    if (linkedEntryIds.size > previousLinkedCount) textNode.replaceWith(fragment);
  });
}
