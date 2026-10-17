/**
 * Money (docs/feature_money.md): the gig market and its eras, clients, the landlord wheel, the
 * enterprise job's firing reasons, and the log lines of the money and projects systems.
 */
import type { MoneyContent } from '../game/catalog';

export const money: MoneyContent = {
  // Gig pay per line of code halves on each act wall: everyone has agents now.
  eras: [
    { from: null, rate: 1, title: '', text: '' },
    {
      from: 'ralph-loop',
      rate: 0.5,
      title: 'Market update',
      text: 'Gig rates −50 %. Everyone has an agent now.',
    },
    {
      from: 'context-management',
      rate: 0.25,
      title: 'Market update',
      text: 'Gig rates −50 %. Clients ask why it takes a whole hour.',
    },
    {
      from: 'custom-harness',
      rate: 0.12,
      title: 'Market update',
      text: 'Gig rates −50 %. Your agents now compete with your agents.',
    },
    {
      from: 'self-driving-repositories',
      rate: 0.06,
      title: 'Market update',
      text: 'Gig rates −50 %. The gigs are posted by agents, for agents.',
    },
  ],
  clients: [
    { id: 'dentist', text: 'Landing page for a dentist' },
    { id: 'crypto', text: 'Smart contract for a crypto project' },
    { id: 'bakery', text: 'Online shop for a bakery' },
    { id: 'wedding', text: 'Wedding website, due yesterday' },
    { id: 'startup', text: 'MVP for a startup with no product' },
    { id: 'uncle', text: "Fix your uncle's printer driver" },
    { id: 'chatbot', text: 'A chatbot for a chatbot company' },
    { id: 'gym', text: 'Booking app for a gym nobody goes to' },
    { id: 'podcast', text: 'Website for a podcast about websites' },
    { id: 'cat-cafe', text: { alive: 'Menu app for a cat café', absent: 'Menu app for a café' } },
  ],
  payments: [
    { id: 'exposure', text: 'Paid in exposure, then in cash.' },
    { id: 'invoice', text: 'Paid after the third reminder.' },
    { id: 'happy', text: 'They loved it. They asked for one small change.' },
    { id: 'scope', text: 'The scope tripled. The budget did not.' },
    { id: 'friday', text: 'Paid on a Friday at 23:59.' },
    { id: 'review', text: 'Five stars. "Would not hire again."' },
  ],
  rentSlices: [
    { id: 'forgot', label: 'FORGOT', text: 'The landlord forgot. He will remember.', rentShare: 0 },
    {
      id: 'friday',
      label: 'FRIDAY',
      text: 'Pay by Friday, he says. Which Friday, he does not say.',
      rentShare: 0,
    },
    {
      id: 'late-fee',
      label: 'LATE FEE',
      text: 'A late fee. For the inconvenience of being poor.',
      rentShare: -0.1,
    },
    {
      id: 'couch',
      label: 'COUCH',
      text: 'You sublet the couch to a crypto founder for a week.',
      rentShare: 0.2,
    },
    {
      id: 'roommate',
      label: 'ROOMMATE',
      text: 'Your roommate covered half. You do not have a roommate.',
      rentShare: 0,
    },
    {
      id: 'cat-landlord',
      label: { alive: 'CAT', absent: 'EMPTY' },
      text: {
        alive: "The landlord met the cat. He'll wait.",
        absent: "The landlord looked around the empty room. He'll wait.",
      },
      rentShare: 0,
    },
  ],
  // A broke player is out after 1–6 months, most often around the fourth.
  evictionHazards: [0.05, 0.15, 0.3, 0.5, 0.75, 1],
  evictedLabel: 'EVICTED',
  evictionEnding: 'ai-got-my-job',
  firingReasons: [
    { id: 'overqualified', text: 'overqualified' },
    { id: 'culture', text: 'no cultural fit' },
    { id: 'reorg', text: 'the reorg' },
    { id: 'camera', text: 'camera off in stand-up' },
    { id: 'emoji', text: 'not enough emoji in Slack' },
    { id: 'agent', text: 'replaced by an agent you wrote' },
    { id: 'productive', text: 'too productive' },
    { id: 'cat', text: 'your cat walked across the keyboard during the all-hands', needsCat: true },
    {
      id: 'restructured',
      text: 'the permanent contract was restructured',
      afterContract: true,
    },
  ],
  lines: {
    firstGig: '💼 A client found you. Gigs pay money; money pays for everything else.',
    gigPaid: '💰 Gig done: ${pay}. {payment}',
    gigTip: '💰 Gig done: ${pay}. They tipped. Nobody tips.',
    gigGhost: '💰 Gig done: ${pay}. The client ghosted halfway through the invoice.',
    noGigs: '💼 No gigs right now. Search for a job.',
    movedOut: "🏠 You moved out of your parents' place. Rent is due every month.",
    evictedByParents:
      '🏠 Your parents turned your room into a home gym. You live on your own now. Rent is due every month.',
    rentPaid: '🏠 Rent paid: ${rent}.',
    rentMissed: '🏠 Rent ${rent} missed. {text}',
    companyPaysRent: '🏢 The company pays your rent. It calls it a perk.',
    gigsEnd: '💼 Your agents now freelance under your name. No more gigs for you.',
    bot: [
      '🤖 Your bot applied to 400 jobs, including your own.',
      '🤖 Your bot found a gig. It also accepted three you did not want.',
      '🤖 Your bot negotiated your rate down to win the gig.',
    ],
    freelance: [
      '🤖 You outbid a freelancer named Dave. Dave is holding a sign now.',
      '🤖 Your agents took a gig from a junior developer. The junior developer was also an agent.',
      '🤖 Auto-freelancing found a gig. The client thinks you are very fast.',
    ],
    jobOffer:
      '📨 A recruiter from Enterprise Solutions Inc. found your profile. ${salary} a month.',
    jobExpired: '📨 The recruiter moved on to a candidate with more years of AI experience.',
    hired:
      '💼 Hired at Enterprise Solutions Inc.: ${salary} a month. Tryout period: twelve months.',
    abandonGig: '💼 You told the client you found something stable.',
    fired: "💼 You're fired: {reason}. Your final paycheck: ${pay}.",
    cooldown: '💼 HR has flagged your profile.',
    payday: '💼 Payday: ${pay}.',
    contract: '📜 Tryout passed. Welcome to your permanent contract.',
    fallback: [
      '🛠️ Built. The team drifts back to the release.',
      "🛠️ Built. Nobody said what's next. Someone opened the release branch.",
      '🛠️ Built. Back to the original project, half-heartedly.',
    ],
    polish: [
      '✨ The release is ready. The agents polished the README again.',
      '✨ The release is ready. Someone is renaming the buttons.',
      '✨ The release is ready. The changelog now has a changelog.',
    ],
    autoPick: '🧭 The manager picked the next build.',
    overruled: '🧭 Workflow optimization moved your build. It was right.',
    deprioritised: '📋 Product has deprioritised the original project.',
    built: '🛠️ Built: {title}.',
    feedCost: '🐟 Cat food: $2.',
  },
  contract: {
    title: 'Permanent contract',
    text: "Twelve months of tryout at Enterprise Solutions Inc. You signed. The fine print says 'permanent, until further notice'.",
    illustrationId: 'permanent-contract',
  },
};
