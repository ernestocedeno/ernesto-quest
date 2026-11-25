"use strict";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const gameShell = document.querySelector(".game-shell");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#startButton");
const title = document.querySelector("#title");
const subtitle = document.querySelector("#subtitle");
const scoreEl = document.querySelector("#score");
const waveEl = document.querySelector("#wave");
const levelNameEl = document.querySelector("#levelName");
const livesEl = document.querySelector("#lives");
const itemsEl = document.querySelector("#items");
const stick = document.querySelector("#stick");
const stickKnob = document.querySelector("#stickKnob");
const attackButton = document.querySelector("#fireButton");
const musicButton = document.querySelector("#musicButton");
const controls = document.querySelector(".controls");
const shopPanel = document.querySelector("#shopPanel");
const shopkeeperMessage = document.querySelector("#shopkeeperMessage");
const shopItems = document.querySelector("#shopItems");
const shopContinue = document.querySelector("#shopContinue");

const W = canvas.width;
const H = canvas.height;
const keys = {};
const directions = {
  north: { x: 0, y: -1, opposite: "south" },
  east: { x: 1, y: 0, opposite: "west" },
  south: { x: 0, y: 1, opposite: "north" },
  west: { x: -1, y: 0, opposite: "east" }
};
const campaigns = [
  { title: "Ernesto's Quest", floors: ["The Moss Labyrinth"], theme: "forest" },
  { title: "Entry Level Specialist", floors: ["The Branch Office"], theme: "office" },
  { title: "Corporate Headquarters", floors: ["Manufacturing", "Upper Management", "The Boardroom"], theme: "hq" }
];
const enemyPools = {
  forest: ["goblin", "ghost", "dinosaur", "knight"],
  office: ["ninja", "drone", "ninja", "drone"],
  manufacturing: ["drone", "ninja", "drone", "knight"],
  executive: ["ninja", "drone", "ninja", "ghost"],
  boardroom: ["ninja", "drone", "knight", "ninja"]
};
const colors = {
  forest: ["#5e8547", "#6a9251", "#526f42"],
  office: ["#77705c", "#837a65", "#696354"],
  manufacturing: ["#54666b", "#65777a", "#485a60"],
  executive: ["#5a5872", "#68667f", "#4d4b62"],
  boardroom: ["#665c53", "#75685d", "#554c47"],
  secret: ["#54473a", "#655242", "#483c33"]
};

let running = false;
let paused = false;
let time = 0;
let rupees = 0;
let health = 10;
let maxHealth = 10;
let roomIndex = 0;
let chapterIndex = 0;
let floorIndex = 0;
let currentRoom = null;
let floorRooms = [];
let swordTimer = 0;
let swordCooldown = 0;
let invulnerable = 0;
let briefcaseTimer = 0;
let message = "Follow the maze. Press an arrow to face that way.";
let messageTime = 4;
let enemies = [];
let projectiles = [];
let playerShots = [];
let roomTransitionLock = 0;
let swingRequested = false;
let cutscene = null;
let cardAction = null;
let armorActive = false;
let reinforcedSuit = false;
let pinstripeSuit = false;
let mbaActive = false;
let keycard = false;
let boardCleared = false;
let collectedItems = new Set();
let pinstripeHitEnemies = new Set();
let drops = [];
let starTimer = 0;
let enemySequence = 0;
let globalRooms = [];
let forestFinalRoom = null;
let finalCeoRoom = null;
let audioContext = null;
let musicGain = null;
let musicTimer = null;
let musicEnabled = true;
let currentMusicTheme = "forest";
let musicStep = 0;
let musicEcho = null;
let musicEchoFeedback = null;
let musicEchoReturn = null;
let shopDestination = null;

const player = {
  x: 100, y: H / 2, r: 15, facing: "east", speed: 180,
  moving: false, animTime: 0, attackTime: 0, attackFacing: "east", hurtTime: 0
};
const touchMove = { x: 0, y: 0 };

function makeEnemy(kind, x, y, hp) {
  const boss = ["hr", "middle", "production", "vp", "executive", "ceo"].includes(kind);
  const maxHp = hp || ({ hr: 18, middle: 20, production: 22, vp: 12, executive: 3, ceo: 32 }[kind] || 2);
  return {
    id: ++enemySequence, kind, x, y, r: kind === "ceo" ? 37 : kind === "hr" || kind === "middle" || kind === "production" ? 29 : boss ? 23 : kind === "dinosaur" || kind === "knight" ? 19 : 15,
    hp: maxHp, maxHp, boss, vx: 0, vy: 0, flash: 0,
    speed: boss ? 58 : kind === "ghost" ? 75 : kind === "dinosaur" ? 83 : kind === "knight" ? 56 : kind === "ninja" ? 98 : kind === "drone" ? 68 : 70,
    dropCooldown: 0,
    attackTimer: 1.5 + Math.random() * 1.3,
    animTime: Math.random() * Math.PI * 2,
    hitTime: 0,
    tauntTimer: kind === "ceo" ? 6 + Math.random() * 2 : 0
  };
}

function drawMiniMap() {
  if (currentRoom.isSecret) return;
  const mapRooms = floorRooms.filter(room => !room.isSecret);
  const cols = Math.max(...mapRooms.map(room => room.col)) + 1;
  const rows = Math.max(...mapRooms.map(room => room.row)) + 1;
  const cellW = 21;
  const cellH = 18;
  const width = cols * cellW + 12;
  const height = rows * cellH + 12;
  const left = W - width - 18;
  const top = 105;
  ctx.fillStyle = "rgba(14,18,17,.6)";
  ctx.fillRect(left, top, width, height);
  ctx.strokeStyle = "rgba(236,220,168,.32)";
  ctx.strokeRect(left, top, width, height);
  ctx.fillStyle = "rgba(244,232,193,.7)";
  ctx.font = "bold 8px system-ui";
  ctx.textAlign = "left";
  ctx.fillText("MAP", left + 6, top - 4);
  for (const room of mapRooms) {
    const x = left + 10 + room.col * cellW;
    const y = top + 8 + room.row * cellH;
    for (const direction of Object.keys(room.links)) {
      const neighbor = room.links[direction].room;
      const delta = directions[direction];
      ctx.strokeStyle = room.links[direction].requirement && !requirementMet(room.links[direction].requirement)
        ? "rgba(207,101,84,.8)" : room.visited || neighbor.visited ? "rgba(232,218,162,.72)" : "rgba(232,218,162,.19)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + 3);
      ctx.lineTo(x + 3 + delta.x * cellW, y + 3 + delta.y * cellH);
      ctx.stroke();
    }
    ctx.fillStyle = room === currentRoom ? "#f5e29b" : room.bossType ? (room.visited ? "#cf7764" : "rgba(207,119,100,.42)") : room.visited ? "#b9d1a2" : "rgba(220,225,199,.24)";
    ctx.fillRect(x, y, 8, 8);
  }
}

function connect(a, direction, b, requirement) {
  a.links[direction] = { room: b, requirement: requirement || null };
  b.links[directions[direction].opposite] = { room: a, requirement: requirement || null };
}

function randomRoomMaze(room, index) {
  const protectedZones = [{ x: W / 2, y: H / 2, r: 82 }];
  if (index === 0) protectedZones.push({ x: 76, y: H / 2, r: 84 });
  if (room.chest) protectedZones.push({ x: room.chest.x, y: room.chest.y, r: 78 });
  if (room.heartContainer) protectedZones.push({ x: room.heartContainer.x, y: room.heartContainer.y, r: 55 });
  if (room.briefcaseAt) protectedZones.push({ x: room.briefcaseAt.x, y: room.briefcaseAt.y, r: 55 });
  if (room.secretWall) protectedZones.push({ x: room.secretWall.x + room.secretWall.w / 2, y: room.secretWall.y + room.secretWall.h / 2, r: 62 });
  if (room.bossType) protectedZones.push({ x: W / 2, y: H / 2 - 20, r: 110 });

  const rectangles = [];
  const overlaps = (rect, other) => rect[0] < other[0] + other[2] + 24 &&
    rect[0] + rect[2] + 24 > other[0] && rect[1] < other[1] + other[3] + 24 &&
    rect[1] + rect[3] + 24 > other[1];
  for (const [left, top] of [[true, true], [true, false], [false, true], [false, false]]) {
    let placed = false;
    for (let attempt = 0; attempt < 20 && !placed; attempt++) {
      const width = 62 + Math.random() * 88;
      const height = 34 + Math.random() * 42;
      const x = left ? 130 + Math.random() * 210 : 620 + Math.random() * 185;
      const y = top ? 98 + Math.random() * 95 : 347 + Math.random() * 72;
      const rect = [Math.round(x), Math.round(y), Math.round(width), Math.round(height)];
      const isProtected = protectedZones.some(zone => {
        const px = Math.max(rect[0], Math.min(zone.x, rect[0] + rect[2]));
        const py = Math.max(rect[1], Math.min(zone.y, rect[1] + rect[3]));
        return Math.hypot(zone.x - px, zone.y - py) < zone.r;
      });
      if (!isProtected && rectangles.every(other => !overlaps(rect, other))) {
        rectangles.push(rect);
        placed = true;
      }
    }
  }
  return rectangles;
}

function createFloor(config) {
  const nodes = [];
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const index = row * config.cols + col;
      const isBoss = config.bossIndex === index || (config.extraBosses && config.extraBosses[index]);
      const room = {
        id: `${config.id}-${index}`, name: config.labels?.[index] || `${config.name} ${index + 1}`,
        chapter: config.chapter, floor: config.floor, gridIndex: index, row, col,
        theme: config.theme, obstacles: [],
        links: {}, gates: {}, enemies: [], cleared: false, bossHandled: false,
        chest: null, heartContainer: null, briefcaseAt: null, secretWall: null,
        bossType: config.extraBosses?.[index] || (config.bossIndex === index ? config.bossType : null)
      };
      if (room.bossType === "vp-team") room.enemySpecs = ["vp", "vp", "vp"];
      else if (room.bossType === "board") room.enemySpecs = ["executive", "executive", "executive", "executive", "executive"];
      else room.enemySpecs = isBoss ? [room.bossType] : [];
      if (!isBoss) {
        const pool = enemyPools[config.enemyPool];
        const count = index === 0 ? 1 : 1 + index % 3;
        room.enemySpecs = Array.from({ length: count }, (_, n) => pool[(index + n * 2) % pool.length]);
      }
      if (config.hearts && config.hearts.includes(index)) {
        room.heartContainer = { id: `${room.id}-heart`, x: index % 2 ? 785 : 175, y: index % 2 ? 395 : 145 };
      }
      if (config.armorRoom === index) {
        room.chest = { x: 790, y: 255, kind: "reinforcedSuit", opened: false };
      }
      if (config.briefcases && config.briefcases.includes(index)) {
        room.briefcaseAt = { x: index % 2 ? 760 : 180, y: index % 2 ? 150 : 390, collected: false };
      }
      nodes.push(room);
    }
  }

  const skip = new Set(config.skipEdges || []);
  const edgeKey = (a, b) => [a, b].sort((x, y) => x - y).join(":");
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const i = row * config.cols + col;
      if (col + 1 < config.cols) {
        const next = i + 1;
        if (!skip.has(edgeKey(i, next))) connect(nodes[i], "east", nodes[next]);
      }
      if (row + 1 < config.rows) {
        const next = i + config.cols;
        if (!skip.has(edgeKey(i, next))) connect(nodes[i], "south", nodes[next]);
      }
    }
  }
  for (const gate of config.gates || []) {
    connect(nodes[gate.from], gate.direction, nodes[gate.to], gate.requirement);
  }
  if (config.keycardRoom !== undefined) {
    nodes[config.keycardRoom].chest = { x: 770, y: 400, kind: "keycard", opened: false };
  }
  if (config.secretRoom !== undefined) {
    nodes[config.secretRoom].secretWall = {
      x: 480, y: 174, w: 62, h: 30, kind: config.secretKind || "moss", opened: false
    };
  }
  if (config.mbaRoom !== undefined) {
    nodes[config.mbaRoom].secretWall = { x: 480, y: 174, w: 62, h: 30, kind: "painting", opened: false };
  }
  nodes.forEach((room, index) => {
    room.obstacles = randomRoomMaze(room, index + config.floor * 8);
    if (room.bossType === "board") room.name = "The Board";
    if (room.bossType === "ceo") room.name = "The CEO's Office";
  });
  return nodes;
}

function buildWorld() {
  const forest = createFloor({
    id: "forest", name: "Moss Labyrinth", chapter: 0, floor: 0, theme: "forest", enemyPool: "forest",
    cols: 5, rows: 2, bossIndex: 9, bossType: "hr", keycardRoom: 6, secretRoom: 2,
    skipEdges: ["8:9", "4:9"], gates: [{ from: 4, direction: "south", to: 9, requirement: "keycard" }],
    hearts: [1, 4, 7], briefcases: [3, 8]
  });
  forestFinalRoom = forest[9];

  const office = createFloor({
    id: "office", name: "Branch Office", chapter: 1, floor: 0, theme: "office", enemyPool: "office",
    cols: 4, rows: 2, bossIndex: 7, bossType: "middle", mbaRoom: 2,
    hearts: [1, 4, 6], briefcases: [3]
  });

  const manufacturing = createFloor({
    id: "hq-manufacturing", name: "Manufacturing", chapter: 2, floor: 0, theme: "manufacturing", enemyPool: "manufacturing",
    cols: 4, rows: 2, bossIndex: 7, bossType: "production", armorRoom: 3, hearts: [2, 5], briefcases: [4]
  });
  const upper = createFloor({
    id: "hq-upper", name: "Upper Management", chapter: 2, floor: 1, theme: "executive", enemyPool: "executive",
    cols: 4, rows: 2, bossIndex: 7, bossType: "vp-team", hearts: [1, 4], briefcases: [5]
  });
  const boardroom = createFloor({
    id: "hq-boardroom", name: "The Boardroom", chapter: 2, floor: 2, theme: "boardroom", enemyPool: "boardroom",
    cols: 4, rows: 2, extraBosses: { 6: "board", 7: "ceo" },
    skipEdges: ["3:7"], gates: [{ from: 6, direction: "east", to: 7, requirement: "board" }],
    hearts: [2, 5], briefcases: [4]
  });
  finalCeoRoom = boardroom[7];
  const floorSets = [[forest], [office], [manufacturing, upper, boardroom]];
  globalRooms = floorSets.flat(2);

  const secretRoom = {
    id: "forest-secret", name: "The Moss Cache", chapter: 0, floor: 0, theme: "secret",
    obstacles: [], links: {}, gates: {}, enemySpecs: [], cleared: true, isSecret: true,
    chest: { x: 480, y: 260, kind: "armor", opened: false }, heartContainer: null, briefcaseAt: null,
    secretWall: null
  };
  const mbaRoom = {
    id: "office-secret", name: "The MBA Annex", chapter: 1, floor: 0, theme: "secret",
    obstacles: [], links: {}, gates: {}, enemySpecs: [], cleared: true, isSecret: true,
    chest: { x: 480, y: 260, kind: "mba", opened: false }, heartContainer: null, briefcaseAt: null,
    secretWall: null
  };
  forest[2].secretRoom = secretRoom;
  office[2].secretRoom = mbaRoom;
  globalRooms.push(secretRoom, mbaRoom);
  return floorSets;
}

const floorSets = buildWorld();

function randomizeFloorGraphs() {
  for (const chapterFloors of floorSets) {
    for (const floor of chapterFloors) {
      const gates = [];
      for (const room of floor) {
        for (const [direction, link] of Object.entries(room.links)) {
          if (link.requirement && room.gridIndex < link.room.gridIndex) {
            gates.push({ from: room, direction, to: link.room, requirement: link.requirement });
          }
        }
        room.links = {};
      }

      const specialBosses = new Set(floor.filter(room => room.bossType === "hr" || room.bossType === "ceo"));
      const mainRooms = floor.filter(room => !specialBosses.has(room));
      const visited = new Set([mainRooms[0]]);
      const stack = [mainRooms[0]];
      const adjacent = room => mainRooms.filter(candidate =>
        !visited.has(candidate) &&
        Math.abs(candidate.col - room.col) + Math.abs(candidate.row - room.row) === 1
      );
      while (stack.length) {
        const room = stack[stack.length - 1];
        const options = adjacent(room);
        if (!options.length) {
          stack.pop();
          continue;
        }
        const next = options[Math.floor(Math.random() * options.length)];
        const direction = next.col > room.col ? "east" : next.col < room.col ? "west" : next.row > room.row ? "south" : "north";
        connect(room, direction, next);
        visited.add(next);
        stack.push(next);
      }

      for (const room of mainRooms) {
        const options = mainRooms.filter(candidate =>
          Math.abs(candidate.col - room.col) + Math.abs(candidate.row - room.row) === 1 &&
          !room.links[ candidate.col > room.col ? "east" : candidate.col < room.col ? "west" : candidate.row > room.row ? "south" : "north" ] &&
          Math.random() < .28
        );
        for (const next of options) {
          const direction = next.col > room.col ? "east" : next.col < room.col ? "west" : next.row > room.row ? "south" : "north";
          connect(room, direction, next);
        }
      }
      for (const gate of gates) connect(gate.from, gate.direction, gate.to, gate.requirement);
    }
  }
}

function updateHud() {
  levelNameEl.textContent = currentRoom?.name || "Ernesto's Quest";
  waveEl.textContent = currentRoom?.isSecret ? "SECRET" : `${roomIndex + 1} / ${floorRooms.length}`;
  const hearts = Array.from({ length: Math.ceil(maxHealth / 2) }, (_, index) => {
    const remaining = health - index * 2;
    return remaining >= 2 ? "♥" : remaining === 1 ? "♡" : "·";
  }).join(" ");
  livesEl.textContent = hearts;
  const badges = [];
  if (keycard) badges.push("KEYCARD");
  if (armorActive) badges.push("TAN SUIT");
  if (reinforcedSuit) badges.push("EXECUTIVE SUIT");
  if (pinstripeSuit) badges.push("PINSTRIPE");
  if (mbaActive) badges.push("MBA STAFF");
  if (briefcaseTimer > 0) badges.push(`BRIEFCASE ${briefcaseTimer.toFixed(0)}s`);
  if (starTimer > 0) badges.push(`STAR ${starTimer.toFixed(0)}s`);
  itemsEl.textContent = badges.join("  ·  ");
  scoreEl.textContent = String(rupees).padStart(3, "0");
}

function spawnEnemies(room) {
  if (room.cleared) return [];
  const specs = room.enemySpecs || [];
  if (!specs.length) return [];
  let spots;
  if (room.bossType === "board") {
    spots = [[310, 180], [400, 390], [590, 390], [790, 250], [710, 280]];
  } else if (room.bossType === "vp-team") {
    spots = [[310, 270], [500, 270], [710, 270]];
  } else if (room.bossType) {
    spots = [[500, 260]];
  } else {
    spots = [[485, 155], [735, 275], [470, 390], [260, 255], [760, 400], [500, 260]];
  }
  const isBlocked = (x, y, radius) => room.obstacles.some(([ox, oy, ow, oh]) => {
    const cx = Math.max(ox, Math.min(x, ox + ow));
    const cy = Math.max(oy, Math.min(y, oy + oh));
    return Math.hypot(x - cx, y - cy) < radius + 4;
  });
  return specs.map((kind, index) => {
    const enemy = makeEnemy(kind, spots[index % spots.length][0], spots[index % spots.length][1]);
    const candidates = [[500,260],[800,270],[150,260],[500,425],[300,250],[750,330]];
    const spot = spots[index % spots.length];
    if (isBlocked(spot[0], spot[1], enemy.r)) {
      const safe = candidates.find(([x,y]) => !isBlocked(x,y,enemy.r));
      if (safe) { enemy.x = safe[0]; enemy.y = safe[1]; }
    }
    return enemy;
  });
}

function beginFloor(chapter, floor) {
  chapterIndex = chapter;
  floorIndex = floor;
  floorRooms = floorSets[chapter][floor];
  loadRoom(floorRooms[0], null);
  running = true;
  paused = false;
  cutscene = null;
  setMusicTheme(campaigns[chapter].theme);
  updateHud();
}

function resetGame() {
  rupees = 0;
  health = 10;
  maxHealth = 10;
  armorActive = false;
  reinforcedSuit = false;
  pinstripeSuit = false;
  mbaActive = false;
  keycard = false;
  boardCleared = false;
  collectedItems = new Set();
  pinstripeHitEnemies = new Set();
  starTimer = 0;
  drops = [];
  enemySequence = 0;
  for (const room of globalRooms) {
    room.cleared = false;
    room.bossHandled = false;
    room.visited = false;
    room.enemyInstances = null;
    room.drops = [];
    room.chest && (room.chest.opened = false);
    room.briefcaseAt && (room.briefcaseAt.collected = false);
    room.secretWall && (room.secretWall.opened = false);
    if (!room.isSecret) {
      const index = room.gridIndex + room.floor * 8;
      room.obstacles = randomRoomMaze(room, index + Math.random() * 1000);
    }
  }
  randomizeFloorGraphs();
  swordTimer = 0;
  swordCooldown = 0;
  invulnerable = 0;
  briefcaseTimer = 0;
  beginFloor(0, 0);
}

function showCard(cardTitle, cardSubtitle, buttonLabel, action) {
  running = false;
  cutscene = null;
  gameShell.classList.remove("cinematic");
  gameShell.classList.remove("shop-open");
  shopPanel.hidden = true;
  startButton.hidden = false;
  controls.hidden = false;
  title.innerHTML = cardTitle;
  subtitle.textContent = cardSubtitle;
  startButton.textContent = buttonLabel;
  cardAction = action;
  overlay.classList.remove("hidden");
}

function showShop(chapter, floor) {
  running = false;
  cutscene = null;
  gameShell.classList.remove("cinematic");
  gameShell.classList.add("shop-open");
  shopDestination = { chapter, floor };
  title.innerHTML = "BETWEEN-LEVEL <em>SHOP</em>";
  subtitle.textContent = "Spend your rupees before the next stage. Anything left over stays with you.";
  startButton.hidden = true;
  controls.hidden = true;
  shopPanel.hidden = false;
  shopContinue.textContent = "Continue to next level";
  overlay.classList.remove("hidden");
  updateShop();
}

function updateShop() {
  const offers = {
    heal: { label: health < maxHealth ? "Restore 4 health" : "Health is already full", cost: 15, available: health < maxHealth },
    heart: { label: "Heart container (+2 max health)", cost: 40, available: maxHealth < 20 },
    armor: { label: armorActive || reinforcedSuit || pinstripeSuit ? "Tan suit (already protected)" : "Tan suit (reduce damage)", cost: 45, available: !armorActive && !reinforcedSuit && !pinstripeSuit },
    mba: { label: mbaActive ? "MBA staff (already owned)" : "MBA staff (double damage)", cost: 60, available: !mbaActive },
    briefcase: { label: briefcaseTimer > 0 ? "Fireball charge (already active)" : "Briefcase fireballs (10 seconds)", cost: 20, available: briefcaseTimer <= 0 }
  };
  shopkeeperMessage.textContent = `You have ${rupees} rupees. Choose carefully, traveler!`;
  for (const button of shopItems.querySelectorAll("[data-shop-item]")) {
    const offer = offers[button.dataset.shopItem];
    button.textContent = `${offer.label} — ${offer.cost} rupees`;
    button.disabled = !offer.available || rupees < offer.cost;
  }
}

function buyShopItem(item) {
  const costs = { heal: 15, heart: 40, armor: 45, mba: 60, briefcase: 20 };
  const cost = costs[item];
  if (!cost || rupees < cost) return;
  if (item === "heal" && health >= maxHealth) return;
  if (item === "heart" && maxHealth >= 20) return;
  if (item === "armor" && (armorActive || reinforcedSuit || pinstripeSuit)) return;
  if (item === "mba" && mbaActive) return;
  if (item === "briefcase" && briefcaseTimer > 0) return;

  rupees -= cost;
  if (item === "heal") health = Math.min(maxHealth, health + 4);
  else if (item === "heart") {
    maxHealth += 2;
    health = Math.min(maxHealth, health + 2);
  } else if (item === "armor") armorActive = true;
  else if (item === "mba") mbaActive = true;
  else if (item === "briefcase") briefcaseTimer = 10;

  updateHud();
  updateShop();
}

function continueFromShop() {
  if (!shopDestination) return;
  const destination = shopDestination;
  shopDestination = null;
  gameShell.classList.remove("shop-open");
  shopPanel.hidden = true;
  startButton.hidden = false;
  controls.hidden = false;
  overlay.classList.add("hidden");
  loadFloor(destination.chapter, destination.floor);
}

function startGame() {
  if (cardAction) {
    const action = cardAction;
    cardAction = null;
    overlay.classList.add("hidden");
    action();
    return;
  }
  ensureAudio();
  resetGame();
  title.innerHTML = "ERNESTO'S <em>QUEST</em>";
  subtitle.textContent = "A new graduate steps into the real world — and a career-sized labyrinth.";
  startButton.textContent = "Begin Graduation";
  startCutscene([
    "After years of hard work, Ernesto graduates — sharp, fit, and ready for what comes next.",
    "Diploma in hand, he leaves the campus and steps into the real world.",
    "A dark suit, a steady stride, and a maze of meetings stand between him and the corner office."
  ], "graduation", () => loadFloor(0, 0));
  overlay.classList.add("hidden");
}

function startCutscene(lines, style, onComplete) {
  running = false;
  overlay.classList.add("hidden");
  cutscene = { lines, style, onComplete, elapsed: 0, line: 0, flash: .18 };
  gameShell.classList.add("cinematic");
}

function advanceCutscene() {
  if (!cutscene) return;
  cutscene.line++;
  if (cutscene.line >= cutscene.lines.length) {
    const done = cutscene.onComplete;
    cutscene = null;
    gameShell.classList.remove("cinematic");
    if (done) done();
  } else {
    cutscene.elapsed = cutscene.line * 3;
    cutscene.flash = .18;
  }
}

function updateCutscene(dt) {
  if (!cutscene) return;
  cutscene.elapsed += dt;
  cutscene.flash = Math.max(0, cutscene.flash - dt);
  const next = Math.floor(cutscene.elapsed / 3);
  if (next > cutscene.line) advanceCutscene();
}

function endGame() {
  running = false;
  startCutscene([
    "The board names Ernesto the new Chief Executive Officer.",
    "A portrait in the corner reveals the truth: the former CEO was his father.",
    "His father had been working toward the ultimate goal all along — retirement.",
    "Ernesto takes the crown, then a small army of underlings hurries over.",
    "“Quick favor, boss… can you approve these expense reports?”"
  ], "finale", () => {
    showCard("ERNESTO <em>THE CEO</em>", "The company is yours. The requests for favors have already begun.", "Play Again", startGame);
  });
}

function faceFromDirection(direction) {
  player.facing = direction;
}

function playerDamage(sourceId, unavoidable = false) {
  if (!running || (invulnerable > 0 && !unavoidable)) return;
  if (starTimer > 0 && !unavoidable) {
    message = "Star power blocks the hit!";
    messageTime = 1;
    return;
  }
  if (pinstripeSuit && sourceId !== undefined && !pinstripeHitEnemies.has(sourceId)) {
    pinstripeHitEnemies.add(sourceId);
    invulnerable = .7;
    message = "Pinstripe suit! First hit from this enemy blocked.";
    messageTime = 1.8;
    updateHud();
    return;
  }
  health = Math.max(0, health - (armorActive || reinforcedSuit || pinstripeSuit ? 1 : 2));
  player.hurtTime = .24;
  invulnerable = reinforcedSuit ? 1.7 : 1.25;
  message = starTimer > 0 ? "Star power blocks the hit!" : armorActive || reinforcedSuit || pinstripeSuit ? "Your suit softened the hit!" : "Ouch! An enemy hit you.";
  messageTime = 1.6;
  updateHud();
  if (health <= 0) {
    showCard("QUEST <em>OVER</em>", "The office is still hiring. Give the labyrinth another try.", "Try Again", startGame);
  }
}

function targetVector(target) {
  const delta = { x: target.x - player.x, y: target.y - player.y };
  const magnitude = Math.hypot(delta.x, delta.y) || 1;
  return { ...delta, magnitude, x: delta.x / magnitude, y: delta.y / magnitude };
}

function openChest() {
  const chest = currentRoom.chest;
  if (!chest || chest.opened || Math.hypot(player.x - chest.x, player.y - chest.y) > 55) return false;
  chest.opened = true;
  if (chest.kind === "keycard") {
    keycard = true;
    message = "Keycard acquired — HR's security door will accept it.";
  } else if (chest.kind === "armor") {
    armorActive = true;
    message = "Tan suit equipped! Incoming damage is halved.";
  } else if (chest.kind === "mba") {
    mbaActive = true;
    message = "MBA degree earned! Your staff now deals double damage.";
  } else if (chest.kind === "reinforcedSuit") {
    reinforcedSuit = true;
    message = "Executive suit equipped! Damage protection improved.";
  } else if (chest.kind === "pinstripe") {
    pinstripeSuit = true;
    pinstripeHitEnemies = new Set();
    message = "Pinstripe suit! It blocks the first hit from every enemy.";
  } else {
    rupees += 10;
    message = "A chest full of rupees!";
  }
  messageTime = 3;
  updateHud();
  return true;
}

function slashSecretWall() {
  const wall = currentRoom.secretWall;
  if (!wall || wall.opened) return false;
  const centerX = wall.x + wall.w / 2;
  const centerY = wall.y + wall.h / 2;
  const vector = targetVector({ x: centerX, y: centerY });
  const facing = directions[player.facing];
  const forward = vector.x * facing.x + vector.y * facing.y;
  const side = Math.abs(vector.x * facing.y - vector.y * facing.x) * vector.magnitude;
  if (forward < .25 || vector.magnitude > 76 || side > 43) return false;
  wall.opened = true;
  message = "A hidden doorway appears behind the moss!";
  messageTime = 2.8;
  return true;
}

function hitEnemy(enemy, damage, dx, dy) {
  enemy.hp = Math.max(0, enemy.hp - damage);
  enemy.flash = .16;
  enemy.hitTime = .22;
  const magnitude = Math.hypot(dx, dy) || 1;
  enemy.vx = dx / magnitude * (enemy.boss ? 125 : 250);
  enemy.vy = dy / magnitude * (enemy.boss ? 125 : 250);
  if (enemy.boss && enemy.dropCooldown <= 0 && enemy.hp > 0 && Math.random() < .28) {
    const kinds = ["briefcase", "star", "heart", "rupees"];
    spawnDrop(kinds[Math.floor(Math.random() * kinds.length)], enemy.x, enemy.y);
    enemy.dropCooldown = 1.3;
  }
  if (enemy.hp === 0) {
    rupees += enemy.boss ? 8 : enemy.kind === "knight" ? 4 : 2;
    message = `${enemyName(enemy.kind)} defeated!`;
    messageTime = 1.8;
    if (enemy.boss) {
      spawnDrop("heart", enemy.x - 18, enemy.y + 8);
      const kinds = ["briefcase", "star", "heart", "rupees"];
      spawnDrop(kinds[Math.floor(Math.random() * kinds.length)], enemy.x + 18, enemy.y + 8);
    }
    updateHud();
  }
}

function spawnDrop(kind, x, y) {
  drops.push({ kind, x, y, phase: Math.random() * Math.PI * 2 });
}

function enemyName(kind) {
  return ({
    hr: "HR", middle: "Middle Management", production: "Production Director",
    vp: "Executive VP", executive: "Board Executive", ceo: "CEO"
  })[kind] || `${kind[0].toUpperCase()}${kind.slice(1)}`;
}

function swingStaff() {
  if (swordCooldown > 0) return;
  swordCooldown = .42;
  swordTimer = .25;
  player.attackTime = .25;
  player.attackFacing = player.facing;
  const facing = directions[player.facing];
  let hits = 0;
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const forward = dx * facing.x + dy * facing.y;
    const lateral = Math.abs(dx * facing.y - dy * facing.x);
    if (forward > 2 && forward < 61 + enemy.r && lateral < 29 + enemy.r) {
      hitEnemy(enemy, mbaActive ? 2 : 1, facing.x, facing.y);
      hits++;
    }
  }
  if (!hits) {
    for (const enemy of enemies) {
      if (enemy.hp <= 0) continue;
      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;
      if (Math.hypot(dx, dy) < 70 && slashDirectionIsToward(enemy)) {
        const direction = targetVector(enemy);
        hitEnemy(enemy, mbaActive ? 2 : 1, direction.x, direction.y);
      }
    }
  }
}

function slashDirectionIsToward(target) {
  const vector = targetVector(target);
  const facing = directions[player.facing];
  return vector.x * facing.x + vector.y * facing.y > .45;
}

function useAttack() {
  if (!running || paused || cutscene) return;
  if (openChest()) return;
  if (slashSecretWall()) return;
  if (currentRoom.isSecret) return;
  if (briefcaseTimer > 0) {
    const facing = directions[player.facing];
    playerShots.push({
      x: player.x + facing.x * 22, y: player.y + facing.y * 22,
      vx: facing.x * 390, vy: facing.y * 390, r: 8, life: 1.35
    });
  } else {
    swingStaff();
  }
}

function requirementMet(requirement) {
  if (requirement === "keycard") return keycard;
  if (requirement === "board") return boardCleared;
  return true;
}

function collidesMap(x, y, radius = player.r, allowDoors = true) {
  if (x < 32 + radius || x > W - 32 - radius || y < 28 + radius || y > H - 26 - radius) {
    if (!allowDoors) return true;
    const nearNorth = y < 28 + radius && Math.abs(x - W / 2) < 60 && currentRoom.links.north;
    const nearSouth = y > H - 26 - radius && Math.abs(x - W / 2) < 60 && currentRoom.links.south;
    const nearWest = x < 32 + radius && Math.abs(y - H / 2) < 60 && currentRoom.links.west;
    const nearEast = x > W - 32 - radius && Math.abs(y - H / 2) < 60 && currentRoom.links.east;
    if (!nearNorth && !nearSouth && !nearWest && !nearEast) return true;
  }
  const blockedByWalls = currentRoom.obstacles.some(([ox, oy, ow, oh]) =>
    x + radius > ox && x - radius < ox + ow && y + radius > oy && y - radius < oy + oh
  );
  if (blockedByWalls) return true;
  const wall = currentRoom.secretWall;
  if (wall && !wall.opened && x + radius > wall.x && x - radius < wall.x + wall.w && y + radius > wall.y && y - radius < wall.y + wall.h) return true;
  return false;
}

function movePlayer(dx, dy, dt) {
  const nx = player.x + dx * player.speed * dt;
  const ny = player.y + dy * player.speed * dt;
  const overlapsEnemy = (x, y) => enemies.some(enemy =>
    enemy.hp > 0 && Math.hypot(x - enemy.x, y - enemy.y) < player.r + enemy.r - 1
  );
  if (!collidesMap(nx, player.y) && !overlapsEnemy(nx, player.y)) player.x = nx;
  if (!collidesMap(player.x, ny) && !overlapsEnemy(player.x, ny)) player.y = ny;
}

function loadRoom(room, entryDirection) {
  currentRoom = room;
  room.visited = true;
  roomIndex = room.gridIndex ?? 0;
  chapterIndex = room.chapter;
  floorIndex = room.floor;
  floorRooms = floorSets[chapterIndex][floorIndex];
  if (room.isSecret) {
    player.x = W / 2;
    player.y = H - 100;
  } else if (entryDirection === "east") {
    player.x = 66; player.y = H / 2;
  } else if (entryDirection === "west") {
    player.x = W - 66; player.y = H / 2;
  } else if (entryDirection === "south") {
    player.x = W / 2; player.y = 70;
  } else if (entryDirection === "north") {
    player.x = W / 2; player.y = H - 70;
  } else {
    player.x = 76; player.y = H / 2;
  }
  if (!room.enemyInstances) room.enemyInstances = spawnEnemies(room);
  enemies = room.enemyInstances;
  projectiles = [];
  playerShots = [];
  if (!room.drops) room.drops = [];
  drops = room.drops;
  roomTransitionLock = .45;
  message = room.isSecret ? "A hidden treasure chamber!" : `${room.name} — explore every branch.`;
  messageTime = 2.5;
  updateHud();
}

function loadFloor(chapter, floor) {
  chapterIndex = chapter;
  floorIndex = floor;
  loadRoom(floorSets[chapter][floor][0], null);
  running = true;
  paused = false;
  cutscene = null;
  setMusicTheme(campaigns[chapter].theme);
}

function moveThroughDoor(direction, link) {
  if (roomTransitionLock > 0) return;
  if (enemies.some(enemy => enemy.hp > 0)) {
    if (direction === "east") player.x = W - 42;
    if (direction === "west") player.x = 42;
    if (direction === "north") player.y = 42;
    if (direction === "south") player.y = H - 42;
    message = "Defeat the room's enemies to unlock its doors.";
    messageTime = 1.7;
    return;
  }
  if (!requirementMet(link.requirement)) {
    player.x = direction === "east" ? W - 42 : direction === "west" ? 42 : player.x;
    player.y = direction === "north" ? 42 : direction === "south" ? H - 42 : player.y;
    message = link.requirement === "keycard" ? "Security lock: find the HR keycard." : "The Board must be defeated first.";
    messageTime = 2;
    return;
  }
  loadRoom(link.room, direction);
}

function checkTransitions() {
  if (currentRoom.isSecret) {
    if (player.y > H - 64) {
      const parent = currentRoom.parentRoom;
      loadRoom(parent, null);
      player.x = parent.secretWall.x + parent.secretWall.w / 2;
      player.y = parent.secretWall.y + parent.secretWall.h + 50;
    }
    return;
  }
  if (currentRoom.secretWall?.opened && currentRoom.secretRoom) {
    const wall = currentRoom.secretWall;
    if (Math.hypot(player.x - (wall.x + wall.w / 2), player.y - (wall.y + wall.h / 2)) < 31) {
      currentRoom.secretRoom.parentRoom = currentRoom;
      loadRoom(currentRoom.secretRoom, "secret");
      return;
    }
  }
  if (player.x > W - 18 && currentRoom.links.east) moveThroughDoor("east", currentRoom.links.east);
  else if (player.x < 18 && currentRoom.links.west) moveThroughDoor("west", currentRoom.links.west);
  else if (player.y < 18 && currentRoom.links.north) moveThroughDoor("north", currentRoom.links.north);
  else if (player.y > H - 18 && currentRoom.links.south) moveThroughDoor("south", currentRoom.links.south);
}

function handleBossClear() {
  if (!currentRoom.bossType || currentRoom.bossHandled || enemies.some(enemy => enemy.hp > 0)) return false;
  currentRoom.cleared = true;
  currentRoom.bossHandled = true;
  if (currentRoom.bossType === "hr") {
    showCard("YOU GOT <em>THE JOB!</em>", "HR approves Ernesto's application. The Entry Level Specialist role is his.", "Visit Shop", () => {
      startCutscene([
        "The offer letter lands on Ernesto's desk. His first real job begins.",
        "He adjusts his tie, takes a breath, and steps into the branch office.",
        "A new maze of meetings is waiting on the other side."
      ], "promotion", () => showShop(1, 0));
    });
  } else if (currentRoom.bossType === "middle") {
    showCard("CONGRATULATIONS!", "Ernesto is now Middle Manager. A business trip to Corporate Headquarters awaits.", "Visit HQ Shop", () => {
      startCutscene([
        "Promotion papers signed. Ernesto packs his tan suit and MBA staff.",
        "A plane crosses the night sky toward Corporate Headquarters.",
        "The manufacturing floor is first. The climb continues."
      ], "travel", () => showShop(2, 0));
    });
  } else if (currentRoom.bossType === "production") {
    showCard("MANUFACTURING <em>SECURED</em>", "The Production Director is defeated. Ernesto takes over all of manufacturing.", "Shop before Upper Management", () => {
      startCutscene([
        "Every production line falls in step with Ernesto's new plan.",
        "A sealed elevator opens with a chime: the executive floors await.",
        "He rides upward, ready to face the people at the top."
      ], "promotion", () => showShop(2, 1));
    });
  } else if (currentRoom.bossType === "vp-team") {
    showCard("THE VPs ARE <em>OUT</em>", "Three Executive Vice Presidents have been outmaneuvered. The Board is next.", "Shop before the Board", () => {
      startCutscene([
        "The executive elevator opens onto the highest floor.",
        "Five silhouettes wait behind the boardroom doors.",
        "Ernesto walks forward as the doors swing wide."
      ], "promotion", () => showShop(2, 2));
    });
  } else if (currentRoom.bossType === "board") {
    boardCleared = true;
    currentRoom.chest = { x: 500, y: 390, kind: "pinstripe", opened: false };
    spawnDrop("heart", 455, 268);
    spawnDrop("star", 505, 268);
    updateHud();
    message = "Board defeated! Claim the pinstripe suit before facing the CEO.";
    messageTime = 4;
  } else if (currentRoom.bossType === "ceo") {
    endGame();
  }
  return true;
}

function collectRoomItems() {
  const heart = currentRoom.heartContainer;
  if (heart && !collectedItems.has(heart.id) && Math.hypot(player.x - heart.x, player.y - heart.y) < 25) {
    collectedItems.add(heart.id);
    maxHealth += 2;
    health = Math.min(maxHealth, health + 2);
    message = "Heart Container! Maximum health increased.";
    messageTime = 2.4;
    updateHud();
  }
  const briefcase = currentRoom.briefcaseAt;
  if (briefcase && !briefcase.collected && Math.hypot(player.x - briefcase.x, player.y - briefcase.y) < 30) {
    briefcase.collected = true;
    briefcaseTimer = 10;
    message = "Briefcase power-up! Fireballs for 10 seconds.";
    messageTime = 2.5;
    updateHud();
  }
  for (const drop of drops) {
    if (drop.collected || Math.hypot(player.x - drop.x, player.y - drop.y) > 24) continue;
    drop.collected = true;
    if (drop.kind === "heart") {
      health = Math.min(maxHealth, health + 2);
      message = "Boss drop: heart restored!";
    } else if (drop.kind === "briefcase") {
      briefcaseTimer = 10;
      message = "Boss drop: 10 seconds of fireballs!";
    } else if (drop.kind === "star") {
      starTimer = 8;
      message = "Star power! Invulnerable for 8 seconds!";
    } else {
      rupees += 15;
      message = "Boss drop: 15 rupees!";
    }
    messageTime = 2;
    updateHud();
  }
  drops = drops.filter(drop => !drop.collected);
  currentRoom.drops = drops;
}

function update(dt) {
  if (cutscene) {
    updateCutscene(dt);
    return;
  }
  if (!running || paused) return;
  time += dt;
  roomTransitionLock = Math.max(0, roomTransitionLock - dt);
  messageTime -= dt;
  swordCooldown = Math.max(0, swordCooldown - dt);
  swordTimer = Math.max(0, swordTimer - dt);
  invulnerable = Math.max(0, invulnerable - dt);
  briefcaseTimer = Math.max(0, briefcaseTimer - dt);
  starTimer = Math.max(0, starTimer - dt);
  player.attackTime = Math.max(0, player.attackTime - dt);
  player.hurtTime = Math.max(0, player.hurtTime - dt);
  attackButton.textContent = briefcaseTimer > 0 ? "FIREBALL" : "STAFF";
  updateHud();

  if (swingRequested) {
    useAttack();
    swingRequested = false;
  }

  let dx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0) + touchMove.x;
  let dy = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0) + touchMove.y;
  const magnitude = Math.hypot(dx, dy);
  player.moving = magnitude > .05;
  if (player.moving) player.animTime += dt;
  else player.animTime = 0;
  if (magnitude > 1) { dx /= magnitude; dy /= magnitude; }
  if (dx || dy) {
    faceFromDirection(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "east" : "west") : (dy > 0 ? "south" : "north"));
    movePlayer(dx, dy, dt);
  }

  collectRoomItems();

  for (const shot of playerShots) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    for (const enemy of enemies) {
      if (enemy.hp > 0 && Math.hypot(shot.x - enemy.x, shot.y - enemy.y) < enemy.r + shot.r) {
        shot.life = 0;
        hitEnemy(enemy, mbaActive ? 4 : 2, shot.vx, shot.vy);
        break;
      }
    }
  }
  playerShots = playerShots.filter(shot => shot.life > 0 && shot.x > 0 && shot.x < W && shot.y > 0 && shot.y < H);

  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    enemy.flash = Math.max(0, enemy.flash - dt);
    enemy.hitTime = Math.max(0, enemy.hitTime - dt);
    enemy.dropCooldown = Math.max(0, enemy.dropCooldown - dt);
    const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const distance = Math.hypot(player.x - enemy.x, player.y - enemy.y);
    enemy.animTime += dt * (distance > enemy.r + player.r + 10 ? 1 : .18);
    enemy.attackTimer -= dt;
    if (enemy.boss && enemy.attackTimer <= 0) {
      const attack = {
        hr: { kind: "rejection", count: 1, speed: 155, radius: 34, delay: 2.25 },
        middle: { kind: "paper", count: 2, speed: 160, radius: 17, delay: 1.8 },
        production: { kind: "wrench", count: 1, speed: 215, radius: 15, delay: 1.5 },
        vp: { kind: "candy", count: 2, speed: 180, radius: 14, delay: 1.35 },
        executive: { kind: "candy", count: 2, speed: 175, radius: 14, delay: 1.5 },
        ceo: { kind: "fireball", count: 3, speed: 205, radius: 12, delay: 1.05 }
      }[enemy.kind] || { kind: "fireball", count: 1, speed: 170, radius: 12, delay: 1.7 };
      enemy.attackTimer = attack.delay;
      for (let i = 0; i < attack.count; i++) {
        const spread = (i - (attack.count - 1) / 2) * .2;
        projectiles.push({
          x: enemy.x, y: enemy.y, sourceId: enemy.id, kind: attack.kind,
          vx: Math.cos(angle + spread) * attack.speed, vy: Math.sin(angle + spread) * attack.speed,
          r: attack.radius, rotation: Math.random() * Math.PI * 2
        });
      }
      enemy.vx = Math.cos(angle) * 110;
      enemy.vy = Math.sin(angle) * 110;
    }
    if (enemy.kind === "ceo") {
      enemy.tauntTimer -= dt;
      if (enemy.tauntTimer <= 0) {
        const taunts = [
          "You are a disgrace.",
          "You disappoint me.",
          "You fail to live up to my expectations."
        ];
        enemy.tauntTimer = 8 + Math.random() * 2.5;
        playerDamage(enemy.id, true);
        message = taunts[Math.floor(Math.random() * taunts.length)];
        messageTime = 2.8;
        if (!running) return;
      }
    }

    const chase = enemy.kind === "ghost" ? .55 : enemy.kind === "drone" ? .62 : .8;
    const nx = enemy.x + (Math.cos(angle) * enemy.speed * chase + enemy.vx) * dt;
    const ny = enemy.y + (Math.sin(angle) * enemy.speed * chase + enemy.vy) * dt;
    const contact = Math.hypot(nx - player.x, ny - player.y) < enemy.r + player.r;
    if (contact) {
      const pushAngle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      enemy.x += Math.cos(pushAngle) * 100 * dt;
      enemy.y += Math.sin(pushAngle) * 100 * dt;
      if (distance < enemy.r + player.r + 4) playerDamage(enemy.id);
    } else if (!collidesMap(nx, ny, enemy.r, false)) {
      enemy.x = nx;
      enemy.y = ny;
    } else {
      enemy.vx *= -.5;
      enemy.vy *= -.5;
    }
    enemy.vx *= Math.pow(.05, dt);
    enemy.vy *= Math.pow(.05, dt);
  }

  for (const shot of projectiles) {
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    if (Math.hypot(shot.x - player.x, shot.y - player.y) < shot.r + player.r) {
      shot.life = 0;
      playerDamage(shot.sourceId);
    }
    if (collidesMap(shot.x, shot.y, shot.r, false)) shot.life = 0;
  }
  projectiles = projectiles.filter(shot => shot.life !== 0 && shot.x > 0 && shot.x < W && shot.y > 0 && shot.y < H);

  if (handleBossClear()) return;
  if (!currentRoom.bossType && enemies.every(enemy => enemy.hp <= 0)) currentRoom.cleared = true;
  checkTransitions();
}

function drawGround() {
  const theme = currentRoom.theme;
  const palette = colors[theme] || colors.forest;
  ctx.fillStyle = palette[0];
  ctx.fillRect(0, 0, W, H);
  if (theme === "forest") {
    for (let y = 0; y < H; y += 48) for (let x = 0; x < W; x += 48) {
      if ((x / 48 + y / 48) % 2 === 0) {
        ctx.fillStyle = "rgba(224,225,164,.09)";
        ctx.fillRect(x, y, 48, 48);
      }
    }
  } else if (theme === "office" || theme === "executive" || theme === "boardroom") {
    ctx.fillStyle = "rgba(214,200,165,.13)";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(35,34,32,.16)";
    ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += 64) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  } else if (theme === "manufacturing") {
    ctx.strokeStyle = "rgba(210,222,210,.16)";
    ctx.lineWidth = 3;
    for (let y = 30; y < H; y += 54) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
  } else {
    ctx.fillStyle = "rgba(235,211,154,.06)";
    for (let x = 0; x < W; x += 42) ctx.fillRect(x, 0, 2, H);
  }

  for (const [x, y, w, h] of currentRoom.obstacles) drawObstacle(x, y, w, h, theme);
  if (currentRoom.bossType === "board" || currentRoom.bossType === "ceo") {
    ctx.fillStyle = "rgba(40,34,29,.28)";
    ctx.fillRect(300, 218, 360, 100);
    ctx.fillStyle = "#705b48";
    ctx.fillRect(315, 230, 330, 75);
    ctx.strokeStyle = "#c5a96f";
    ctx.lineWidth = 3;
    ctx.strokeRect(315, 230, 330, 75);
  }
  if (currentRoom.secretWall && !currentRoom.secretWall.opened) drawSecretWall(currentRoom.secretWall);
  if (currentRoom.secretWall?.opened) drawSecretPortal(currentRoom.secretWall.x + currentRoom.secretWall.w / 2, currentRoom.secretWall.y + currentRoom.secretWall.h / 2);
  drawRoomDoors();
}

function drawObstacle(x, y, w, h, theme) {
  const fill = theme === "manufacturing" ? "#435257" : theme === "office" ? "#534f44" : theme === "executive" ? "#4b4960" : theme === "boardroom" ? "#544b43" : "#536346";
  ctx.fillStyle = "rgba(20,25,20,.25)";
  ctx.fillRect(x - 4, y + h - 4, w + 8, 12);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(239,227,180,.34)";
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  if (theme === "office" || theme === "executive") {
    ctx.fillStyle = "rgba(185,174,142,.28)";
    ctx.fillRect(x + 8, y + 8, w - 16, 5);
  }
  if (theme === "manufacturing") {
    ctx.fillStyle = "#d2aa4f";
    ctx.fillRect(x + 8, y + h - 8, w - 16, 4);
  }
}

function drawRoomDoors() {
  if (currentRoom.isSecret) return;
  for (const direction of Object.keys(currentRoom.links)) {
    const { x, y } = directions[direction];
    const isLocked = !requirementMet(currentRoom.links[direction].requirement);
    ctx.fillStyle = "#2d2823";
    if (direction === "east" || direction === "west") {
      const dx = direction === "west" ? 6 : W - 26;
      ctx.fillRect(dx, H / 2 - 43, 20, 86);
      ctx.fillStyle = isLocked ? "#b84d43" : "#d9c77f";
      ctx.fillRect(dx + 5, H / 2 - 29, 10, 58);
    } else {
      const dy = direction === "north" ? 6 : H - 26;
      ctx.fillRect(W / 2 - 43, dy, 86, 20);
      ctx.fillStyle = isLocked ? "#b84d43" : "#d9c77f";
      ctx.fillRect(W / 2 - 29, dy + 5, 58, 10);
    }
  }
}

function drawSecretWall(wall) {
  if (wall.kind === "moss") {
    ctx.fillStyle = "#3e5a39";
    ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    ctx.fillStyle = "#6b9852";
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(wall.x + 5 + i * 9, wall.y + 7 + (i % 2) * 8, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "#4a3428";
    ctx.fillRect(wall.x - 4, wall.y - 20, wall.w + 8, wall.h + 18);
    ctx.strokeStyle = "#d0b879";
    ctx.lineWidth = 3;
    ctx.strokeRect(wall.x - 2, wall.y - 18, wall.w + 4, wall.h + 14);
    ctx.fillStyle = "#b9a98c";
    ctx.fillRect(wall.x + 7, wall.y - 10, wall.w - 14, wall.h);
    ctx.fillStyle = "#42352c";
    ctx.beginPath();
    ctx.arc(wall.x + wall.w / 2, wall.y + 2, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSecretPortal(x, y) {
  ctx.save();
  ctx.globalAlpha = .7 + Math.sin(time * 5) * .25;
  ctx.strokeStyle = "#e9dc9a";
  ctx.lineWidth = 4;
  ctx.shadowColor = "#e9dc9a";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.ellipse(x, y, 21, 28, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawChest(chest) {
  ctx.fillStyle = chest.opened ? "#63594a" : "#9b7141";
  ctx.fillRect(chest.x - 19, chest.y - 12, 38, 27);
  ctx.fillStyle = chest.opened ? "#746b5c" : "#c19a58";
  ctx.fillRect(chest.x - 20, chest.y - 15, 40, 8);
  ctx.strokeStyle = "#ead58a";
  ctx.lineWidth = 2;
  ctx.strokeRect(chest.x - 20, chest.y - 15, 40, 30);
  ctx.fillStyle = "#f4e3a2";
  ctx.fillRect(chest.x - 2, chest.y - 3, 4, 7);
}

function drawHeartContainer(x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.2 + Math.sin(time * 4) * .08, 1.2 + Math.sin(time * 4) * .08);
  ctx.fillStyle = "#e6555b";
  ctx.shadowColor = "#ff7270";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.moveTo(0, 11);
  ctx.bezierCurveTo(-22, -2, -13, -17, -3, -9);
  ctx.bezierCurveTo(3, -19, 18, -9, 0, 11);
  ctx.fill();
  ctx.restore();
}

function drawBriefcase(x, y) {
  ctx.fillStyle = "#543b2b";
  ctx.fillRect(x - 18, y - 12, 36, 25);
  ctx.fillStyle = "#b18a4d";
  ctx.fillRect(x - 18, y - 12, 36, 5);
  ctx.strokeStyle = "#ead58a";
  ctx.lineWidth = 3;
  ctx.strokeRect(x - 18, y - 12, 36, 25);
  ctx.beginPath();
  ctx.roundRect(x - 7, y - 19, 14, 9, 3);
  ctx.stroke();
  ctx.fillStyle = "#ead58a";
  ctx.fillRect(x - 2, y - 2, 4, 5);
}

function drawPlayer() {
  const stride = player.moving ? Math.sin(player.animTime * 14) : 0;
  const bob = player.moving ? Math.abs(stride) * 2.2 : Math.sin(time * 2) * .5;
  const facing = directions[player.facing];
  const recoil = player.hurtTime > 0 ? Math.sin(player.hurtTime * 52) * 2 : 0;
  ctx.save();
  ctx.translate(player.x - facing.x * recoil, player.y - bob - facing.y * recoil);
  if (invulnerable > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = .42;
  drawPlayerShadow();
  if (player.facing === "north") drawPlayerBack();
  else if (player.facing === "east" || player.facing === "west") {
    ctx.save();
    if (player.facing === "west") ctx.scale(-1, 1);
    drawPlayerProfile();
    ctx.restore();
  } else drawPlayerFront();
  ctx.restore();

  if (player.attackTime > 0 && briefcaseTimer <= 0) {
    const attackDirection = directions[player.attackFacing];
    const baseAngle = Math.atan2(attackDirection.y, attackDirection.x);
    const progress = 1 - player.attackTime / .25;
    const swingAngle = baseAngle - 1.05 + progress * 2.1;
    ctx.save();
    ctx.translate(player.x, player.y - bob);
    ctx.strokeStyle = "rgba(255,244,184,.7)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 38, baseAngle - 1.05, baseAngle - 1.05 + progress * 2.1);
    ctx.stroke();
    ctx.rotate(swingAngle);
    ctx.strokeStyle = "#44321f"; ctx.lineWidth = 8; ctx.lineCap = "square";
    ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(51, 0); ctx.stroke();
    ctx.strokeStyle = mbaActive ? "#8de1e9" : "#d8b869"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(51, 0); ctx.stroke();
    ctx.fillStyle = mbaActive ? "#dbffff" : "#f4e3a8";
    ctx.fillRect(48, -3, 6, 6);
    ctx.restore();
  }
}

function playerSuitColor() {
  if (pinstripeSuit) return "#263442";
  if (reinforcedSuit) return "#647887";
  if (armorActive) return "#b69b6b";
  return "#27364b";
}

function drawPlayerShadow() {
  ctx.fillStyle = "rgba(17,22,18,.48)";
  ctx.fillRect(-16, 20, 32, 7);
}

function drawPlayerFront() {
  const suit = playerSuitColor();
  const stride = player.moving ? Math.sin(player.animTime * 14) * 3 : 0;
  const step = Math.abs(stride) * .35;
  ctx.fillStyle = suit;
  ctx.fillRect(-20, 1 + stride, 6, 13); ctx.fillRect(14, 1 - stride, 6, 13);
  ctx.fillStyle = "#d2ae90";
  ctx.fillRect(-20, 11 + stride, 6, 4); ctx.fillRect(14, 11 - stride, 6, 4);
  ctx.fillStyle = "#161d29";
  ctx.fillRect(-12 - stride, 17 + step, 9, 12); ctx.fillRect(4 + stride, 17 + step, 9, 12);
  ctx.fillStyle = "#24222a"; ctx.fillRect(-14 - stride, 27, 12, 4); ctx.fillRect(3 + stride, 27, 12, 4);
  ctx.fillStyle = suit; ctx.fillRect(-16, -2, 32, 23);
  ctx.strokeStyle = "#111923"; ctx.lineWidth = 3; ctx.strokeRect(-16, -2, 32, 23);
  ctx.fillStyle = "#e9dfcb";
  ctx.beginPath(); ctx.moveTo(-9, -2); ctx.lineTo(0, 9); ctx.lineTo(9, -2); ctx.lineTo(6, 16); ctx.lineTo(-6, 16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#18202a";
  ctx.beginPath(); ctx.moveTo(-3, 2); ctx.lineTo(3, 2); ctx.lineTo(5, 16); ctx.lineTo(0, 20); ctx.lineTo(-5, 16); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#d2ae90"; ctx.fillRect(-4, -7, 8, 8);
  ctx.fillStyle = "#d7b392"; ctx.fillRect(-11, -25, 22, 21);
  ctx.fillStyle = "#15191d"; ctx.fillRect(-12, -28, 24, 8); ctx.fillRect(-12, -24, 4, 8); ctx.fillRect(8, -24, 4, 8);
  ctx.fillStyle = "#181819"; ctx.fillRect(-8, -31, 16, 5);
  if (chapterIndex >= 2) {
    ctx.fillStyle = "#24201f"; ctx.fillRect(-8, -10, 16, 6); ctx.fillRect(-5, -14, 10, 4);
  } else {
    ctx.fillStyle = "#9c7865"; ctx.fillRect(-2, -10, 4, 2);
  }
  ctx.fillStyle = "#1c1919"; ctx.fillRect(-7, -18, 3, 2); ctx.fillRect(4, -18, 3, 2);
  ctx.fillStyle = "#d8c99e"; ctx.fillRect(11, 1, 3, 3);
  drawPinstripes(suit);
}

function drawPlayerProfile() {
  const suit = playerSuitColor();
  const stride = player.moving ? Math.sin(player.animTime * 14) * 3 : 0;
  ctx.fillStyle = suit; ctx.fillRect(-16, 2 + stride, 6, 13); ctx.fillRect(11, 2 - stride, 6, 13);
  ctx.fillStyle = "#d2ae90"; ctx.fillRect(-16, 12 + stride, 6, 4); ctx.fillRect(11, 12 - stride, 6, 4);
  ctx.fillStyle = "#171e28"; ctx.fillRect(-11 - stride, 17, 9, 12); ctx.fillRect(4 + stride, 17, 9, 12);
  ctx.fillStyle = "#26222a"; ctx.fillRect(-13 - stride, 27, 12, 4); ctx.fillRect(3 + stride, 27, 12, 4);
  ctx.fillStyle = suit; ctx.fillRect(-15, -2, 30, 24);
  ctx.strokeStyle = "#111923"; ctx.lineWidth = 3; ctx.strokeRect(-15, -2, 30, 24);
  ctx.fillStyle = "#e8dfcd"; ctx.fillRect(1, 0, 5, 15);
  ctx.fillStyle = "#171d25"; ctx.fillRect(3, 2, 3, 14);
  ctx.fillStyle = "#d2ae90"; ctx.fillRect(-3, -8, 9, 7);
  ctx.fillStyle = "#d5b08d"; ctx.fillRect(-7, -26, 17, 21); ctx.fillRect(8, -17, 5, 5);
  ctx.fillStyle = "#15191d"; ctx.fillRect(-9, -29, 19, 9); ctx.fillRect(-9, -23, 5, 8);
  if (chapterIndex >= 2) {
    ctx.fillStyle = "#231d1c"; ctx.fillRect(-3, -10, 12, 7); ctx.fillRect(4, -14, 7, 4);
  } else {
    ctx.fillStyle = "#9c7865"; ctx.fillRect(6, -11, 3, 2);
  }
  ctx.fillStyle = "#171617"; ctx.fillRect(5, -19, 3, 2);
  ctx.fillStyle = "#d6c28a"; ctx.fillRect(-5, 1, 3, 3);
  drawPinstripes(suit);
}

function drawPlayerBack() {
  const suit = playerSuitColor();
  const stride = player.moving ? Math.sin(player.animTime * 14) * 3 : 0;
  ctx.fillStyle = suit;
  ctx.fillRect(-20, 1 + stride, 6, 13); ctx.fillRect(14, 1 - stride, 6, 13);
  ctx.fillStyle = "#171e28";
  ctx.fillRect(-12 - stride, 17, 9, 12); ctx.fillRect(4 + stride, 17, 9, 12);
  ctx.fillStyle = "#26222a"; ctx.fillRect(-14 - stride, 27, 13, 4); ctx.fillRect(3 + stride, 27, 13, 4);
  ctx.fillStyle = suit;
  ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-11, -5); ctx.lineTo(-7, -8); ctx.lineTo(7, -8);
  ctx.lineTo(12, -5); ctx.lineTo(16, 0); ctx.lineTo(14, 22); ctx.lineTo(-14, 22); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#111923"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#d2ae90"; ctx.fillRect(-4, -11, 8, 6);
  ctx.fillStyle = "#15191d"; ctx.fillRect(-12, -27, 24, 17); ctx.fillRect(-9, -31, 18, 6);
  ctx.fillStyle = "#242222"; ctx.fillRect(-10, -14, 20, 6);
  ctx.fillStyle = "#90939a"; ctx.fillRect(-1, -2, 2, 21);
  ctx.fillStyle = "#b99e72"; ctx.fillRect(10, -1, 3, 3);
  drawPinstripes(suit);
}

function drawPinstripes(suit) {
  if (!pinstripeSuit && !reinforcedSuit) return;
  ctx.strokeStyle = pinstripeSuit ? "rgba(207,218,222,.48)" : "rgba(225,229,222,.28)";
  ctx.lineWidth = 1;
  for (const x of [-10, -5, 5, 10]) {
    ctx.beginPath(); ctx.moveTo(x, 1); ctx.lineTo(x, 20); ctx.stroke();
  }
}

function drawEnemy(enemy) {
  if (enemy.hp <= 0) return;
  ctx.save();
  const bounce = Math.sin(enemy.animTime * 10) * 1.5;
  ctx.translate(enemy.x, enemy.y + (enemy.hitTime > 0 ? 0 : bounce));
  if (enemy.flash > 0) ctx.globalAlpha = .45;
  ctx.fillStyle = "rgba(22,28,22,.34)";
  ctx.beginPath(); ctx.ellipse(0, enemy.r + 7, enemy.r + 3, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (enemy.hitTime > 0) {
    ctx.rotate(Math.sin(enemy.hitTime * 42) * .08);
    ctx.scale(1.13, .86);
  }
  if (enemy.kind === "goblin") {
    ctx.fillStyle = "#5aa35a"; ctx.beginPath(); ctx.arc(0, 0, enemy.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d9c67f"; ctx.beginPath(); ctx.moveTo(-10,-6); ctx.lineTo(-22,-13); ctx.lineTo(-14,1); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10,-6); ctx.lineTo(22,-13); ctx.lineTo(14,1); ctx.fill();
    ctx.fillStyle = "#281c1b"; ctx.fillRect(-8,-4,4,4); ctx.fillRect(4,-4,4,4);
  } else if (enemy.kind === "dinosaur") {
    ctx.fillStyle = "#568747"; ctx.beginPath(); ctx.ellipse(-3,0,20,13,-.1,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(13,-6,12,9,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#d7cc8e";ctx.beginPath();ctx.moveTo(18,-3);ctx.lineTo(29,1);ctx.lineTo(18,3);ctx.fill();
    ctx.fillStyle="#231c16";ctx.beginPath();ctx.arc(16,-9,2,0,Math.PI*2);ctx.fill();
  } else if (enemy.kind === "ghost") {
    ctx.fillStyle = "rgba(192,225,230,.86)";
    ctx.beginPath();ctx.arc(0,-3,enemy.r,Math.PI,Math.PI*2);ctx.lineTo(enemy.r,11);ctx.lineTo(6,7);ctx.lineTo(0,12);ctx.lineTo(-7,7);ctx.lineTo(-enemy.r,11);ctx.closePath();ctx.fill();
    ctx.fillStyle="#35435a";ctx.beginPath();ctx.arc(-5,-1,2.4,0,Math.PI*2);ctx.arc(5,-1,2.4,0,Math.PI*2);ctx.fill();
  } else if (enemy.kind === "knight") {
    ctx.fillStyle="#77858a";ctx.fillRect(-14,-12,28,30);
    ctx.fillStyle="#c2c9c4";ctx.fillRect(-12,-19,24,16);
    ctx.fillStyle="#293a46";ctx.fillRect(-9,-12,18,4);
    ctx.fillStyle="#d5aa5e";ctx.fillRect(-2,-12,4,4);
  } else if (enemy.kind === "ninja") {
    ctx.fillStyle="#25262b";ctx.beginPath();ctx.ellipse(0,2,16,19,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#d7b78e";ctx.fillRect(-9,-8,18,7);
    ctx.fillStyle="#292123";ctx.fillRect(-10,-14,20,7);
    ctx.fillStyle="#e9ddbd";ctx.fillRect(-6,-6,4,2);ctx.fillRect(3,-6,4,2);
    ctx.strokeStyle="#b9c3c4";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(9,8);ctx.lineTo(22,17);ctx.stroke();
  } else if (enemy.kind === "drone") {
    ctx.fillStyle="#929ea0";ctx.beginPath();ctx.arc(0,0,14,0,Math.PI*2);ctx.fill();
    ctx.fillStyle="#d73d47";ctx.shadowColor="#f33";ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
    ctx.strokeStyle="#30383a";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-19,-13);ctx.lineTo(19,-13);ctx.moveTo(-19,13);ctx.lineTo(19,13);ctx.stroke();
  } else if (enemy.kind === "vp" || enemy.kind === "executive") {
    drawSuitEnemy(enemy.kind === "vp" ? "#38374b" : "#4b4037", enemy.kind === "vp" ? "#c39a4e" : "#a75a4c");
  } else {
    const suit = enemy.kind === "hr" ? "#672f3a" : enemy.kind === "middle" ? "#41536b" : enemy.kind === "production" ? "#4d493b" : "#322f31";
    const skin = enemy.kind === "ceo" ? "#b8a487" : "#d0ac8d";
    drawCorporateBoss(enemy, suit, skin);
  }
  if (enemy.boss && enemy.kind !== "ceo") {
    ctx.fillStyle = "#332b25";
    ctx.fillRect(-28, -enemy.r - 17, 56, 5);
    ctx.fillStyle = "#7ec56f";
    ctx.fillRect(-28, -enemy.r - 17, 56 * Math.max(0, enemy.hp / enemy.maxHp), 5);
  }
  ctx.restore();
}

function drawSuitEnemy(suit, tie) {
  ctx.fillStyle = suit; ctx.fillRect(-13,-3,26,28);
  ctx.fillStyle = "#dccfb7";ctx.beginPath();ctx.arc(0,-12,10,0,Math.PI*2);ctx.fill();
  ctx.fillStyle = "#1f1d1b";ctx.beginPath();ctx.arc(0,-16,10,Math.PI,Math.PI*2);ctx.fill();
  ctx.fillStyle = tie;ctx.beginPath();ctx.moveTo(-2,-2);ctx.lineTo(2,-2);ctx.lineTo(4,13);ctx.lineTo(0,17);ctx.lineTo(-4,13);ctx.closePath();ctx.fill();
}

function drawCorporateBoss(enemy, suit, skin) {
  const isCeo = enemy.kind === "ceo";
  const bodyW = isCeo ? 43 : 32;
  ctx.fillStyle = suit;
  ctx.beginPath();ctx.ellipse(0,8,bodyW,27,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#eee7d9";
  ctx.beginPath();ctx.moveTo(-10,-8);ctx.lineTo(0,7);ctx.lineTo(10,-8);ctx.lineTo(6,20);ctx.lineTo(-6,20);ctx.closePath();ctx.fill();
  ctx.fillStyle="#b4483e";
  ctx.beginPath();ctx.moveTo(-3,-5);ctx.lineTo(3,-5);ctx.lineTo(6,18);ctx.lineTo(0,23);ctx.lineTo(-6,18);ctx.closePath();ctx.fill();
  ctx.fillStyle=skin;ctx.beginPath();ctx.ellipse(0,-24,isCeo?27:22,23,0,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#211d1a";ctx.beginPath();ctx.arc(0,-35,isCeo?27:22,Math.PI,Math.PI*2);ctx.fill();
  if (enemy.kind === "production") {
    ctx.fillStyle = "#d9ad36"; ctx.fillRect(-28, -58, 56, 9); ctx.fillRect(-17, -68, 34, 13);
    ctx.fillStyle = "#f4d367"; ctx.fillRect(-5, -66, 10, 7);
    ctx.strokeStyle = "#59451d"; ctx.lineWidth = 2; ctx.strokeRect(-28, -58, 56, 9);
  }
  ctx.fillStyle="#292622";ctx.fillRect(-bodyW+3,28,17,9);ctx.fillRect(bodyW-20,28,17,9);
  ctx.fillStyle="#f1df8d";ctx.font="bold 10px Georgia";ctx.textAlign="center";
  ctx.fillText(enemyName(enemy.kind).toUpperCase(),0,46);
  if (isCeo) {
    ctx.fillStyle="#b3463e";ctx.fillRect(-31,-65,62,6);
    ctx.fillStyle="#67d27a";ctx.fillRect(-31,-65,62*Math.max(0,enemy.hp/enemy.maxHp),6);
  }
}

function drawEnemyProjectile(shot) {
  const spin = shot.rotation + time * (shot.kind === "wrench" ? 7 : 2);
  ctx.save();
  ctx.translate(shot.x, shot.y);
  if (shot.kind === "rejection") {
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 15px Georgia";
    ctx.lineWidth = 4; ctx.strokeStyle = "#341d1b"; ctx.fillStyle = "#ff766a";
    ctx.shadowColor = "#e44642"; ctx.shadowBlur = 12;
    ctx.strokeText("REJECTION", 0, 0); ctx.fillText("REJECTION", 0, 0);
  } else if (shot.kind === "paper") {
    ctx.rotate(spin);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 2 ? "#f5ebd2" : "#c8c0af";
      ctx.fillRect(-12 + i * 2, -15 - i * 2, 25, 30);
      ctx.strokeStyle = "#645b4e"; ctx.lineWidth = 1; ctx.strokeRect(-12 + i * 2, -15 - i * 2, 25, 30);
    }
    ctx.strokeStyle = "#b74e49"; ctx.beginPath(); ctx.moveTo(-7, -7); ctx.lineTo(8, -7); ctx.moveTo(-7, -1); ctx.lineTo(8, -1); ctx.stroke();
  } else if (shot.kind === "wrench") {
    ctx.rotate(spin);
    ctx.lineCap = "square"; ctx.lineWidth = 8; ctx.strokeStyle = "#a9b0a7";
    ctx.beginPath(); ctx.moveTo(-13, 14); ctx.lineTo(10, -9); ctx.stroke();
    ctx.lineWidth = 10; ctx.strokeStyle = "#68777b";
    ctx.beginPath(); ctx.moveTo(7, -7); ctx.lineTo(15, -15); ctx.moveTo(7, -7); ctx.lineTo(15, 1); ctx.stroke();
    ctx.fillStyle = "#e2bd62"; ctx.fillRect(-16, 10, 8, 8);
  } else if (shot.kind === "candy") {
    ctx.rotate(Math.sin(time * 10 + shot.rotation) * .2);
    ctx.fillStyle = "#e9c5d2";
    ctx.beginPath(); ctx.moveTo(-7, -5); ctx.lineTo(-17, -12); ctx.lineTo(-15, 0); ctx.lineTo(-17, 12); ctx.lineTo(-7, 5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(7, -5); ctx.lineTo(17, -12); ctx.lineTo(15, 0); ctx.lineTo(17, 12); ctx.lineTo(7, 5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = shot.rotation % 2 < 1 ? "#ed6672" : "#f2cb68";
    ctx.beginPath(); ctx.ellipse(0, 0, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#fff1df"; ctx.lineWidth = 2; ctx.stroke();
  } else {
    ctx.rotate(Math.atan2(shot.vy, shot.vx));
    ctx.fillStyle = "rgba(227,75,47,.42)"; ctx.beginPath(); ctx.ellipse(-10, 0, 18, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f05b32"; ctx.beginPath(); ctx.arc(0, 0, 11 + Math.sin(time * 18 + shot.rotation) * 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffd06a"; ctx.beginPath(); ctx.arc(2, -2, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function draw() {
  if (cutscene) {
    drawCutscene();
    return;
  }
  drawGround();
  if (currentRoom.heartContainer && !collectedItems.has(currentRoom.heartContainer.id)) {
    drawHeartContainer(currentRoom.heartContainer.x, currentRoom.heartContainer.y);
  }
  if (currentRoom.briefcaseAt && !currentRoom.briefcaseAt.collected) drawBriefcase(currentRoom.briefcaseAt.x, currentRoom.briefcaseAt.y);
  if (currentRoom.chest) drawChest(currentRoom.chest);
  for (const drop of drops) drawBossDrop(drop);
  for (const enemy of enemies) drawEnemy(enemy);
  for (const shot of playerShots) {
    ctx.fillStyle="#ff8d37";ctx.shadowColor="#ffba4d";ctx.shadowBlur=18;
    ctx.beginPath();ctx.arc(shot.x,shot.y,shot.r+Math.sin(time*20)*2,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  }
  for (const shot of projectiles) drawEnemyProjectile(shot);
  if (currentRoom.isSecret) drawSecretPortal(W/2,H-38);
  drawMiniMap();
  drawPlayer();
  if (messageTime > 0) {
    ctx.fillStyle="rgba(24,31,26,.84)";
    ctx.fillRect(W/2-250,H-68,500,34);
    ctx.strokeStyle="#ddcf91";ctx.strokeRect(W/2-250,H-68,500,34);
    ctx.fillStyle="#f3edc9";ctx.textAlign="center";ctx.font="bold 14px Georgia";ctx.fillText(message,W/2,H-46);
  }
  if (briefcaseTimer > 0) {
    ctx.fillStyle="#f1e7bf";ctx.textAlign="left";ctx.font="bold 13px Georgia";
    ctx.fillText(`FIREBALL ${briefcaseTimer.toFixed(1)}s`,24,25);
    ctx.fillStyle="#29231e";ctx.fillRect(24,31,100,5);
    ctx.fillStyle="#ff9a45";ctx.fillRect(24,31,100*briefcaseTimer/10,5);
  }
  if (starTimer > 0) {
    ctx.fillStyle = "#fff1a0";
    ctx.textAlign = "left";
    ctx.font = "bold 13px Georgia";
    ctx.fillText(`STAR ${starTimer.toFixed(1)}s`, 24, 54);
  }
  ctx.fillStyle = "rgba(10,12,16,.09)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);
  if (paused) {
    ctx.fillStyle="rgba(10,18,15,.7)";ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#fff";ctx.textAlign="center";ctx.font="bold 40px Georgia";ctx.fillText("PAUSED",W/2,H/2);
  }

  function drawBossDrop(drop) {
    const y = drop.y + Math.sin(time * 4 + drop.phase) * 3;
    const styles = {
      heart: ["#ef5961", "♥"],
      briefcase: ["#e3c876", "▣"],
      star: ["#fff1a0", "★"],
      rupees: ["#68e0ae", "◆"]
    };
    const [color, icon] = styles[drop.kind];
    ctx.fillStyle = color;
    ctx.strokeStyle = "#33291e";
    ctx.lineWidth = 3;
    ctx.font = "bold 23px Georgia";
    ctx.textAlign = "center";
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillText(icon, drop.x, y + 8);
    ctx.shadowBlur = 0;
    ctx.strokeText(icon, drop.x, y + 8);
  }
}

function drawAnimeSpeedLines(scene, strength) {
  const centerX = scene.style === "finale" ? 460 : 480;
  const centerY = scene.style === "finale" ? 280 : 265;
  ctx.save();
  ctx.lineWidth = 2;
  for (let i = 0; i < 32; i++) {
    const angle = i * Math.PI * 2 / 32 + Math.sin(scene.elapsed * .7) * .035;
    const radius = 85 + (i * 67 + scene.elapsed * 145) % 310;
    const length = 28 + (i % 4) * 13;
    ctx.strokeStyle = i % 3 === 0
      ? `rgba(255,230,167,${strength})`
      : `rgba(213,225,241,${strength * .72})`;
    ctx.beginPath();
    ctx.moveTo(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius);
    ctx.lineTo(centerX + Math.cos(angle) * (radius + length), centerY + Math.sin(angle) * (radius + length));
    ctx.stroke();
  }
  ctx.restore();
}

function drawCutscene() {
  const scene = cutscene;
  const index = Math.min(scene.line, scene.lines.length - 1);
  const background = scene.style === "graduation" ? "#243b38" : scene.style === "travel" ? "#222b40" : scene.style === "promotion" ? "#26323b" : scene.style === "finale" ? "#20202b" : "#1c2b21";
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);
  const gradient = ctx.createRadialGradient(W / 2, H / 2, 30, W / 2, H / 2, 480);
  gradient.addColorStop(0, "rgba(240,216,145,.18)");
  gradient.addColorStop(1, "rgba(10,12,19,.12)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  if (scene.style === "travel") drawAnimeSpeedLines(scene, .12);
  else if (scene.style === "promotion") drawAnimeSpeedLines(scene, .1);
  else if (scene.style === "finale") drawAnimeSpeedLines(scene, .075);
  ctx.fillStyle = "#e9d69a";
  ctx.textAlign = "center";
  ctx.font = "bold 18px Georgia";
  ctx.fillText(scene.style === "graduation" ? "A NEW GRADUATE" : scene.style === "travel" ? "A PROMOTION IN MOTION" : scene.style === "promotion" ? "THE NEXT CHAPTER" : "ERNESTO'S STORY", W / 2, 48);

  if (scene.style === "graduation") {
    ctx.fillStyle = "#536957"; ctx.fillRect(0, 290, W, 120);
    ctx.fillStyle = "#b7a779"; ctx.fillRect(110, 108, 740, 190);
    ctx.fillStyle = "#6b5945"; ctx.fillRect(395, 180, 170, 118);
    ctx.fillStyle = "#394a47";
    for (const x of [165, 280, 620, 735]) {
      ctx.fillRect(x, 145, 66, 78);
      ctx.fillStyle = "#c8d0b1"; ctx.fillRect(x + 7, 152, 52, 62);
      ctx.fillStyle = "#394a47";
    }
    ctx.fillStyle = "#dbca91"; ctx.fillRect(0, 390, W, 20);
    const stride = Math.min(1, scene.elapsed / 8);
    drawCinematicHero(245 + stride * 470, 340, 1.45, false, index === 0, index < 2, false);
    if (index >= 1) {
      ctx.fillStyle = "#f4e3a8";
      ctx.fillRect(505 + stride * 15, 320, 25, 7);
      ctx.fillStyle = "#9c3e38";
      ctx.fillRect(526 + stride * 15, 320, 6, 7);
    }
    if (index >= 2) {
      ctx.fillStyle = "#f0d98b"; ctx.font = "bold 15px Georgia";
      ctx.fillText("READY FOR THE REAL WORLD", W / 2, 100);
    }
  } else if (scene.style === "travel") {
    ctx.fillStyle = "#303c50"; ctx.fillRect(0, 350, W, 60);
    ctx.fillStyle = "#e8d18c"; ctx.font = "bold 24px Georgia";
    ctx.fillText("CORPORATE HEADQUARTERS", W / 2, 120);
    ctx.fillStyle = "#838b9a"; ctx.fillRect(690, 170, 180, 150);
    ctx.fillStyle = "#d1c69e"; ctx.fillRect(715, 205, 30, 45); ctx.fillRect(765, 205, 30, 45); ctx.fillRect(815, 205, 30, 45);
    ctx.fillStyle = "#4b5360"; ctx.fillRect(705, 270, 150, 50);
    const planeX = ((scene.elapsed * 115) % 1100) - 100;
    ctx.fillStyle = "#d9e3ed";
    ctx.beginPath(); ctx.moveTo(planeX, 215); ctx.lineTo(planeX + 185, 202); ctx.lineTo(planeX + 225, 214);
    ctx.lineTo(planeX + 185, 225); ctx.lineTo(planeX + 78, 221); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#8c9daa"; ctx.fillRect(planeX + 105, 192, 34, 28);
    drawCinematicHero(320 + Math.min(scene.elapsed * 17, 100), 345, 1.3, false, false, false, false);
  } else if (scene.style === "promotion") {
    ctx.fillStyle = "#45535c"; ctx.fillRect(0, 110, W, 300);
    ctx.fillStyle = "#65727a";
    ctx.beginPath(); ctx.moveTo(90, 110); ctx.lineTo(870, 110); ctx.lineTo(700, 410); ctx.lineTo(260, 410); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#26343b"; ctx.fillRect(382, 115, 196, 205);
    ctx.strokeStyle = "#d1bc7d"; ctx.lineWidth = 4; ctx.strokeRect(382, 115, 196, 205);
    const approach = Math.min(scene.elapsed / 5, 1);
    const heroX = 290 + approach * 210;
    drawCinematicHero(heroX, 340, 1.45, false, false, false, false);
    ctx.fillStyle = "#e9d083";
    ctx.globalAlpha = .65 + Math.sin(scene.elapsed * 8) * .2;
    ctx.fillRect(565, 190, 5, 90);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#d5bd79"; ctx.font = "bold 13px Georgia";
    ctx.fillText(index === 0 ? "A NEW ROLE" : index === 1 ? "PROMOTION UNLOCKED" : "ONWARD AND UPWARD", W / 2, 96);
  } else {
    ctx.fillStyle = "#514b43"; ctx.fillRect(130, 105, 700, 300);
    ctx.strokeStyle = "#d1bc7d"; ctx.lineWidth = 5; ctx.strokeRect(130, 105, 700, 300);
    ctx.fillStyle = "#293247"; ctx.fillRect(180, 150, 600, 210);
    ctx.fillStyle = "#584a3c"; ctx.fillRect(190, 163, 128, 120);
    ctx.strokeStyle = "#e0c47e"; ctx.strokeRect(190, 163, 128, 120);
    drawCinematicHero(254, 250, .88, true, false, false, false);

    if (scene.style === "finale") {
      if (index === 0) {
        ctx.fillStyle = "#e8d28c"; ctx.beginPath(); ctx.moveTo(520, 160); ctx.lineTo(506, 188); ctx.lineTo(534, 188); ctx.closePath(); ctx.fill();
        drawCinematicHero(520, 330, 1.65, true, false, false, true);
      } else if (index === 1) {
        ctx.fillStyle = "#292b34"; ctx.fillRect(260, 165, 170, 170); ctx.strokeStyle = "#dfc47d"; ctx.lineWidth = 5; ctx.strokeRect(260, 165, 170, 170);
        drawCinematicHero(345, 265, 1.05, true, false, false, false);
        drawCinematicHero(570, 335, 1.45, true, false, false, false);
      } else if (index === 2) {
        ctx.fillStyle = "#6d5947"; ctx.fillRect(215, 287, 125, 90); ctx.fillRect(225, 350, 16, 40); ctx.fillRect(315, 350, 16, 40);
        drawCinematicHero(280, 280, 1.05, true, false, false, false);
        drawCinematicHero(560, 340, 1.45, true, false, false, true);
      } else {
        drawCinematicHero(460, 340, 1.55, true, false, false, true);
        for (let i = 0; i < 5; i++) {
          ctx.save();
          ctx.translate(95 + i * 145, 340 + Math.sin(scene.elapsed * 5 + i) * 3);
          drawTinyUnderling(["#4e5867", "#57483e", "#454c59", "#655045", "#3d4851"][i]);
          ctx.restore();
        }
        if (index === 4) {
          ctx.fillStyle = "#e9dfc5"; ctx.fillRect(715, 308, 95, 48);
          ctx.strokeStyle = "#514638"; ctx.strokeRect(715, 308, 95, 48);
          ctx.fillStyle = "#2c2927"; ctx.font = "bold 10px Georgia"; ctx.fillText("EXPENSES", 762, 336);
        }
      }
    } else {
      drawCinematicHero(480, 340, 1.5, false, false, false, false);
    }
  }

  if (scene.flash > 0) {
    ctx.fillStyle = `rgba(255,248,216,${scene.flash * .55})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.fillStyle = "rgba(9,12,18,.88)"; ctx.fillRect(52, 422, 856, 73);
  ctx.strokeStyle = "#d1b977"; ctx.lineWidth = 2; ctx.strokeRect(52, 422, 856, 73);
  ctx.fillStyle = "#fff5d8"; ctx.font = "bold 18px Georgia"; ctx.textAlign = "center";
  drawWrappedText(scene.lines[index], W / 2, 451, 800, 22);
  ctx.fillStyle = "rgba(255,255,255,.64)"; ctx.font = "12px system-ui";
  ctx.fillText("Press ENTER or click to continue", W / 2, 518);
}

function drawCinematicHero(x, y, scale, older, cap, gown, crown) {
  const phase = cutscene ? cutscene.elapsed * 12 : time * 12;
  const stride = Math.sin(phase + x * .01) * 3;
  const bounce = Math.abs(Math.sin(phase + x * .01)) * 1.7;
  ctx.save();
  ctx.translate(x, y - bounce);
  ctx.scale(scale, scale);
  const width = older ? 25 : 19;
  const suit = gown ? "#292c3d" : pinstripeSuit ? "#263442" : "#27364b";
  ctx.fillStyle = "rgba(8,12,14,.45)"; ctx.fillRect(-width - 5, 28, width * 2 + 10, 7);
  ctx.fillStyle = "#171e28"; ctx.fillRect(-width + 4 + stride, 17, 8, 15); ctx.fillRect(4 - stride, 17, 8, 15);
  ctx.fillStyle = suit; ctx.fillRect(-width - 3, 0 - stride, 6, 14); ctx.fillRect(width - 3, 0 + stride, 6, 14);
  ctx.fillStyle = suit; ctx.fillRect(-width, -5, width * 2, 28);
  ctx.strokeStyle = "#101722"; ctx.lineWidth = 3; ctx.strokeRect(-width, -5, width * 2, 28);
  ctx.fillStyle = "#eee7d9"; ctx.beginPath(); ctx.moveTo(-8, -5); ctx.lineTo(0, 8); ctx.lineTo(8, -5); ctx.lineTo(5, 17); ctx.lineTo(-5, 17); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#1a2028"; ctx.fillRect(-2, 1, 4, 16);
  ctx.fillStyle = "#d7b392"; ctx.fillRect(-4, -11, 8, 8); ctx.fillRect(-10, -31, 20, 22);
  ctx.fillStyle = older ? "#aaa99c" : "#15191d"; ctx.fillRect(-11, -34, 22, 9); ctx.fillRect(-11, -30, 4, 9); ctx.fillRect(7, -30, 4, 9);
  if (chapterIndex >= 2) {
    ctx.fillStyle = older ? "#b0afa3" : "#222020";
    ctx.fillRect(-8, -15, 16, 7);
  }
  if (!cap) {
    ctx.fillStyle = older ? "#97958a" : "#201a19"; ctx.fillRect(-8, -19, 16, 5);
    ctx.fillStyle = "#171617"; ctx.fillRect(-6, -25, 3, 2); ctx.fillRect(4, -25, 3, 2);
  }
  if (cap) {
    ctx.fillStyle = "#101722"; ctx.fillRect(-15, -39, 30, 5); ctx.fillRect(-8, -46, 16, 8);
    ctx.fillStyle = "#d3b970"; ctx.fillRect(7, -38, 14, 2);
  }
  if (crown) {
    ctx.fillStyle = "#e9d083";
    ctx.beginPath(); ctx.moveTo(-13, -38); ctx.lineTo(-10, -49); ctx.lineTo(-3, -41); ctx.lineTo(2, -51); ctx.lineTo(7, -41); ctx.lineTo(13, -48); ctx.lineTo(12, -36); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = older ? "#aaa99c" : "#d0ab8c";
  ctx.fillRect(-10, -13, 3, 5); ctx.fillRect(7, -13, 3, 5);
  if (older) {
    ctx.fillStyle = "#c3c0b4"; ctx.fillRect(-13, -12, 4, 7); ctx.fillRect(9, -12, 4, 7);
  }
  ctx.fillStyle = "#d6c28a"; ctx.fillRect(width - 5, -2, 3, 3);
  ctx.restore();
}

function drawTinyUnderling(suit) {
  ctx.fillStyle = suit; ctx.fillRect(-12, -5, 24, 34);
  ctx.fillStyle = "#d7b392"; ctx.fillRect(-8, -24, 16, 18);
  ctx.fillStyle = "#55545a"; ctx.fillRect(-9, -28, 18, 7);
  ctx.fillStyle = "#e8e1d2"; ctx.fillRect(-3, 0, 6, 16);
}

function drawWrappedText(text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((value, index) => ctx.fillText(value, x, startY + index * lineHeight));
}

const musicPatterns = {
  forest: {
    interval: 175, roots: [60, 65, 57, 62], scale: [0, 4, 7, 12, 16, 12, 7, 4],
    lead: "triangle", bass: "sine", third: 4
  },
  office: {
    interval: 235, roots: [45, 41, 43, 38], scale: [0, 3, 7, 10, 7, 3, 12, 10],
    lead: "triangle", bass: "sine", third: 3
  },
  hq: {
    interval: 190, roots: [43, 38, 41, 36], scale: [0, 3, 7, 12, 10, 7, 3, -1],
    lead: "square", bass: "triangle", third: 3
  }
};

function ensureAudio() {
  if (!musicEnabled) return;
  const AudioContextType = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextType) {
    musicButton.textContent = "♪ AUDIO N/A";
    return;
  }
  if (!audioContext) {
    audioContext = new AudioContextType();
    musicGain = audioContext.createGain();
    musicGain.gain.value = .075;
    musicGain.connect(audioContext.destination);
    musicEcho = audioContext.createDelay(.6);
    musicEcho.delayTime.value = .22;
    musicEchoFeedback = audioContext.createGain();
    musicEchoFeedback.gain.value = .16;
    musicEchoReturn = audioContext.createGain();
    musicEchoReturn.gain.value = .2;
    musicGain.connect(musicEcho);
    musicEcho.connect(musicEchoFeedback);
    musicEchoFeedback.connect(musicEcho);
    musicEcho.connect(musicEchoReturn);
    musicEchoReturn.connect(audioContext.destination);
  }
  musicGain.gain.setTargetAtTime(.075, audioContext.currentTime, .08);
  if (audioContext.state === "suspended") audioContext.resume();
  if (!musicTimer) startMusicLoop();
}

function setMusicTheme(theme) {
  currentMusicTheme = theme === "office" ? "office" : theme === "hq" ? "hq" : "forest";
  musicStep = 0;
  if (audioContext && musicEnabled) startMusicLoop();
}

function startMusicLoop() {
  if (musicTimer) clearInterval(musicTimer);
  const pattern = musicPatterns[currentMusicTheme];
  musicStep = 0;
  musicTimer = setInterval(() => {
    if (!audioContext || !musicEnabled || audioContext.state !== "running") return;
    const step = musicStep++;
    const bar = Math.floor(step / 16) % pattern.roots.length;
    const beat = step % 16;
    const root = pattern.roots[bar];
    if (beat % 4 === 0) playMusicNote(root - 24, .45, pattern.bass, .18);
    if (currentMusicTheme !== "office" || beat % 2 === 0) {
      const note = pattern.scale[(step + Math.floor(step / 8)) % pattern.scale.length];
      playMusicNote(root + 12 + note, .22, pattern.lead, .12);
    }
    if (beat % 4 === 2) {
      const harmony = [0, pattern.third, 7, 12][Math.floor(beat / 4)];
      playMusicNote(root + 12 + harmony, .34, "sine", .045);
    }
    if (beat === 0) {
      playMusicNote(root, 1.3, "triangle", .045);
      playMusicNote(root + pattern.third, 1.3, "triangle", .035);
      playMusicNote(root + 7, 1.3, "triangle", .035);
      playMusicNote(root + 12, .62, "sine", .025);
    }
    if (currentMusicTheme === "hq" && beat % 8 === 4) playMusicNote(root + 19, .45, "sawtooth", .05);
  }, pattern.interval);
}

function playMusicNote(midi, duration, waveform, volume) {
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = waveform;
  oscillator.frequency.setValueAtTime(440 * Math.pow(2, (midi - 69) / 12), now);
  envelope.gain.setValueAtTime(.0001, now);
  envelope.gain.exponentialRampToValueAtTime(volume, now + .025);
  envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
  oscillator.connect(envelope);
  envelope.connect(musicGain);
  oscillator.start(now);
  oscillator.stop(now + duration + .03);
}

function toggleMusic() {
  musicEnabled = !musicEnabled;
  musicButton.setAttribute("aria-pressed", String(musicEnabled));
  musicButton.textContent = musicEnabled ? "♪ MUSIC ON" : "♪ MUSIC OFF";
  if (musicEnabled) {
    ensureAudio();
  } else {
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
    if (musicGain && audioContext) musicGain.gain.setTargetAtTime(0, audioContext.currentTime, .08);
  }
}

function updateStick(event) {
  const rect = stick.getBoundingClientRect();
  let x = event.clientX - (rect.left + rect.width / 2);
  let y = event.clientY - (rect.top + rect.height / 2);
  const limit = 28;
  const length = Math.hypot(x, y);
  if (length > limit) { x *= limit / length; y *= limit / length; }
  touchMove.x = x / limit;
  touchMove.y = y / limit;
  stickKnob.style.transform = `translate(${x}px,${y}px)`;
}

function gameLoop(now) {
  const dt = Math.min((now - previous) / 1000, .033);
  previous = now;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

let previous = performance.now();

window.addEventListener("keydown", event => {
  if (cutscene && (event.code === "Enter" || event.code === "Space")) {
    event.preventDefault();
    advanceCutscene();
    return;
  }
  keys[event.code] = true;
  const arrowFacing = {
    ArrowUp: "north", ArrowRight: "east", ArrowDown: "south", ArrowLeft: "west"
  };
  if (arrowFacing[event.code]) {
    faceFromDirection(arrowFacing[event.code]);
    event.preventDefault();
  }
  if (event.code === "Space") {
    event.preventDefault();
    swingRequested = true;
  }
  if (event.code === "Escape" && running) paused = !paused;
});
window.addEventListener("keyup", event => { keys[event.code] = false; });
canvas.addEventListener("pointerdown", event => {
  if (cutscene) {
    advanceCutscene();
    return;
  }
  if (event.pointerType === "mouse") swingRequested = true;
});
startButton.addEventListener("click", startGame);
musicButton.addEventListener("click", toggleMusic);
shopItems.addEventListener("click", event => {
  const button = event.target.closest("[data-shop-item]");
  if (button && !button.disabled) buyShopItem(button.dataset.shopItem);
});
shopContinue.addEventListener("click", continueFromShop);
stick.addEventListener("pointerdown", event => { stick.setPointerCapture(event.pointerId); updateStick(event); });
stick.addEventListener("pointermove", event => { if (stick.hasPointerCapture(event.pointerId)) updateStick(event); });
function releaseStick() {
  touchMove.x = 0; touchMove.y = 0; stickKnob.style.transform = "";
}
stick.addEventListener("pointerup", releaseStick);
stick.addEventListener("pointercancel", releaseStick);
attackButton.addEventListener("pointerdown", event => { attackButton.setPointerCapture(event.pointerId); swingRequested = true; });

resetGame();
draw();
requestAnimationFrame(gameLoop);
