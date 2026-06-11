type SendOne = (args: { chatId: string; text: string }) => Promise<boolean>;

export async function fanOutMissionToChats(
  chatIds: string[],
  text: string,
  sendOne: SendOne,
): Promise<{ sent: number; failed: number }> {
  if (chatIds.length === 0) return { sent: 0, failed: 0 };
  const results = await Promise.allSettled(
    chatIds.map((chatId) => sendOne({ chatId, text })),
  );
  let sent = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) sent++;
    else failed++;
  }
  return { sent, failed };
}
