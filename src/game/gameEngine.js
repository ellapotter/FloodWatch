/**
 * Provides the lifecycle shared by every mission simulation.
 * Protocol behavior lives in a level-specific driver so missions can use
 * different traffic models, network states, and mitigation actions.
 */
export class NetworkSimulation {
  // Creates the level driver that supplies this mission's network behavior.
  constructor({ createDriver, ...driverOptions }) {
    if (typeof createDriver !== 'function') {
      throw new TypeError('NetworkSimulation requires a createDriver function.');
    }
    this.driver = createDriver(driverOptions);
  }

  // Starts or resumes the active mission simulation.
  play() {
    return this.driver.play();
  }

  // Pauses the active mission simulation without clearing its state.
  pause() {
    return this.driver.pause();
  }

  // Restarts the active mission simulation.
  reset(shouldPlay = true) {
    return this.driver.reset(shouldPlay);
  }

  // Stops the active simulation when its mission page is discarded.
  destroy() {
    return this.driver.destroy();
  }

  // Changes the active simulation's speed without restarting it.
  setSpeed(speedMultiplier) {
    return this.driver.setSpeed(speedMultiplier);
  }

  // Returns the current state supplied by the level driver.
  getState() {
    return this.driver.getState();
  }

  // Advances the driver from an animation timestamp.
  tick(timestamp) {
    return this.driver.tick(timestamp);
  }

  // Runs a named action implemented by the current level, such as a mitigation.
  performAction(actionName, ...args) {
    return this.driver.performAction?.(actionName, ...args) ?? false;
  }

  // Returns timing information exposed by the current level driver.
  getTiming() {
    return this.driver.getTiming?.() ?? {};
  }
}

/** Shared choice-state behavior for attack reporting and mitigation selection. */
function createChoiceState(configuration) {
  let selectedChoiceId = null;
  let feedback = null;
  let succeeded = false;

  // Stores a valid choice unless the correct answer has already been submitted.
  function select(choiceId) {
    if (succeeded || !configuration.choices.some((choice) => choice.id === choiceId)) {
      return false;
    }
    selectedChoiceId = choiceId;
    return true;
  }

  // Checks the selected answer and creates the feedback returned to the panel.
  function resolveChoice() {
    if (!selectedChoiceId || succeeded) return null;

    const choice = configuration.choices.find((item) => item.id === selectedChoiceId);
    succeeded = selectedChoiceId === configuration.correctChoiceId;
    feedback = {
      choiceId: selectedChoiceId,
      isCorrect: succeeded,
      message: choice.feedback,
    };
    return { ...feedback };
  }

  // Returns the current choice, feedback, and success state.
  function getState() {
    return { selectedChoiceId, feedback, succeeded };
  }

  // Clears the selected answer and feedback.
  function reset() {
    selectedChoiceId = null;
    feedback = null;
    succeeded = false;
  }

  return { select, resolveChoice, getState, reset };
}

/** Stores report selection and feedback independently from the report dialog DOM. */
export function createReportState(configuration) {
  const state = createChoiceState(configuration);
  return {
    select: state.select,
    submit: state.resolveChoice,
    // Returns report state using the name expected by the report panel.
    getState() {
      const { selectedChoiceId, feedback, succeeded } = state.getState();
      return { selectedChoiceId, feedback, isCorrect: succeeded };
    },
    reset: state.reset,
  };
}

/** Stores mitigation selection and locks the result after the correct defense is applied. */
export function createMitigationState(configuration) {
  const state = createChoiceState(configuration);
  return {
    select: state.select,
    apply: state.resolveChoice,
    // Returns mitigation state using the name expected by the mitigation panel.
    getState() {
      const { selectedChoiceId, feedback, succeeded } = state.getState();
      return { selectedChoiceId, feedback, isSuccessful: succeeded };
    },
    reset: state.reset,
  };
}

/** Determines whether collected evidence satisfies a level's report requirements. */
export function canOpenReport(configuration, collectedEvidence) {
  const minimumEvidenceCount = configuration.minimumEvidenceCount ?? 0;
  if (collectedEvidence.length < minimumEvidenceCount) return false;

  const collectedIds = new Set(collectedEvidence.map((evidence) => evidence.id));
  const requiredEvidenceCollected = configuration.requiredEvidenceIds.every(
    (evidenceId) => collectedIds.has(evidenceId),
  );
  if (!requiredEvidenceCollected) return false;

  const qualifyingEvidenceIds = configuration.qualifyingEvidenceIds ?? [];
  return qualifyingEvidenceIds.length === 0
    || qualifyingEvidenceIds.some((evidenceId) => collectedIds.has(evidenceId));
}

const validStages = new Set([
  'observing',
  'investigating',
  'reporting',
  'attack-reported',
  'mitigating',
  'mitigation-active',
  'network-recovery',
  'completed',
]);

// Creates a small state controller for the stages shared by every mission.
export function createMissionState(initialStage = 'observing') {
  let stage = initialStage;

  return {
    // Returns the mission's current gameplay stage.
    getStage() {
      return stage;
    },

    // Changes the gameplay stage after checking that the name is supported.
    setStage(nextStage) {
      if (!validStages.has(nextStage)) {
        throw new Error(`Unknown mission stage: ${nextStage}`);
      }
      stage = nextStage;
    },

    // Returns the mission to its original gameplay stage.
    reset() {
      stage = initialStage;
    },
  };
}

/** Creates an in-memory evidence collection that is cleared by a mission restart. */
export function createEvidenceStore(missionId) {
  const collectedEvidence = new Map();

  return {
    // Adds valid evidence once and rejects evidence from another mission.
    collect(evidence) {
      if (evidence.missionId !== missionId || collectedEvidence.has(evidence.id)) {
        return false;
      }

      collectedEvidence.set(evidence.id, { ...evidence, collected: true });
      return true;
    },

    // Checks whether an evidence item has already been collected.
    has(evidenceId) {
      return collectedEvidence.has(evidenceId);
    },

    // Returns every collected evidence item in collection order.
    getAll() {
      return [...collectedEvidence.values()];
    },

    // Removes all evidence when the mission restarts.
    clear() {
      collectedEvidence.clear();
    },
  };
}
