/**
 * TDX's ResponsibilityUids search parameter matches any responsibility association on a
 * ticket -- including task and assignment responsibility -- not just the ticket's own
 * responsible person. Callers asking "what is this person responsible for" get back
 * tickets owned by someone else, so narrow the result set to ticket-level matches here.
 */
export function filterByResponsibleUid<T extends Record<string, unknown>>(
  tickets: T[],
  responsibleUids: string[] | undefined
): { tickets: T[]; applied: boolean } {
  if (!responsibleUids || responsibleUids.length === 0) {
    return { tickets, applied: false };
  }

  const wanted = new Set(responsibleUids.map((uid) => uid.trim().toLowerCase()).filter((uid) => uid !== ""));
  if (wanted.size === 0) {
    return { tickets, applied: false };
  }

  // If TDX did not return the field at all, filtering would silently drop every row.
  const fieldPresent = tickets.some((t) => typeof t.ResponsibleUid === "string" && t.ResponsibleUid !== "");
  if (!fieldPresent) {
    return { tickets, applied: false };
  }

  return {
    tickets: tickets.filter(
      (t) => typeof t.ResponsibleUid === "string" && wanted.has((t.ResponsibleUid as string).toLowerCase())
    ),
    applied: true,
  };
}
