/**
 * Renders investigation infromation for a selected network object 
 */
import { setGlossaryText } from '../glossary/glossaryText.js';
import {
  createEvidenceIcon,
  decorateHeading,
  panelIconMappings,
} from '../icons/iconSystem.js';


export function createInvestigationPanel({ onCollectEvidence, onClose }) {
  const section = document.createElement('section');
  section.className = 'panel investigation-panel';
  section.setAttribute('aria-labelledby', 'investigation-title');

  // Hides the panel and removes the previously selected investigation.
  function clear() {
    section.hidden = true;
    section.replaceChildren();
  }

  // Renders all details for the current investigation.
  function update(investigation, isCollected) {
    section.hidden = false;
    section.innerHTML = `
      <div class="section-heading">
        <h2 id="investigation-title"></h2>
        <button class="investigation-close" type="button" aria-label="Close investigation">Close</button>
      </div>
      <div class="investigation-section">
        <h3>Investigation Details</h3>
        <p data-content="details"></p>
      </div>
      <div class="investigation-section">
        <h3>What This Means</h3>
        <p data-content="meaning"></p>
      </div>
    `;

    section.querySelector('#investigation-title').textContent = investigation.title;
    decorateHeading(
      section.querySelector('#investigation-title'),
      panelIconMappings.investigation,
    );
    setGlossaryText(section.querySelector('[data-content="details"]'), investigation.details);
    setGlossaryText(section.querySelector('[data-content="meaning"]'), investigation.meaning);

    if (investigation.dynamicFacts?.length) {
      const facts = document.createElement('dl');
      facts.className = 'investigation-facts';
      investigation.dynamicFacts.forEach(([label, value]) => {
        const row = document.createElement('div');
        row.dataset.fact = label;
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        description.textContent = value;
        row.append(term, description);
        facts.append(row);
      });
      section.querySelector('.investigation-section').before(facts);
    }

    if (investigation.learnMore) {
      const more = document.createElement('details');
      more.className = 'investigation-more';
      const summary = document.createElement('summary');
      summary.textContent = 'Learn More';
      const content = document.createElement('p');
      setGlossaryText(content, investigation.learnMore);
      more.append(summary, content);
      section.append(more);
    }

    if (investigation.evidence?.available) {
      const evidence = document.createElement('div');
      evidence.className = 'investigation-section';
      evidence.innerHTML = '<button class="collect-evidence" type="button"></button>';
      const collectButton = evidence.querySelector('.collect-evidence');
      collectButton.disabled = isCollected;
      collectButton.textContent = isCollected ? 'Evidence Collected' : 'Collect Evidence';
      section.append(evidence);
    }

    section.querySelector('.investigation-close').addEventListener('click', onClose);

    if (investigation.evidence?.available && !isCollected) {
      // Sends the current evidence item to the mission's evidence store.
      section.querySelector('.collect-evidence').addEventListener('click', () => {
        onCollectEvidence(investigation.evidence);
      });
    }
  }

  // Refreshes live values without rebuilding the full investigation panel.
  function updateDynamicFacts(dynamicFacts = []) {
    dynamicFacts.forEach(([label, value]) => {
      const row = [...section.querySelectorAll('.investigation-facts div')].find(
        (element) => element.dataset.fact === label,
      );
      if (row) row.querySelector('dd').textContent = value;
    });
  }

  clear();
  return { element: section, clear, update, updateDynamicFacts };
}

// Creates the evidence list and the button used to open the attack report.
export function createEvidencePanel({ onReportAttack = () => {} } = {}) {
  const section = document.createElement('section');
  section.className = 'panel evidence-panel';
  section.setAttribute('aria-labelledby', 'evidence-title');
  section.innerHTML = `
    <div class="section-heading">
      <h2 id="evidence-title">Evidence Collected</h2>
    </div>
    <p class="evidence-empty">No evidence collected yet.</p>
    <ul class="evidence-list"></ul>
    <button class="report-attack" type="button">Report Attack</button>
  `;

  const emptyMessage = section.querySelector('.evidence-empty');
  const list = section.querySelector('.evidence-list');
  const reportButton = section.querySelector('.report-attack');
  decorateHeading(section.querySelector('#evidence-title'), panelIconMappings.evidence);
  reportButton.addEventListener('click', onReportAttack);

  return {
    element: section,
    // Replaces the displayed list with the evidence collected in the mission.
    update(evidenceItems) {
      emptyMessage.hidden = evidenceItems.length > 0;
      list.replaceChildren(
        ...evidenceItems.map((evidence) => {
          const item = document.createElement('li');
          const description = document.createElement('span');
          description.className = 'evidence-list__description';
          setGlossaryText(description, evidence.description);
          item.append(createEvidenceIcon(evidence), description);
          return item;
        }),
      );
    },
    // Enables reporting only when the mission's evidence requirements are satisfied.
    setReportEnabled(isEnabled) {
      reportButton.disabled = !isEnabled;
    },
  };
}
