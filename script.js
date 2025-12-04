// Space Company - simplified idle game with achievements and upgrade hub
const SAVE_KEY = 'space-company-v1'

// DOM
const creditsEl = document.getElementById('credits')
const metalEl = document.getElementById('metal')
const fuelEl = document.getElementById('fuel')
const partsEl = document.getElementById('parts')
const researchEl = document.getElementById('research')
const buildingListEl = document.getElementById('buildingList')
const upgradeHubEl = document.getElementById('upgradeHub')
const achievementsEl = document.getElementById('achievements')
const logArea = document.getElementById('logArea')

const launchBtn = document.getElementById('launchBtn')
const collectBtn = document.getElementById('collectBtn')
const autoToggle = document.getElementById('autoToggle')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')

// Game state
let state = {
  credits: 50,
  metal: 0,
  fuel: 0,
  parts: 0,
  research: 0,
  totalCreditsEarned: 50,
  missionsLaunched: 0,
  tickRate: 1,
  automation: false,
  buildings: {
    mine: 0,
    refinery: 0,
    factory: 0,
    launchpad: 0
  },
  upgrades: {},
  achievements: {}
}

// Building definitions
const buildings = {
  mine: { name:'Mine', baseCost: 15, costScale:1.15, produces:{metal:1}, desc:'Produces Metal per tick.' },
  refinery: { name:'Refinery', baseCost: 80, costScale:1.17, produces:{fuel:0.5}, desc:'Refines Fuel from Metal.' },
  factory: { name:'Factory', baseCost: 300, costScale:1.2, produces:{parts:0.2}, desc:'Assembles Parts from Metal and Fuel.' },
  launchpad: { name:'Launchpad', baseCost: 1200, costScale:1.25, produces:{}, desc:'Enables launches; increases launch capacity.' }
}

// Upgrades in the hub (bought with research points)
const hubUpgrades = [
  { id:'prodBoost', name:'Production Boost', desc:'+20% production for all buildings', cost:5, apply(s){ s.upgrades.prodBoost=(s.upgrades.prodBoost||0)+1 } },
  { id:'costEff', name:'Cost Efficiency', desc:'-10% building cost (multiplicative)', cost:8, apply(s){ s.upgrades.costEff=(s.upgrades.costEff||0)+1 } },
  { id:'autoLaunch', name:'Auto Launch', desc:'Automatically launches missions when affordable', cost:12, apply(s){ s.upgrades.autoLaunch=true } }
]

// Achievements
const achievements = [
  { id:'firstCredits', name:'First Credits', desc:'Earn 100 credits', check: s => s.totalCreditsEarned >= 100, reward: ()=>({credits:50}) },
  { id:'bigBank', name:'Big Bank', desc:'Earn 10,000 credits', check: s => s.totalCreditsEarned >= 10000, reward: ()=>({research:10}) },
  { id:'builder', name:'Builder', desc:'Own 10 Mines', check: s => s.buildings.mine >= 10, reward: ()=>({credits:200}) },
  { id:'launcher', name:'Launcher', desc:'Launch 10 missions', check: s => s.missionsLaunched >= 10, reward: ()=>({research:5}) }
]

function log(msg){
  const el = document.createElement('div')
  el.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`
  logArea.prepend(el)
}

function format(n){ return Number(n).toLocaleString(undefined, {maximumFractionDigits:2}) }

// cost calculation
function buildingCost(key, amount=1){
  const b = buildings[key]
  const owned = state.buildings[key]
  const base = b.baseCost * Math.pow(b.costScale, owned)
  return Math.floor(base * amount)
}

// buy building
function buyBuilding(key){
  const cost = buildingCost(key)
  if (state.credits >= cost){
    state.credits -= cost
    state.buildings[key]++
    log(`Bought ${buildings[key].name} for ${cost} credits`)
    render()
    save()
  } else {
    log('Not enough credits')
  }
}

// production tick
function tick(){
  // production multipliers
  let prodMult = 1
  if (state.upgrades.prodBoost) prodMult *= 1 + 0.2 * state.upgrades.prodBoost

  // generate from buildings
  const mineOut = state.buildings.mine * (buildings.mine.produces.metal * prodMult)
  state.metal += mineOut

  const refineryCount = state.buildings.refinery
  const fuelFromRefinery = refineryCount * (buildings.refinery.produces.fuel * prodMult)
  // consume metal for refinery to produce fuel
  const metalNeeded = refineryCount * 0.8
  const actualMetal = Math.min(state.metal, metalNeeded)
  if (actualMetal>0){
    state.metal -= actualMetal
    state.fuel += fuelFromRefinery * (actualMetal/metalNeeded)
  }

  // factories consume metal and fuel to produce parts
  const fac = state.buildings.factory
  const metalNeededFac = fac * 0.5
  const fuelNeededFac = fac * 0.3
  const availableFactor = Math.min(state.metal/Math.max(1e-9, metalNeededFac||1), state.fuel/Math.max(1e-9, fuelNeededFac||1), 1)
  if (fac>0 && availableFactor>0){
    const usedMetal = metalNeededFac * availableFactor
    const usedFuel = fuelNeededFac * availableFactor
    state.metal -= usedMetal
    state.fuel -= usedFuel
    state.parts += fac * (buildings.factory.produces.parts * prodMult) * availableFactor
  }

  // passive credits from parts stored
  const creditFromParts = Math.floor(state.parts * 0.02)
  if (creditFromParts>0){ state.credits += creditFromParts; state.totalCreditsEarned += creditFromParts; state.parts -= creditFromParts }

  // automation: build cheapest if enabled
  if (state.automation){
    for (const k of Object.keys(buildings)){
      const c = buildingCost(k)
      if (state.credits >= c){ buyBuilding(k); break }
    }
  }

  // check achievements
  checkAchievements()

  render()
}

// Launch missions: cost in parts+fuel, reward credits + research
function launchMission(){
  const partsCost = 10 + state.buildings.launchpad * 5
  const fuelCost = 8 + state.buildings.launchpad * 4
  if (state.parts >= partsCost && state.fuel >= fuelCost){
    state.parts -= partsCost
    state.fuel -= fuelCost
    const reward = Math.floor(200 + Math.random()*300 + state.buildings.launchpad*50)
    const researchGain = Math.floor(2 + Math.random()*5)
    state.credits += reward
    state.research += researchGain
    state.totalCreditsEarned += reward
    state.missionsLaunched++
    log(`Launch success! +${reward} credits, +${researchGain} research`)
    checkAchievements()
    render(); save()
  } else {
    log('Not enough Parts or Fuel to launch')
  }
}

// collect all (move small stores to credits)
function collectAll(){
  const c = Math.floor(state.metal*0.01 + state.fuel*0.01 + state.parts*0.02)
  if (c>0){ state.credits += c; state.totalCreditsEarned += c; state.metal*=0.99; state.fuel*=0.99; state.parts*=0.98; log(`Collected ${c} credits from resources`) }
  render(); save()
}

// hub upgrades purchase with research points
function buyHubUpgrade(id){
  const u = hubUpgrades.find(x=>x.id===id)
  if (!u) return
  if (state.research >= u.cost){
    state.research -= u.cost
    u.apply(state)
    log(`Purchased upgrade: ${u.name}`)
    render(); save()
  } else log('Not enough research')
}

// achievements
function checkAchievements(){
  achievements.forEach(a => {
    if (!state.achievements[a.id] && a.check(state)){
      state.achievements[a.id] = true
      const rew = a.reward(state)
      if (rew){ Object.keys(rew).forEach(k=> state[k] = (state[k]||0) + rew[k]) }
      log(`Achievement unlocked: ${a.name}`)
    }
  })
}

// rendering lists
function renderBuildings(){
  buildingListEl.innerHTML = ''
  Object.keys(buildings).forEach(k=>{
    const b = buildings[k]
    const div = document.createElement('div'); div.className='building'
    const meta = document.createElement('div'); meta.className='meta'
    meta.innerHTML = `<div><strong>${b.name}</strong></div><div style="font-size:12px;opacity:.9">${b.desc}</div><div style="font-size:12px;opacity:.9">Owned: ${state.buildings[k]}</div>`
    const right = document.createElement('div'); right.style.display='flex'; right.style.flexDirection='column'; right.style.alignItems='flex-end'
    const cost = document.createElement('div'); cost.textContent = `${buildingCost(k)} cr`;
    cost.style.fontSize='12px'
    const btn = document.createElement('button'); btn.textContent='BUY'; btn.onclick = ()=> buyBuilding(k)
    right.appendChild(cost); right.appendChild(btn)
    div.appendChild(meta); div.appendChild(right)
    buildingListEl.appendChild(div)
  })
}

function renderHub(){
  upgradeHubEl.innerHTML = ''
  hubUpgrades.forEach(u=>{
    const div = document.createElement('div'); div.className='upgrade'
    const meta = document.createElement('div'); meta.className='meta'
    meta.innerHTML = `<div><strong>${u.name}</strong></div><div style="font-size:12px;opacity:.9">${u.desc}</div>`
    const right = document.createElement('div'); right.style.display='flex'; right.style.flexDirection='column'; right.style.alignItems='flex-end'
    const cost = document.createElement('div'); cost.textContent = `${u.cost} RP`; cost.style.fontSize='12px'
    const btn = document.createElement('button'); btn.textContent='BUY'; btn.onclick = ()=> buyHubUpgrade(u.id)
    btn.disabled = state.research < u.cost
    right.appendChild(cost); right.appendChild(btn)
    div.appendChild(meta); div.appendChild(right)
    upgradeHubEl.appendChild(div)
  })
}

function renderAchievements(){
  achievementsEl.innerHTML = ''
  achievements.forEach(a=>{
    const div = document.createElement('div'); div.className='achievement'
    const meta = document.createElement('div'); meta.innerHTML = `<strong>${a.name}</strong><div style="font-size:12px;opacity:.9">${a.desc}</div>`
    const status = document.createElement('div'); status.textContent = state.achievements[a.id] ? 'UNLOCKED' : (a.check(state)? 'READY':'LOCKED'); status.style.fontSize='12px'
    div.appendChild(meta); div.appendChild(status)
    achievementsEl.appendChild(div)
  })
}

function renderResources(){
  creditsEl.textContent = format(state.credits)
  metalEl.textContent = format(state.metal)
  fuelEl.textContent = format(state.fuel)
  partsEl.textContent = format(state.parts)
  researchEl.textContent = format(state.research)
}

function render(){ renderResources(); renderBuildings(); renderHub(); renderAchievements() }

// save/load
function save(){ localStorage.setItem(SAVE_KEY, JSON.stringify(state)) }
function load(){ const raw = localStorage.getItem(SAVE_KEY); if (raw) try{ state = Object.assign(state, JSON.parse(raw)) }catch(e){ console.warn('load fail', e) } }

// UI bindings
launchBtn.addEventListener('click', launchMission)
collectBtn.addEventListener('click', collectAll)
autoToggle.addEventListener('click', ()=>{ state.automation = !state.automation; log(`Automation ${state.automation?'enabled':'disabled'}`); render(); save() })
saveBtn.addEventListener('click', ()=>{ save(); log('Saved') })
resetBtn.addEventListener('click', ()=>{ if (confirm('Reset game?')){ localStorage.removeItem(SAVE_KEY); location.reload() } })

// auto launch if upgrade present
function maybeAutoLaunch(){ if (state.upgrades.autoLaunch){ launchMission() } }

// main loop
load(); render();
setInterval(()=>{ tick(); maybeAutoLaunch() }, 1000)
setInterval(save, 10000)

log('Game loaded. Welcome to Space Company!')
