// Creates the shared navigation bar used across the website.
export function createNavigationPanel() {
  const navigation = document.createElement('header');
  navigation.className = 'site-header';
  navigation.innerHTML = `
    <nav class="navigation" aria-label="Main navigation">
      <a class="navigation__title" href="#home">FloodWatch</a>
      <div class="navigation__links">
        <a href="#home">Home</a>
        <a href="#help">Help</a>
        <a href="#settings">Settings</a>
      </div>
    </nav>
  `;
  return navigation;
}
