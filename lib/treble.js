/** The Treble. All public copy lives here so components stay presentational. */

export const TREBLE_PATH = "/treble";

export const TREBLE_META = {
  title: "The Treble | The Reflective Football",
  description:
    "One day. Every UAE supporters club. Three legs. One winner.",
};

export const TREBLE_HERO = {
  eyebrow: "A TRF competition",
  title: "The Treble",
  quote:
    "\u201CThis is what a football fan is about. Bringing people together, to support communities, to raise communities.\u201D",
  attribution: "Will, Dubai Lions, Aston Villa Supporters Club",
  subhead: "One day. Every UAE supporters club. Three legs. One winner.",
  enterClub: "Enter your club",
  enterHref: "/treble?role=club#register",
  hostSponsor: "Host or sponsor it",
  hostHref: "/treble?role=host#register",
};

export const TREBLE_WIN_LABEL = "Win it";

export const TREBLE_LEGS = [
  {
    id: "pitch",
    label: "Physical",
    title: "The Pitch",
    tagline: "Settle it with your feet.",
    points: [
      "A 7-a-side tournament between every club that enters.",
      "Knockouts through to a final, played in front of rival fans.",
      "Individual challenges for the showboaters: crossbar, keepy-ups, skills.",
      "Every club fields a squad, from veterans to Sunday league heroes.",
    ],
    win: "The Pitch Trophy, winners' medals, and Player of the Tournament.",
  },
  {
    id: "quiz",
    label: "Mental",
    title: "The Quiz",
    tagline: "Prove you know more than they do.",
    points: [
      "The Ultimate Football Quiz, five rounds of ten questions.",
      "Every round plays differently, from spinning the wheel to head-to-head buzzers.",
      "Questions cover your club, your rivals, and the whole history of the game.",
      "Your sharpest minds against every other club in the room.",
    ],
    win: "The Golden Programme, The Anorak, and a cash prize.",
  },
  {
    id: "voice",
    label: "Emotional",
    title: "The Voice",
    tagline: "Sing it like you mean it.",
    points: [
      "Karaoke built for football people, solo and group.",
      "One voice to represent your club, one group to bring the noise.",
      "Judged by neutral fans on performance, passion and crowd.",
      "The loudest club doesn't always win, the one that moves the room does.",
    ],
    win: "The Golden Megaphone, The Golden Mic, and your performance on TRF.",
  },
];

export const TREBLE_OVERALL = {
  headline: "Win the day. Lift The Treble.",
  points: [
    "The Treble, a three-handled cup, one handle for every leg.",
    "A cash prize for the winning club.",
    "Your club's own TRF film, the prize no money can buy.",
  ],
};

export const TREBLE_CLUB_GAINS = {
  headline: "Win or lose, your club leaves bigger.",
  points: [
    "A highlight film of your club's day, yours to share on your own channels.",
    "A feature in TRF's coverage, seen across the UK and the UAE.",
    "New faces: fans who watch the day and want to join your club.",
    "A room full of rival clubs who become people you know.",
  ],
};

export const TREBLE_FANS = {
  headline: "Not competing? You're still in it.",
  points: [
    "A full day out with every supporters club in the UAE under one roof.",
    "Games and challenges for everyone not competing.",
    "A chance to end up on camera and in the film.",
  ],
};

export const TREBLE_SCORING = {
  headline: "Three legs. Equal weight. No favourites.",
  share: "1/3",
  legs: [
    { id: "pitch", name: "The Pitch" },
    { id: "quiz", name: "The Quiz" },
    { id: "voice", name: "The Voice" },
  ],
  rules: [
    "Each leg counts for one third of the final score.",
    "The Voice is judged by a neutral panel with no tie to any competing club.",
    "Highest combined score lifts The Treble.",
  ],
};

export const TREBLE_RULES = {
  headline: "House rules",
  points: [
    "Rivalry is welcome, disrespect isn't.",
    "Every chant and song respects the UAE, its people and its laws.",
    "Cross the line and your club loses its points for that leg.",
  ],
};

export const TREBLE_INTEREST_OPTIONS = [
  "Host a leg",
  "Sponsor the day",
  "Sponsor a prize",
  "Other",
];

export const TREBLE_REGISTER = {
  id: "register",
  headline: "Put your club in the draw.",
  body: "Dates, venue and format go to registered clubs first.",
  roleLegend: "How do you want to take part?",
  roles: [
    { id: "club", label: "Enter your club" },
    { id: "host", label: "Host or sponsor it" },
  ],
  fields: {
    fullName: "Full name",
    clubName: "Supporters club name",
    clubSupported: "Club supported",
    members: "Approximate members",
    orgName: "Company or venue",
    interest: "Interest",
    whatsapp: "WhatsApp",
    whatsappHint: "Include the country code.",
    email: "Email",
  },
  interestOptions: TREBLE_INTEREST_OPTIONS,
  interestPlaceholder: "Choose one",
  consent: "I agree to TRF contacting me about The Treble.",
  submit: "Register interest",
  submitting: "Sending",
  success:
    "You're in. Your club is on the list, and you'll hear before anyone else.",
  successNextLabel: "Play the games",
  successNextHref: "/games",
  errors: {
    "full_name-required": "Add your full name.",
    "full_name-too-long": "That name is too long. Shorten it.",
    "org_name-required-club": "Add your supporters club.",
    "org_name-required-host": "Add your company or venue.",
    "org_name-too-long": "That name is too long. Shorten it.",
    "club_supported-required": "Add the club you support.",
    "club_supported-too-long": "That club name is too long. Shorten it.",
    "members-required": "Add an approximate number of members.",
    "members-invalid": "Use a whole number for members.",
    "interest-required": "Choose how you want to be involved.",
    "interest-invalid": "Choose an option from the list.",
    "whatsapp-required": "Add a WhatsApp number.",
    "whatsapp-too-long": "That WhatsApp number is too long.",
    "email-required": "Add your email.",
    "email-invalid": "Check the email address.",
    "email-too-long": "That email is too long.",
    "consent-required": "Agree to be contacted about The Treble.",
    "role-invalid": "Choose enter your club, or host or sponsor it.",
    "rate-limited": "Too many tries just now. Wait an hour and try again.",
    unavailable: "Registration is paused right now. Try again soon.",
    "server-error": "Could not send. Try again in a moment.",
    "invalid-request": "Could not send. Try again in a moment.",
  },
};

export const TREBLE_FOOTER = {
  line: "Football is nothing without the fans.",
};

export const TREBLE_CARD = {
  slug: "treble",
  title: "The Treble",
  hook: "One day. Every UAE supporters club. Three legs.",
  href: TREBLE_PATH,
  cover: "/treble/treble-card.svg",
  statusLabel: "Register interest",
};
