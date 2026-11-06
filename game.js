import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const canvas = $('game-canvas');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#a9c5c6');
scene.fog = new THREE.FogExp2('#9ab7b5', 0.0085);
const camera = new THREE.PerspectiveCamera(73, innerWidth / innerHeight, 0.1, 260);
camera.position.set(0, 1.7, 22);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;

const clock = new THREE.Clock();
const touchDevice = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
const clamp = THREE.MathUtils.clamp;
const rand = (a,b) => a + Math.random() * (b-a);
const colors = [0x304b48,0x596653,0x6a493c,0x3c4656,0x4a5d6e,0x756449,0x333f3c,0x58613b,0x4b3b40,0x68574b,0x394b59,0x6a5548,0x485448,0x423e55,0x6b674f,0x384652,0x765548,0x4c5a48,0x514b42,0x394147];
const accents = [0xd5dc9a,0xe29d6d,0x86c8d6,0xb5a6de,0xd66d58,0xb8d08a,0xe0c88b,0x86a5d5,0xda9abd,0x9bd5b2,0xe7a758,0x97c7cb,0xd78171,0xbedc78,0xc0ad8e,0x9ca5e3,0xe28d62,0xa0cc95,0xdfd287,0x85b2cc];
const operators = [
 ['NOVA “TIDE” KIM','SCOUT',0],['MATEO “ANCHOR” RUIZ','BREACHER',1],['IMANI “VOLT” OKAFOR','ASSAULT',2],['ELI “NORTH” PARK','MEDIC',3],['SANA “WREN” HADDAD','MARKSMAN',4],['JACK “DOCK” MERCER','ENGINEER',5],['LEILA “MIST” AZIZ','RECON',6],['OWEN “RIG” PRICE','HEAVY',7],['PRIYA “FLARE” SHAH','SUPPORT',8],['LUCA “REEF” MORETTI','SCOUT',9],
 ['YARA “FROST” KHALIL','ASSAULT',10],['KAI “SHARD” TANAKA','MARKSMAN',11],['MIRA “SABLE” PETROV','BREACHER',12],['DARIUS “COIL” COLE','ENGINEER',13],['ANA “EMBER” COSTA','RECON',14],['NOAH “GULL” WILLIAMS','MEDIC',15],['ZARA “KITE” IQBAL','SUPPORT',16],['FELIX “BOLT” WEBER','HEAVY',17],['AMARA “DELTA” DIALLO','ASSAULT',18],['ETHAN “MACK” BROOKS','BREACHER',19]
];
const weaponFamilies=['ASSAULT RIFLE','SUBMACHINE GUN','BATTLE RIFLE','DESIGNATED MARKSMAN','PRECISION RIFLE','SHOTGUN','LIGHT MACHINE GUN','CARBINE','PERSONAL DEFENSE','TACTICAL RIFLE'];
const weaponPrefixes=['VANGUARD','TIDELINE','BREAKWATER','CUTLASS','TEMPEST','NORTHSTAR','HARBOR','RIPTIDE','SENTINEL','SEAWALL'];
const weaponNames=[], weapons=[];
for(let i=0;i<100;i++){
 const family=i%10, variant=Math.floor(i/10)+1;
 weaponNames.push(`${weaponPrefixes[family]} ${['5.56','9MM','7.62','DMR','.308','12G','5.56','4.6MM','.45','6.8'][family]} / ${String(variant).padStart(2,'0')}`);
 weapons.push({name:weaponNames[i],type:weaponFamilies[family],damage:clamp(38+((i*17)%47),30,90),control:clamp(88-((i*13)%62),22,94),rate:clamp(86-((i*19)%58),24,96),mag:[30,32,25,20,5,8,45,30,40,28][family],fireDelay:[.14,.085,.19,.32,.72,.52,.11,.13,.09,.16][family],damageBase:[31,18,42,57,90,68,24,29,17,36][family]});
}
let selectedOperator=0, selectedWeapon=0, mode='lobby', scoreBlue=0, scoreRed=0, kills=0, health=100, ammo=30, reserveAmmo=120, reloading=false, reloadTime=0, fireTimer=0, lastShot=0, toastTimer=0, elapsed=0, matchTime=0;
let bots=[], obstacles=[], particles=[], keys={}, moveTouch={x:0,y:0}, touchLook={x:0,y:0}, lookPointer=null, yaw=0, pitch=0, velocityY=0, grounded=true, lastBotShot=0, audioCtx=null, muted=false;
const player={position:new THREE.Vector3(0,1.7,22),radius:.42};
const playerGroup=new THREE.Group(); scene.add(playerGroup); playerGroup.add(camera);
const colliders=[];

scene.add(new THREE.HemisphereLight(0xc9e6e5,0x34423a,2.1));
const sun=new THREE.DirectionalLight(0xffe6bd,3.2); sun.position.set(-35,55,18); sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); sun.shadow.camera.left=-55; sun.shadow.camera.right=55; sun.shadow.camera.top=55; sun.shadow.camera.bottom=-55; sun.shadow.bias=-.0002; scene.add(sun);
const fill=new THREE.DirectionalLight(0x74b7c8,1.2); fill.position.set(35,18,-35); scene.add(fill);
const mat=(color,roughness=.85,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const mats={ground:mat('#667866'),grass:mat('#768569'),sand:mat('#b9ae87'),concrete:mat('#8b9187'),wall:mat('#c4b89d'),roof:mat('#505e5a'),dark:mat('#243333'),water:mat('#286c78',.23,.33),wood:mat('#806f52'),rock:mat('#707d76')};
function mesh(geo,material,x,y,z,opts={}){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=opts.cast!==false;m.receiveShadow=opts.receive!==false;scene.add(m);return m;}
function addCollider(x,z,w,d,top=3){colliders.push({x,z,w,d,top});}

function makeWorld(){
 // Deep water sheet with small wave-driven vertex movement.
 const waterGeo=new THREE.PlaneGeometry(240,240,100,100); waterGeo.rotateX(-Math.PI/2);
 const pos=waterGeo.attributes.position;
 for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,Math.sin(x*.15+z*.08)*.045+Math.cos(z*.13-x*.07)*.035);}
 waterGeo.computeVertexNormals(); const water=mesh(waterGeo,mats.water,0,-1.15,0,{cast:false});
 water.userData.wave=true;
 // Uneven low island plinth with a sandy waterline and grassy upper shelf.
 const base=mesh(new THREE.CylinderGeometry(48,51,3.8,64,3),mats.sand,0,-1.15,0);base.scale.set(1,.7,.84);base.position.y=-1.65;
 const island=mesh(new THREE.CylinderGeometry(37,39,1.4,64,2),mats.ground,0,-.05,0);island.scale.z=.88;island.position.y=-.12;
 const grassRing=mesh(new THREE.CylinderGeometry(36,38,1.35,64),mats.grass,0,.03,0);grassRing.scale.z=.88;grassRing.position.y=.12;
 // Tarmac lanes cross the center and connect both teams' spawn points.
 const lane=mesh(new THREE.PlaneGeometry(70,13),mat('#6a7068'),0,.16,0,{cast:false});lane.rotation.x=-Math.PI/2;
 const crossLane=mesh(new THREE.PlaneGeometry(12,65),mat('#73776c'),0,.17,0,{cast:false});crossLane.rotation.x=-Math.PI/2;
 for(let z=-30;z<=30;z+=4){const stripe=mesh(new THREE.BoxGeometry(.12,.025,1.3),mat('#d6d3ad'),0,.19,z,{cast:false});}
 // waterfront docks and piers
 for(const [x,z,w,d] of [[-5,-35,19,7],[8,34,19,7],[-34,-3,7,18],[34,8,7,18]]){
  const dock=mesh(new THREE.BoxGeometry(w,.75,d),mats.wood,x,-.05,z);dock.position.y=-.22;
  for(let px=x-w/2+1;px<x+w/2;px+=3)for(let pz=z-d/2+1;pz<z+d/2;pz+=3)mesh(new THREE.CylinderGeometry(.13,.18,2.6,7),mats.dark,px,-.85,pz);
 }
 // Distinct tactical compounds, canopies, roofs, lit windows.
 const buildings=[[-17,-16,13,10,5.1,'#b3a78c'],[15,-17,13,11,6.2,'#a8a38e'],[-18,15,12,10,5.8,'#9b9e8c'],[17,15,14,11,5.1,'#b7aa91'],[0,-27,10,7,4.2,'#a59d84'],[0,27,10,7,4.5,'#929b8f']];
 buildings.forEach(([x,z,w,d,h,c],i)=>{
  mesh(new THREE.BoxGeometry(w,h,d),mat(c),x,h/2+.18,z); addCollider(x,z,w,d,h);
  mesh(new THREE.BoxGeometry(w+.5,.4,d+.5),i%2?mats.roof:mat('#596a63'),x,h+.35,z);
  // front windows / doors, exterior bands, air vents
  const side=z<0?1:-1;
  for(let xx=x-w*.29;xx<x+w*.3;xx+=w*.29){
   const win=mesh(new THREE.BoxGeometry(1.05,1.05,.08),mat(i%2?'#799da0':'#91a6a0',.26,.2),xx,2.5,z+side*(d/2+.045),{cast:false});
   mesh(new THREE.BoxGeometry(1.14,.07,.11),mats.dark,xx,3.05,z+side*(d/2+.08),{cast:false});
  }
  mesh(new THREE.BoxGeometry(1.35,2.3,.12),mats.dark,x+w*.25,1.35,z+side*(d/2+.07));
  for(let j=0;j<2;j++)mesh(new THREE.BoxGeometry(w+.2,.13,d+.2),mat('#69766b'),x,.75+j*.24,z,{cast:false});
  // rooftop utility / solar panels
  if(i%2===0){const box=mesh(new THREE.BoxGeometry(2.4,.65,1.5),mat('#344646'),x-2,h+.85,z);box.rotation.y=.18;}
 });
 // low cover, crates, barriers, parked boats and scattered cargo
 const covers=[[-9,-7,4,1.1,1.4],[9,-7,4,1.1,1.4],[-8,8,3.8,1.2,1.35],[8,8,3.8,1.2,1.35],[-27,0,1.5,6,1.3],[27,-5,1.5,6,1.3],[-1,-12,6,1.1,1.35],[0,13,6,1.1,1.3]];
 covers.forEach(([x,z,w,d,h],i)=>{mesh(new THREE.BoxGeometry(w,h,d),i%3===0?mats.concrete:mats.wood,x,h/2+.2,z);addCollider(x,z,w,d,h);if(i%2===0)mesh(new THREE.BoxGeometry(w+.1,.12,d+.1),mats.dark,x,h+.24,z);});
 for(let i=0;i<24;i++){
  const x=rand(-31,31),z=rand(-31,31);if(Math.abs(x)<11&&Math.abs(z)<11)continue;
  const size=rand(.65,1.25),box=mesh(new THREE.BoxGeometry(size,size,size),i%2?mats.wood:mats.concrete,x,size/2+.2,z);box.rotation.y=rand(-.4,.4);if(i%3===0)addCollider(x,z,size,size,size);
  if(i%6===0){const drum=mesh(new THREE.CylinderGeometry(.42,.42,1.05,12),mat('#506e6b',.5),x+1,.75,z+.8);drum.rotation.z=.04;}
 }
 // windswept coastal trees and rocks around perimeter
 for(let i=0;i<28;i++){
  const angle=i/28*Math.PI*2,r=rand(31,38),x=Math.cos(angle)*r,z=Math.sin(angle)*r*.88;
  if(Math.abs(x)<24&&Math.abs(z)<24)continue;
  const trunk=mesh(new THREE.CylinderGeometry(.16,.3,2.4,7),mat('#64523f'),x,1.1,z);trunk.rotation.z=rand(-.16,.16);
  const crown=mesh(new THREE.ConeGeometry(rand(1.1,1.65),3.7,7),mat(i%2?'#47684f':'#527153'),x,3.25,z);crown.rotation.z=trunk.rotation.z;
 }
 for(let i=0;i<22;i++){const x=rand(-39,39),z=rand(-35,35);if(Math.abs(x)<22&&Math.abs(z)<21)continue;const rock=mesh(new THREE.DodecahedronGeometry(rand(.45,1.3),0),mats.rock,x,.3,z);rock.scale.y=.55;rock.rotation.set(rand(0,1),rand(0,2),rand(0,1));}
 // pennants and colored objective markers
 const pole=mesh(new THREE.CylinderGeometry(.05,.07,6,8),mats.dark,0,3.2,0);const flag=mesh(new THREE.PlaneGeometry(2.5,1),mat('#d7e775',.55),1.2,5.3,0,{cast:false});flag.material.side=THREE.DoubleSide;
 for(const [x,z,c] of [[-5,-4,0x78d5ed],[5,4,0xff796e]]){const ring=mesh(new THREE.TorusGeometry(1.55,.055,7,40),mat(c,.35,.2),x,.22,z);ring.rotation.x=Math.PI/2;}
 // distant seabirds / far coastline atmospheric silhouettes
 for(let i=0;i<8;i++){const bird=new THREE.Group();const body=mesh(new THREE.SphereGeometry(.12,6,5),mat('#253a3a'),0,0,0,{cast:false});body.scale.set(1.3,.5,.5);bird.add(body);for(const s of [-1,1]){const wing=mesh(new THREE.BoxGeometry(.55,.025,.1),mat('#253a3a'),s*.3,.03,0,{cast:false});wing.rotation.z=s*.13;bird.add(wing);}bird.position.set(rand(-50,50),rand(16,25),rand(-50,50));scene.add(bird);bird.userData.bird=true;bird.userData.phase=rand(0,6);}
}
makeWorld();

function makeSoldier(id, team, isPlayer=false){
 const info=operators[id], group=new THREE.Group(), cloth=mat(colors[id]), trim=mat(accents[id]), skin=mat(id%3===0?'#b9876c':id%3===1?'#d1a888':'#986d58'), black=mat('#202b2a'), visor=mat(team===0?'#7ecbdb':'#e18175',.27,.45);
 const torso=mesh(new THREE.BoxGeometry(.62,.75,.32),cloth,0,1.18,0);torso.castShadow=true;group.add(torso);
 const vest=mesh(new THREE.BoxGeometry(.67,.42,.36),trim,0,1.24,-.015);group.add(vest);
 for(let s of [-1,1]){
  const arm=mesh(new THREE.CylinderGeometry(.13,.16,.61,8),cloth,s*.42,1.16,0);arm.rotation.z=s*.16;group.add(arm);
  const glove=mesh(new THREE.SphereGeometry(.13,8,6),black,s*.46,.82,-.05);group.add(glove);
  const leg=mesh(new THREE.CylinderGeometry(.14,.12,.66,8),mat(id%2?'#414a3e':'#35413f'),s*.18,.47,0);group.add(leg);
  const boot=mesh(new THREE.BoxGeometry(.25,.15,.4),black,s*.18,.14,-.07);group.add(boot);
 }
 const head=mesh(new THREE.SphereGeometry(.21,12,10),skin,0,1.75,0);head.scale.y=1.12;group.add(head);
 const helmet=mesh(new THREE.SphereGeometry(.23,10,7,0,Math.PI*2,0,Math.PI*.56),trim,0,1.82,-.015);group.add(helmet);
 const goggles=mesh(new THREE.BoxGeometry(.29,.075,.08),visor,0,1.76,-.19);group.add(goggles);
 const pack=mesh(new THREE.BoxGeometry(.36,.52,.2),black,0,1.3,.24);group.add(pack);
 const shoulder=mesh(new THREE.BoxGeometry(.13,.18,.36),team===0?mat('#67b3ca'):mat('#cc5b51'),-.35,1.4,0);group.add(shoulder);
 // Signature details make all twenty silhouettes distinct at a glance.
 if(id%4===0){const antenna=mesh(new THREE.CylinderGeometry(.018,.018,.58,5),black,.2,2,.1);antenna.rotation.z=-.2;group.add(antenna);}
 if(id%4===1){const gogglesTop=mesh(new THREE.BoxGeometry(.34,.06,.12),black,0,1.91,-.02);group.add(gogglesTop);}
 if(id%4===2){const scarf=mesh(new THREE.BoxGeometry(.5,.12,.35),trim,0,1.54,0);group.add(scarf);}
 if(id%4===3){const headset=mesh(new THREE.TorusGeometry(.23,.035,5,12,Math.PI),black,0,1.8,0);group.add(headset);}
 group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 group.position.set(0,0,0);scene.add(group);
 const gunGroup=new THREE.Group();
 const gunBody=mesh(new THREE.BoxGeometry(.15,.16,.66),mat('#35413c',.48,.24),.32,1.27,-.32);group.add(gunBody);
 const gunBarrel=mesh(new THREE.CylinderGeometry(.035,.045,.58,8),mat('#202c2a',.35,.55),.32,1.29,-.83);gunBarrel.rotation.x=Math.PI/2;group.add(gunBarrel);
 const stock=mesh(new THREE.BoxGeometry(.11,.12,.28),mat('#554c3c'),.32,1.28,.13);group.add(stock);
 const mag=mesh(new THREE.BoxGeometry(.09,.24,.13),mat('#293330'),.32,1.1,-.28);mag.rotation.x=-.14;group.add(mag);
 return {id,team,info,group,alive:true,hp:100,respawn:0,attack:rand(.8,2),wander:rand(0,6),phase:rand(0,5),shotAt:0,gun:{body:gunBody,barrel:gunBarrel,mag},isPlayer};
}
function makeFirstPersonGun(){
 const g=new THREE.Group();const dark=mat('#202a27',.35,.45),metal=mat('#69766b',.32,.68),accent=mat('#d7e775',.35,.22);
 const body=mesh(new THREE.BoxGeometry(.17,.18,.67),dark,0,0,0);g.add(body);
 const receiver=mesh(new THREE.BoxGeometry(.18,.13,.26),metal,0,.045,-.03);g.add(receiver);
 const barrel=mesh(new THREE.CylinderGeometry(.035,.045,.56,10),dark,0,.02,-.56);barrel.rotation.x=Math.PI/2;g.add(barrel);
 const stock=mesh(new THREE.BoxGeometry(.12,.14,.29),mat('#485149'),0,-.015,.43);g.add(stock);
 const mag=mesh(new THREE.BoxGeometry(.1,.27,.15),mat('#303b36'),0,-.19,-.12);mag.rotation.x=-.13;g.add(mag);
 const sight=mesh(new THREE.BoxGeometry(.08,.08,.08),accent,0,.14,-.05);g.add(sight);
 g.position.set(.35,-.32,-.65);g.rotation.set(-.04,-.08,0);camera.add(g);return g;
}
const viewGun=makeFirstPersonGun();
function buildCharacterSelect(){
 const root=$('character-grid');root.innerHTML='';
 operators.forEach((op,i)=>{const card=document.createElement('button');card.className=`character-card ${i>=10?'red':''}${i===selectedOperator?' selected':''}`;card.style.setProperty('--card-color',i>=10?'#453336':'#263e3c');card.style.setProperty('--accent','#'+accents[i].toString(16).padStart(6,'0'));card.setAttribute('aria-label',`${op[0]}, ${op[1]}`);card.innerHTML=`<span class="silhouette"></span><span class="card-team"></span><span class="card-num">${String(i+1).padStart(2,'0')}</span>`;card.addEventListener('click',()=>{selectedOperator=i;buildCharacterSelect();});root.append(card);});
 const op=operators[selectedOperator];$('operator-avatar').textContent=String(selectedOperator+1).padStart(2,'0');$('operator-avatar').style.background=`linear-gradient(145deg,#${accents[selectedOperator].toString(16)},#53694d)`;$('operator-name').textContent=op[0];$('operator-role').textContent=`${op[1]} · ${selectedOperator<10?'HARBOR SQUAD':'RAIDER SQUAD'}`;$('operator-rating').textContent=['A','A+','S','B+','A','A-','S','B','A+','A'][selectedOperator%10];
}
function displayWeapon(){const w=weapons[selectedWeapon];$('weapon-type').textContent=w.type;$('weapon-name').textContent=w.name;$('weapon-desc').textContent=`${['Fast handling, steady recoil, and ready for the first push.','A tuned platform for confident shots across the whole island.','Hard-hitting, dependable, and at home in the thick of it.','Compact control with a sharp edge in close quarters.','Built for measured shots and long sightlines.'][selectedWeapon%5]}`;$('weapon-index-art').textContent=`BW—${String(selectedWeapon+1).padStart(2,'0')}`;
 for(const [id,val] of [['stat-damage',w.damage],['stat-control',w.control],['stat-rate',w.rate]])$(id).style.width=`${val}%`;
 $('weapon-pips').innerHTML=`<b>${String(selectedWeapon+1).padStart(2,'0')}</b> ··· ${String(100).padStart(2,'0')}`;
 $('hud-weapon-type').textContent=w.type;$('hud-weapon-name').textContent=w.name;$('ammo-now').textContent=w.mag;$('ammo-reserve').textContent=w.mag*4;
 const tint=['#35413c','#36413e','#454b40','#41483d','#393b38','#49483e','#3f4943','#37413b','#39423e','#40483f'][selectedWeapon%10];viewGun.children.forEach(c=>{if(c.material.color)c.material.color.set(tint)});
}
buildCharacterSelect();displayWeapon();

function intersectsWall(a,b){
 for(const c of colliders){const t=((c.x-a.x)*(b.x-a.x)+(c.z-a.z)*(b.z-a.z))/((b.x-a.x)**2+(b.z-a.z)**2||1);if(t<0||t>1)continue;const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if(Math.abs(x-c.x)<c.w/2&&Math.abs(z-c.z)<c.d/2&&a.y+(b.y-a.y)*t<c.top+.2)return true;}return false;
}
function clampPlayer(){
 player.position.x=clamp(player.position.x,-39,39);player.position.z=clamp(player.position.z,-37,37);
 for(const c of colliders){const dx=player.position.x-c.x,dz=player.position.z-c.z,px=c.w/2+player.radius-Math.abs(dx),pz=c.d/2+player.radius-Math.abs(dz);if(px>0&&pz>0){if(px<pz)player.position.x+=Math.sign(dx||1)*px;else player.position.z+=Math.sign(dz||1)*pz;}}
 player.position.y=clamp(player.position.y,1.7,3.8);
}
function startMatch(){
 bots.forEach(b=>scene.remove(b.group));bots=[];scoreBlue=0;scoreRed=0;kills=0;health=100;elapsed=0;matchTime=0;lastBotShot=0;ammo=weapons[selectedWeapon].mag;reserveAmmo=ammo*4;reloading=false;
 const playerTeam=selectedOperator<10?0:1;const playerBot=makeSoldier(selectedOperator,playerTeam,true);playerBot.isPlayer=true;playerBot.group.visible=false;bots.push(playerBot);
 for(let t=0;t<2;t++)for(let id=t*10;id<t*10+10;id++)if(id!==selectedOperator){const b=makeSoldier(id,t,false);bots.push(b);}
 bots.forEach((b)=>{
  const teamStart=b.team===0?10:-10;
  b.group.position.set(rand(-26,26),0,teamStart+rand(-4,4));
  b.group.rotation.y=b.team===0?0:Math.PI;
  b.target=new THREE.Vector3(rand(-14,14),0,rand(-12,12));
  b.group.traverse(o=>{if(o.isMesh)o.userData.ownerBot=b;});
 });
 player.position.set(rand(-3,3),1.7,playerTeam===0?22:-22);yaw=playerTeam===0?0:Math.PI;pitch=0;velocityY=0;camera.rotation.set(0,yaw,0,'YXZ');playerGroup.rotation.y=0;
 mode='game';$('start-screen').classList.add('hidden');$('weapon-screen').classList.add('hidden');$('end-screen').classList.add('hidden');$('pause-screen').classList.add('hidden');$('hud').classList.remove('hidden');$('scoreboard').classList.remove('hidden');$('crosshair').classList.remove('hidden');$('touch-controls').style.display=touchDevice?'block':'none';$('blue-score').textContent='000';$('red-score').textContent='000';$('health-value').textContent='100';$('health-bar').style.width='100%';$('alive-blue').textContent='10';$('alive-red').textContent='10';$('damage-flash').style.opacity=0;displayWeapon();updateAmmoUI();
 if(innerWidth>700&&canvas.requestPointerLock)canvas.requestPointerLock();showToast('SQUAD DEPLOYED · SECURE THE ISLAND');
}
function updateAmmoUI(){$('ammo-now').textContent=ammo;$('ammo-reserve').textContent=reserveAmmo;$('health-value').textContent=Math.ceil(health);$('health-bar').style.width=`${health}%`;}
function setPause(paused){if(paused){mode='paused';$('pause-screen').classList.remove('hidden');document.exitPointerLock?.();}else{mode='game';$('pause-screen').classList.add('hidden');if(innerWidth>700)canvas.requestPointerLock?.();clock.getDelta();}}
function finishMatch(){mode='end';document.exitPointerLock?.();$('hud').classList.add('hidden');$('scoreboard').classList.add('hidden');$('crosshair').classList.add('hidden');$('end-screen').classList.remove('hidden');const won=scoreBlue>=100;const playerTeam=selectedOperator<10?0:1;const playerWon=(playerTeam===0?won:!won);$('end-title').innerHTML=playerWon?'ISLAND<br><em>SECURED.</em>':'MISSION<br><em>FAILED.</em>';$('end-copy').textContent=playerWon?'Your squad owned the breakwater.':'The other side took the island this time.';$('end-kills').textContent=String(kills).padStart(2,'0');$('end-score').textContent=String(Math.max(scoreBlue,scoreRed)).padStart(3,'0');$('end-weapon').textContent=String(selectedWeapon+1).padStart(2,'0');}
function showToast(text){const t=$('toast');t.textContent=text;t.classList.add('show');toastTimer=2.2;}
function playTone(freq=180,duration=.06,type='square',volume=.025){if(muted)return;try{audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.type=type;osc.frequency.value=freq;gain.gain.setValueAtTime(volume,audioCtx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);osc.connect(gain);gain.connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime+duration);}catch{}}
function addFeed(killer,victim,team){const entry=document.createElement('div');entry.className=`feed-entry ${team===1?'enemy':''}`;entry.innerHTML=`${killer}<span>✕</span>${victim}`;$('killfeed').prepend(entry);while($('killfeed').children.length>4)$('killfeed').lastChild.remove();setTimeout(()=>entry.remove(),5000);}
function addTracer(start,end,team=0){const points=[start.clone(),end.clone()];const geom=new THREE.BufferGeometry().setFromPoints(points);const line=new THREE.Line(geom,new THREE.LineBasicMaterial({color:team===0?0x9be8f6:0xff9a81,transparent:true,opacity:.9}));scene.add(line);particles.push({object:line,life:.09,max:.09});}
function eliminate(victim,killer,team){
 if(!victim.alive)return;victim.alive=false;victim.respawn=3.1;victim.group.visible=false;
 if(team===0)scoreBlue+=10;else scoreRed+=10;
 $('blue-score').textContent=String(scoreBlue).padStart(3,'0');$('red-score').textContent=String(scoreRed).padStart(3,'0');$('blue-progress').style.width=`${scoreBlue}%`;$('alive-blue').textContent=Math.max(0,bots.filter(b=>b.team===0&&b.alive).length);$('alive-red').textContent=Math.max(0,bots.filter(b=>b.team===1&&b.alive).length);
 addFeed(killer,victim.info[0].split('“')[0].trim(),team);
 if(victim.isPlayer){health=0;updateAmmoUI();$('damage-flash').style.opacity=.8;setTimeout(()=>{$('damage-flash').style.opacity=0;},220);showToast('OPERATOR DOWN · RESPAWNING');}
 else if(killer===operators[selectedOperator][0]){kills++;}
 if(scoreBlue>=100||scoreRed>=100){setTimeout(finishMatch,800);}
}
function respawnBot(bot){bot.alive=true;bot.hp=100;bot.group.visible=true;bot.group.position.set(rand(-26,26),0,bot.team===0?rand(13,25):rand(-25,-13));bot.attack=rand(.8,2.1);}
function firePlayer(){
 if(mode!=='game'||reloading)return;if(ammo<=0){beginReload();return;}const w=weapons[selectedWeapon],now=elapsed;if(now-lastShot<w.fireDelay)return;lastShot=now;ammo--;updateAmmoUI();playTone(110+Math.random()*40,.07,'sawtooth',.035);viewGun.position.z=-.65+.045;setTimeout(()=>{viewGun.position.z=-.65;},65);
 const start=camera.getWorldPosition(new THREE.Vector3()),dir=new THREE.Vector3();camera.getWorldDirection(dir);let target=null,best=Infinity;
 for(const bot of bots){if(!bot.alive||bot.isPlayer||bot.team===(selectedOperator<10?0:1))continue;const pos=bot.group.position.clone().add(new THREE.Vector3(0,1.25,0)),to=pos.clone().sub(start),along=to.dot(dir);if(along<0||along>75)continue;const near=start.clone().addScaledVector(dir,along);const off=near.distanceTo(pos);if(off<.82&&along<best&&!intersectsWall(start,pos)){best=along;target=bot;}}
 const end=target?target.group.position.clone().add(new THREE.Vector3(0,1.25,0)):start.clone().addScaledVector(dir,75);addTracer(start,end,selectedOperator<10?0:1);
 if(target){target.hp-=w.damageBase*(.72+Math.random()*.55);target.group.traverse(o=>{if(o.isMesh&&o.material.color)o.material.emissive?.set('#542a20');});if(target.hp<=0)eliminate(target,operators[selectedOperator][0],selectedOperator<10?0:1);}
 if(ammo===0)beginReload();
}
function beginReload(){if(reloading||ammo>=weapons[selectedWeapon].mag||reserveAmmo<=0)return;reloading=true;reloadTime=1.35;$('reload-line').style.width='100%';$('reload-line').style.transition='width 1.35s linear';playTone(250,.06,'triangle',.015);}
function completeReload(){const amount=Math.min(weapons[selectedWeapon].mag-ammo,reserveAmmo);ammo+=amount;reserveAmmo-=amount;reloading=false;$('reload-line').style.transition='none';$('reload-line').style.width='0';updateAmmoUI();playTone(360,.07,'triangle',.018);}

function damagePlayer(amount){if(mode!=='game'||health<=0)return;health=Math.max(0,health-amount);updateAmmoUI();$('damage-flash').style.opacity=.52;setTimeout(()=>$('damage-flash').style.opacity=0,120);if(health<=0){const me=bots.find(b=>b.isPlayer);if(me)eliminate(me,'ENEMY OPERATOR',selectedOperator<10?1:0);}}
function updateBots(dt){
 const playerTeam=selectedOperator<10?0:1;
 for(const bot of bots){
  if(!bot.alive){bot.respawn-=dt;if(bot.respawn<=0){respawnBot(bot);if(bot.isPlayer){health=100;player.position.set(rand(-4,4),1.7,playerTeam===0?22:-22);updateAmmoUI();showToast('BACK IN THE FIGHT');}}continue;}
  if(bot.isPlayer)continue;
  bot.attack-=dt;bot.wander-=dt;
  const enemy=bots.filter(b=>b.alive&&b.team!==bot.team).sort((a,b)=>a.group.position.distanceToSquared(bot.group.position)-b.group.position.distanceToSquared(bot.group.position))[0];
  if(!enemy)continue;
  const from=bot.group.position,to=enemy.isPlayer?player.position.clone().setY(0):enemy.group.position.clone(),distance=from.distanceTo(to);
  const canSee=distance<32&&!intersectsWall(from.clone().add(new THREE.Vector3(0,1.3,0)),to.clone().add(new THREE.Vector3(0,1.1,0)));
  if(distance>9||!canSee){
   let destination=to.clone();if(bot.wander<=0){bot.wander=rand(1.7,4);destination.x+=rand(-7,7);destination.z+=rand(-7,7);}bot.target=destination;
   const delta=bot.target.clone().sub(from);delta.y=0;const len=delta.length();if(len>.2){delta.normalize();const speed=bot.info[1]==='SCOUT'?3.2:2.45;
    let next=from.clone().addScaledVector(delta,speed*dt);
    if(colliders.some(c=>Math.abs(next.x-c.x)<c.w/2+.5&&Math.abs(next.z-c.z)<c.d/2+.5)){const side=new THREE.Vector3(-delta.z,0,delta.x);next=from.clone().addScaledVector(side,speed*dt*(bot.id%2?1:-1));if(colliders.some(c=>Math.abs(next.x-c.x)<c.w/2+.5&&Math.abs(next.z-c.z)<c.d/2+.5))next=from.clone().addScaledVector(side,-speed*dt*(bot.id%2?1:-1));}
    bot.group.position.x=clamp(next.x,-34,34);bot.group.position.z=clamp(next.z,-34,34);bot.group.rotation.y=Math.atan2(-delta.x,-delta.z);
   }
  }else if(bot.attack<=0){
   bot.attack=rand(1.15,2.4);bot.gun.body.rotation.y=.035;setTimeout(()=>{if(bot.gun.body)bot.gun.body.rotation.y=0;},80);
   const hitChance=enemy.isPlayer?.42:.32;
   if(Math.random()<hitChance){
    const muzzle=bot.group.position.clone().add(new THREE.Vector3(0,1.28,0));const victim=enemy.isPlayer?player.position.clone():enemy.group.position.clone().add(new THREE.Vector3(0,1.2,0));addTracer(muzzle,victim,bot.team);
    if(enemy.isPlayer)damagePlayer(rand(7,12));else{enemy.hp-=rand(16,26);if(enemy.hp<=0)eliminate(enemy,bot.info[0],bot.team);}
   }
  }
  const phase=elapsed*8+bot.phase;bot.group.position.y=Math.abs(Math.sin(phase))*.035*(distance>5?1:0.15);
 }
 $('alive-blue').textContent=Math.max(0,bots.filter(b=>b.team===0&&b.alive).length);$('alive-red').textContent=Math.max(0,bots.filter(b=>b.team===1&&b.alive).length);
}
function updatePlayer(dt){
 if(mode!=='game')return;
 const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));let x=0,z=0;
 if(keys.KeyW||keys.ArrowUp)z+=1;if(keys.KeyS||keys.ArrowDown)z-=1;if(keys.KeyA||keys.ArrowLeft)x-=1;if(keys.KeyD||keys.ArrowRight)x+=1;
 x+=moveTouch.x;z+=moveTouch.y;const input=new THREE.Vector3().addScaledVector(right,x).addScaledVector(forward,z);if(input.length()>1)input.normalize();const sprint=keys.ShiftLeft||keys.ShiftRight;const speed=sprint?8.1:5.7;player.position.addScaledVector(input,speed*dt);clampPlayer();
 if(keys.Space&&grounded){velocityY=7;grounded=false;}velocityY-=20*dt;player.position.y+=velocityY*dt;if(player.position.y<=1.7){player.position.y=1.7;velocityY=0;grounded=true;}
 camera.position.set(player.position.x,player.position.y,player.position.z);camera.rotation.set(pitch,yaw,0,'YXZ');
 if(keys.Mouse0||touchFiring)firePlayer();
 if(reloading){reloadTime-=dt;if(reloadTime<=0)completeReload();}
 viewGun.position.y=-.32+Math.sin(elapsed*(sprint?16:10))*.008*(input.length()>.1?1:0);viewGun.rotation.x=-.04+Math.sin(elapsed*8)*.008*(input.length()>.1?1:0);
}
let touchFiring=false;
function onLook(dx,dy){yaw-=dx*.0023;pitch=clamp(pitch-dy*.0023,-1.3,1.3);}
canvas.addEventListener('click',()=>{if(mode==='game'&&innerWidth>700&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();});
document.addEventListener('mousemove',e=>{if(document.pointerLockElement===canvas&&mode==='game')onLook(e.movementX,e.movementY);});
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&mode==='game'){lookPointer={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}});
canvas.addEventListener('pointermove',e=>{if(lookPointer?.id===e.pointerId){const dx=e.clientX-lookPointer.x,dy=e.clientY-lookPointer.y;lookPointer.x=e.clientX;lookPointer.y=e.clientY;onLook(dx,dy);}});
canvas.addEventListener('pointerup',e=>{if(lookPointer?.id===e.pointerId)lookPointer=null;});
window.addEventListener('keydown',e=>{keys[e.code]=true;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(e.code==='Escape'){if(mode==='game')setPause(true);else if(mode==='paused')setPause(false);}if(e.code==='KeyR')beginReload();if(e.code==='Enter'&&mode==='lobby')$('deploy-btn').click();});
window.addEventListener('keyup',e=>{keys[e.code]=false;});
const touchStick=$('touch-stick'),stickKnob=touchStick.querySelector('.stick-knob');
let movePointerId=null,firePointerId=null;
function updateTouchStick(e){const r=touchStick.getBoundingClientRect(),dx=(e.clientX-(r.left+r.width/2))/(r.width*.34),dy=(e.clientY-(r.top+r.height/2))/(r.height*.34);moveTouch.x=clamp(dx,-1,1);moveTouch.y=clamp(-dy,-1,1);stickKnob.style.transform=`translate(calc(-50% + ${moveTouch.x*22}px),calc(-50% - ${moveTouch.y*22}px))`;}
function releaseTouchStick(e){if(e.pointerId!==movePointerId)return;movePointerId=null;moveTouch={x:0,y:0};stickKnob.style.transform='translate(-50%,-50%)';}
touchStick.addEventListener('pointerdown',e=>{e.preventDefault();movePointerId=e.pointerId;touchStick.setPointerCapture(e.pointerId);updateTouchStick(e);});
touchStick.addEventListener('pointermove',e=>{if(e.pointerId===movePointerId)updateTouchStick(e);});
touchStick.addEventListener('pointerup',releaseTouchStick);touchStick.addEventListener('pointercancel',releaseTouchStick);touchStick.addEventListener('lostpointercapture',releaseTouchStick);
function stopTouchFire(e){if(e.pointerId!==firePointerId)return;firePointerId=null;touchFiring=false;}
$('touch-fire').addEventListener('pointerdown',e=>{e.preventDefault();firePointerId=e.pointerId;$('touch-fire').setPointerCapture(e.pointerId);touchFiring=true;firePlayer();});
$('touch-fire').addEventListener('pointerup',stopTouchFire);$('touch-fire').addEventListener('pointercancel',stopTouchFire);$('touch-fire').addEventListener('lostpointercapture',stopTouchFire);
$('touch-reload').addEventListener('pointerdown',e=>{e.preventDefault();beginReload();});$('touch-jump').addEventListener('pointerdown',e=>{e.preventDefault();if(grounded){velocityY=7;grounded=false;}});

function showWeaponScreen(){
 $('start-screen').classList.add('hidden');$('end-screen').classList.add('hidden');$('weapon-screen').classList.remove('hidden');
}
function changeWeapon(delta){selectedWeapon=(selectedWeapon+delta+weapons.length)%weapons.length;displayWeapon();}
$('deploy-btn').addEventListener('click',showWeaponScreen);
$('match-btn').addEventListener('click',startMatch);
$('play-again').addEventListener('click',showWeaponScreen);
$('weapon-prev').addEventListener('click',()=>changeWeapon(-1));
$('weapon-next').addEventListener('click',()=>changeWeapon(1));
$('back-to-operator').addEventListener('click',()=>{$('weapon-screen').classList.add('hidden');$('start-screen').classList.remove('hidden');});
$('pause-btn').addEventListener('click',()=>{if(mode==='game')setPause(true);});
$('resume-btn').addEventListener('click',()=>setPause(false));
$('quit-btn').addEventListener('click',()=>{mode='lobby';document.exitPointerLock?.();$('pause-screen').classList.add('hidden');$('hud').classList.add('hidden');$('scoreboard').classList.add('hidden');$('crosshair').classList.add('hidden');$('start-screen').classList.remove('hidden');$('touch-controls').style.display='none';});
$('sound-btn').addEventListener('click',()=>{muted=!muted;$('sound-btn').classList.toggle('muted',muted);$('sound-btn').setAttribute('aria-label',muted?'Enable sound':'Mute sound');if(!muted)playTone(480,.08,'sine',.02);});
canvas.addEventListener('mousedown',e=>{if(e.button!==0||mode!=='game')return;keys.Mouse0=true;if(innerWidth>700&&document.pointerLockElement!==canvas)canvas.requestPointerLock?.();});
document.addEventListener('mouseup',e=>{if(e.button===0)keys.Mouse0=false;});
window.addEventListener('blur',()=>{keys={};keys.Mouse0=false;touchFiring=false;moveTouch={x:0,y:0};if(mode==='game')setPause(true);});
window.addEventListener('resize',()=>{
 const width=innerWidth,height=innerHeight;camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
 $('touch-controls').style.display=mode==='game'&&touchDevice?'block':'none';
});

const waterGeometry=scene.children.find(o=>o.userData.wave)?.geometry;
function animate(){
 requestAnimationFrame(animate);
 const dt=Math.min(clock.getDelta(),.05);elapsed+=dt;
 if(mode==='game'){
  matchTime+=dt;updatePlayer(dt);updateBots(dt);
  if(scoreBlue>=100||scoreRed>=100){/* finishMatch is scheduled by the scoring event */}
 }
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){scene.remove(p.object);p.object.geometry?.dispose();p.object.material?.dispose();particles.splice(i,1);}else if(p.object.material)p.object.material.opacity=.9*(p.life/p.max);}
 if(waterGeometry){const position=waterGeometry.attributes.position;for(let i=0;i<position.count;i++){const x=position.getX(i),z=position.getZ(i);position.setY(i,Math.sin(x*.15+z*.08+elapsed*.8)*.045+Math.cos(z*.13-x*.07+elapsed*.6)*.035);}position.needsUpdate=true;waterGeometry.computeVertexNormals();}
 for(const bird of scene.children){if(bird.userData.bird){bird.position.x+=Math.sin(elapsed*.35+bird.userData.phase)*dt*.6;bird.position.z+=Math.cos(elapsed*.28+bird.userData.phase)*dt*.45;}}
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('show');}
 if(mode==='game'||mode==='paused'){$('clock').textContent=`${String(Math.floor(matchTime/60)).padStart(2,'0')}:${String(Math.floor(matchTime%60)).padStart(2,'0')}`;}
 renderer.render(scene,camera);
 if(!$('loader').classList.contains('hidden'))$('loader').classList.add('hidden');
}
window.addEventListener('contextmenu',e=>e.preventDefault());
animate();
