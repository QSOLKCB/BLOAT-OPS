// Original QSOL-IMC mission. All coordinates use QwakeTF's Z-up convention.
import { World, boxBrush, MASK_PLAYER } from '../engine/world.js';
import { PL_MINS, PL_MAXS } from '../engine/defs.js';

export const ZONES = [
  { name: 'ENGINEERING BAY', from: 0, to: 700, half: 300, height: 240 },
  { name: 'TELEMETRY INTAKE', from: 700, to: 1550, half: 460, height: 280 },
  { name: 'MIDDLEWARE HALL', from: 1550, to: 2350, half: 380, height: 280 },
  { name: 'DEPENDENCY CHAMBER', from: 2350, to: 3500, half: 600, height: 360 },
  { name: 'EXTRACTION', from: 3500, to: 4120, half: 300, height: 240 },
];
export const SPAWN = [170, 0, 25];
export const POWERUP = [1280, 280, 40];
export const RELAYS = [[1950, 270, 48], [2150, -270, 48]];
export const CORE = [3180, 0, 55];
export const EXTRACT = [3970, 0, 25];
export const SUPPLIES = [
  [520, -190, 25], [1050, -340, 25], [1430, 280, 25],
  [1740, -260, 25], [2190, 260, 25], [2520, -440, 25],
  [2920, 450, 25], [3350, -410, 25], [3680, -180, 25],
];
export const ENCOUNTERS = [
  [['harvester', 1000, -170], ['harvester', 1210, 80]],
  [['harvester', 980, 240], ['manager', 1130, -180], ['harvester', 1380, -220], ['manager', 1400, 90]],
  [['harvester', 1700, 110], ['manager', 1880, -120], ['harvester', 2020, 100], ['manager', 2230, -80]],
  [['manager', 2530, -210], ['harvester', 2670, 250], ['harvester', 2860, -310], ['manager', 3100, 270], ['harvester', 3340, -240]],
  [['harvester', 2590, -380], ['harvester', 2690, 380], ['manager', 3270, -340], ['harvester', 3340, 310]],
  [['manager', 2510, 280], ['harvester', 2700, -330], ['manager', 3280, 330], ['harvester', 3340, -290]],
  [['harvester', 2580, 350], ['manager', 2740, -300], ['harvester', 3130, -350], ['manager', 3360, 300]],
];

export function buildLevel() {
  const world = new World(), lights = [], signs = [];
  const box = (a, b, t = 'concrete', opts = {}) => world.add(boxBrush(a, b, t, undefined, opts));
  const light = (p, color = [1, .66, .3], radius = 420, intensity = .85) => lights.push({ origin: p, color, radius, intensity });
  for (const [index,z] of ZONES.entries()) {
    const {from:a,to:b,half:w,height:h} = z;
    box([a,-w,-24],[b,w,0], 'floor');
    box([a,-w-24,0],[b,-w,h], 'wall'); box([a,w,0],[b,w+24,h], 'wall');
    box([a,-w,h],[b,w,h+20], 'ceiling');
    // Seal the union of adjoining room widths/heights, including the exposed
    // shoulders when a room narrows. Only the central 176-unit portal is open.
    if (index) {
      const span=Math.max(w,ZONES[index-1].half),top=Math.max(h,ZONES[index-1].height);
      box([a-12,-span,0],[a+12,-88,top]); box([a-12,88,0],[a+12,span,top]); box([a-12,-88,160],[a+12,88,top],'steel');
    }
    for (let x=a+130; x<b-60; x+=260) {
      for (const side of [-1,1]) {
        const y=side*(w-8);
        box([x-8,y-8,0],[x+8,y+8,h],'steel');
        box([x-35,y-12,h-35],[x+35,y+12,h-27],'lamp_fbr');
        light([x,side*(w-45),h-55]);
      }
      box([x-6,-w,h-16],[x+6,w,h],'steel');
    }
    // A continuous amber centre stripe keeps the route readable.
    box([a+25,-3,.1],[b-25,3,.5],'amber_fbr');
    signs.push({origin:[a+110,w-3,100],yaw:0,title:z.name,sub:'BLOAT / AUTHORIZED PERSONNEL ONLY'});
  }
  box([-24,-324,0],[0,324,260]); box([4120,-324,0],[4144,324,260]);
  // Workbenches and service crates in the abandoned bay.
  for(const x of [300,470]) { box([x,-282,0],[x+100,-220,58],'steel'); box([x+20,-270,58],[x+65,-247,100],'terminal_fbr'); }
  // Staggered cover supports flanking. All aisles are wider than the player hull.
  for(const [x,y,w,h] of [[950,-280,85,50],[1100,250,95,58],[1360,-310,90,72],[1730,210,85,90],[1870,-240,85,90],[2110,180,85,90],[2490,-340,110,60],[2710,140,110,65],[2870,-210,100,75],[3080,370,110,65],[3280,-430,90,65]]) {
    box([x-w/2,y-35,0],[x+w/2,y+35,h],'steel');
    box([x-w/2,y-36,h-9],[x+w/2,y+36,h-3],'hazard');
  }
  // Server banks along the room edges, with emissive status strips.
  for(const [a,b,y] of [[810,1450,420],[1620,2290,340],[2410,3440,560]]) {
    for(let x=a;x<b;x+=150) {
      box([x,y-55,0],[x+65,y,150],'server');
      box([x+5,y-57,22],[x+60,y-55,27],'amber_fbr');
    }
  }
  // Reactor is behind an accessible control plinth.
  box([3220,-78,0],[3370,78,240],'steel');
  box([3218,-60,40],[3220,60,216],'core_fbr');
  for(const p of RELAYS) box([p[0]-26,p[1]-18,0],[p[0]+26,p[1]+18,35],'steel');
  box([3150,-30,0],[3208,30,37],'steel');
  light([3160,0,160],[1,.35,.12],500,1.1);
  signs.push({origin:[3230,-590,150],yaw:0,title:'ONE TEXT FILE. 47 MICROSERVICES.',sub:'COMPLEXITY IS OUR BUSINESS MODEL.'});
  signs.push({origin:[4020,290,100],yaw:0,title:'DEPENDENCIES TERMINATED',sub:'EXTRACTION / NO ACCOUNT REQUIRED'});
  world.finalize();
  const map = { world, lights, signs, ambient:[.19,.20,.22], gates:[1550,2350,3500].map(x=>({origin:[x,0,0],brushes:[boxBrush([-10,-88,0],[10,88,160],'steel')],solid:true})), spawn:SPAWN, zones:ZONES };
  // Level definitions are checked in Node as well as at startup.
  for(const p of [SPAWN,...SUPPLIES,...ENCOUNTERS.flat().map(e=>[e[1],e[2],25])]) {
    if(world.trace(p,p,PL_MINS,PL_MAXS,MASK_PLAYER).startsolid) throw new Error('Invalid spawn: '+p);
  }
  return map;
}
