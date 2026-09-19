import React from "react";
import { Routes, Route, Link, NavLink, useLocation } from "react-router-dom";
import { Shield, ArrowUpRight } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import { Checker } from "../features/Checker.jsx";
import {
  AuthForm,
  VerifyEmail,
  AuthAction,
  Account,
} from "../features/Auth.jsx";
import { actionsFor, SOURCES } from "../../shared/catalog.js";
function Privacy() {
  return (
    <article className="card prose">
      <span className="eyebrow">PRIVACY NOTICE · VERSION 1.0</span>
      <h1>Your message is yours.</h1>
      <p>
        Message text, screenshots, extracted text and reports stay in browser
        memory for the active check. We do not save them to our database, object
        storage, analytics, or scan history. Closing or refreshing this tab
        clears the draft.
      </p>
      <h2>Processing on your device</h2>
      <p>
        In the free web version, messages are checked in your browser.
        Screenshot text is extracted on your device using Tesseract.js. Images
        and message text are not uploaded. The OCR engine and English model
        download from this site. Review extracted text before checking it.
      </p>
      <h2>Account data</h2>
      <p>
        Firebase Authentication handles your email, password and verification.
        This version creates no database profiles, scan history, quota records
        or scan metadata. Sign-in lasts for your browser session. Vercel serves
        the site assets; provider infrastructure may retain access/security
        logs. We do not send scan content to those logs or collect it for
        training.
      </p>
      <h2>Delete your account</h2>
      <p>
        From <Link to="/account">Account</Link>, verify your email and confirm
        your password to delete your Firebase login. Browser drafts are cleared
        on sign-out, refresh or closing the tab. This version stores no scan
        data on a server to delete.
      </p>
      <h2>About the free version</h2>
      <p>
        Sign-in is part of the app flow, not protection for a private analysis
        service. The checking rules run locally, and there are no
        server-enforced daily checking limits. Results are guidance, not proof
        of authenticity.
      </p>
    </article>
  );
}
function Help() {
  return (
    <article className="card prose">
      <span className="eyebrow">TAKE YOUR NEXT STEP</span>
      <h1>Help when something feels wrong.</h1>
      <p>
        Scam Shield checks English text for a fixed set of patterns. It does not
        verify senders, websites or screenshots. A result without listed signs
        is not a safety guarantee.
      </p>
      {["sent_money", "shared_password", "shared_details", "clicked"].map(
        (k) => {
          const a = actionsFor([], k)[0];
          return (
            <section key={k}>
              <h2>{a.title}</h2>
              <p>{a.detail}</p>
            </section>
          );
        },
      )}
      <h2>Trusted guidance</h2>
      <p>
        These sources are from the US Federal Trade Commission. For official
        reporting, use a service appropriate to your country.
      </p>
      <ul>
        {Object.values(SOURCES).map((s) => (
          <li key={s.id}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.title} ↗
            </a>
          </li>
        ))}
      </ul>
      <h2>Supported inputs</h2>
      <p>
        20–10,000 characters, in English; or one JPEG, PNG or WebP up to 4 MiB
        and 20 megapixels. PDF, HEIC, GIF, SVG, QR decoding and attachments are
        not supported. Translate unsupported languages cautiously and verify
        independently.
      </p>
    </article>
  );
}
export default function App() {
  const { user, ready, epoch, logout } = useAuth();
  const location = useLocation();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Scam Shield home">
          <span className="brand-icon">
            <Shield size={24} strokeWidth={1.8} />
          </span>
          <span>
            scam<span className="brand-light">shield</span>
            <small>A MOMENT OF CAUTION. MORE PEACE OF MIND.</small>
          </span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/check">Check a message</NavLink>
          <NavLink to="/help">Help & guidance</NavLink>
          {user ? (
            <>
              <NavLink to="/account">Account</NavLink>
              <button className="nav-auth" onClick={logout}>
                Sign out <ArrowUpRight size={15} />
              </button>
            </>
          ) : (
            <Link className="nav-auth" to="/sign-in">
              Sign in <ArrowUpRight size={15} />
            </Link>
          )}
        </nav>
      </header>
      <main id="main">
        {!ready ? (
          <p role="status">Loading your session…</p>
        ) : (
          <Routes>
            <Route path="/" element={<Checker key={`${epoch}-home`} />} />
            <Route path="/check" element={<Checker key={`${epoch}-check`} />} />
            {["/sign-in", "/sign-up", "/reset-password"].map((path) => (
              <Route
                key={path}
                path={path}
                element={<AuthForm key={location.pathname} />}
              />
            ))}
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/auth/action" element={<AuthAction />} />
            <Route path="/account" element={<Account />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/help" element={<Help />} />
            <Route
              path="*"
              element={
                <section className="card narrow">
                  <h1>Page not found</h1>
                  <Link to="/check">Go to the checker</Link>
                </section>
              }
            />
          </Routes>
        )}
      </main>
      <footer>
        <span>© {new Date().getFullYear()} Scam Shield</span>
        <span>A clearer next step, never a guarantee.</span>
        <div>
          <Link to="/privacy">Privacy</Link>
          <Link to="/help">Help</Link>
        </div>
      </footer>
    </div>
  );
}
