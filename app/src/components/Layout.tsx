import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { appConfig, isConfigured } from "../lib/config";
import { ConnectButton } from "./ConnectButton";

const navItems = [
  { to: "/", label: "Home", end: true },
  { to: "/desk", label: "Desk" },
  { to: "/proof", label: "Proof" },
  { to: "/docs", label: "Docs" }
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-inner">
          <Link className="brand" to="/" aria-label="Requisition home">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
            </span>
            <span className="brand-text">
              <strong>Requisition</strong>
              <small>agent intent / human approval</small>
            </span>
          </Link>
          <nav className="site-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            <ConnectButton />
          </div>
        </div>
      </header>

      {!isConfigured && (
        <div className="config-banner">
          <div className="container">
            Contract configuration is pending. The public app is ready; onchain
            payment activates after a contract address is configured.
          </div>
        </div>
      )}

      <main className="site-main">
        <div className="container">{children}</div>
      </main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <div>
            <div className="footer-brand">Requisition</div>
            <p>
              Independent project. Not affiliated with Circle or Arc. Unaudited.
              Use small amounts.
            </p>
          </div>
          <div className="footer-links">
            <Link to="/docs">Security model</Link>
            <Link to="/proof">Live proof</Link>
            {appConfig.repoUrl && (
              <a href={appConfig.repoUrl} target="_blank" rel="noreferrer">
                Repository
              </a>
            )}
            {appConfig.studioUrl && (
              <a href={appConfig.studioUrl} target="_blank" rel="noreferrer">
                Arc Studio
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
