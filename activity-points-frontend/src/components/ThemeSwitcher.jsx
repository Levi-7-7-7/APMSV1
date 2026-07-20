import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const OPTIONS = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

/**
 * Drop-in "Appearance" section for the three-dot dropdown menus
 * (student / tutor / admin). Lets the user pick Light, Dark, or
 * System (follows device setting) — System is the default.
 *
 * Clicking an option does NOT close the parent dropdown, so the
 * user can see the theme change take effect immediately.
 */
const ThemeSwitcher = () => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-switcher" role="group" aria-label="Appearance">
      <div className="theme-switcher-label">
        <Sun size={16} className="theme-switcher-label-icon" />
        <span>Appearance</span>
      </div>
      <div className="theme-switcher-options">
        {OPTIONS.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            className={`theme-switcher-option${theme === value ? ' active' : ''}`}
            onClick={() => setTheme(value)}
            aria-pressed={theme === value}
            aria-label={`${label} theme`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ThemeSwitcher;
