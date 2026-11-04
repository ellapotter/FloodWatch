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

