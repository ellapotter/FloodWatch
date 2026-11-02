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
  main.querySelector('button').addEventListener('click', () => {
    window.location.hash = 'home';
  });
  return main;
}
