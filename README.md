# FloodWatch

FloodWatch is a browser-based educational cybersecurity game designed to teach new network defenders how to recognize and respond to denial-of-service (DoS) and distributed denial-of-service (DDoS) attacks.

This repository currently contains the Phase 1 website foundation and landing page. Interactive game features will be developed in later phases.

## Technologies

- HTML5 for semantic structure
- CSS3 for styling and responsive layouts
- Vanilla JavaScript using ES modules
- SVG for scalable visual assets
- Vite for local development and production builds

## Getting started

Install [Node.js](https://nodejs.org/) (version 20.19 or newer), then clone or download this repository and run:

```bash
npm install
npm run dev
```

Vite will print a local URL (usually `http://localhost:5173`) in the terminal. Open it in a browser to view the site.

## Production build

Create an optimized build in the `dist` directory:

```bash
npm run build
```

Preview that production build locally:

```bash
npm run preview
```

## Deploying to Vercel

1. Push the project to a GitHub repository.
2. Sign in to [Vercel](https://vercel.com/) and select **Add New > Project**.
3. Import the GitHub repository.
4. Vercel should detect Vite automatically. If needed, set the build command to `npm run build` and the output directory to `dist`.
5. Select **Deploy**.

No server or environment variables are needed for the Phase 1 website.

## Planned phases

1. **Website foundation:** project structure, responsive landing page, and deployment setup.
2. **Home experience:** introduction, navigation, and mission selection.
3. **Core simulation:** network visualization and reusable game systems.
4. **Educational levels:** SYN Flood, UDP Flood, HTTP Flood, and DNS Amplification scenarios.
5. **Final mission and polish:** combined-attack challenge, accessibility, testing, and refinement.

## Project structure

```text
FloodWatch/
├── public/             # Static files copied directly into the build
├── src/
│   ├── assets/         # Future images and other imported assets
│   ├── components/     # Future reusable interface components
│   ├── game/
│   │   ├── engine/     # Future shared simulation systems
│   │   └── levels/     # Future level-specific modules
│   ├── pages/          # Future page modules
│   ├── styles/         # Global design rules and page layout styles
│   └── main.js         # JavaScript entry point
├── index.html          # Main semantic HTML document
└── package.json        # Project scripts and development dependencies
```

Empty future-development directories contain `.gitkeep` files so Git can preserve the intended structure.
