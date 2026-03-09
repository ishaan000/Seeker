import { UserProfile } from "./api";

export function generatePersonalizedPrompts(user: UserProfile): string[] {
  const prefs = user.preferences;
  const title = user.title || "professional";
  const skills = prefs.skills?.join(", ") || "";
  const targetCompanies = prefs.targetCompanies || [];
  const targetLocations = prefs.targetLocations || [];
  const industry = user.industry || "";

  const roleLabel = title;
  const locationLabel = targetLocations[0] || "your area";

  // Pick distinct companies for each prompt, cycling through all of them
  const co = (i: number) => targetCompanies[i % targetCompanies.length] || "";
  const hasCompanies = targetCompanies.length > 0;

  // Prompt 1: Find people — use company[0]
  const prompt1 = hasCompanies
    ? `Find hiring managers at ${co(0)} for ${title} roles`
    : `Find hiring managers in the ${industry} industry for ${title} roles`;

  // Prompt 2: Job search — use second location if available
  const prompt2 = `Find ${roleLabel} jobs in ${locationLabel}`;

  // Prompt 3: Research company — use company[1] or fall back to [0]
  const researchCo = targetCompanies.length > 1 ? co(1) : co(0);
  const prompt3 = researchCo
    ? `Research ${researchCo} - funding, culture, and recent news`
    : `Research top ${industry} companies to work at`;

  // Prompt 4: Interview prep — use company[2] or cycle
  const interviewCo = targetCompanies.length > 2 ? co(2) : co(0);
  const prompt4 = interviewCo
    ? `Prep me for an interview at ${interviewCo} for a ${roleLabel} role`
    : `Prep me for a ${roleLabel} interview - common questions and tips`;

  // Prompt 5: Skills advice
  const skillsSuffix = skills ? ` I know ${skills}` : "";
  const prompt5 = `What skills should I highlight for a ${roleLabel} role?${skillsSuffix}`;

  // Prompt 6: Outreach — use a different company than prompt 1
  const outreachCo = targetCompanies.length > 1 ? co(1) : co(0);
  const prompt6 = outreachCo
    ? `Write an outreach sequence for the hiring manager at ${outreachCo}`
    : `Write an outreach sequence for a hiring manager in the ${industry} industry`;

  return [prompt1, prompt2, prompt3, prompt4, prompt5, prompt6];
}
