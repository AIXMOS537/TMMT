import { describe, expect, it } from 'vitest'
import { classifyCommunicationControl } from './communication-control'

/**
 * The deterministic classification the inbound SMS route runs before any AI
 * guard. `opt_out` records suppression; `stop_like` is held for a human with no
 * reply; `none` is an ordinary message that may continue to the agent.
 */
describe('classifyCommunicationControl', () => {
  it.each([
    'STOP', 'stop', 'Stop.', ' STOP ',
    'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT',
    'stop please', 'opt out', 'opt-out', 'OPTOUT',
  ])('explicit keyword %j is an opt-out', (body) => {
    expect(classifyCommunicationControl(body)).toEqual({ kind: 'opt_out' })
  })

  it.each(['START', 'start', 'UNSTOP', 'resubscribe', 'opt in'])('%j is an opt-in', (body) => {
    expect(classifyCommunicationControl(body)).toEqual({ kind: 'opt_in' })
  })

  it.each([
    ['STOP ALL', 'stop'],
    ['STOP!', 'stop'],
    ['please stop', 'stop'],
    ['Stop it', 'stop'],
    ['stop texting me', 'stop'],
    ["don't message me anymore", 'do_not_contact'],
    ['don’t text me again', 'do_not_contact'],
    ['do not contact me', 'do_not_contact'],
    ['take me off your list', 'take_me_off'],
    ['please remove me', 'remove_me'],
    ['I want to unsubscribe', 'unsubscribe'],
    ['how do I opt out of this', 'opt_out'],
    ['no more texts please', 'no_more_messages'],
    ['leave me alone', 'leave_me_alone'],
    ['REVOKE', 'revoke'],
  ])('%j is stop-like (held, not a formal opt-out)', (body, signal) => {
    expect(classifyCommunicationControl(body)).toEqual({ kind: 'stop_like', signal })
  })

  it.each([
    'hello',
    'Is the Camry still available?',
    'cancel my appointment',
    'can I pick it up at the end of the month',
    'I quit my job last week, can I still apply?',
    'what are your weekly prices',
    'Christopher said to text you',
    'stopped by the lot yesterday',
  ])('ordinary message %j is not a communication control', (body) => {
    expect(classifyCommunicationControl(body)).toEqual({ kind: 'none' })
  })

  it('over-matches on purpose: a question that contains "stop" is held, not answered by AI', () => {
    expect(classifyCommunicationControl('what time do you stop renting today?').kind).toBe('stop_like')
  })
})
