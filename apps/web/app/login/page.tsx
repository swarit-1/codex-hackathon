"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthActions, useConvexEnabled, useCurrentUser } from "../../lib/hooks";
import { getErrorMessage } from "../../lib/utils";

function getNextPath() {
  if (typeof window === "undefined") {
    return "/marketplace";
  }

  return new URLSearchParams(window.location.search).get("next") || "/marketplace";
}

export default function LoginPage() {
  const router = useRouter();
  const convexEnabled = useConvexEnabled();
  const { sessionToken, isLoading, setSession } = useCurrentUser();
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const nextPath = getNextPath();

  useEffect(() => {
    if (convexEnabled && sessionToken && !isLoading) {
      router.replace(nextPath);
    }
  }, [convexEnabled, isLoading, nextPath, router, sessionToken]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await signIn({
        email: email.trim(),
        password,
      });

      if (!result) {
        return;
      }

      setSession(result.sessionToken, result.user);
      router.replace(nextPath);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Sign in failed."));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!convexEnabled) {
    return (
      <main className="standalone-shell">
        <section className="standalone-panel">
          <h1>Convex is not configured</h1>
          <p className="lede">
            Authentication is only available when the frontend is connected to a Convex deployment.
          </p>
          <div className="card-actions">
            <Link className="button-link" href="/">
              Return home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="standalone-shell">
      <section className="standalone-panel">
        <p className="kicker">Sign in</p>
        <h1>Access your LonghorNet workspace</h1>
        <p className="lede">
          Sign in with the email and password you used to register your student workflow account.
        </p>

        <form className="profile-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Email</span>
            <input
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="form-field">
            <span>Password</span>
            <input
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

          <div className="card-actions">
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
            <Link className="button-link secondary" href={`/onboarding?next=${encodeURIComponent(nextPath)}`}>
              Create account
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
