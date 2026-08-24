export type ComplaintStatus = "new" | "in_review" | "in_progress" | "resolved" | "rejected";
export type ComplaintCategory = "job" | "quality" | "employee" | "deadline" | "other";

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  new: "Nova",
  in_review: "U pregledu",
  in_progress: "U rešavanju",
  resolved: "Rešena",
  rejected: "Odbijena",
};

export const COMPLAINT_STATUS_VARIANTS: Record<ComplaintStatus, string> = {
  new: "bg-red-500/15 text-red-600 border-red-500/30",
  in_review: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  in_progress: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  resolved: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  rejected: "bg-muted text-muted-foreground border-border",
};

export const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  job: "Konkretan posao / nalog",
  quality: "Kvalitet rada",
  employee: "Odnos zaposlenog",
  deadline: "Rok isporuke",
  other: "Ostalo",
};

export const SEVERITY_LABELS: Record<number, string> = {
  1: "1 - Minorno",
  2: "2 - Nisko",
  3: "3 - Srednje",
  4: "4 - Visoko",
  5: "5 - Kritično",
};

export const OPEN_COMPLAINT_STATUSES: ComplaintStatus[] = ["new", "in_review", "in_progress"];

export function isComplaintOverdue(status: ComplaintStatus, dueAt: string | null): boolean {
  if (!dueAt) return false;
  if (!OPEN_COMPLAINT_STATUSES.includes(status)) return false;
  return new Date(dueAt).getTime() < Date.now();
}

export const MAX_COMPLAINT_ATTACHMENTS = 5;
