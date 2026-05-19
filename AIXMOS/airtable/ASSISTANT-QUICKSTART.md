# AIXMOS Operations — Assistant quick start

## Your job in one sentence
Keep every approved person moving through login → welcome → Day-1 Training Vault, and keep the content list honest (nothing “coming soon” without a task).

## Every morning (10 min)
1. Open base **AIXMOS Operations** → Interface **Assistant Home** (or Omni).
2. Paste Omni prompt from `omni/PROMPTS.md` → **Daily start**.
3. Work the list top to bottom.

## When Muhammad approves someone
1. Omni prompt: **New person approved** (fill name, type, email).
2. In **People**: set **Portal Password** (Muhammad sends via Signal), check **Sync to Portal**, Status **Login Created**.
3. Ping Muhammad: *"Ready for sync"* → he runs `npm run sync:aixmos-people` (or you’re told when done).
4. Send welcome email (Omni: **Draft welcome email**).
5. Update Status: Welcome Sent → Day-1 call → Day-1 Call Done → Active.

## Every Friday (30 min)
1. Omni prompt: **Friday report**.
2. Review draft → Muhammad approves → Status **Sent to Muhammad**.

## Do not
- Change prices or investor claims
- Store real passwords in Airtable (checkbox only: “temp password sent”)
- Mark investor content Ready without Muhammad

## Need help?
Open Omni and ask: *“What should I work on today?”*

Full setup: `README.md` in this folder.
