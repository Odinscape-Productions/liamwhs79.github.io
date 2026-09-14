const { randomUUID } = require("crypto");
const { writeDb } = require("./store");

const games = [
  {
    id: "ghost-yotei", slug: "ghost-yotei", title: "Ghost of Yōtei", short: "GY",
    genre: "Action Adventure", platform: "PS5", accent: "#ff6a5b",
    cover: "linear-gradient(145deg,#6f1d1b,#d45a3a 48%,#f8d17a)",
    mapGenieUrl: "https://mapgenie.io/", source: "demo",
    description: "A sweeping open-world samurai adventure represented here with demo community metadata.", trophyCount: 52,
    trophies: [
      { id:"gy1", name:"A New Legend", grade:"platinum", rarity:"Ultra Rare", tip:"Complete the full trophy list.", earned:true },
      { id:"gy2", name:"Edge of the North", grade:"gold", rarity:"Rare", tip:"Clear every northern region tale.", earned:true },
      { id:"gy3", name:"Foxfire Trail", grade:"silver", rarity:"Uncommon", tip:"Discover hidden shrines and complete their paths.", earned:false },
      { id:"gy4", name:"Perfect Draw", grade:"bronze", rarity:"Common", tip:"Win a duel without taking damage.", earned:true }
    ]
  },
  {
    id: "helldivers-2", slug: "helldivers-2", title: "Helldivers 2", short: "HD2",
    genre: "Co-op Shooter", platform: "PS5", accent: "#f4d35e",
    cover: "linear-gradient(145deg,#13202b,#2d4a59 52%,#e0bc3d)", mapGenieUrl: "", source: "demo",
    description: "Squad-based co-op action with community parties, reviews and shared goals.", trophyCount: 39,
    trophies: [
      { id:"hd1", name:"The Epitome of Super Earth", grade:"platinum", rarity:"Ultra Rare", tip:"Earn every other trophy.", earned:false },
      { id:"hd2", name:"Hold My Primary", grade:"gold", rarity:"Very Rare", tip:"Complete a high-difficulty mission with strict weapon constraints.", earned:true },
      { id:"hd3", name:"Extractinating the Countryside", grade:"silver", rarity:"Rare", tip:"Finish a mission with the full squad extracted.", earned:true }
    ]
  },
  {
    id: "spider-man-2", slug: "spider-man-2", title: "Marvel's Spider-Man 2", short: "SM2",
    genre: "Action", platform: "PS5", accent: "#ef233c",
    cover: "linear-gradient(145deg,#101017,#283044 45%,#c21f39)", mapGenieUrl: "https://mapgenie.io/", source: "demo",
    description: "A city-sized superhero playground. Demo guide entries are included.", trophyCount: 42,
    trophies: [
      { id:"sm1", name:"Dedicated", grade:"platinum", rarity:"Uncommon", tip:"Collect all trophies.", earned:true },
      { id:"sm2", name:"Superior", grade:"gold", rarity:"Common", tip:"Reach the maximum level.", earned:true },
      { id:"sm3", name:"New York, New York", grade:"bronze", rarity:"Common", tip:"Complete all photo ops.", earned:true }
    ]
  },
  {
    id: "astro-bot", slug: "astro-bot", title: "ASTRO BOT", short: "AB",
    genre: "Platformer", platform: "PS5", accent: "#50b8e7",
    cover: "linear-gradient(145deg,#09244c,#157fb9 55%,#9ce9ff)", mapGenieUrl: "", source: "demo",
    description: "Bright platforming with a trophy hunt built for completionists.", trophyCount: 44,
    trophies: [
      { id:"ab1", name:"Astro-nomical!", grade:"platinum", rarity:"Rare", tip:"Unlock all trophies.", earned:false },
      { id:"ab2", name:"Bot Bot Revolution", grade:"silver", rarity:"Uncommon", tip:"Rescue a large group of bots.", earned:true }
    ]
  },
  {
    id: "gran-turismo-7", slug: "gran-turismo-7", title: "Gran Turismo 7", short: "GT7",
    genre: "Racing", platform: "PS5", accent: "#4f7cff",
    cover: "linear-gradient(145deg,#08152c,#123f87 52%,#6397ff)", mapGenieUrl: "", source: "demo",
    description: "Track-focused racing with time trial groups and trophy progression.", trophyCount: 54,
    trophies: [
      { id:"gt1", name:"Gran Turismo Platinum Trophy", grade:"platinum", rarity:"Ultra Rare", tip:"Earn all Gran Turismo 7 trophies.", earned:false },
      { id:"gt2", name:"Finale", grade:"gold", rarity:"Uncommon", tip:"Complete the main café journey.", earned:true }
    ]
  }
];

function demoUser(id, handle, displayName, avatar, theme, stats, bio, currentGame, library) {
  return {
    id, username:null, passwordHash:null, canLogin:false,
    handle, psnOnlineId:handle, displayName, role:"demo", bio, avatar, theme,
    level:stats.level, platinum:stats.platinum, gold:stats.gold, silver:stats.silver, bronze:stats.bronze,
    hours:stats.hours, psnLinked:false, psnVerified:false, dataSource:"demo", currentGame,
    createdAt:new Date().toISOString(), library
  };
}

async function createSeed() {
  const now = new Date().toISOString();
  const users = [
    demoUser("u-demo-karn","KARN_91","Karn","nova","midnight",{level:387,platinum:46,gold:188,silver:604,bronze:2142,hours:4382},"Trophy hunter • late-night co-op • always chasing the next platinum.","ghost-yotei",[
      {gameId:"ghost-yotei",hours:118,progress:82,trophies:43,lastPlayed:"Today"},
      {gameId:"helldivers-2",hours:246,progress:61,trophies:24,lastPlayed:"Yesterday"},
      {gameId:"spider-man-2",hours:73,progress:100,trophies:42,lastPlayed:"3 days ago"}
    ]),
    demoUser("u-demo-sky","SKYFORGE","Sky","vortex","aurora",{level:244,platinum:28,gold:139,silver:438,bronze:1610,hours:2891},"Co-op, photo mode and impossible difficulty settings.","helldivers-2",[
      {gameId:"helldivers-2",hours:390,progress:92,trophies:36,lastPlayed:"Today"},
      {gameId:"gran-turismo-7",hours:203,progress:51,trophies:28,lastPlayed:"2 days ago"}
    ]),
    demoUser("u-demo-moth","MOTHBYTE","MothByte","prism","void",{level:511,platinum:91,gold:306,silver:999,bronze:3611,hours:6721},"Indies, platinum routes and suspiciously detailed spreadsheets.","astro-bot",[
      {gameId:"astro-bot",hours:58,progress:100,trophies:44,lastPlayed:"Today"},
      {gameId:"ghost-yotei",hours:156,progress:100,trophies:52,lastPlayed:"4 days ago"}
    ])
  ];

  const reviews = [
    { id:randomUUID(), gameId:"ghost-yotei", userId:"u-demo-moth", rating:5, body:"Beautiful world, great combat rhythm and a trophy route that rewards exploring instead of checklist fatigue.", createdAt:now },
    { id:randomUUID(), gameId:"helldivers-2", userId:"u-demo-sky", rating:5, body:"Still one of the best games here for instant squad chaos. Party finder makes it even better.", createdAt:now }
  ];
  const parties = [
    { id:randomUUID(), gameId:"helldivers-2", title:"Super Helldive • chill comms", hostId:"u-demo-sky", members:["u-demo-sky"], maxMembers:4, mic:"Preferred", skill:"Any", startsAt:"Tonight 21:30", status:"open", createdAt:now },
    { id:randomUUID(), gameId:"gran-turismo-7", title:"Nordschleife practice", hostId:"u-demo-moth", members:["u-demo-moth"], maxMembers:8, mic:"Optional", skill:"Intermediate+", startsAt:"Tomorrow 20:00", status:"open", createdAt:now }
  ];
  const groups = [
    { id:randomUUID(), gameId:"ghost-yotei", name:"Yōtei 100% Club", description:"Routes, hidden collectibles, photo spots and platinum help.", ownerId:"u-demo-moth", members:["u-demo-moth"], visibility:"public", createdAt:now },
    { id:randomUUID(), gameId:"helldivers-2", name:"Night Shift Divers", description:"UK evening squads. No rage, no sweat, just clean extractions.", ownerId:"u-demo-sky", members:["u-demo-sky"], visibility:"public", createdAt:now }
  ];

  return {
    meta:{version:2,seededAt:now,demoData:true}, users, games, reviews, parties, groups,
    activity:[
      {id:randomUUID(),userId:"u-demo-karn",type:"trophy",title:"Earned Gold: Edge of the North",gameId:"ghost-yotei",at:"12m"},
      {id:randomUUID(),userId:"u-demo-sky",type:"party",title:"Created a Helldivers 2 party",gameId:"helldivers-2",at:"34m"},
      {id:randomUUID(),userId:"u-demo-moth",type:"platinum",title:"Platinum #91 unlocked",gameId:"astro-bot",at:"2h"}
    ]
  };
}

async function seedIfNeeded(readDb) {
  if (readDb()) return;
  writeDb(await createSeed());
}

module.exports = { createSeed, seedIfNeeded };
