export interface ScholarshipMatch {
  title: string;
  source: string;
  deadline: string;
  eligibility: string;
  matchScore: number;
}

interface StudentProfile {
  major?: string;
  classification?: string;
}

export function matchScholarships(profile: StudentProfile = {}, sources: string[] = []): ScholarshipMatch[] {
  const major = profile.major ?? "General Studies";
  const classification = profile.classification ?? "Student";
  const baseSource = sources[0] ?? "UT Scholarships";

  return [
    {
      title: `${major} Merit Scholarship`,
      source: baseSource,
      deadline: "2026-10-15",
      eligibility: `${classification} students in ${major}`,
      matchScore: 0.94,
    },
    {
      title: "Longhorn Leadership Grant",
      source: sources[1] ?? "Scholarships.com",
      deadline: "2026-11-01",
      eligibility: `${classification} students with community involvement`,
      matchScore: 0.82,
    },
  ];
}
