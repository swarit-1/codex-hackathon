import type { LabOpeningMatch } from "./matcher.ts";

interface StudentContext {
  name: string;
  major: string;
  classification: string;
  gpa?: string;
  researchInterests?: string[];
  relevantCourses?: string[];
  skills?: string[];
}

export function draftProfessorEmail(opening: LabOpeningMatch, student: StudentContext): string {
  const interestsPhrase = student.researchInterests?.length
    ? student.researchInterests.join(", ")
    : opening.researchArea.split(",")[0].trim();

  const coursesPhrase = student.relevantCourses?.length
    ? `Relevant coursework includes ${student.relevantCourses.join(", ")}.`
    : "";

  const skillsPhrase = student.skills?.length
    ? `I have experience with ${student.skills.join(", ")}.`
    : "";

  const gpaPhrase = student.gpa ? ` with a ${student.gpa} GPA` : "";

  return [
    `Subject: Interest in Undergraduate Research Position - ${opening.labName}`,
    ``,
    `Dear ${opening.professorName},`,
    ``,
    `I am writing to express my strong interest in the research opening in the ${opening.labName} that I found on ${opening.source}. I am a ${student.classification} ${student.major} student at UT Austin${gpaPhrase}, and your work in ${opening.researchArea} aligns closely with my academic interests.`,
    ``,
    `I am particularly interested in ${interestsPhrase} and would welcome the opportunity to contribute to your lab's research.${coursesPhrase ? ` ${coursesPhrase}` : ""}${skillsPhrase ? ` ${skillsPhrase}` : ""}`,
    ``,
    `I understand you are looking for students who meet the following: ${opening.requirements}`,
    ``,
    `I would be grateful for the chance to discuss how I might contribute to your ongoing projects. I am available to meet at your convenience and can provide my resume, transcript, or any additional materials upon request.`,
    ``,
    `Thank you for your time and consideration.`,
    ``,
    `Best regards,`,
    `${student.name}`,
    `${student.major}, ${student.classification}`,
    `The University of Texas at Austin`,
  ].join("\n");
}

export function draftFollowUpEmail(opening: LabOpeningMatch, student: StudentContext): string {
  return [
    `Subject: Following Up - Research Position in ${opening.labName}`,
    ``,
    `Dear ${opening.professorName},`,
    ``,
    `I hope this message finds you well. I recently reached out regarding the research position in the ${opening.labName} and wanted to follow up on my interest.`,
    ``,
    `As a ${student.classification} ${student.major} student, I remain very excited about the opportunity to work on ${opening.researchArea.split(",")[0].trim()} research in your lab.`,
    ``,
    `Please let me know if there is any additional information I can provide or if you would be available for a brief meeting.`,
    ``,
    `Thank you again for your consideration.`,
    ``,
    `Best regards,`,
    `${student.name}`,
  ].join("\n");
}
