export interface TemplateLite { id: string; name: string; description: string; body: string; builtin: boolean }

/** Starting points that ship with the suite. People add their own next to these. */
export const BUILTIN_DOCUMENTS: TemplateLite[] = [
  {
    id: 'builtin:meeting-notes', name: 'Meeting notes', description: 'Agenda, decisions and actions', builtin: true,
    body: '<h1>Meeting notes</h1><p><strong>Date:</strong> </p><p><strong>Attendees:</strong> </p><h2>Agenda</h2><ul><li>&nbsp;</li></ul><h2>Discussion</h2><p>&nbsp;</p><h2>Decisions</h2><ul><li>&nbsp;</li></ul><h2>Actions</h2><table><tr><th>Action</th><th>Owner</th><th>Due</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table>',
  },
  {
    id: 'builtin:concept-note', name: 'Concept note', description: 'A two page note for a funder', builtin: true,
    body: '<h1>Concept note</h1><h2>The problem</h2><p>&nbsp;</p><h2>Our approach</h2><p>&nbsp;</p><h2>Expected results</h2><ul><li>&nbsp;</li></ul><h2>Who benefits</h2><p>&nbsp;</p><h2>Timeline and budget</h2><p>&nbsp;</p><h2>Why Sauti Salama</h2><p>&nbsp;</p>',
  },
  {
    id: 'builtin:project-brief', name: 'Project brief', description: 'Goals, scope, team and milestones', builtin: true,
    body: '<h1>Project brief</h1><h2>Goal</h2><p>&nbsp;</p><h2>Scope</h2><p>&nbsp;</p><h2>Team</h2><ul><li>&nbsp;</li></ul><h2>Milestones</h2><table><tr><th>Milestone</th><th>Date</th><th>Owner</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table><h2>Risks</h2><ul><li>&nbsp;</li></ul>',
  },
  {
    id: 'builtin:letter', name: 'Letter', description: 'A formal letter on the organisation letterhead', builtin: true,
    body: '<p><strong>Sauti Salama</strong></p><p>&nbsp;</p><p>Date</p><p>&nbsp;</p><p>Dear </p><p>&nbsp;</p><p>Yours sincerely,</p><p>&nbsp;</p>',
  },
  {
    id: 'builtin:report', name: 'Donor report', description: 'Narrative report with results and learning', builtin: true,
    body: '<h1>Report</h1><h2>Summary</h2><p>&nbsp;</p><h2>Activities</h2><ul><li>&nbsp;</li></ul><h2>Results against targets</h2><table><tr><th>Indicator</th><th>Target</th><th>Result</th></tr><tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr></table><h2>Challenges and learning</h2><p>&nbsp;</p><h2>Next steps</h2><p>&nbsp;</p>',
  },
];

export const BUILTIN_POSTS: TemplateLite[] = [
  { id: 'builtin:announce', name: 'Announcement', description: 'Share good news', builtin: true, body: 'We are glad to share that [what happened].\n\n[One line on why it matters for the people we serve.]\n\nRead more: [link]' },
  { id: 'builtin:call', name: 'Call for applications', description: 'Open call with a deadline', builtin: true, body: 'Applications are open: [opportunity].\n\nWho can apply: [who]\nDeadline: [date]\nHow to apply: [link]' },
  { id: 'builtin:thanks', name: 'Thank you', description: 'Thank partners and supporters', builtin: true, body: 'Thank you to [partner] for [what they did]. Because of you, [result].' },
  { id: 'builtin:event', name: 'Event invitation', description: 'Invite people to an event', builtin: true, body: 'Join us on [date] at [time] for [event].\n\n[One line on what people will get from it.]\n\nRegister: [link]' },
  { id: 'builtin:story', name: 'Impact story', description: 'A short story of change, shared with consent', builtin: true, body: 'When [person, with consent and no identifying detail] first reached us, [situation].\n\nToday, [change].\n\nSupport like yours makes this possible.' },
];
