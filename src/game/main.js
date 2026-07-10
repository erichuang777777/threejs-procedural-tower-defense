// Onco Defense — game bootstrap. Wires the Three.js presentation layer to
// the Three.js-agnostic simulation in game.js. See docs/GAME_DESIGN.md.
import * as THREE from 'three';
import { Game } from './game.js';
import { DOCTORS, doctorById } from './data/doctors.js';
import { CANCER_FAMILIES } from './data/enemies.js';
import { damageTypeById, DAMAGE_TYPES } from './data/damageTypes.js';
import { DEPLOY_TILES, PATH_CELLS, gridToWorld, TILE_SIZE, ENTRANCE, CORE } from './map.js';
import { getDoctorSprite, getEnemySprite } from './sprites.js';
import { SpriteAnimator } from './anim.js';
import { resolveResistance } from './combat.js';

// --- DOM refs -----------------------------------------------------------
const $ = (id) => document.getElementById(id);
const vLives = $('vLives'), vDp = $('vDp'), vWave = $('vWave'), vMdt = $('vMdt'), statMdt = $('statMdt');
const bossbar = $('bossbar'), bossName = $('bossName'), bossPhaseTeach = $('bossPhaseTeach'), bossHpFill = $('bossHpFill');
const toastLayer = $('toastLayer');
const squadbar = $('squadbar');
const inspect = $('inspect'), inspectBody = $('inspectBody'), inspectClose = $('inspectClose');
const startOverlay = $('startOverlay'), startBtn = $('startBtn');
const endOverlay = $('endOverlay'), endTitle = $('endTitle'), endBody = $('endBody'), restartBtn = $('restartBtn');

function hex(n) {
  return '#' + (n >>> 0).toString(16).padStart(6, '0');
}
function showToast(text, cls = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + cls;
  el.textContent = text;
  toastLayer.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
function hideInspect() {
  inspect.classList.add('hidden');
}
inspectClose.addEventListener('click', hideInspect);

// --- Renderer / scene / camera ------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.inset = '0';
renderer.domElement.style.zIndex = '0';
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x120a10);

let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
for (const [x, z] of PATH_CELLS) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
for (const t of DEPLOY_TILES) { minX = Math.min(minX, t.x); maxX = Math.max(maxX, t.x); minZ = Math.min(minZ, t.z); maxZ = Math.max(maxZ, t.z); }
const center = gridToWorld((minX + maxX) / 2, (minZ + maxZ) / 2);
const spanX = (maxX - minX + 4) * TILE_SIZE, spanZ = (maxZ - minZ + 4) * TILE_SIZE;
const viewSize = Math.max(spanX, spanZ) / 2;

let camera;
function buildCamera() {
  const aspect = innerWidth / innerHeight;
  camera = new THREE.OrthographicCamera(-viewSize * aspect, viewSize * aspect, viewSize, -viewSize, 0.1, 300);
  const yaw = Math.PI / 4, pitch = 1.0, dist = 60;
  camera.position.set(center.x + Math.cos(yaw) * dist * Math.cos(pitch), Math.sin(pitch) * dist, center.z + Math.sin(yaw) * dist * Math.cos(pitch));
  camera.lookAt(center.x, 0, center.z);
}
buildCamera();

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  const aspect = innerWidth / innerHeight;
  camera.left = -viewSize * aspect; camera.right = viewSize * aspect;
  camera.top = viewSize; camera.bottom = -viewSize;
  camera.updateProjectionMatrix();
});

// --- Procedural tissue floor ---------------------------------------------
function buildFloorTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#5c2024'; ctx.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 64, y = Math.random() * 64, r = Math.random() * 1.6 + 0.4;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(120,40,45,0.5)' : 'rgba(210,110,100,0.22)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set((maxX - minX + 6) / 2, (maxZ - minZ + 6) / 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const floorGeo = new THREE.PlaneGeometry(spanX + 10, spanZ + 10);
floorGeo.rotateX(-Math.PI / 2);
const floor = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial({ map: buildFloorTexture() }));
floor.position.set(center.x, -0.05, center.z);
scene.add(floor);

// --- Path (vessel) + entrance/core markers -------------------------------
function addFlatTile(x, z, size, color, opacity, y) {
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity });
  const mesh = new THREE.Mesh(geo, mat);
  const wp = gridToWorld(x, z);
  mesh.position.set(wp.x, y, wp.z);
  scene.add(mesh);
  return { mesh, mat };
}
for (const [x, z] of PATH_CELLS) addFlatTile(x, z, TILE_SIZE * 0.95, 0x8a2b2b, 0.55, 0.005);
addFlatTile(ENTRANCE[0], ENTRANCE[1], TILE_SIZE * 1.3, 0x35d08a, 0.75, 0.006);
addFlatTile(CORE[0], CORE[1], TILE_SIZE * 1.3, 0x5ab0ff, 0.75, 0.006);

// --- Deploy tile markers (interactive) -----------------------------------
const tileMeshes = new Map();
function tileKey(t) { return `${t.x},${t.z}`; }
for (const tile of DEPLOY_TILES) {
  const { mesh, mat } = addFlatTile(tile.x, tile.z, TILE_SIZE * 0.86, tile.type === 'ground' ? 0x2f6fb0 : 0xb08a2f, 0.14, 0.01);
  mesh.userData = { tile };
  tileMeshes.set(tileKey(tile), { mesh, mat, tile });
}

let selectedDoctorId = null;
function refreshTileHighlights() {
  for (const { mat, tile } of tileMeshes.values()) {
    const def = selectedDoctorId ? doctorById[selectedDoctorId] : null;
    const isValidType = def && def.deployTiles.includes(tile.type);
    const free = game.deployment.isTileFree(tile);
    if (isValidType && free) {
      mat.opacity = 0.6; mat.color.set(tile.type === 'ground' ? 0x5ab0ff : 0xffd35a);
    } else if (!free) {
      mat.opacity = 0.3; mat.color.set(0x555555);
    } else {
      mat.opacity = 0.14; mat.color.set(tile.type === 'ground' ? 0x2f6fb0 : 0xb08a2f);
    }
  }
}

// --- Billboard sprite + HP bar helpers ------------------------------------
function makeBillboard(sheet, scale) {
  const mat = new THREE.SpriteMaterial({ map: sheet.texture, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale, scale, 1);
  return sprite;
}
const barTex = (() => {
  const c = document.createElement('canvas'); c.width = 2; c.height = 2;
  c.getContext('2d').fillStyle = '#fff'; c.getContext('2d').fillRect(0, 0, 2, 2);
  return new THREE.CanvasTexture(c);
})();
function makeHpBar() {
  const bg = new THREE.Sprite(new THREE.SpriteMaterial({ map: barTex, color: 0x1a1c28, transparent: true, opacity: 0.85, depthTest: false }));
  bg.scale.set(1.1, 0.14, 1);
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ map: barTex, color: 0x35d08a, transparent: true, depthTest: false }));
  fg.scale.set(1.06, 0.09, 1);
  scene.add(bg); scene.add(fg);
  return { bg, fg };
}
function updateHpBar(bar, worldPos, hpFrac, barY, isEnemy) {
  const w = Math.max(0.0001, 1.06 * Math.max(0, Math.min(1, hpFrac)));
  bar.bg.position.set(worldPos.x, barY, worldPos.z);
  bar.fg.position.set(worldPos.x - (1.06 - w) / 2, barY + 0.001, worldPos.z);
  bar.fg.scale.x = w;
  bar.fg.material.color.set(isEnemy ? 0xe05a4e : hpFrac < 0.35 ? 0xe0a24e : 0x35d08a);
}
function disposeBar(bar) {
  if (!bar) return;
  scene.remove(bar.bg); scene.remove(bar.fg);
}

// --- Game instance ---------------------------------------------------------
const game = new Game();
const doctorViews = new Map();
const enemyViews = new Map();

// Debug/test hook — lets automated playtests and future dev tools drive the
// simulation directly instead of depending on pixel-perfect canvas raycasts.
window.__oncoDefense = { game, DEPLOY_TILES, doctorViews, enemyViews, start: () => { startOverlay.classList.add('hidden'); running = true; } };

game.on('doctorDeployed', ({ doctor }) => {
  const sheet = getDoctorSprite(doctor.def);
  const sprite = makeBillboard(sheet, 1.7);
  sprite.position.set(doctor.pos.x, 0.9, doctor.pos.z);
  sprite.userData = { kind: 'doctor', id: doctor.id };
  scene.add(sprite);
  const animator = new SpriteAnimator(sheet.states, { defaultState: 'idle' });
  doctorViews.set(doctor.id, { sprite, animator, sheet, bar: makeHpBar() });
  refreshTileHighlights();
});
function disposeDoctorView(id) {
  const v = doctorViews.get(id);
  if (!v) return;
  scene.remove(v.sprite);
  disposeBar(v.bar);
  doctorViews.delete(id);
  refreshTileHighlights();
}
game.on('doctorRetreated', ({ doctor }) => disposeDoctorView(doctor.id));
game.on('doctorDied', ({ doctor }) => { disposeDoctorView(doctor.id); showToast(`${doctor.def.name} 陣亡`, 'bad'); });

game.on('enemySpawned', ({ enemy }) => {
  const family = CANCER_FAMILIES.find((f) => f.id === enemy.familyId);
  const sheet = getEnemySprite(enemy.def, { familyColor: family?.color });
  const sprite = makeBillboard(sheet, enemy.isBoss ? 3.4 : 1.3);
  const wp = enemy.worldPosition();
  sprite.position.set(wp.x, enemy.isBoss ? 1.4 : 0.7, wp.z);
  sprite.userData = { kind: 'enemy', id: enemy.id };
  scene.add(sprite);
  const animator = new SpriteAnimator(sheet.states, { defaultState: 'move' });
  enemyViews.set(enemy.id, { sprite, animator, sheet, bar: enemy.isBoss ? null : makeHpBar(), enemy });
});
function disposeEnemyView(id) {
  const v = enemyViews.get(id);
  if (!v) return;
  scene.remove(v.sprite);
  disposeBar(v.bar);
  enemyViews.delete(id);
}

game.on('waveStart', ({ index, total }) => {
  vWave.textContent = `${Math.min(index + 1, total)}/${total}`;
  showToast(`第 ${index + 1} 波開始`);
});
game.on('synergyActivated', ({ synergy }) => {
  statMdt.classList.add('on');
  vMdt.textContent = `${synergy.name}啟動！全隊 ×2`;
  showToast(`🩺 ${synergy.name}啟動：內科＋外科＋放射腫瘤科齊聚，全隊傷害 ×2`, 'mdt');
});
game.on('synergyDeactivated', () => {
  statMdt.classList.remove('on');
  vMdt.textContent = 'MDT 未啟動';
});
game.on('bossSpawned', () => {
  bossbar.classList.remove('hidden');
  bossName.textContent = game.boss.name;
  showToast('⚠ 胃癌原發腫瘤出現！', 'phase');
});
game.on('bossPhaseChange', ({ phase }) => {
  bossPhaseTeach.textContent = phase.teach;
  showToast(`Boss 階段轉換 — ${phase.teach}`, 'phase');
});
game.on('coreHit', () => showToast('癌細胞抵達核心！生命值 -1', 'bad'));
game.on('gameOver', ({ outcome }) => {
  running = false;
  endTitle.textContent = outcome === 'win' ? '手術成功 — 病患康復' : '病患病危 — 關卡失敗';
  endBody.textContent = outcome === 'win'
    ? '你成功帶領腫瘤團隊清除了所有癌細胞，並擊敗了胃癌原發腫瘤。'
    : `病患生命徵象歸零。剩餘波次：${game.waveSpawner.totalWaves - game.waveSpawner.waveIndex}。再檢視一下抗性表，選對治療再試一次。`;
  endOverlay.classList.remove('hidden');
});

// --- Deployment error copy ---------------------------------------------
function deployErrorMessage(reason) {
  return {
    squad_full: '已達部署上限', wrong_tile: '此格不適合此醫師', tile_occupied: '此格已被佔用',
    insufficient_dp: '研究經費不足', on_cooldown: '再部署冷卻中', unknown_doctor: '未知醫師',
  }[reason] || '無法部署';
}

// --- Squad bar (deploy roster) --------------------------------------------
function renderSquadBar() {
  squadbar.innerHTML = '';
  for (const def of DOCTORS) {
    const dt = damageTypeById[def.damageType];
    const onCooldown = game.deployment.isOnCooldown(def.id);
    const hasFreeTile = def.deployTiles.some((t) => game.deployment.availableTiles(t).length > 0);
    const afford = game.deployment.canAfford(def.deployCost);
    const squadFull = game.doctors.length >= game.deployment.config.maxDeployed;
    const disabled = onCooldown || !hasFreeTile || !afford || squadFull;
    const card = document.createElement('div');
    card.className = 'docCard ' + (disabled ? 'disabled' : 'selectable') + (selectedDoctorId === def.id ? ' selected' : '');
    card.innerHTML = `<div class="swatch" style="background:${hex(dt.color)}"></div>
      <div class="name">${def.name}</div>
      <div class="cost">${onCooldown ? '冷卻中' : def.deployCost + ' DP'}</div>`;
    if (!disabled) {
      card.addEventListener('click', () => {
        selectedDoctorId = selectedDoctorId === def.id ? null : def.id;
        renderSquadBar();
        refreshTileHighlights();
      });
    }
    squadbar.appendChild(card);
  }
}

// --- Inspect panel ---------------------------------------------------------
function showEnemyInspect(enemyId) {
  const v = enemyViews.get(enemyId);
  if (!v) return;
  const e = v.enemy;
  const rows = DAMAGE_TYPES.map((dt) => {
    const mult = resolveResistance(e, dt.id);
    const cls = mult >= 3 ? 'weak' : mult <= 0.5 ? 'resist' : '';
    const label = mult >= 3 ? '弱點 ×3' : mult <= 0.5 ? '抗性 ×0.5' : '普通 ×1';
    return `<div class="resistRow"><span>${dt.name}</span><span class="${cls}">${label}</span></div>`;
  }).join('');
  inspectBody.innerHTML = `<h3>${e.name}${e.isBoss ? ' 👑' : ''}</h3>
    <div class="resistRow"><span>HP</span><span>${Math.round(e.hp)}/${e.maxHp}</span></div>
    ${rows}`;
  inspect.classList.remove('hidden');
}
function showDoctorInspect(doctorId) {
  const d = game.doctors.find((x) => x.id === doctorId);
  if (!d) return;
  const refund = Math.round(d.def.deployCost * game.deployment.config.retreatRefundRatio);
  inspectBody.innerHTML = `<h3>${d.def.name}（Lv.${d.level}）</h3>
    <div class="resistRow"><span>HP</span><span>${d.hp}/${d.maxHp}</span></div>
    <div class="resistRow"><span>攻擊力</span><span>${Math.round(d.atk)}</span></div>
    <div class="resistRow"><span>技能充能</span><span>${d.skillReady ? '就緒' : Math.round(d.skillCharge) + '/' + d.def.skill.chargeTime + 's'}</span></div>
    <button id="retreatBtn" style="margin-top:10px;width:100%;padding:8px;border-radius:6px;border:1px solid #262a3a;background:#1a1c28;color:#dfe3ee">撤退（回收 ${refund} DP）</button>`;
  inspect.classList.remove('hidden');
  $('retreatBtn').onclick = () => { game.retreat(d); hideInspect(); };
}

// --- Input: click to deploy / inspect --------------------------------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('click', (ev) => {
  mouse.x = (ev.clientX / innerWidth) * 2 - 1;
  mouse.y = -(ev.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);

  if (selectedDoctorId) {
    const tileObjs = [...tileMeshes.values()].map((t) => t.mesh);
    const hits = raycaster.intersectObjects(tileObjs);
    if (hits.length) {
      const tile = hits[0].object.userData.tile;
      const res = game.tryDeploy(selectedDoctorId, tile);
      if (res.ok) {
        selectedDoctorId = null;
        renderSquadBar();
        refreshTileHighlights();
      } else {
        showToast(deployErrorMessage(res.reason), 'bad');
      }
      return;
    }
  }

  const spriteObjs = [...doctorViews.values()].map((v) => v.sprite).concat([...enemyViews.values()].map((v) => v.sprite));
  const hits2 = raycaster.intersectObjects(spriteObjs);
  if (hits2.length) {
    const ud = hits2[0].object.userData;
    if (ud.kind === 'doctor') showDoctorInspect(ud.id);
    else showEnemyInspect(ud.id);
  } else {
    hideInspect();
  }
});

// --- Main loop ---------------------------------------------------------
let running = false;
const clock = new THREE.Clock();
let hudTimer = 0;

function syncViews(dt) {
  for (const doctor of game.doctors) {
    const v = doctorViews.get(doctor.id);
    if (!v) continue;
    v.animator.play(doctor.animState);
    v.animator.update(dt);
    if (v.animator.isDone) { v.animator.play('idle'); doctor.animState = 'idle'; }
    v.sheet.texture.offset.x = v.animator.frameIndex / v.sheet.cols;
    v.sprite.position.set(doctor.pos.x, 0.9, doctor.pos.z);
    updateHpBar(v.bar, doctor.pos, doctor.hp / doctor.maxHp, 1.9, false);
  }

  const currentIds = new Set();
  for (const enemy of game.enemies) {
    currentIds.add(enemy.id);
    const v = enemyViews.get(enemy.id);
    if (!v) continue;
    v.animator.play(enemy.animState);
    v.animator.update(dt);
    if (v.animator.isDone) {
      if (enemy.alive && enemy.blockedBy) { v.animator.play('attack', { restart: true }); enemy.animState = 'attack'; }
      else if (enemy.alive) { v.animator.play('move'); enemy.animState = 'move'; }
    }
    v.sheet.texture.offset.x = v.animator.frameIndex / v.sheet.cols;
    const wp = enemy.worldPosition();
    v.sprite.position.set(wp.x, enemy.isBoss ? 1.4 : 0.7, wp.z);
    if (v.bar) updateHpBar(v.bar, wp, enemy.hp / enemy.maxHp, enemy.isBoss ? 2.8 : 1.3, true);
    if (enemy.isBoss) bossHpFill.style.width = Math.max(0, (enemy.hp / enemy.maxHp) * 100) + '%';
  }
  for (const [id] of enemyViews) if (!currentIds.has(id)) disposeEnemyView(id);
}

function refreshHud() {
  vLives.textContent = Math.round(game.lives);
  vDp.textContent = Math.floor(game.deployment.dp);
  renderSquadBar();
  refreshTileHighlights();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  if (running) {
    game.update(dt);
    syncViews(dt);
    hudTimer += dt;
    if (hudTimer > 0.2) { hudTimer = 0; refreshHud(); }
  }
  renderer.render(scene, camera);
}
animate();

startBtn.addEventListener('click', () => {
  startOverlay.classList.add('hidden');
  running = true;
  clock.getDelta();
  refreshHud();
});
restartBtn.addEventListener('click', () => location.reload());
