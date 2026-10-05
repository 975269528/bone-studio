export type EditorTheme = 'light' | 'dark';

/** Read the palette initialized before first paint; unknown values use the dark default. */
export function getTheme(): EditorTheme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** Apply the palette immediately and report whether the browser saved the preference. */
export function setTheme(theme: EditorTheme): boolean {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  try {
    const storageKey = root.dataset.themeStorageKey;
    if (!storageKey) return false;
    localStorage.setItem(storageKey, theme);
    return true;
  } catch {
    return false;
  }
}
