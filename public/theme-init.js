/* global document, localStorage */
/** Restore the saved palette before the editor stylesheet and first paint. */
(function initializeTheme() {
  const root = document.documentElement;
  let theme = 'dark';
  try {
    const storageKey = root.dataset.themeStorageKey;
    if (storageKey && localStorage.getItem(storageKey) === 'light') theme = 'light';
  } catch {
    // Restricted storage still permits a usable default and session-only switching.
  }
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
})();
