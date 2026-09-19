import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  applyActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import {
  auth,
  configured,
  authReady,
  call,
  errorMessage,
} from "../services/firebase.js";
import { useAuth } from "../app/AuthContext.jsx";
export function AuthForm() {
  const { pathname } = useLocation(),
    nav = useNavigate();
  const signup = pathname === "/sign-up",
    reset = pathname === "/reset-password";
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await authReady;
      if (reset) {
        await sendPasswordResetEmail(auth, email);
        setNotice(
          "If an account can receive a reset email, a link will arrive shortly.",
        );
      } else {
        const cred = await (
          signup ? createUserWithEmailAndPassword : signInWithEmailAndPassword
        )(auth, email, password);
        setPassword("");
        if (signup) await sendEmailVerification(cred.user);
        nav(cred.user.emailVerified ? "/check" : "/verify-email");
      }
    } catch {
      setNotice(
        reset
          ? "If an account can receive a reset email, a link will arrive shortly."
          : "Unable to continue with those details. Check your email and password, or try password reset.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card narrow">
      <span className="eyebrow">YOUR PRIVATE WORKSPACE</span>
      <h1>
        {reset
          ? "Reset your password"
          : signup
            ? "Create your account"
            : "Welcome back"}
      </h1>
      <p>Sign in with your verified email to use Scam Shield.</p>
      <form onSubmit={submit}>
        <label>
          Email address
          <input
            autoComplete="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        {!reset && (
          <>
            <label>
              Password
              <input
                type={show ? "text" : "password"}
                autoComplete={signup ? "new-password" : "current-password"}
                minLength={signup ? 12 : undefined}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="checkline">
              <input
                type="checkbox"
                checked={show}
                onChange={(e) => setShow(e.target.checked)}
              />
              Show password
            </label>
            {signup && (
              <small>
                Use at least 12 characters. Password managers and paste are
                supported.
              </small>
            )}
          </>
        )}
        {!configured && (
          <p className="notice">
            Service setup is pending. See the repository setup guide.
          </p>
        )}
        <button className="primary" disabled={busy || !configured}>
          {busy
            ? "Please wait…"
            : reset
              ? "Send reset link"
              : signup
                ? "Create account"
                : "Sign in"}
        </button>
        <p role="status">{notice}</p>
      </form>
      <div className="auth-links">
        <Link to={signup ? "/sign-in" : "/sign-up"}>
          {signup ? "Already have an account? Sign in" : "Create an account"}
        </Link>
        <Link to="/reset-password">Reset password</Link>
      </div>
    </section>
  );
}
export function VerifyEmail() {
  const { user, refresh } = useAuth();
  const [notice, setNotice] = useState(""),
    [cooldown, setCooldown] = useState(0),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  async function run(fn) {
    setBusy(true);
    try {
      await fn();
    } catch {
      setNotice("Could not update verification. Try again shortly.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card narrow">
      <span className="eyebrow">ONE MORE STEP</span>
      <h1>Verify your email</h1>
      <p>
        Open the verification link in your inbox, then refresh your status here.
      </p>
      {user ? (
        <>
          <p>{user.email}</p>
          {user.emailVerified ? (
            <Link className="primary link-button" to="/check">
              Continue to checker
            </Link>
          ) : (
            <>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await refresh();
                    setNotice(
                      "Status refreshed. If still unverified, open the link in your inbox.",
                    );
                  })
                }
              >
                I have verified my email
              </button>
              <button
                className="secondary"
                disabled={busy || cooldown > 0}
                onClick={() =>
                  run(async () => {
                    await sendEmailVerification(auth.currentUser);
                    setCooldown(60);
                    setNotice(
                      "Verification email requested. Check your inbox and spam folder.",
                    );
                  })
                }
              >
                {cooldown
                  ? `Resend in ${cooldown}s`
                  : "Resend verification email"}
              </button>
            </>
          )}
        </>
      ) : (
        <Link to="/sign-in">Sign in to verify</Link>
      )}
      <p role="status">{notice}</p>
    </section>
  );
}
export function AuthAction() {
  const [params] = useState(() => new URLSearchParams(window.location.search));
  const mode = params.get("mode"),
    code = params.get("oobCode");
  const [password, setPassword] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  useEffect(() => {
    window.history.replaceState({}, "", window.location.pathname);
  }, []);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "verifyEmail") await applyActionCode(auth, code);
      else if (mode === "resetPassword") {
        await verifyPasswordResetCode(auth, code);
        await confirmPasswordReset(auth, code, password);
      } else throw Error();
      setPassword("");
      setDone(true);
      setNotice("Completed. You can return to sign in.");
    } catch {
      setNotice(
        "This link is invalid or expired. Request a new verification or password-reset email.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card narrow">
      <h1>
        {mode === "verifyEmail"
          ? "Confirm email verification"
          : "Set a new password"}
      </h1>
      <form onSubmit={submit}>
        {mode === "resetPassword" && !done && (
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        <button
          className="primary"
          disabled={
            busy ||
            done ||
            !configured ||
            !code ||
            !["verifyEmail", "resetPassword"].includes(mode)
          }
        >
          Confirm
        </button>
      </form>
      <p role="status">{notice}</p>
      <div className="auth-links">
        <Link to="/sign-in">Sign in</Link>
        <Link to="/verify-email">Verification help</Link>
        <Link to="/reset-password">New reset link</Link>
      </div>
    </section>
  );
}
export function Account() {
  const { user, logout, clearSession } = useAuth();
  const [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setPassword("");
    setConfirm(false);
  }, [user?.uid]);
  async function remove(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await reauthenticateWithCredential(
        auth.currentUser,
        EmailAuthProvider.credential(user.email, password),
      );
      await auth.currentUser.getIdToken(true);
      await call("deleteAccount", { requestId: crypto.randomUUID() });
      clearSession();
      setPassword("");
      await logout();
      setNotice(
        "Your account deletion request completed. You have been signed out.",
      );
    } catch (e) {
      setNotice(errorMessage(e));
      setPassword("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card narrow">
      <h1>Your account</h1>
      <p role="status">{notice}</p>
      {user ? (
        <>
          <p>{user.email}</p>
          <p>{user.emailVerified ? "Email verified" : "Email not verified"}</p>
          <button className="secondary" onClick={logout}>
            Sign out
          </button>
          <hr />
          <h2>Delete your account</h2>
          <p>
            This permanently removes your account and its operational metadata.
            No scan history is stored.
          </p>
          {!user.emailVerified ? (
            <Link to="/verify-email">Verify email before deleting</Link>
          ) : (
            <form onSubmit={remove}>
              <label>
                Confirm your password
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="checkline">
                <input
                  type="checkbox"
                  required
                  checked={confirm}
                  onChange={(e) => setConfirm(e.target.checked)}
                />
                I understand this deletion is permanent.
              </label>
              <button className="danger" disabled={busy || !confirm}>
                {busy ? "Requesting deletion…" : "Permanently delete account"}
              </button>
            </form>
          )}
        </>
      ) : (
        <Link to="/sign-in">Sign in</Link>
      )}
    </section>
  );
}
