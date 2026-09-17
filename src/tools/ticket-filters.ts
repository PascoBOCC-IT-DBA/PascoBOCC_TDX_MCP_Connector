/**
 * Safety net for ticket-level responsibility. Searches now send TDX's
 * PrimaryResponsibilityUids, but ResponsibilityUids (used when task responsibility is
 * opted into) matches any responsibility association on a ticket -- including task and
 * assignment responsibility -- so callers asking "what is this person responsible for"
 * can get back tickets owned by someone else.
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
