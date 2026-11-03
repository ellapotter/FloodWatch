// Builds the simple starting screen shown before the player enters the home page.
export function renderStartPage() {
  const main = document.createElement('main');
  main.className = 'start-screen';
  main.innerHTML = `
    <section aria-labelledby="page-title">
      <h1 id="page-title">FloodWatch</h1>
      <p>DoS Defense Simulator</p>
      <button type="button">Start</button>
    </section>
  `;
  // Opens the home page when the player presses Start.
  main.querySelector('button').addEventListener('click', () => {
    window.location.hash = 'home';
  });
  return main;
}
