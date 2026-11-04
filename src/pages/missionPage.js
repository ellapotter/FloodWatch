/**
 * Builds the page used by every mission.
 * Each mission defines its own content and simulation in the level files
 */
import { applyGlossaryTerms } from '../glossary/glossaryText.js';
import {
  createEvidencePanel,
  createInvestigationPanel,
} from '../panels/investigationPanel.js';
import { createMitigationPanel } from '../panels/mitigationPanel.js';
import { createMissionCompletionPanel } from '../panels/missionCompletionPanel.js';
import {
  findMission,
  findMissionDefinition,
  getMissionStatus,
  getMissionDisplayTitle,
  loadProgress,
  markMissionCompleted,
} from '../panels/missionCardPanel.js';
import { createNavigationPanel } from '../panels/navigationPanel.js';
import { createNetworkStatisticsPanel } from '../panels/networkStatisticsPanel.js';
import { createReportAttackPanel } from '../panels/reportAttackPanel.js';
import {
  canOpenReport,
  createEvidenceStore,
  createMissionState,
} from '../game/gameEngine.js';
import { getSimulationSpeedMultiplier, loadSettings } from './settingsPage.js';
import { renderPlaceholderPage } from './placeholderPage.js';

// Creates a text value used to detect changes in investigation content.
function getInvestigationSignature(investigation) {
  if (!investigation) return null;
  return JSON.stringify({
    objectId: investigation.objectId,
    title: investigation.title,
    details: investigation.details,
    meaning: investigation.meaning,
    learnMore: investigation.learnMore,
    evidence: investigation.evidence,
  });
}

// Creates the shared page layout and returns the areas where mission components belong.
function createMissionTemplate(instructions) {
  const page = document.createElement('div');
  const main = document.createElement('main');
  main.className = 'page-layout mission-layout';
  main.innerHTML = `
    <section class="panel mission-instructions" aria-labelledby="instructions-title">
      <h2 id="instructions-title">Mission Instructions</h2>
      <p></p>
    </section>

    <div class="mission-workspace">
      <div class="mission-workspace__observer"></div>
      <aside class="mission-workspace__sidebar" aria-label="Mission information"></aside>
      <aside class="mitigation-status-slot" aria-label="Attack and mitigation information" hidden></aside>
    </div>
    <div class="report-panel-container"></div>
    <div class="mitigation-panel-container" hidden></div>
    <div class="mission-completion-container"></div>
  `;

  const missionInstructions = main.querySelector('.mission-instructions');
  missionInstructions.querySelector('p').textContent = instructions;
  applyGlossaryTerms(missionInstructions);
  page.append(createNavigationPanel(), main);

  return {
    page,
    main,
    missionInstructions,
    missionWorkspace: main.querySelector('.mission-workspace'),
    runtimeContainer: main.querySelector('.mission-workspace__observer'),
    sidebar: main.querySelector('.mission-workspace__sidebar'),
    mitigationContainer: main.querySelector('.mitigation-panel-container'),
    mitigationStatusSlot: main.querySelector('.mitigation-status-slot'),
    reportContainer: main.querySelector('.report-panel-container'),
    completionContainer: main.querySelector('.mission-completion-container'),
  };
}

// Connects a mission definition to the shared page components and controls.
function renderConfiguredMission(definition) {
  const template = createMissionTemplate(definition.instructions);
  const {
    page,
    main,
    missionInstructions,
    missionWorkspace,
    runtimeContainer,
    sidebar,
    mitigationContainer,
    mitigationStatusSlot,
    reportContainer,
    completionContainer,
  } = template;
  const statistics = createNetworkStatisticsPanel(definition.statistics);
  const evidenceStore = createEvidenceStore(definition.id);
  const missionState = createMissionState();
  let latestSimulationState = null;
  let selectedInvestigationRequest = null;
  let selectedInvestigation = null;
  let runtime;
  let missionCompletion;
  let completionShown = false;

  // When mission is completed, progress is saved and the mission completion panel is shown
  function showMissionCompletion() {
    if (completionShown) return;
    completionShown = true;
    missionState.setStage('completed');
    markMissionCompleted(definition.id);
    runtime.pause();
    missionInstructions.hidden = true;
    missionWorkspace.hidden = true;
    mitigationContainer.hidden = true;
    missionCompletion.show();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Finds the content for a clicked network object and opens the investigation panel with correct content
  function openInvestigation(objectId, selection) {
    const request = { ...selection, objectId };
    const investigation = definition.getInvestigation(request, latestSimulationState);
    if (!investigation) return;

    selectedInvestigationRequest = request;
    selectedInvestigation = investigation;
    if (['observing', 'investigating'].includes(missionState.getStage())) {
      missionState.setStage('investigating');
    }
    contextPanel?.setSelection?.(selection);
    if (contextPanel?.ownsSelection?.(selection)) runtime.clearSelection();
    else runtime.selectObject(objectId);
    runtimeContainer.classList.add('is-investigating');
    investigationPanel.update(
      investigation,
      investigation.evidence ? evidenceStore.has(investigation.evidence.id) : false,
    );
  }

  // Updates an already open investigation panel with new content
  function refreshOpenInvestigation(state) {
    if (!selectedInvestigationRequest) return;
    const resolvedRequest = definition.resolveSelection
      ? definition.resolveSelection(selectedInvestigationRequest, state)
      : selectedInvestigationRequest;
    if (!resolvedRequest) {
      selectedInvestigationRequest = null;
      selectedInvestigation = null;
      investigationPanel.clear();
      runtime.clearSelection();
      contextPanel?.setSelection?.(null);
      runtimeContainer.classList.remove('is-investigating');
      return;
    }
    const nextInvestigation = definition.getInvestigation(resolvedRequest, state);
    if (!nextInvestigation) return;

    const contentChanged = getInvestigationSignature(nextInvestigation)
      !== getInvestigationSignature(selectedInvestigation);
    selectedInvestigationRequest = resolvedRequest;
    selectedInvestigation = nextInvestigation;
    if (contentChanged) {
      investigationPanel.update(
        nextInvestigation,
        nextInvestigation.evidence
          ? evidenceStore.has(nextInvestigation.evidence.id)
          : false,
      );
    } else {
      investigationPanel.updateDynamicFacts(nextInvestigation.dynamicFacts);
    }
  }

  // Returns the panels and collected evidence to their starting state after player presses restart
  function resetMissionInterface() {
    selectedInvestigation = null;
    selectedInvestigationRequest = null;
    evidenceStore.clear();
    missionState.reset();
    completionShown = false;
    evidencePanel.update([]);
    evidencePanel.element.hidden = false;
    evidencePanel.setReportEnabled(canOpenReport(definition.report, []));
    contextPanel?.reset?.();
    if (contextPanel) contextPanel.element.hidden = false;
    investigationPanel.clear();
    runtime.clearSelection();
    runtimeContainer.classList.remove('is-investigating');
    reportPanel.reset();
    mitigationPanel.reset();
    main.classList.remove('is-mitigating');
    missionInstructions.hidden = false;
    missionWorkspace.hidden = false;
    mitigationContainer.hidden = true;
    mitigationStatusSlot.hidden = true;
    missionCompletion.hide();
  }

  const contextPanel = definition.createContextPanel?.({
    onInvestigate: openInvestigation,
  }) ?? null;
  
  const mitigationPanel = createMitigationPanel({
    configuration: definition.mitigation,
    // Applies any selected defense through the mission-specific runtime.
    onApply(choiceId) {
      const activated = runtime.applyMitigation(choiceId);
      if (!activated) return false;
      if (choiceId === definition.mitigation.correctChoiceId) {
        missionState.setStage('network-recovery');
        mitigationPanel.setRecoveryState('recovering');
      } else {
        missionState.setStage('mitigating');
        mitigationPanel.setRecoveryState('inactive');
      }
      return true;
    },
    onComplete: showMissionCompletion,
  });

  const reportPanel = createReportAttackPanel({
    configuration: definition.report,
    // Returns the player to the stage they were in before opening the report.
    onClose() {
      reportPanel.close();
      if (missionState.getStage() !== 'mitigating') {
        missionState.setStage(selectedInvestigation ? 'investigating' : 'observing');
      }
    },
    // Records that the player correctly identified the attack.
    onCorrect() {
      missionState.setStage('attack-reported');
      evidencePanel.element.hidden = true;
    },
    // Changes the page from investigation controls to mitigation controls.
    onContinueToMitigation() {
      missionState.setStage('mitigating');
      missionInstructions.hidden = true;
      missionWorkspace.hidden = false;
      investigationPanel.clear();
      runtime.clearSelection();
      contextPanel?.setSelection?.(null);
      runtimeContainer.classList.remove('is-investigating');
      main.classList.add('is-mitigating');
      if (contextPanel?.hideDuringMitigation) contextPanel.element.hidden = true;
      mitigationContainer.hidden = false;
      mitigationStatusSlot.hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });


  const evidencePanel = createEvidencePanel({
    // Opens the report dialog when the collected evidence meets its rules.
    onReportAttack() {
      const evidenceItems = evidenceStore.getAll();
      if (!canOpenReport(definition.report, evidenceItems)) return;

      if (!reportPanel.getState().isCorrect) {
        missionState.setStage('reporting');
      }
      reportPanel.open(evidenceItems);
    },
  });

  // Investigations display mission content and send collected evidence to the evidence store.
  const investigationPanel = createInvestigationPanel({
    // Saves a new evidence item and refreshes the evidence controls.
    onCollectEvidence(evidence) {
      evidenceStore.collect(evidence);
      const evidenceItems = evidenceStore.getAll();
      evidencePanel.update(evidenceItems);
      evidencePanel.setReportEnabled(canOpenReport(definition.report, evidenceItems));
      investigationPanel.update(selectedInvestigation, evidenceStore.has(evidence.id));
    },
    // Closes the investigation and clears its selected network object.
    onClose() {
      selectedInvestigation = null;
      selectedInvestigationRequest = null;
      investigationPanel.clear();
      runtime.clearSelection();
      contextPanel?.setSelection?.(null);
      runtimeContainer.classList.remove('is-investigating');
    },
  });

  runtime = definition.createRuntime({
    speedMultiplier: getSimulationSpeedMultiplier(loadSettings()),
    hintsEnabled: loadSettings().hintsEnabled,
    // Keeps the shared panels synchronized with the latest simulation state.
    onStateChange(state, recoveryState) {
      latestSimulationState = state;
      statistics.update(state);
      contextPanel?.update?.(state);

      if (recoveryState === 'recovering' && missionState.getStage() !== 'completed') {
        missionState.setStage('network-recovery');
        mitigationPanel.setRecoveryState('recovering');
      } else if (recoveryState === 'complete') {
        mitigationPanel.setRecoveryState('complete');
      }
      refreshOpenInvestigation(state);
    },
    onInvestigate: openInvestigation,
    onRestart: resetMissionInterface,
  });

  const completion = definition.completion;
  missionCompletion = createMissionCompletionPanel({
    attackName: completion.attackName,
    defenseName: completion.defenseName,
    attackSummary: completion.attackSummary,
    defenseSummary: completion.defenseSummary,
    continueLabel: completion.continueLabel,
    // Sends the player back to the mission-selection screen.
    onReturnHome() {
      window.location.hash = 'home';
    },
    // Opens the next mission from the completion panel when one is configured.
    onContinue: completion.nextMissionId
      ? () => {
          window.location.hash = `mission/${completion.nextMissionId}`;
        }
      : null,
  });


  // Places each reusable component into its matching area in the page template.
  evidencePanel.setReportEnabled(canOpenReport(definition.report, []));
  runtimeContainer.append(runtime.element, investigationPanel.element);
  sidebar.append(evidencePanel.element, statistics.element);
  if (contextPanel) sidebar.append(contextPanel.element);
  reportContainer.append(reportPanel.element);
  mitigationContainer.append(mitigationPanel.element);
  mitigationStatusSlot.append(mitigationPanel.statusElement);
  completionContainer.append(missionCompletion.element);

  // Let Help and Settings pause a mission without losing it.
  let resumeSimulationAfterAuxiliaryPage = false;
  // Pauses the active simulation while Help or Settings is open.
  page.suspend = () => {
    resumeSimulationAfterAuxiliaryPage = runtime.getState().isPlaying;
    runtime.pause();
  };
  // Restores settings and resumes the simulation when the player returns.
  page.resume = () => {
    const settings = loadSettings();
    runtime.setSpeed(getSimulationSpeedMultiplier(settings));
    runtime.setHints(settings.hintsEnabled);
    if (resumeSimulationAfterAuxiliaryPage) runtime.play();
    resumeSimulationAfterAuxiliaryPage = false;
  };
  // Stops this mission's simulation before the page is discarded.
  page.cleanup = () => runtime.destroy();
  runtime.play();
  return page;
}

// Checks mission access, loads its definition, and falls back to a placeholder if needed.
export function renderMissionPage(missionId) {
  const mission = findMission(missionId);

  if (!mission || getMissionStatus(mission, loadProgress()) === 'Locked') {
    return renderPlaceholderPage(
      'Mission Locked',
      'Complete the earlier missions before entering this mission.',
    );
  }

  const definition = findMissionDefinition(missionId);
  if (definition) return renderConfiguredMission(definition);

  return renderPlaceholderPage(
    getMissionDisplayTitle(mission),
    'This mission has not been implemented yet.',
  );
}
