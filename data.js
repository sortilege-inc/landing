// Page data: open games, and the seed lists behind the type-to-filter pickers.
//
// Edit this file when the roster changes — it is the only place game details live.
// Details below were taken from the StartPlaying listings on 2026-08-21; schedules
// and prices drift, so re-check them against the listings periodically.

window.OPEN_GAMES = [
  {
    title: 'Sjórseiðr: A Sea-Faring Covenant',
    system: 'Ars Magica 5th Edition',
    status: 'One seat left',
    price: '$32 / session',
    length: '3–4 hours',
    schedule: 'Bi-weekly, Sundays',
    format: 'Online (Foundry VTT + Discord)',
    image: 'assets/art/game-sjorseidr.jpg',
    pitch: 'A group of mages have established an independent floating covenant in the North Atlantic, operating from their ships while investigating the mysterious disappearance of their founding magus.',
    url: 'https://startplaying.games/adventure/cm2lsx0ok00325goj0sybhg5q',
  },
  {
    title: 'Journey to the Winter City',
    system: 'City of Winter',
    status: 'Not yet started',
    price: '$35 / session',
    length: '3 hours',
    schedule: 'Bi-weekly, Wednesdays',
    format: 'Online (Discord)',
    image: 'assets/art/game-winter-city.jpg',
    pitch: 'A story-driven exploration game where characters navigate the difficult journey to a new home while deciding which traditions to carry forward from their abandoned homeland.',
    url: 'https://startplaying.games/adventure/cmsukcr0l00lplf04l20padwp',
  },
  {
    title: "So You've Been Thrown Down a Well",
    system: 'Troika!',
    status: 'One-shot · Not yet scheduled',
    price: '$35 / session',
    length: '3 hours',
    schedule: 'Date to be arranged',
    format: 'Online (Discord)',
    image: 'assets/art/game-troika-well.jpg',
    pitch: 'After falling down a strange well, players explore a surreal dungeon in search of escape and redemption.',
    url: 'https://startplaying.games/adventure/cmsuncli60006l404ybpsvxxn',
  },
];

window.DISCORD_INVITE = 'https://discord.gg/KNcPMrQuSW';

// Systems Jordan has run. Seeded from the Gamemastering Pamphlet and the converted
// rules corpora — EDIT FREELY, this is just the starting list people can pick from.
// The pickers also accept anything typed in, so nothing here is a limit.
window.SYSTEMS = [
  'Ars Magica 5th Edition',
  'Call of Cthulhu',
  'City of Winter',
  'Daggerheart',
  'Dungeons & Dragons 5e',
  'Dune: Adventures in the Imperium',
  'Eclipse Phase',
  'Good Society',
  'Invisible Sun',
  'Legend of the Five Rings',
  'Monsterhearts',
  'Mouse Guard',
  'Mörk Borg',
  'Root',
  'The Expanse',
  'The One Ring',
  'Troika!',
  'Vampire: The Masquerade',
  'Werewolf: The Apocalypse',
];

window.VIBES = [
  'Political intrigue',
  'Courtly romance',
  'Cosmic horror',
  'Gothic horror',
  'Folk horror',
  'Dark fantasy',
  'Heroic fantasy',
  'Cyberpunk',
  'Space opera',
  'Mystery & investigation',
  'Heist',
  'Exploration & travel',
  'Survival',
  'Comedy',
  'Tragedy',
  'Historical',
  'Post-apocalyptic',
  'Wuxia & samurai',
  'Slice of life',
  'Pulp adventure',
];
