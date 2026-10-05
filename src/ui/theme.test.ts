import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTheme, setTheme } from './theme';

const STORAGE_KEY = 'palette-test-preference';
const initializer = readFileSync(new URL('../../public/theme-init.js', import.meta.url), 'utf8');
const root = { dataset: { themeStorageKey: STORAGE_KEY, theme: 'dark' }, style: { colorScheme: 'dark' } };
const storage = { getItem: vi.fn(), setItem: vi.fn() };
beforeEach(() => {
  root.dataset.theme = 'dark'; root.style.colorScheme = 'dark';
  storage.getItem.mockReset(); storage.setItem.mockReset();
  vi.stubGlobal('document', { documentElement: root });
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('editor palette preference', () => {
  it('restores a persisted light palette before first paint using the configured key', () => {
    storage.getItem.mockReturnValue('light');
    runInNewContext(initializer, { document: { documentElement: root }, localStorage: storage });
    expect(root).toMatchObject({ dataset: { theme: 'light' }, style: { colorScheme: 'light' } });
    expect(storage.getItem).toHaveBeenCalledWith(STORAGE_KEY);
    expect(getTheme()).toBe('light');
  });

  it('uses the dark default for missing or malformed persisted values', () => {
    for (const preference of [null, 'unexpected', 'LIGHT']) {
      storage.getItem.mockReturnValue(preference);
      runInNewContext(initializer, { document: { documentElement: root }, localStorage: storage });
      expect(root.dataset.theme).toBe('dark');
      expect(root.style.colorScheme).toBe('dark');
    }
  });

  it('remains usable when storage is unavailable during startup', () => {
    storage.getItem.mockImplementation(() => { throw new Error('Storage blocked'); });
    expect(() => runInNewContext(initializer, { document: { documentElement: root }, localStorage: storage })).not.toThrow();
    expect(getTheme()).toBe('dark');
  });

  it('applies and persists palette changes without altering document state', () => {
    expect(setTheme('light')).toBe(true);
    expect(root.style.colorScheme).toBe('light');
    expect(storage.setItem).toHaveBeenLastCalledWith(STORAGE_KEY, 'light');
    expect(setTheme('dark')).toBe(true);
    expect(getTheme()).toBe('dark');
    expect(storage.setItem).toHaveBeenLastCalledWith(STORAGE_KEY, 'dark');
  });

  it('keeps the chosen session palette when preference storage fails', () => {
    storage.setItem.mockImplementation(() => { throw new Error('Storage blocked'); });
    expect(setTheme('light')).toBe(false);
    expect(getTheme()).toBe('light');
    expect(root.style.colorScheme).toBe('light');
  });
});
