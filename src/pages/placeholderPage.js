import { createNavigationPanel } from '../panels/navigationPanel.js';

// Creates a basic page for locked or unfinished routes.
function createPlaceholder(title, message) {
  const page = document.createElement('div');
  const main = document.createElement('main');
  main.className = 'page-layout';
  main.innerHTML = `
    <section class="panel placeholder" aria-labelledby="placeholder-title">
      <h1 id="placeholder-title">${title}</h1>
      <p>${message}</p>
      <a class="button-link" href="#home">Return to Home</a>
    </section>
  `;
  page.append(createNavigationPanel(), main);
  return page;
}

// Builds a placeholder page with the regular site navigation.
export function renderPlaceholderPage(title, message) {
  return createPlaceholder(title, message);
}
