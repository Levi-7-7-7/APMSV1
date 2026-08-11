/**
 * components/ErrorBoundary.jsx
 *
 * Catches uncaught render/lifecycle errors anywhere below it in the tree
 * and shows a calm recovery screen instead of a blank white page.
 *
 * React error boundaries are class components by requirement — there is
 * no hook equivalent for componentDidCatch/getDerivedStateFromError.
 *
 * Usage:
 *   - One instance wraps the whole app (in App.jsx) as the last resort.
 *   - Optionally wrap a specific risky section (e.g. an export/chart
 *     widget) in its own <ErrorBoundary label="..."> so a failure there
 *     doesn't take down the rest of the page around it.
 */
import React from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';
import '../css/ErrorBoundary.css';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // Centralized so swapping in a real error-tracking SDK later (Sentry,
    // etc.) only means changing this one spot.
    console.error(`[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}]`, error, info?.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    // A full reload is deliberate, not just resetting local state — a
    // thrown render error often means something in memory (context,
    // cached data) is in a bad state, so starting clean is safer than
    // silently re-rendering the same broken tree.
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className={`eb-container ${this.props.inline ? 'eb-inline' : 'eb-fullscreen'}`}>
        <div className="eb-icon"><AlertTriangle size={this.props.inline ? 22 : 30} /></div>
        <h2 className="eb-title">Something went wrong</h2>
        <p className="eb-message">
          {this.props.inline
            ? "This part of the page couldn't load. The rest of the app is unaffected."
            : "The app hit an unexpected error. Reloading usually fixes it."}
        </p>
        <button type="button" className="eb-retry" onClick={this.handleReload}>
          <RotateCw size={15} /> Reload
        </button>
      </div>
    );
  }
}
