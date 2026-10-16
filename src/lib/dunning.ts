/** Rules for payment reminders (opomene). */
export const isOverdue = (dueDate: string | null, open: number, today: string) =>
  !!dueDate && dueDate < today && open > 0.5;

export const daysLate = (dueDate: string | null, today: string) =>
  dueDate && dueDate < today ? Math.round((Date.parse(today) - Date.parse(dueDate)) / 86400000) : 0;
