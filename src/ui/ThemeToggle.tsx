import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { getTheme, setTheme } from './theme';

/** Toggle the editor palette with a readable label and a persisted browser preference. */
export function ThemeToggle() {
  const [theme, setCurrentTheme] = useState(getTheme);
  const [isPersisted, setIsPersisted] = useState(true);
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const nextLabel = nextTheme === 'light' ? '柔和浅色' : '柔和深色';
  const handleToggleTheme = () => {
    setIsPersisted(setTheme(nextTheme));
    setCurrentTheme(nextTheme);
  };
  return <button className="theme-toggle" aria-label={`切换到${nextLabel}`} aria-pressed={theme === 'light'}
    title={isPersisted ? `切换到${nextLabel}；自动记住偏好` : '本次主题已切换；当前浏览器不允许保存偏好'} onClick={handleToggleTheme}>
    {theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}<span>{theme === 'light' ? '柔和浅色' : '柔和深色'}</span>
  </button>;
}
