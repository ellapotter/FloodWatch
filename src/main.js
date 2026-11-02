import './styles/global.css';
import './styles/layout.css';

import { renderHomePage } from './pages/homePage.js';
import { renderMissionPage, renderPlaceholderPage } from './pages/placeholderPage.js';
import { renderStartPage } from './pages/startPage.js';

const app = document.querySelector('#app');

const routes = {
  home: renderHomePage,
  help: () => renderPlaceholderPage('Help', 'Help content will be added in a future phase.'),
  settings: () =>
    renderPlaceholderPage('Settings', 'Game settings will be added in a future phase.'),
};

function getRoute() {
  return window.location.hash.slice(1) || 'start';
}

function renderCurrentRoute() {
  const route = getRoute();
  let page;

  if (route.startsWith('mission/')) {
    page = renderMissionPage(route.replace('mission/', ''));
  } else {
    page = routes[route]?.() ?? renderStartPage();
  }

  app.replaceChildren(page);
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', renderCurrentRoute);
renderCurrentRoute();
