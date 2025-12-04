// Retro Clicker - simple clicker with upgrades and autos
const scoreEl = document.getElementById('score')
const clicker = document.getElementById('clicker')
const perClickEl = document.getElementById('perClick')
const autoRateEl = document.getElementById('autoRate')
const upgradesEl = document.getElementById('upgrades')
const saveBtn = document.getElementById('saveBtn')
const resetBtn = document.getElementById('resetBtn')

const SAVE_KEY = 'neon-clicker-v1'

let state = {
  score: 0,
  perClick: 1,
  autos: 0,
  upgrades: {
    clickPowerLevel: 0, // increases perClick
    autoLevel: 0 // increases autos
  }
}

const shopItems = [
  {
    id: 'clickPower',
    name: 'Click Power',
    description: 'Increase points per click by 1',
    baseCost: 10,
    buy() {
      state.upgrades.clickPowerLevel++
      state.perClick = 1 + state.upgrades.clickPowerLevel
    },
    cost() { return Math.floor(this.baseCost * Math.pow(1.7, state.upgrades.clickPowerLevel)) }
  },
  {
    id: 'autoClicker',
    name: 'Auto Clicker',
    description: 'Adds 1 auto click per second',
    baseCost: 50,
    buy() {
      state.upgrades.autoLevel++
      state.autos = state.upgrades.autoLevel
    },
    cost() { return Math.floor(this.baseCost * Math.pow(1.6, state.upgrades.autoLevel)) }
  },
  {
    id: 'multiplier',
    name: 'Multiplier',
    description: 'Double your click power',
    baseCost: 400,
    bought: false,
    buy() {
      if (!this.bought) {
        state.perClick *= 2
        this.bought = true
      }
    },
    cost() { return this.bought ? Infinity : this.baseCost }
  }
]

function format(n){ return n.toLocaleString() }

function render() {
  scoreEl.textContent = format(Math.floor(state.score))
  perClickEl.textContent = format(state.perClick)
  autoRateEl.textContent = format(state.autos)

  // upgrades
  upgradesEl.innerHTML = ''
  shopItems.forEach(item => {
    const card = document.createElement('div')
    card.className = 'upgrade'
    const meta = document.createElement('div')
    meta.className = 'meta'
    const title = document.createElement('div')
    title.textContent = item.name
    const desc = document.createElement('div')
    desc.style.opacity = '0.9'
    desc.style.fontSize = '12px'
    desc.textContent = item.description
    meta.appendChild(title)
    meta.appendChild(desc)

    const right = document.createElement('div')
    right.style.display = 'flex'
    right.style.flexDirection = 'column'
    right.style.alignItems = 'flex-end'
    const cost = document.createElement('div')
    const c = item.cost()
    cost.textContent = c === Infinity ? 'SOLD' : format(c)
    cost.style.fontSize = '12px'
    const btn = document.createElement('button')
    btn.textContent = c === Infinity ? '—' : 'BUY'
    btn.disabled = c === Infinity || state.score < c
    btn.onclick = ()=>{
      if (state.score >= c && c !== Infinity) {
        state.score -= c
        item.buy()
        save()
        render()
      }
    }
    right.appendChild(cost)
    right.appendChild(btn)

    card.appendChild(meta)
    card.appendChild(right)
    upgradesEl.appendChild(card)
  })
}

clicker.addEventListener('click', ()=>{
  state.score += state.perClick
  // quick pop animation
  clicker.animate([
    { transform: 'scale(1)' },
    { transform: 'scale(1.06)' },
    { transform: 'scale(1)' }
  ], { duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' })
  render()
})

// autos tick
setInterval(()=>{
  if (state.autos > 0) {
    state.score += state.autos
    render()
  }
}, 1000)

// save/load
function save(){
  localStorage.setItem(SAVE_KEY, JSON.stringify(state))
}
function load(){
  const raw = localStorage.getItem(SAVE_KEY)
  if (raw) {
    try {
      const s = JSON.parse(raw)
      // basic merge to avoid missing fields
      state = Object.assign(state, s)
    } catch(e){ console.warn('Failed to load save', e) }
  }
  // ensure derived values consistent
  state.perClick = 1 + (state.upgrades.clickPowerLevel || 0)
  state.autos = state.upgrades.autoLevel || 0
}

saveBtn.addEventListener('click', ()=>{ save(); flash('Saved') })
resetBtn.addEventListener('click', ()=>{
  if (confirm('Reset your progress?')){
    localStorage.removeItem(SAVE_KEY)
    state = { score:0, perClick:1, autos:0, upgrades:{clickPowerLevel:0, autoLevel:0} }
    // reset bought flags
    shopItems.forEach(i=>{ if (i.id==='multiplier') i.bought=false })
    render(); flash('Reset')
  }
})

function flash(text){
  const el = document.createElement('div')
  el.textContent = text
  el.style.position = 'fixed'
  el.style.right = '20px'
  el.style.bottom = '20px'
  el.style.padding = '10px 14px'
  el.style.background = 'rgba(0,0,0,0.6)'
  el.style.border = '1px solid rgba(255,255,255,0.04)'
  el.style.borderRadius = '8px'
  el.style.color = '#e6f7ff'
  document.body.appendChild(el)
  setTimeout(()=>{ el.style.transition='opacity .4s'; el.style.opacity=0 },900)
  setTimeout(()=>document.body.removeChild(el),1400)
}

// initial load
load(); render();

// autosave every 10s
setInterval(save, 10000)
