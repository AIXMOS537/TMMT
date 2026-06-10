import Twilio from 'twilio'

export interface SendSmsArgs {
  from: string
  to: string
  body: string
  twilioAccountSid?: string
  twilioAuthToken?: string
}

export async function sendSms(args: SendSmsArgs): Promise<{ sid: string }> {
  const sid = args.twilioAccountSid ?? process.env.TWILIO_ACCOUNT_SID
  const tok = args.twilioAuthToken ?? process.env.TWILIO_AUTH_TOKEN
  if (!sid || !tok) throw new Error('Twilio credentials missing (SID or AUTH_TOKEN)')
  const client = Twilio(sid, tok)
  const msg = await client.messages.create({ from: args.from, to: args.to, body: args.body })
  return { sid: msg.sid }
}
