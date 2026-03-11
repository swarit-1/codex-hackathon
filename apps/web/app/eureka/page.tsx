"use client";

import { useState } from "react";
import { AppShell, SectionHeading } from "../../components/shared";
import type { LabOpening, LabOpeningStatus } from "../../lib/contracts/types";

const MOCK_LAB_OPENINGS: LabOpening[] = [
  {
    id: "lab_001",
    labName: "Intelligent Systems Lab",
    professorName: "Dr. Peter Stone",
    professorEmail: "pstone@cs.utexas.edu",
    department: "Computer Science",
    researchArea: "AI, Machine Learning, Multi-Agent Systems",
    source: "Eureka",
    postedDate: "2026-03-01",
    deadline: "2026-04-15",
    requirements: "Looking for Undergraduate students in Computer Science with interest in AI/ML. Experience with Python and PyTorch preferred.",
    matchScore: 0.98,
    status: "email_ready",
    emailDraft: `Subject: Interest in Undergraduate Research Position - Intelligent Systems Lab

Dear Dr. Peter Stone,

I am writing to express my strong interest in the research opening in the Intelligent Systems Lab that I found on Eureka. I am a Undergraduate Computer Science student at UT Austin with a 3.8 GPA, and your work in AI, Machine Learning, Multi-Agent Systems aligns closely with my academic interests.

I am particularly interested in machine learning, systems and would welcome the opportunity to contribute to your lab's research. Relevant coursework includes CS 429 Computer Organization, CS 439 Operating Systems, CS 378 Machine Learning. I have experience with Python, PyTorch, C++, Linux.

I understand you are looking for students who meet the following: Looking for Undergraduate students in Computer Science with interest in AI/ML. Experience with Python and PyTorch preferred.

I would be grateful for the chance to discuss how I might contribute to your ongoing projects. I am available to meet at your convenience and can provide my resume, transcript, or any additional materials upon request.

Thank you for your time and consideration.

Best regards,
UT Student
Computer Science, Undergraduate
The University of Texas at Austin`,
  },
  {
    id: "lab_002",
    labName: "Natural Language Processing Group",
    professorName: "Dr. Greg Durrett",
    professorEmail: "gdurrett@cs.utexas.edu",
    department: "Computer Science",
    researchArea: "NLP, Information Extraction, Question Answering",
    source: "UT Research Portal",
    postedDate: "2026-03-05",
    deadline: "2026-05-01",
    requirements: "Open to Undergraduate students with NLP or linguistics background. Python and transformer models experience a plus.",
    matchScore: 0.91,
    status: "discovered",
  },
  {
    id: "lab_003",
    labName: "Systems and Networking Lab",
    professorName: "Dr. Simon Peter",
    professorEmail: "simon@cs.utexas.edu",
    department: "Computer Science",
    researchArea: "Operating Systems, Distributed Systems, Networking",
    source: "Eureka",
    postedDate: "2026-02-20",
    deadline: "2026-04-01",
    requirements: "Seeking Undergraduate researchers with strong C/C++ and systems programming background.",
    matchScore: 0.88,
    status: "discovered",
  },
  {
    id: "lab_004",
    labName: "Robotics and Autonomous Systems Lab",
    professorName: "Dr. Joydeep Biswas",
    professorEmail: "joydeepb@cs.utexas.edu",
    department: "Computer Science",
    researchArea: "Robotics, Computer Vision, Autonomous Navigation",
    source: "Eureka",
    postedDate: "2026-03-08",
    requirements: "Undergraduate students in Computer Science or ECE. ROS2 experience preferred, C++ required.",
    matchScore: 0.85,
    status: "discovered",
  },
  {
    id: "lab_005",
    labName: "Computational Visualization Center",
    professorName: "Dr. Chandrajit Bajaj",
    professorEmail: "bajaj@cs.utexas.edu",
    department: "Computer Science",
    researchArea: "Scientific Visualization, Computational Biology, Geometric Modeling",
    source: "UT Research Portal",
    postedDate: "2026-02-15",
    deadline: "2026-03-30",
    requirements: "Looking for motivated Undergraduate students with strong math background. Graphics/OpenGL experience welcome.",
    matchScore: 0.78,
    status: "expired",
  },
];

function getStatusLabel(status: LabOpeningStatus): string {
  const labels: Record<LabOpeningStatus, string> = {
    discovered: "New",
    reviewing: "Reviewing",
    drafting_email: "Drafting",
    email_ready: "Email Ready",
    contacted: "Contacted",
    expired: "Expired",
  };
  return labels[status];
}

function getStatusClass(status: LabOpeningStatus): string {
  if (status === "contacted") return "success";
  if (status === "expired") return "error";
  if (status === "email_ready") return "active";
  if (status === "drafting_email" || status === "reviewing") return "paused";
  return "";
}

function LabOpeningCard({
  opening,
  onDraftEmail,
  onViewEmail,
}: {
  opening: LabOpening;
  onDraftEmail: (opening: LabOpening) => void;
  onViewEmail: (opening: LabOpening) => void;
}) {
  return (
    <article className="market-card" id={opening.id}>
      <div className="market-card-head">
        <div>
          <h3>{opening.labName}</h3>
          <p>{opening.professorName} &middot; {opening.department}</p>
        </div>
        <span className={`table-status ${getStatusClass(opening.status)}`}>
          {getStatusLabel(opening.status)}
        </span>
      </div>
      <dl className="meta-grid">
        <div>
          <dt>Research Area</dt>
          <dd>{opening.researchArea}</dd>
        </div>
        <div>
          <dt>Match Score</dt>
          <dd style={{ color: opening.matchScore >= 0.9 ? "var(--success)" : "var(--text)" }}>
            {(opening.matchScore * 100).toFixed(0)}%
          </dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{opening.source}</dd>
        </div>
        <div>
          <dt>Deadline</dt>
          <dd>{opening.deadline ?? "Rolling"}</dd>
        </div>
      </dl>
      {opening.requirements ? (
        <div>
          <h4 style={{ fontSize: "0.98rem", marginBottom: "6px" }}>Requirements</h4>
          <p style={{ color: "var(--text-muted)", lineHeight: 1.55, fontSize: "0.95rem" }}>
            {opening.requirements}
          </p>
        </div>
      ) : null}
      <div className="card-actions">
        {opening.emailDraft ? (
          <button onClick={() => onViewEmail(opening)} type="button">
            View Email Draft
          </button>
        ) : opening.status !== "expired" && opening.status !== "contacted" ? (
          <button onClick={() => onDraftEmail(opening)} type="button">
            Draft Email
          </button>
        ) : null}
        {opening.professorEmail ? (
          <a
            className="button-link secondary"
            href={`mailto:${opening.professorEmail}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {opening.professorEmail}
          </a>
        ) : null}
      </div>
    </article>
  );
}

function EmailDraftModal({
  opening,
  onClose,
  onSend,
  onEdit,
}: {
  opening: LabOpening;
  onClose: () => void;
  onSend: (opening: LabOpening, editedDraft: string) => void;
  onEdit: (opening: LabOpening, editedDraft: string) => void;
}) {
  const [draft, setDraft] = useState(opening.emailDraft ?? "");
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    onSend(opening, draft);
    setSent(true);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(34, 29, 22, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--line)",
          borderRadius: "12px",
          boxShadow: "0 20px 60px rgba(34, 29, 22, 0.15)",
          padding: "28px",
          width: "min(720px, 100%)",
          maxHeight: "85vh",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "1.3rem", letterSpacing: "-0.02em" }}>
              Email to {opening.professorName}
            </h2>
            <p style={{ color: "var(--text-muted)", marginTop: "4px" }}>
              {opening.labName} &middot; {opening.professorEmail}
            </p>
          </div>
          <button className="secondary" onClick={onClose} type="button" style={{ padding: "0.5rem 0.8rem" }}>
            Close
          </button>
        </div>

        {sent ? (
          <div className="form-message success" style={{ textAlign: "center", padding: "20px" }}>
            Email draft saved and marked as sent to {opening.professorName} ({opening.professorEmail}).
            In production, this would open your email client or send via SMTP.
          </div>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              style={{ minHeight: "340px", fontFamily: "monospace", fontSize: "0.92rem", lineHeight: 1.55 }}
            />
            <div className="card-actions">
              <button onClick={handleSend} type="button">
                Send Email
              </button>
              <button
                className="secondary"
                onClick={() => onEdit(opening, draft)}
                type="button"
              >
                Save Draft
              </button>
              <a
                className="button-link secondary"
                href={`mailto:${opening.professorEmail}?subject=${encodeURIComponent(
                  draft.split("\n")[0]?.replace("Subject: ", "") ?? "Research Position Inquiry"
                )}&body=${encodeURIComponent(draft.split("\n").slice(1).join("\n"))}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open in Mail Client
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function generateEmailDraft(opening: LabOpening): string {
  return [
    `Subject: Interest in Undergraduate Research Position - ${opening.labName}`,
    ``,
    `Dear ${opening.professorName},`,
    ``,
    `I am writing to express my strong interest in the research opening in the ${opening.labName} that I found on ${opening.source}. I am an Undergraduate Computer Science student at UT Austin, and your work in ${opening.researchArea} aligns closely with my academic interests.`,
    ``,
    `I am particularly interested in exploring the research areas your lab focuses on and would welcome the opportunity to contribute to your ongoing projects.`,
    ``,
    `${opening.requirements ? `I understand you are looking for students who meet the following: ${opening.requirements}` : ""}`,
    ``,
    `I would be grateful for the chance to discuss how I might contribute. I am available to meet at your convenience and can provide my resume, transcript, or any additional materials upon request.`,
    ``,
    `Thank you for your time and consideration.`,
    ``,
    `Best regards,`,
    `[Your Name]`,
    `Computer Science, Undergraduate`,
    `The University of Texas at Austin`,
  ].join("\n");
}

export default function EurekaPage() {
  const [openings, setOpenings] = useState<LabOpening[]>(MOCK_LAB_OPENINGS);
  const [selectedOpening, setSelectedOpening] = useState<LabOpening | null>(null);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "done">("done");
  const [filter, setFilter] = useState<"all" | LabOpeningStatus>("all");

  const handleDraftEmail = (opening: LabOpening) => {
    const draft = generateEmailDraft(opening);
    const updated = openings.map((o) =>
      o.id === opening.id ? { ...o, status: "email_ready" as LabOpeningStatus, emailDraft: draft } : o
    );
    setOpenings(updated);
    setSelectedOpening({ ...opening, status: "email_ready", emailDraft: draft });
  };

  const handleViewEmail = (opening: LabOpening) => {
    setSelectedOpening(opening);
  };

  const handleSendEmail = (opening: LabOpening, editedDraft: string) => {
    const updated = openings.map((o) =>
      o.id === opening.id
        ? { ...o, status: "contacted" as LabOpeningStatus, emailDraft: editedDraft, emailSentAt: Date.now() }
        : o
    );
    setOpenings(updated);
  };

  const handleEditDraft = (opening: LabOpening, editedDraft: string) => {
    const updated = openings.map((o) =>
      o.id === opening.id ? { ...o, emailDraft: editedDraft } : o
    );
    setOpenings(updated);
    setSelectedOpening(null);
  };

  const handleScan = async () => {
    setScanState("scanning");
    try {
      const res = await fetch("/api/demo/eureka", { method: "POST" });
      const data = await res.json();
      if (data.ok && data.liveUrl) {
        window.open(data.liveUrl, "_blank");
      }
    } catch {
      // Fall through to done state
    }
    setScanState("done");
  };

  const filteredOpenings = filter === "all"
    ? openings
    : openings.filter((o) => o.status === filter);

  const stats = {
    total: openings.length,
    newCount: openings.filter((o) => o.status === "discovered").length,
    emailReady: openings.filter((o) => o.status === "email_ready").length,
    contacted: openings.filter((o) => o.status === "contacted").length,
  };

  return (
    <AppShell currentPath="/eureka">
      <section className="page-section intro-section">
        <SectionHeading
          title="EurekaBot"
          description="Scan UT Eureka for research lab openings that match your profile. Review matches, draft personalized outreach emails, and track your applications."
          actionHref="/my-agents"
          actionLabel="View all agents"
        />
      </section>

      <section className="page-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div style={{ display: "flex", gap: "16px", alignItems: "baseline" }}>
            <h3 style={{ fontSize: "1.1rem" }}>Lab Openings</h3>
            <span style={{ color: "var(--text-muted)", fontSize: "0.92rem" }}>
              {stats.total} found &middot; {stats.newCount} new &middot; {stats.emailReady} email ready &middot; {stats.contacted} contacted
            </span>
          </div>
          <button
            onClick={handleScan}
            disabled={scanState === "scanning"}
            type="button"
            style={{ padding: "0.6rem 1.2rem" }}
          >
            {scanState === "scanning" ? "Scanning Eureka..." : "Scan for Openings"}
          </button>
        </div>

        <div className="filter-bar" style={{ marginBottom: "18px" }}>
          {(
            [
              { value: "all", label: "All" },
              { value: "discovered", label: "New" },
              { value: "email_ready", label: "Email Ready" },
              { value: "contacted", label: "Contacted" },
              { value: "expired", label: "Expired" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              className={filter === opt.value ? "filter-pill active" : "filter-pill"}
              onClick={() => setFilter(opt.value)}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>

        {filteredOpenings.length > 0 ? (
          <div className="card-grid two-up">
            {filteredOpenings.map((opening) => (
              <LabOpeningCard
                key={opening.id}
                opening={opening}
                onDraftEmail={handleDraftEmail}
                onViewEmail={handleViewEmail}
              />
            ))}
          </div>
        ) : (
          <p className="empty-state">
            No lab openings match this filter. Try scanning Eureka for new openings.
          </p>
        )}
      </section>

      {selectedOpening ? (
        <EmailDraftModal
          opening={selectedOpening}
          onClose={() => setSelectedOpening(null)}
          onSend={handleSendEmail}
          onEdit={handleEditDraft}
        />
      ) : null}
    </AppShell>
  );
}
