import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sun, Moon, Monitor, Palette, Sparkles, Check } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import '../css/AppearanceSettings.css';

const BUILT_IN_OPTIONS = [
  { value: 'light', label: 'Light', desc: 'Bright background, dark text', Icon: Sun },
  { value: 'dark', label: 'Dark', desc: 'Dark background, easy on the eyes at night', Icon: Moon },
  { value: 'teal', label: 'Teal', desc: 'Deep teal accent, inspired by the app brand', Icon: Palette },
  { value: 'system', label: 'System', desc: 'Matches your device setting automatically', Icon: Monitor },
];

/**
 * Full-page "Appearance" screen — reached from the three-dot menu on the
 * student / tutor / admin dashboards (replacing the old inline
 * ThemeSwitcher dropdown section) so there's more room to browse themes,
 * including building and using a custom one.
 *
 * `onBack` lets the admin panel (which doesn't use nested routes) supply
 * its own "close this tab" handler instead of browser back navigation.
 * `hideHeader` lets that same embedded usage skip this page's own
 * back-button/title, since the admin topbar already has one.
 */
export default function AppearanceSettings({ onBack, hideHeader = false }) {
  const navigate = useNavigate();
  const { theme, setTheme, customTheme, setCustomTheme } = useTheme();

  const handleBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  const customActive = theme === 'custom';

  return (
    <div className={`apps-page${hideHeader ? ' apps-page-embedded' : ''}`}>
      {!hideHeader && (
        <div className="apps-hero">
          <button className="apps-back-btn" onClick={handleBack} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <h1 className="apps-hero-title">Appearance</h1>
        </div>
      )}

      <p className="apps-section-label">THEME</p>
      <div className="apps-options">
        {BUILT_IN_OPTIONS.map(({ value, label, desc, Icon }) => {
          const active = theme === value;
          return (
            <button
              key={value}
              type="button"
              className={`apps-option${active ? ' active' : ''}`}
              onClick={() => setTheme(value)}
              aria-pressed={active}
            >
              <div className={`apps-option-icon apps-swatch-${value}`}>
                <Icon size={20} />
              </div>
              <div className="apps-option-text">
                <span className="apps-option-label">{label}</span>
                <span className="apps-option-desc">{desc}</span>
              </div>
              {active && (
                <span className="apps-option-check">
                  <Check size={16} />
                </span>
              )}
            </button>
          );
        })}

        {/* Custom theme — the swatch shows the user's own saved accent
            color instead of a fixed gradient, since it's user-defined. */}
        <button
          type="button"
          className={`apps-option${customActive ? ' active' : ''}`}
          onClick={() => setTheme('custom')}
          aria-pressed={customActive}
        >
          <div className="apps-option-icon" style={{ background: customTheme.accent }}>
            <Sparkles size={20} />
          </div>
          <div className="apps-option-text">
            <span className="apps-option-label">Custom</span>
            <span className="apps-option-desc">Your own color, saved and ready to use</span>
          </div>
          {customActive && (
            <span className="apps-option-check">
              <Check size={16} />
            </span>
          )}
        </button>
      </div>

      {/* Editor — always reachable (not just once Custom is active) so the
          user can tweak their color and preview it before switching to it,
          and stays open afterwards so they can keep adjusting it live. */}
      <p className="apps-section-label apps-section-label-spaced">CREATE YOUR OWN THEME</p>
      <div className="apps-custom-editor">
        <div className="apps-custom-row">
          <label htmlFor="apps-accent-input">Accent color</label>
          <div className="apps-color-input-wrap">
            <input
              id="apps-accent-input"
              type="color"
              value={customTheme.accent}
              onChange={(e) => setCustomTheme({ accent: e.target.value })}
            />
            <span className="apps-color-hex">{customTheme.accent.toUpperCase()}</span>
          </div>
        </div>

        <div className="apps-custom-row">
          <label>Background</label>
          <div className="apps-base-toggle" role="group" aria-label="Custom theme background">
            <button
              type="button"
              className={customTheme.base === 'light' ? 'active' : ''}
              onClick={() => setCustomTheme({ base: 'light' })}
            >
              <Sun size={14} /> Light
            </button>
            <button
              type="button"
              className={customTheme.base === 'dark' ? 'active' : ''}
              onClick={() => setCustomTheme({ base: 'dark' })}
            >
              <Moon size={14} /> Dark
            </button>
          </div>
        </div>

        <p className="apps-custom-hint">
          Pick a color and a background, then tap <strong>Custom</strong> above to use it. Changes here update your
          saved custom theme immediately, even before you switch to it.
        </p>

        {!customActive && (
          <button type="button" className="apps-custom-apply-btn" onClick={() => setTheme('custom')}>
            <Sparkles size={16} /> Use This Theme
          </button>
        )}
      </div>
    </div>
  );
}
