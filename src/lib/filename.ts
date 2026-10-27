import { CONTACT } from "./profile";

// "Elizabeth H. McMillan - People Operations Manager Resume". Used for the PDF (page title)
// and the .txt download, so saved files are named for the job.
export function resumeFileName(jobTitle: string): string {
  const title = jobTitle
    .replace(/^job application for\s+/i, "")
    .replace(/\s+at\s+.+$/i, "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${CONTACT.name} - ${title} Resume`;
}
