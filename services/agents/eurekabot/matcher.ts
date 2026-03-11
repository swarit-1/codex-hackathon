export interface LabOpeningMatch {
  labName: string;
  professorName: string;
  professorEmail: string;
  department: string;
  researchArea: string;
  source: string;
  postedDate: string;
  deadline?: string;
  requirements: string;
  matchScore: number;
}

interface StudentProfile {
  major?: string;
  classification?: string;
  researchInterests?: string[];
  gpa?: string;
}

export function matchLabOpenings(profile: StudentProfile = {}, sources: string[] = []): LabOpeningMatch[] {
  const major = profile.major ?? "Computer Science";
  const classification = profile.classification ?? "Undergraduate";
  const interests = profile.researchInterests ?? ["machine learning", "systems"];
  const baseSource = sources[0] ?? "Eureka";

  const allOpenings: LabOpeningMatch[] = [
    {
      labName: "Intelligent Systems Lab",
      professorName: "Dr. Peter Stone",
      professorEmail: "pstone@cs.utexas.edu",
      department: "Computer Science",
      researchArea: "AI, Machine Learning, Multi-Agent Systems",
      source: baseSource,
      postedDate: "2026-03-01",
      deadline: "2026-04-15",
      requirements: `Looking for ${classification} students in ${major} with interest in AI/ML. Experience with Python and PyTorch preferred.`,
      matchScore: 0.95,
    },
    {
      labName: "Systems and Networking Lab",
      professorName: "Dr. Simon Peter",
      professorEmail: "simon@cs.utexas.edu",
      department: "Computer Science",
      researchArea: "Operating Systems, Distributed Systems, Networking",
      source: baseSource,
      postedDate: "2026-02-20",
      deadline: "2026-04-01",
      requirements: `Seeking ${classification} researchers with strong C/C++ and systems programming background.`,
      matchScore: 0.88,
    },
    {
      labName: "Natural Language Processing Group",
      professorName: "Dr. Greg Durrett",
      professorEmail: "gdurrett@cs.utexas.edu",
      department: "Computer Science",
      researchArea: "NLP, Information Extraction, Question Answering",
      source: sources[1] ?? "UT Research Portal",
      postedDate: "2026-03-05",
      deadline: "2026-05-01",
      requirements: `Open to ${classification} students with NLP or linguistics background. Python and transformer models experience a plus.`,
      matchScore: 0.91,
    },
    {
      labName: "Robotics and Autonomous Systems Lab",
      professorName: "Dr. Joydeep Biswas",
      professorEmail: "joydeepb@cs.utexas.edu",
      department: "Computer Science",
      researchArea: "Robotics, Computer Vision, Autonomous Navigation",
      source: baseSource,
      postedDate: "2026-03-08",
      requirements: `${classification} students in ${major} or ECE. ROS2 experience preferred, C++ required.`,
      matchScore: 0.85,
    },
    {
      labName: "Computational Visualization Center",
      professorName: "Dr. Chandrajit Bajaj",
      professorEmail: "bajaj@cs.utexas.edu",
      department: "Computer Science",
      researchArea: "Scientific Visualization, Computational Biology, Geometric Modeling",
      source: sources[1] ?? "UT Research Portal",
      postedDate: "2026-02-15",
      deadline: "2026-03-30",
      requirements: `Looking for motivated ${classification} students with strong math background. Graphics/OpenGL experience welcome.`,
      matchScore: 0.78,
    },
  ];

  // Score boost if interests match research areas
  return allOpenings
    .map((opening) => {
      let score = opening.matchScore;
      for (const interest of interests) {
        if (opening.researchArea.toLowerCase().includes(interest.toLowerCase())) {
          score = Math.min(1.0, score + 0.05);
        }
      }
      if (opening.department.toLowerCase().includes(major.toLowerCase())) {
        score = Math.min(1.0, score + 0.03);
      }
      return { ...opening, matchScore: parseFloat(score.toFixed(2)) };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}
