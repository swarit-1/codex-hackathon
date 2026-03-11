"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { AppShell, SectionHeading, SettingsGrid } from "../../components/shared";
import { settingsSections } from "../../lib/contracts/mock-data";
import type { ProfileFormValues } from "../../lib/contracts/types";
import {
  useConvexEnabled,
  useCurrentUser,
  useRequireCurrentUser,
} from "../../lib/hooks";
import {
  getErrorMessage,
  profileFormValuesToProfileData,
  profileToFormValues,
} from "../../lib/utils";

const EMPTY_PROFILE_FORM: ProfileFormValues = {
  name: "",
  email: "",
  eid: "",
  major: "",
  classification: "",
  scholarshipInterests: "",
  notifications: "",
};

export default function SettingsPage() {
  const convexEnabled = useConvexEnabled();
  const { userId, profile, setCurrentUser } = useCurrentUser();
  const { isReady, isLoading, needsOnboarding } = useRequireCurrentUser();
  const updateProfile = useMutation(api.users.updateProfile);
  const [formValues, setFormValues] = useState<ProfileFormValues>(EMPTY_PROFILE_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFormValues(profileToFormValues(profile));
    }
  }, [profile]);

  if (!convexEnabled) {
    return (
      <AppShell currentPath="/settings">
        <section className="page-section intro-section">
          <SectionHeading
            title="Settings"
            description="Profile context, credentials, and notifications should live in one predictable place."
            actionHref="/my-agents"
            actionLabel="Return to operations"
          />
        </section>
        <section className="page-section">
          <SettingsGrid sections={settingsSections} />
        </section>
      </AppShell>
    );
  }

  if (!isReady || !userId) {
    return (
      <AppShell currentPath="/settings">
        <section className="page-section">
          <p className="empty-state">
            {isLoading || needsOnboarding ? "Loading account..." : "Preparing settings..."}
          </p>
        </section>
      </AppShell>
    );
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const updatedProfile = await updateProfile({
        userId: userId as Id<"users">,
        name: formValues.name.trim(),
        email: formValues.email.trim(),
        eid: formValues.eid.trim() || undefined,
        authMethod: "email",
        profileData: profileFormValuesToProfileData(formValues),
      });

      setCurrentUser(updatedProfile.id, updatedProfile);
      setStatusMessage("Profile saved.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Profile could not be saved."));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell currentPath="/settings">
      <section className="page-section intro-section">
        <SectionHeading
          title="Settings"
          description="Manage the student profile, saved preferences, and notification defaults used across your workflows."
          actionHref="/my-agents"
          actionLabel="Return to operations"
        />
      </section>

      <section className="page-section profile-layout">
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

          {statusMessage ? <p className="form-message success">{statusMessage}</p> : null}
          {errorMessage ? <p className="form-message error">{errorMessage}</p> : null}

          <div className="card-actions">
            <button disabled={isSaving} type="submit">
              {isSaving ? "Saving..." : "Save settings"}
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
