# Car Rental Communication SOP

Source: original `CAR_RENTAL_COMMUNICATION_SYSTEM.md` (imported to this repo; path is machine-specific)

## Objective

Standardize customer communication for car rental bookings, pick-ups, returns, extensions, late returns, reviews, and damage situations.

## Communication Rules

1. Use approved templates for routine messages.
2. Send all messages from the business line or approved communication tool.
3. Log every customer conversation.
4. Escalate damage, disputes, unresolved complaints, and extension decisions to the owner.
5. Do not improvise customer-facing policy language.

## Trigger Matrix

| Trigger | Message | Owner | Timing | Automation Status |
|---|---|---|---|---|
| Booking confirmed | Booking confirmation | Team / Auto | Immediately | Automate |
| 24 hours before pick-up | Pick-up reminder | Team / Auto | Day before | Automate |
| Morning of pick-up | Day-of pick-up message | Team / Auto | By 8:00 AM | Automate |
| Customer arrives | Vehicle handoff checklist | Team | At pick-up | Manual |
| 24 hours before return | Return reminder | Team / Auto | Day before | Automate |
| 30 minutes late | Late return warning | Team | 30 minutes after due time | Manual |
| Return completed | Thank you and review request | Team / Auto | Within 1 hour | Automate |
| Damage found | Damage notification | Owner only | Same day | Manual owner review |

## Escalation Rules

Escalate to owner immediately when:

- Damage is found.
- Customer disputes charges, damage, timing, or policies.
- Customer requests an extension that affects another booking.
- Complaint cannot be resolved with approved templates.
- Legal, insurance, or payment risk is present.

## Human vs Automated

### Automate

- Booking confirmation
- Pick-up reminder
- Day-of pick-up message
- Return reminder
- Thank you and review request

### Keep Human

- Late return warnings
- Damage notifications
- Extension decisions
- Complaints
- Any situation involving unclear liability or policy enforcement

## Implementation Checklist

### Week 1: Install

- [ ] Choose communication tool.
- [ ] Load approved templates.
- [ ] Assign primary communication handler.
- [ ] Train team on escalation rules.
- [ ] Confirm business line is used for all rental communication.

### Week 2: Automate

- [ ] Automate booking confirmation.
- [ ] Automate 24-hour pick-up reminder.
- [ ] Automate day-of pick-up message.
- [ ] Automate 24-hour return reminder.
- [ ] Automate thank you and review request.
- [ ] Test automations with a sample booking.

### Week 3: Delegate

- [ ] Team handles all routine messages.
- [ ] Owner handles only exceptions and escalations.
- [ ] Review communication logs weekly.

### Week 4: Optimize

- [ ] Track response times.
- [ ] Add missing templates.
- [ ] Review customer complaints for pattern issues.
- [ ] Track review request conversion.

## Required Business Variables

| Variable | Value |
|---|---|
| Business name |  |
| Business phone |  |
| Pick-up address |  |
| Booking link |  |
| Review link |  |
| Reservation hold time |  |
| Late fee policy |  |
| Response time standard |  |
| After-hours cutoff |  |

## Risk Controls

- Damage messages require owner review before sending.
- Late return warnings should be logged with exact due time and contact attempts.
- Policy language should match the rental agreement.
- Team should not promise refunds, fee waivers, or extensions without approval.
- Customer identity and booking details should be confirmed before sending sensitive information.
