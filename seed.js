const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");
const { writeDb } = require("./store");

const games = [
  {
    id: "ghost-yotei",
    slug: "ghost-yotei",
    title: "Ghost of Yōtei",
    short: "GY",
    genre: "Action Adventure",
    platform: "PS5",
    accent: "#ff6a5b",
    cover: "linear-gradient(145deg,#6f1d1b,#d45a3a 48%,#f8d17a)",
    mapGenieUrl: "https://mapgenie.io/",
    description: "A sweeping open-world samurai adventure represented here with demo community metadata.",
    trophyCount: 52,
    trophies: [
      { id:"gy1", name:"A New Legend", grade:"platinum", rarity:"Ultra Rare", tip:"Complete the full trophy list.", earned:true },
      { id:"gy2", name:"Edge of the North", grade:"gold", rarity:"Rare", tip:"Clear every northern region tale.", earned:true },
      { id:"gy3", name:"Foxfire Trail", grade:"silver", rarity:"Uncommon", tip:"Discover hidden shrines and complete their paths.", earned:false },
      { id:"gy4", name:"Perfect Draw", grade:"bronze", rarity:"Common", tip:"Win a duel without taking damage.", earned:true }
    ]
  },
  {
    id: "helldivers-2",
    slug: "helldivers-2",
    title: "Helldivers 2",
    short: "HD2",
    genre: "Co-op Shooter",
    platform: "PS5",
    accent: "#f4d35e",
    cover: "linear-gradient(145deg,#13202b,#2d4a59 52%,#e0bc3d)",
    mapGenieUrl: "",
    description: "Squad-based co-op action with community parties, reviews and shared goals.",
    trophyCount: 39,
    trophies: [
      { id:"hd1", name:"The Epitome of Super Earth", grade:"platinum", rarity:"Ultra Rare", tip:"Earn every other trophy.", earned:false },
      { id:"hd2", name:"Hold My Primary", grade:"gold", rarity:"Very Rare", tip:"Complete a high-difficulty mission with strict weapon constraints.", earned:true },
      { id:"hd3", name:"Extractinating the Countryside", grade:"silver", rarity:"Rare", tip:"Finish a mission with the full squad extracted.", earned:true }
    ]
  },
  {
    id: "spider-man-2",
    slug: "spider-man-2",
    title: "Marvel's Spider-Man 2",
    short: "SM2",
    genre: "Action",
    platform: "PS5",
    accent: "#ef233c",
    cover: "linear-gradient(145deg,#101017,#283044 45%,#c21f39)",
    mapGenieUrl: "https://mapgenie.io/",
    description: "A city-sized superhero playground. Demo guide entries are included.",
    trophyCount: 42,
    trophies: [
      { id:"sm1", name:"Dedicated", grade:"platinum", rarity:"Uncommon", tip:"Collect all trophies.", earned:true },
      { id:"sm2", name:"Superior", grade:"gold", rarity:"Common", tip:"Reach the maximum level.", earned:true },
      { id:"sm3", name:"New York, New York", grade:"bronze", rarity:"Common", tip:"Complete all photo ops.", earned:true }
    ]
  },
  {
    id: "astro-bot",
    slug: "astro-bot",
    title: "ASTRO BOT",
    short: "AB",
    genre: "Platformer",
    platform: "PS5",
    accent: "#50b8e7",
    cover: "linear-gradient(145deg,#09244c,#157fb9 55%,#9ce9ff)",
    mapGenieUrl: "",
    description: "Bright platforming with a trophy hunt built for completionists.",
    trophyCount: 44,
    trophies: [
      { id:"ab1", name:"Astro-nomical!", grade:"platinum", rarity:"Rare", tip:"Unlock all trophies.", earned:false },
      { id:"ab2", name:"Bot Bot Revolution", grade:"silver", rarity:"Uncommon", tip:"Rescue a large group of bots.", earned:true }
    ]
  },
  {
    id: "death-stranding-2",
    slug: "death-stranding-2",
    title: "Death Stranding 2",
    short: "DS2",
    genre: "Adventure",
    platform: "PS5",
    accent: "#9ac3d7",
    cover: "linear-gradient(145deg,#10242a,#476b74 50%,#d0dee3)",
    mapGenieUrl: "https://mapgenie.io/",
    description: "A cinematic traversal adventure with community-created checklist and guide hooks.",
    trophyCount: 55,
    trophies: [
      { id:"ds1", name:"Should We Have Connected?", grade:"platinum", rarity:"Ultra Rare", tip:"Complete the trophy set.", earned:false },
      { id:"ds2", name:"Bridge Builder", grade:"silver", rarity:"Uncommon", tip:"Contribute materials to network structures.", earned:true }
    ]
  },
  {
    id: "gran-turismo-7",
    slug: "gran-turismo-7",
    title: "Gran Turismo 7",
    short: "GT7",
    genre: "Racing",
    platform: "PS5",
    accent: "#4f7cff",
    cover: "linear-gradient(145deg,#08152c,#123f87 52%,#6397ff)",
    mapGenieUrl: "",
    description: "Track-focused racing with time trial groups and trophy progression.",
    trophyCount: 54,
    trophies: [
      { id:"gt1", name:"Gran Turismo Platinum Trophy", grade:"platinum", rarity:"Ultra Rare", tip:"Earn all Gran Turismo 7 trophies.", earned:false },
      { id:"gt2", name:"Finale", grade:"gold", rarity:"Uncommon", tip:"Complete the main café journey.", earned:true }
    ]
  }
];

async function createSeed() {
  const now = new Date().toISOString();
  const users = [
    {
      id: "u-liam",
      email: "liam@demo.local",
      passwordHash: await bcrypt.hash("Play1234!", 10),
      handle: "KARN_91",
      displayName: "Karn",
      role: "member",
      bio: "Trophy hunter • late-night co-op • always chasing the next platinum.",
      avatar: "nova",
      theme: "midnight",
      level: 387,
      platinum: 46,
      gold: 188,
      silver: 604,
      bronze: 2142,
      hours: 4382,
      psnLinked: false,
      dataSource: "demo",
      currentGame: "ghost-yotei",
      createdAt: now,
      library: [
        { gameId:"ghost-yotei", hours:118, progress:82, trophies:43, lastPlayed:"Today" },
        { gameId:"helldivers-2", hours:246, progress:61, trophies:24, lastPlayed:"Yesterday" },
        { gameId:"spider-man-2", hours:73, progress:100, trophies:42, lastPlayed:"3 days ago" },
        { gameId:"astro-bot", hours:41, progress:76, trophies:34, lastPlayed:"1 week ago" },
        { gameId:"death-stranding-2", hours:95, progress:49, trophies:27, lastPlayed:"1 week ago" }
      ]
    },
    {
      id: "u-sky",
      email: "sky@demo.local",
      passwordHash: await bcrypt.hash("Play1234!", 10),
      handle: "SKYFORGE",
      displayName: "Sky",
      role: "member",
      bio: "Co-op, photo mode and impossible difficulty settings.",
      avatar: "vortex",
      theme: "aurora",
      level: 244,
      platinum: 28,
      gold: 139,
      silver: 438,
      bronze: 1610,
      hours: 2891,
      psnLinked: false,
      dataSource: "demo",
      currentGame: "helldivers-2",
      createdAt: now,
      library: [
        { gameId:"helldivers-2", hours:390, progress:92, trophies:36, lastPlayed:"Today" },
        { gameId:"gran-turismo-7", hours:203, progress:51, trophies:28, lastPlayed:"2 days ago" }
      ]
    },
    {
      id: "u-moth",
      email: "moth@demo.local",
      passwordHash: await bcrypt.hash("Play1234!", 10),
      handle: "MOTHBYTE",
      displayName: "MothByte",
      role: "member",
      bio: "Indies, platinum routes and suspiciously detailed spreadsheets.",
      avatar: "prism",
      theme: "void",
      level: 511,
      platinum: 91,
      gold: 306,
      silver: 999,
      bronze: 3611,
      hours: 6721,
      psnLinked: false,
      dataSource: "demo",
      currentGame: "astro-bot",
      createdAt: now,
      library: [
        { gameId:"astro-bot", hours:58, progress:100, trophies:44, lastPlayed:"Today" },
        { gameId:"ghost-yotei", hours:156, progress:100, trophies:52, lastPlayed:"4 days ago" }
      ]
    }
  ];

  const reviews = [
    { id: randomUUID(), gameId:"ghost-yotei", userId:"u-moth", rating:5, body:"Beautiful world, great combat rhythm and a trophy route that rewards exploring instead of checklist fatigue.", createdAt:now },
    { id: randomUUID(), gameId:"helldivers-2", userId:"u-sky", rating:5, body:"Still one of the best games here for instant squad chaos. Party finder makes it even better.", createdAt:now },
    { id: randomUUID(), gameId:"spider-man-2", userId:"u-liam", rating:4, body:"A brilliant weekend platinum. The movement is the star and the clean-up is painless.", createdAt:now }
  ];

  const parties = [
    {
      id: randomUUID(), gameId:"helldivers-2", title:"Super Helldive • chill comms",
      hostId:"u-sky", members:["u-sky","u-liam"], maxMembers:4,
      mic:"Preferred", skill:"Any", startsAt:"Tonight 21:30", status:"open", createdAt:now
    },
    {
      id: randomUUID(), gameId:"gran-turismo-7", title:"Nordschleife practice",
      hostId:"u-moth", members:["u-moth"], maxMembers:8,
      mic:"Optional", skill:"Intermediate+", startsAt:"Tomorrow 20:00", status:"open", createdAt:now
    }
  ];

  const groups = [
    {
      id: randomUUID(), gameId:"ghost-yotei", name:"Yōtei 100% Club",
      description:"Routes, hidden collectibles, photo spots and platinum help.",
      ownerId:"u-moth", members:["u-moth","u-liam"], visibility:"public", createdAt:now
    },
    {
      id: randomUUID(), gameId:"helldivers-2", name:"Night Shift Divers",
      description:"UK evening squads. No rage, no sweat, just clean extractions.",
      ownerId:"u-sky", members:["u-sky","u-liam"], visibility:"public", createdAt:now
    },
    {
      id: randomUUID(), gameId:"gran-turismo-7", name:"Late Apex",
      description:"Time trials, tuning talk and weekly community laps.",
      ownerId:"u-moth", members:["u-moth"], visibility:"public", createdAt:now
    }
  ];

  return {
    meta: { version:1, seededAt:now, demoData:true },
    users, games, reviews, parties, groups,
    activity: [
      { id:randomUUID(), userId:"u-liam", type:"trophy", title:"Earned Gold: Edge of the North", gameId:"ghost-yotei", at:"12m" },
      { id:randomUUID(), userId:"u-sky", type:"party", title:"Created a Helldivers 2 party", gameId:"helldivers-2", at:"34m" },
      { id:randomUUID(), userId:"u-moth", type:"platinum", title:"Platinum #91 unlocked", gameId:"astro-bot", at:"2h" }
    ]
  };
}

async function seedIfNeeded(readDb) {
  if (readDb()) return;
  writeDb(await createSeed());
}

module.exports = { createSeed, seedIfNeeded };
