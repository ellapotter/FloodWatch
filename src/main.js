import './styles/global.css';
import './styles/glossary.css';
import './styles/layout.css';

import { renderHelpPage } from './pages/helpPage.js';
import { renderHomePage } from './pages/homePage.js';
import { renderMissionPage } from './pages/missionPage.js';
import { renderSettingsPage } from './pages/settingsPage.js';

const app = document.querySelector('#app');
let currentPage = null;
let currentRoute = null;
let suspendedMission = null;
const auxiliaryRoutes = new Set(['help', 'settings']);

const routes = {
  home: renderHomePage,
};

// Reads the requested page from the URL; defaults to the home page.
function getRoute() {
  return window.location.hash.slice(1) || 'home';
}

// Renders the requested page and runs reset, pause, or resume when needed.
function renderCurrentRoute() {
  const route = getRoute();
  let page;
  let shouldCleanupCurrentPage = true;

  if (auxiliaryRoutes.has(route)) {
    if (currentRoute?.startsWith('mission/') && currentPage) {
      currentPage.suspend?.();
      suspendedMission = { route: currentRoute, page: currentPage };
      shouldCleanupCurrentPage = false;
    }

    if (route === 'help') {
      page = renderHelpPage({ returnRoute: suspendedMission?.route });
    } else {
      page = renderSettingsPage({
        returnRoute: suspendedMission?.route,
        // Refreshes the home page after saved mission progress is cleared
        onProgressReset() {
          suspendedMission?.page.cleanup?.();
          suspendedMission = null;
        },
      });
    }
  } else if (suspendedMission && route === suspendedMission.route) {
    page = suspendedMission.page;
    suspendedMission = null;
    page.resume?.();
  } else if (route.startsWith('mission/')) {
    page = renderMissionPage(route.replace('mission/', ''));
  } else {
    page = routes[route]?.() ?? renderHomePage();
  }

  if (shouldCleanupCurrentPage) currentPage?.cleanup?.();
  if (suspendedMission && !auxiliaryRoutes.has(route)) {
    suspendedMission.page.cleanup?.();
    suspendedMission = null;
  }
  currentPage = page;
  currentRoute = route;
  app.replaceChildren(currentPage);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', renderCurrentRoute);
renderCurrentRoute();
