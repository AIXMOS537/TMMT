/** Resolve ClickUp user IDs from emails (team members). */
export async function resolveClickUpUserIds(emails: string[]): Promise<number[]> {
  const token = process.env.CLICKUP_API_TOKEN?.trim();
  const teamId = process.env.CLICKUP_TEAM_ID?.trim();
  if (!token || !teamId || emails.length === 0) return [];

  const ids: number[] = [];
  for (const email of emails) {
    const q = new URLSearchParams({ email: email.trim().toLowerCase() });
    const res = await fetch(`https://api.clickup.com/api/v2/team/${teamId}/user?${q}`, {
      headers: { Authorization: token },
    });
    if (!res.ok) continue;
    const data = (await res.json()) as { user?: { id?: number } };
    if (data.user?.id) ids.push(data.user.id);
  }
  return ids;
}
