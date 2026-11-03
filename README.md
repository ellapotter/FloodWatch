# FloodWatch

FloodWatch is a browser-based educational cybersecurity game for learning how denial-of-service attacks affect networks and how defenders can respond. The implemented first mission shows normal TCP communication, develops into a SYN flood, and guides the player through investigation, evidence collection, attack reporting, SYN cookie mitigation, and network recovery.

## Technology stack

- HTML5 and accessible native controls
- CSS3 and responsive layouts
- Vanilla JavaScript with ES modules
- SVG for the interactive network diagram and packet movement
- `localStorage` for settings and mission progress
- Vite for local development and production builds
- Node's built-in test runner for automated tests

The application has no backend. Simulation and player state run in the browser.

## Running locally

Install Node.js 20.19 or newer, then run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

Other useful commands:

```bash
npm test          # Run the automated tests
npm run build     # Create the production build in dist/
npm run preview   # Preview the production build locally
```

`node_modules/` contains installed packages and can be recreated with `npm install`. `dist/` contains generated production output and can be recreated with `npm run build`.

## Project structure

```text
FloodWatch/
├── src/
│   ├── glossary/         # Shared glossary data and interactive glossary text
│   ├── panels/           # Reusable panels, mission catalog, and progress tracking
│   ├── game/
│   │   ├── gameEngine.js # Shared simulation, mission, evidence, and choice state
│   │   └── levels/       # Level-specific configuration and educational content
│   ├── pages/            # Route-level page assembly and mission coordination
│   ├── styles/           # Global, layout, and glossary styles
│   └── main.js           # Application entry point and hash router
├── test/                 # Automated engine, gameplay, settings, and glossary tests
├── index.html            # Browser entry document
└── package.json          # Scripts and development dependencies
```

## Application architecture

The application uses URL hashes such as `#home`, `#help`, and `#mission/syn-flood` for routing. [src/main.js](src/main.js) renders the matching page and calls page lifecycle methods when a mission is suspended, resumed, or left.

Page modules assemble reusable panels. The shared page in [src/pages/missionPage.js](src/pages/missionPage.js) coordinates the Network Observer, investigation panel, evidence store, attack report, mitigation interface, mission state, and completion screen. [src/panels/missionCardPanel.js](src/panels/missionCardPanel.js) stores mission information and connects implemented mission IDs to their definitions, while each level definition supplies protocol-specific behavior.

The main gameplay systems are separated by responsibility:

- `gameEngine.js` contains shared simulation lifecycle, mission-stage, evidence, and choice-state behavior.
- `NetworkSimulation` provides one lifecycle interface and delegates network behavior to the active level driver.
- `LevelOneSimulation` schedules Level 1 clients, TCP packets, attack attempts, and recovery using its simulation clock.
- `TcpConnectionModel` owns Level 1's simplified pending-connection backlog and TCP handshake counters.
- Level definitions provide a standard mission runtime, statistics, investigation content selection, reporting choices, mitigation choices, and completion data.
- `NetworkObserver` converts simulation snapshots into the interactive SVG diagram.
- Investigation definitions use the current simulation snapshot to choose content and evidence availability.
- Evidence is kept in a mission-scoped in-memory store and passed into the reporting interface.
- Correct reporting unlocks mitigation; correct mitigation enables simplified SYN cookie behavior.
- Progress and settings are stored under separate `localStorage` keys.
- Glossary helpers replace recognized terms in displayed text with buttons that open a definition dialog.

## Level 1 gameplay flow

1. Legitimate clients appear, perform SYN/SYN-ACK/ACK handshakes, exchange data, and leave.
2. After the configured normal-traffic period, one occupied client position is selected randomly and begins sending repeated SYN packets without completing the handshake.
3. Half-open connections consume the simplified server backlog. Later legitimate clients can be delayed or rejected when it is full.
4. The player investigates clients, packets, and the server. Evidence only becomes collectable when its supporting behavior has occurred.
5. Relevant collected evidence enables the Report Attack dialog. A correct SYN flood report advances the mission to mitigation.
6. Selecting SYN cookies changes how new connection requests are handled: incomplete attack requests no longer allocate pending backlog state, while legitimate handshakes can complete.
7. Once the configured recovery conditions are met, Level 1 is marked complete and its progress is saved.

## Extending the game

- Add mission metadata and its implemented definition to `src/panels/missionCardPanel.js`, then create the level-specific files under `src/game/levels/`.
- Give each new level its own simulation driver under `src/game/levels/`, then connect that driver through `NetworkSimulation`. Reuse or extend files in `src/game/` only when behavior is truly shared by multiple levels.
- Keep player-facing investigation, reporting, and mitigation wording in one level content module, following `levelOneContent.js`.
- Keep simulation configuration, investigation selection, runtime creation, and recovery rules in one mission module, following `levelOneMission.js`.
- Add shared networking definitions and aliases to `src/glossary/networkGlossary.js`.

Keep educational wording in data modules rather than embedding long explanations in component rendering code. This lets components remain reusable and makes the source material easier to verify.
