"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProfileFormValues } from "../../lib/contracts/types";
import { useAuthActions, useConvexEnabled, useCurrentUser } from "../../lib/hooks";
import {
  getErrorMessage,
  profileFormValuesToProfileData,
} from "../../lib/utils";

const INITIAL_FORM_VALUES: ProfileFormValues = {
  name: "",
  email: "",
  eid: "",
  major: "",
  classification: "",
  scholarshipInterests: "",
  notifications: "",
};

function getNextPath() {
  if (typeof window === "undefined") {
    return "/marketplace";
  }

  return new URLSearchParams(window.location.search).get("next") || "/marketplace";
}

export default function OnboardingPage() {
  const router = useRouter();
  const convexEnabled = useConvexEnabled();
  const { sessionToken, isLoading, setSession } = useCurrentUser();
  const { signUp } = useAuthActions();
  const [formValues, setFormValues] = useState<ProfileFormValues>(INITIAL_FORM_VALUES);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await signUp({
        name: formValues.name.trim(),
        email: formValues.email.trim(),
        password,
        eid: formValues.eid.trim() || undefined,
        profileData: profileFormValuesToProfileData(formValues),
      });

      if (!result) {
        return;
      }

      setSession(result.sessionToken, result.user);
      router.replace(nextPath);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Account creation failed."));
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
        <p className="kicker">Create account</p>
        <h1>Create your LonghorNet profile</h1>
        <p className="lede">
          Register with email and password, then save the student profile your marketplace installs and workflows will use by default.
        </p>

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="field-grid two-column">
            <label className="form-field">
              <span>Name</span>
              <input
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    name: event.target.value,
                  }))
                }
                required
                type="text"
                value={formValues.name}
              />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    email: event.target.value,
                  }))
                }
                required
                type="email"
                value={formValues.email}
              />
            </label>
            <label className="form-field">
              <span>Password</span>
              <input
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <label className="form-field">
              <span>Confirm password</span>
              <input
                minLength={8}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                type="password"
                value={confirmPassword}
              />
            </label>
            <label className="form-field">
              <span>UT EID</span>
              <input
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    eid: event.target.value,
                  }))
                }
                type="text"
                value={formValues.eid}
              />
            </label>
            <label className="form-field">
              <span>Classification</span>
              <input
                onChange={(event) =>
                  setFormValues((currentValues) => ({
                    ...currentValues,
                    classification: event.target.value,
                  }))
                }
                type="text"
                value={formValues.classification}
              />
            </label>
          </div>

          <label className="form-field">
            <span>Major</span>
            <input
              onChange={(event) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  major: event.target.value,
                }))
              }
              type="text"
              value={formValues.major}
            />
          </label>

          <label className="form-field">
            <span>Scholarship interests</span>
            <textarea
              onChange={(event) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  scholarshipInterests: event.target.value,
                }))
              }
              rows={4}
              value={formValues.scholarshipInterests}
            />
          </label>

          <label className="form-field">
            <span>Notifications</span>
            <textarea
              onChange={(event) =>
                setFormValues((currentValues) => ({
                  ...currentValues,
                  notifications: event.target.value,
                }))
              }
              rows={3}
              value={formValues.notifications}
            />
          </label>

          {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

          <div className="card-actions">
            <button disabled={isSubmitting} type="submit">
              {isSubmitting ? "Creating account..." : "Create account"}
            </button>
            <Link className="button-link secondary" href={`/login?next=${encodeURIComponent(nextPath)}`}>
              Sign in instead
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}
