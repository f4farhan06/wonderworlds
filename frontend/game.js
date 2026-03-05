// ============================================================
//  Wonder Worlds — game.js
//  All game logic: config, state, API, UI, questions, scoring
//
//  SECTIONS (use Ctrl+F to jump):
//  ⚙️  CONFIG          — API URL, admin PIN, free worlds
//  🌍  WORLD INFO      — display names, colours, CSS classes
//  📚  QUESTION BANK   — built-in fallback questions
//  💾  STATE           — all runtime variables
//  🌐  API             — fetch helper + health check
//  🔧  UTILS           — showScreen, toast, helpers
//  👑  ADMIN           — PIN modal, activate/deactivate
//  👤  SETUP           — player name, age, avatar
//  🎮  WORLDS GRID     — load & render world tiles
//  🏁  LEVELS          — level selection screen
//  ❓  QUESTIONS       — fetch from API or fallback bank
//  ▶️  GAME LOOP       — start level, render Q, check answer
//  🏆  RESULTS         — end game, scores, stars
//  📋  REVIEW          — answer-by-answer breakdown
//  📊  LEADERBOARD     — save, render, clear
//  ✏️  CUSTOM EDITOR   — admin world builder
//  🎊  CONFETTI        — celebration animation
// ============================================================

'use strict';
// ═══════════════════════════════════════════════
//  ⚙️  CONFIG — edit these values
// ═══════════════════════════════════════════════
const API_URL   = 'http://localhost:4000/api';   // Change for production
const ADMIN_PIN = '1234';                         // Change to your PIN
const FREE_WORLDS = new Set(['math','science','quiz']);

// ─── Static world display info (used as fallback if API offline) ───
const W_INFO = {
  math:    {name:'Math World',       emoji:'🔢',color:'#FF6B6B',cls:'world-math'},
  science: {name:'Science Lab',      emoji:'🔬',color:'#4ECDC4',cls:'world-science'},
  quiz:    {name:'Quiz Zone',        emoji:'🧩',color:'#A855F7',cls:'world-quiz'},
  gk:      {name:'General Knowledge',emoji:'🌐',color:'#F59E0B',cls:'world-gk'},
  reading: {name:'Reading Quest',    emoji:'📚',color:'#3B82F6',cls:'world-reading'},
  writing: {name:'Writing Studio',   emoji:'✏️', color:'#10B981',cls:'world-writing'},
  custom:  {name:'My Custom World',  emoji:'⭐',color:'#EC4899',cls:'world-custom'},
};

// ─── Built-in question bank (fallback when API offline) ───
const QB = {
  math:{
    easy:[
      {q:'5 + 3 = ?',opts:['6','7','8','9'],ans:2},{q:'10 - 4 = ?',opts:['5','6','7','8'],ans:1},
      {q:'Sides of a triangle?',opts:['2','3','4','5'],ans:1},{q:'2 × 5 = ?',opts:['8','9','10','11'],ans:2},
      {q:'Half of 12?',opts:['4','5','6','7'],ans:2},{q:'9 - 3 = ?',opts:['4','5','6','7'],ans:2},
      {q:'4 + 4 = ?',opts:['6','7','8','9'],ans:2},{q:'After 19 comes?',opts:['18','20','21','17'],ans:1},
      {q:'3 × 3 = ?',opts:['6','7','9','8'],ans:2},{q:'7 × 1 = ?',opts:['1','7','8','14'],ans:1},
      {q:'Sides of a square?',opts:['3','4','5','6'],ans:1},{q:'20 ÷ 4 = ?',opts:['3','4','5','6'],ans:2},
      {q:'6 + 7 = ?',opts:['11','12','13','14'],ans:2},{q:'Minutes in an hour?',opts:['30','45','60','100'],ans:2},
      {q:'15 - 9 = ?',opts:['4','5','6','7'],ans:2},
    ],
    medium:[
      {q:'12 × 7 = ?',opts:['74','82','84','76'],ans:2},{q:'144 ÷ 12 = ?',opts:['10','11','12','13'],ans:2},
      {q:'25% of 80?',opts:['15','20','25','30'],ans:1},{q:'√64 = ?',opts:['6','7','8','9'],ans:2},
      {q:'3³ = ?',opts:['9','18','27','36'],ans:2},{q:'2x = 18, x = ?',opts:['7','8','9','10'],ans:2},
      {q:'Degrees in right angle?',opts:['45°','90°','120°','180°'],ans:1},{q:'0.5 × 0.5 = ?',opts:['0.1','0.25','0.5','1'],ans:1},
      {q:'15% of 200?',opts:['20','25','30','35'],ans:2},{q:'Average of 4,8,12?',opts:['6','7','8','9'],ans:2},
      {q:'2⁵ = ?',opts:['10','16','32','64'],ans:2},{q:'8 × 9 = ?',opts:['63','72','81','64'],ans:1},
    ],
    hard:[
      {q:'x² - 9 = 0, x = ?',opts:['x=3 only','x=-3 only','x=±3','x=±9'],ans:2},
      {q:'Angles in a pentagon?',opts:['360°','450°','540°','720°'],ans:2},
      {q:'240 km in 3 hrs — speed?',opts:['70 km/h','80 km/h','90 km/h','100 km/h'],ans:1},
      {q:'LCM of 12 and 18?',opts:['24','36','54','72'],ans:1},
      {q:'5x + 3 = 28, x = ?',opts:['4','5','6','7'],ans:1},
      {q:'Volume of cube side 5?',opts:['25','75','100','125'],ans:3},
      {q:'P(rolling 6 on die)?',opts:['1/3','1/4','1/5','1/6'],ans:3},
      {q:'Hypotenuse of 3 & 4?',opts:['4','5','6','7'],ans:1},
    ],
    expert:[
      {q:'Derivative of x³?',opts:['x²','2x²','3x²','3x'],ans:2},
      {q:'log₁₀(1000) = ?',opts:['2','3','4','10'],ans:1},
      {q:'sin(90°) = ?',opts:['0','0.5','1','√2/2'],ans:2},
      {q:'x² + 5x + 6 = 0 → x?',opts:['x=-2,-3','x=2,3','x=-2,3','x=2,-3'],ans:0},
      {q:'∫2x dx = ?',opts:['x','x²','x² + C','2x² + C'],ans:2},
    ]
  },
  science:{
    easy:[
      {q:'Plants need ___ to make food.',opts:['Moonlight','Sunlight','Darkness','Rain only'],ans:1},
      {q:'Insect leg count?',opts:['4','6','8','10'],ans:1},
      {q:'Ice is which state?',opts:['Gas','Liquid','Solid','Plasma'],ans:2},
      {q:'Largest planet?',opts:['Earth','Mars','Jupiter','Saturn'],ans:2},
      {q:'Most of Earth\'s surface?',opts:['Land','Ice','Water','Rocks'],ans:2},
      {q:'Which is a mammal?',opts:['Shark','Eagle','Dolphin','Frog'],ans:2},
      {q:'Center of solar system?',opts:['Moon','Earth','Mars','Sun'],ans:3},
      {q:'We breathe ___ to survive.',opts:['CO₂','Nitrogen','Oxygen','Hydrogen'],ans:2},
      {q:'Sense organ for smell?',opts:['Eyes','Ears','Nose','Tongue'],ans:2},
      {q:'Baby frogs called?',opts:['Larvae','Tadpoles','Juveniles','Hatchlings'],ans:1},
      {q:'Moon orbits the?',opts:['Sun','Jupiter','Earth','Mars'],ans:2},
      {q:'The Red Planet?',opts:['Venus','Jupiter','Mars','Saturn'],ans:2},
    ],
    medium:[
      {q:'Powerhouse of the cell?',opts:['Nucleus','Ribosome','Mitochondria','Vacuole'],ans:2},
      {q:'Chemical symbol for water?',opts:['WA','HO','H₂O','W₂O'],ans:2},
      {q:'Speed of light?',opts:['300 km/s','3,000 km/s','300,000 km/s','3,000,000 km/s'],ans:2},
      {q:'Force keeping planets in orbit?',opts:['Magnetism','Gravity','Friction','Electricity'],ans:1},
      {q:'DNA stands for?',opts:['Deoxyribonucleic Acid','Digital Nucleic Acid','Dual Nitrogen Acid','Dense Nuclear Atom'],ans:0},
      {q:'Human chromosome count?',opts:['23','44','46','48'],ans:2},
      {q:'Blood-filtering organ?',opts:['Liver','Lungs','Kidneys','Heart'],ans:2},
      {q:'Hardest body tissue?',opts:['Bone','Cartilage','Tooth enamel','Muscle'],ans:2},
    ],
    hard:[
      {q:'pH of pure water?',opts:['5','6','7','8'],ans:2},
      {q:'Particle with no charge?',opts:['Proton','Electron','Neutron','Quark'],ans:2},
      {q:'Newton\'s 2nd Law: F = ?',opts:['mv','ma','m/a','m+a'],ans:1},
      {q:'Avogadro\'s number?',opts:['6.02×10²¹','6.02×10²³','6.02×10²⁵','6.02×10²⁷'],ans:1},
      {q:'Symbol \'Au\' = ?',opts:['Silver','Aluminum','Gold','Argon'],ans:2},
    ],
    expert:[
      {q:'Heisenberg Uncertainty Principle?',opts:['Energy conserved','Position & momentum can\'t both be exact','Light is constant','Entropy increases'],ans:1},
      {q:'CRISPR-Cas9 used for?',opts:['Protein synthesis','Gene editing','Cell imaging','Drug delivery'],ans:1},
      {q:'E=mc²?',opts:['E=mass×velocity','E=mass×c²','Everything is relative','Energy≠mass'],ans:1},
    ]
  },
  quiz:{
    easy:[
      {q:'Days in a week?',opts:['5','6','7','8'],ans:2},{q:'Tallest animal?',opts:['Elephant','Horse','Giraffe','Camel'],ans:2},
      {q:'Colors in a rainbow?',opts:['5','6','7','8'],ans:2},{q:'Baby dog?',opts:['Kitten','Cub','Puppy','Foal'],ans:2},
      {q:'Fingers on two hands?',opts:['8','9','10','11'],ans:2},{q:'Fastest land animal?',opts:['Lion','Horse','Cheetah','Leopard'],ans:2},
      {q:'A dozen = how many?',opts:['10','11','12','13'],ans:2},{q:'Yellow + Blue = ?',opts:['Orange','Purple','Green','Brown'],ans:2},
      {q:'Days in a year?',opts:['354','365','366','360'],ans:1},
    ],
    medium:[
      {q:'Who painted Mona Lisa?',opts:['Van Gogh','Picasso','Da Vinci','Michelangelo'],ans:2},
      {q:'Largest ocean?',opts:['Atlantic','Indian','Arctic','Pacific'],ans:3},
      {q:'Guitar strings (standard)?',opts:['4','5','6','7'],ans:2},
      {q:'Wimbledon sport?',opts:['Golf','Cricket','Tennis','Football'],ans:2},
      {q:'Japan\'s currency?',opts:['Yuan','Won','Yen','Rupee'],ans:2},
      {q:'Planets in our solar system?',opts:['7','8','9','10'],ans:1},
      {q:'Smallest country?',opts:['Monaco','San Marino','Vatican City','Nauru'],ans:2},
      {q:'WW2 ended in?',opts:['1943','1944','1945','1946'],ans:2},
    ],
    hard:[
      {q:'Theory of evolution?',opts:['Newton','Darwin','Einstein','Hawking'],ans:1},
      {q:'Longest river?',opts:['Amazon','Congo','Nile','Mississippi'],ans:2},
      {q:'Salt chemical formula?',opts:['NaCl','KCl','CaCO₃','MgSO₄'],ans:0},
      {q:'First man on the moon?',opts:['Buzz Aldrin','Neil Armstrong','Yuri Gagarin','John Glenn'],ans:1},
      {q:'Bones in human body?',opts:['196','206','216','226'],ans:1},
    ],
    expert:[
      {q:'\'Cogito ergo sum\' means?',opts:['I think therefore I am','To be or not to be','Knowledge is power','I came I saw I conquered'],ans:0},
      {q:'Mandelbrot set is a type of?',opts:['Fractal','Music concept','Physics law','Chemical compound'],ans:0},
      {q:'\'The Republic\' author?',opts:['Aristotle','Socrates','Plato','Descartes'],ans:2},
    ]
  },
  gk:{
    easy:[{q:'Capital of France?',opts:['London','Berlin','Paris','Rome'],ans:2},{q:'Continents on Earth?',opts:['5','6','7','8'],ans:2},{q:'Biggest ocean?',opts:['Atlantic','Indian','Arctic','Pacific'],ans:3},{q:'Capital of USA?',opts:['New York','Los Angeles','Washington D.C.','Chicago'],ans:2},{q:'Hours in a day?',opts:['12','20','24','48'],ans:2},{q:'Biggest country by area?',opts:['USA','China','Canada','Russia'],ans:3}],
    medium:[{q:'Tallest mountain?',opts:['K2','Kilimanjaro','Everest','Aconcagua'],ans:2},{q:'Who invented telephone?',opts:['Edison','Tesla','Bell','Marconi'],ans:2},{q:'Capital of Australia?',opts:['Sydney','Melbourne','Brisbane','Canberra'],ans:3},{q:'Olympics every ___ years?',opts:['2','3','4','5'],ans:2},{q:'National animal of India?',opts:['Lion','Tiger','Elephant','Peacock'],ans:1}],
    hard:[{q:'Deepest lake?',opts:['Lake Superior','Caspian Sea','Lake Baikal','Lake Tanganyika'],ans:2},{q:'Berlin Wall fell in?',opts:['1985','1987','1989','1991'],ans:2},{q:'Longest bone?',opts:['Spine','Humerus','Femur','Tibia'],ans:2},{q:'Country with most time zones?',opts:['USA','Russia','China','France'],ans:3}],
    expert:[{q:'First artificial satellite?',opts:['Explorer 1','Sputnik 1','Vostok 1','Apollo 1'],ans:1},{q:'Machu Picchu is in?',opts:['Brazil','Colombia','Peru','Ecuador'],ans:2},{q:'Chemical symbol for iron?',opts:['Ir','In','Fe','Fi'],ans:2}]
  },
  reading:{
    easy:[
      {passage:'Tom has a red ball. He loves to play with it in the park.',q:'What color is Tom\'s ball?',opts:['Blue','Red','Green','Yellow'],ans:1},
      {passage:'Sara loves elephants because they are big and smart.',q:'Sara\'s favourite animal?',opts:['Lion','Elephant','Tiger','Giraffe'],ans:1},
      {passage:'Jack waters his seeds every day. After two weeks, little plants grow.',q:'How often does Jack water?',opts:['Once a week','Twice a day','Every day','Never'],ans:2},
      {passage:'Ben studies every day because he wants to be a doctor.',q:'What does Ben want to be?',opts:['Teacher','Engineer','Doctor','Pilot'],ans:2},
    ],
    medium:[
      {passage:'The Amazon rainforest covers most of the Amazon basin in South America and is home to millions of species.',q:'Where is the Amazon rainforest?',opts:['Africa','North America','South America','Australia'],ans:2},
      {passage:'Marie Curie won the Nobel Prize twice — Physics (1903) and Chemistry (1911).',q:'How many Nobel Prizes did she win?',opts:['1','2','3','4'],ans:1},
      {passage:'The water cycle: water evaporates, rises into the atmosphere, condenses into clouds, then falls as rain.',q:'What happens after water evaporates?',opts:['It disappears','It rises into the atmosphere','It falls immediately','It turns to ice'],ans:1},
    ],
    hard:[
      {passage:'AI is categorised as narrow (weak) or general (strong), with applications in medicine, finance and education.',q:'AI can be categorised into how many types?',opts:['1','2','3','4'],ans:1},
      {passage:'Quantum computers use qubits that can represent multiple states at once, unlike classical bits.',q:'What do quantum computers use instead of bits?',opts:['Bytes','Atoms','Qubits','Pixels'],ans:2},
    ],
    expert:[
      {passage:'Epigenetics studies heritable changes in gene expression that do not change the DNA sequence.',q:'What makes epigenetic changes unique?',opts:['They alter DNA','Inherited without changing DNA','Always permanent','Only in aging'],ans:1},
      {passage:'The Nash Equilibrium: no player can improve their outcome by unilaterally changing their strategy.',q:'A player who changes strategy alone in Nash Equilibrium?',opts:['Always gains','Always loses','Cannot improve outcome','Forces others to change'],ans:2},
    ]
  },
  writing:{
    easy:[{q:'Correctly spelled?',opts:['freind','becaus','beautiful','tomorro'],ans:2},{q:'Punctuation ending a question?',opts:['.','!','?',','],ans:2},{q:'Noun in "The happy dog runs fast"?',opts:['happy','dog','runs','fast'],ans:1},{q:'A sentence starts with?',opts:['lowercase','number','capital letter','punctuation'],ans:2},{q:'Plural of "child"?',opts:['Childs','Childes','Childrens','Children'],ans:3}],
    medium:[{q:'A metaphor is?',opts:['Comparison using like/as','Direct comparison without like/as','Exaggeration','A sound word'],ans:1},{q:'Protagonist means?',opts:['The villain','Main character','The setting','The plot'],ans:1},{q:'Alliteration is?',opts:['Rhyming words','Repetition of initial consonant sounds','Synonyms','Opposite words'],ans:1},{q:'Passive voice?',opts:['She wrote the letter','The letter was written by her','She is writing','She will write'],ans:1}],
    hard:[{q:'"Thunder roared angrily" is?',opts:['Simile','Metaphor','Personification','Hyperbole'],ans:2},{q:'"Affect" vs "effect"?',opts:['No difference','Affect=verb, effect=noun','Effect=verb, affect=noun','Same word'],ans:1},{q:'Oxford comma is?',opts:['Comma after question mark','Comma before last item in list','Comma separating clauses','Comma after however'],ans:1}],
    expert:[{q:'Chiasmus is?',opts:['Repetition at clause ends','Reversal of grammatical structures','Same word in different contexts','Type of rhyme'],ans:1},{q:'"Unreliable narrator"?',opts:['A lying narrator','Narrator whose credibility is compromised','Narrator with poor memory','Narrator who changes perspective'],ans:1}]
  },
  custom:{easy:[],medium:[],hard:[],expert:[]}
};

const AVATARS = ['🦁','🐯','🦊','🐼','🦄','🐸','🦋','🐉','🤖','👻','🦸','🧙','🐨','🦝','🐬','🦩'];

const LEVELS = [
  {num:1,diff:'easy',  label:'Easy',  cls:'diff-easy',  time:30},
  {num:2,diff:'easy',  label:'Easy',  cls:'diff-easy',  time:26},
  {num:3,diff:'medium',label:'Medium',cls:'diff-medium',time:25},
  {num:4,diff:'medium',label:'Medium',cls:'diff-medium',time:22},
  {num:5,diff:'hard',  label:'Hard',  cls:'diff-hard',  time:20},
  {num:6,diff:'hard',  label:'Hard',  cls:'diff-hard',  time:16},
  {num:7,diff:'expert',label:'Expert',cls:'diff-expert',time:14},
  {num:8,diff:'expert',label:'Expert',cls:'diff-expert',time:12},
];

// ─── State ───
let G = {
  numPlayers:1, players:[], currentPlayer:0,
  currentWorld:null, currentWorldKey:null, currentLevel:null,
  questions:[], currentQ:0, timer:null, timeLeft:30, totalQ:0,
  scores:[0,0], turnScores:[0,0], completedLevels:{},
  usedQIds:new Set(), builtinUsed:{}, sessionAnswers:[],
};
let ADMIN  = {active:false, tapCount:0, tapTimer:null};
let WORLDS = [];      // cache from API
let API_ON = false;
let lbFilter = 'all';
let cwDraft  = [];

// ─── API helper ───
async function api(path, opts={}) {
  try {
    const r = await fetch(API_URL + path, {headers:{'Content-Type':'application/json'},...opts});
    return r.ok ? r.json() : null;
  } catch { return null; }
}

// ─── Helpers ───
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}
function toast(msg, err=false) {
  const t=document.createElement('div');
  t.className='toast'+(err?' err':''); t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),3000);
}
function star(n) { return '⭐'.repeat(n)+'☆'.repeat(Math.max(0,3-n)); }
function esc(s)  { return (s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function createBubbles() {
  const c=document.getElementById('bubbles');
  ['#FF6B6B','#4ECDC4','#A855F7','#F59E0B','#3B82F6','#10B981','#EC4899'].forEach((col,i)=>{
    const b=document.createElement('div'); b.className='bubble';
    const s=Math.random()*80+30;
    b.style.cssText=`width:${s}px;height:${s}px;left:${8+i*14}%;background:${col};animation-duration:${14+i*3}s;animation-delay:${i*2}s`;
    c.appendChild(b);
  });
}

// ─── API Status ───
async function checkApi() {
  const data = await api('/health');
  API_ON = !!data;
  const pill = document.getElementById('apiPill');
  pill.style.display = 'inline-flex';
  pill.className = 'api-pill ' + (API_ON ? 'api-online' : 'api-offline');
  document.getElementById('apiText').textContent = API_ON ? 'API Online — scores saved' : 'Offline — using built-in questions';
}

// ─── Admin PIN ───
function handleAdminTap() {
  ADMIN.tapCount++;
  clearTimeout(ADMIN.tapTimer);
  const h=document.getElementById('tapHint');
  h.textContent = ADMIN.tapCount>=2 ? `${ADMIN.tapCount}/5 taps…` : '';
  ADMIN.tapTimer = setTimeout(()=>{ADMIN.tapCount=0; h.textContent='';}, 2000);
  if (ADMIN.tapCount>=5) {
    ADMIN.tapCount=0; h.textContent='';
    if (ADMIN.active) { toast('👑 Already in Admin Mode'); return; }
    openPin();
  }
}
function openPin() {
  let entered='';
  const upd = ()=>document.querySelectorAll('.pin-dot').forEach((d,i)=>d.classList.toggle('filled',i<entered.length));
  const attempt = ()=>{
    if (entered===ADMIN_PIN) { activateAdmin(); closePin(); }
    else {
      entered=''; upd();
      const e=document.getElementById('pinErr');
      if(e){e.textContent='❌ Wrong PIN'; setTimeout(()=>{if(e)e.textContent='';},1500);}
    }
  };
  document.getElementById('modalContainer').innerHTML=`
    <div class="modal-bg" onclick="if(event.target===this)closePin()">
      <div class="pin-modal">
        <div class="pin-title">👑 Admin Access</div>
        <div class="pin-sub">Enter your 4-digit PIN</div>
        <div class="pin-dots">${[0,1,2,3].map(i=>`<div class="pin-dot" id="pd${i}"></div>`).join('')}</div>
        <div class="pin-keypad">
          ${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="pin-key" onclick="pp('${n}')">${n}</button>`).join('')}
          <button class="pin-key" onclick="pp('del')" style="font-size:17px">⌫</button>
          <button class="pin-key" onclick="pp('0')">0</button>
          <button class="pin-key" onclick="pp('ok')" style="background:rgba(168,85,247,.22)">✓</button>
        </div>
        <div id="pinErr" class="pin-error"></div>
        <button class="pin-cancel" onclick="closePin()">Cancel</button>
      </div>
    </div>`;
  window.pp = v => {
    if(v==='del'){entered=entered.slice(0,-1);upd();return;}
    if(v==='ok'){attempt();return;}
    if(entered.length>=4)return;
    entered+=v; upd();
    if(entered.length===4) setTimeout(attempt,280);
  };
}
function closePin() { document.getElementById('modalContainer').innerHTML=''; window.pp=null; }
function activateAdmin() {
  ADMIN.active=true;
  document.getElementById('adminBar').style.display='flex';
  document.getElementById('lbClearBtn').style.display='';
  renderWorldsGrid(); toast('👑 Admin mode activated!');
}
function deactivateAdmin() {
  ADMIN.active=false;
  document.getElementById('adminBar').style.display='none';
  document.getElementById('lbClearBtn').style.display='none';
  renderWorldsGrid(); toast('🔒 Admin mode locked');
}

// ─── Setup ───
function startSetup(n) {
  G.numPlayers=n; G.scores=[0,0]; G.usedQIds=new Set(); G.builtinUsed={};
  document.getElementById('setupTitle').textContent = n===1?'🎮 Who\'s Playing?':'👥 Who\'s Playing?';
  const c=document.getElementById('playerCardsContainer'); c.innerHTML='';
  for(let i=0;i<n;i++){
    c.innerHTML+=`
      <div class="player-card p${i+1}">
        <h3>Player ${i+1}</h3>
        <div class="fg"><label>Nickname</label>
          <input type="text" id="nm${i}" placeholder="Enter nickname…" maxlength="20"></div>
        <div class="fg"><label>Age Group</label>
          <select id="ag${i}">
            <option value="young">🌱 5–8 (Beginner)</option>
            <option value="mid" selected>🌟 9–13 (Explorer)</option>
            <option value="teen">🚀 14–18 (Champion)</option>
          </select></div>
        <div class="fg"><label>Avatar</label>
          <div class="av-display" id="avD${i}" onclick="document.getElementById('avF${i}').click()">
            <span id="avE${i}" style="font-size:30px">${AVATARS[i*3]}</span>
          </div>
          <input type="file" id="avF${i}" accept="image/*" style="display:none" onchange="loadImg(${i},this)">
          <button class="upload-btn" onclick="document.getElementById('avF${i}').click()">📁 Upload Photo</button>
          <div class="av-picker">
            ${AVATARS.map((a,j)=>`<span class="av-opt${j===i*3?' sel':''}" onclick="selAv(${i},${j},'${a}')">${a}</span>`).join('')}
          </div>
        </div>
      </div>`;
  }
  showScreen('setup');
}
function loadImg(idx,input) {
  if(!input.files?.[0])return;
  const r=new FileReader();
  r.onload=e=>{
    const d=document.getElementById(`avD${idx}`);
    d._img=e.target.result;
    document.getElementById(`avE${idx}`).style.display='none';
    let img=d.querySelector('img');
    if(!img){img=document.createElement('img');d.appendChild(img);}
    img.src=e.target.result;
    document.querySelectorAll(`.player-card.p${idx+1} .av-opt`).forEach(el=>el.classList.remove('sel'));
  };
  r.readAsDataURL(input.files[0]);
}
function selAv(idx,optIdx,emoji) {
  document.querySelectorAll(`.player-card.p${idx+1} .av-opt`).forEach((el,j)=>el.classList.toggle('sel',j===optIdx));
  const d=document.getElementById(`avD${idx}`); d._img=null;
  const img=d.querySelector('img'); if(img)img.remove();
  const em=document.getElementById(`avE${idx}`); em.style.display=''; em.textContent=emoji;
}
async function goToWorlds() {
  G.players=[];
  for(let i=0;i<G.numPlayers;i++){
    const nm=document.getElementById(`nm${i}`).value.trim()||`Player ${i+1}`;
    const d=document.getElementById(`avD${i}`);
    G.players.push({name:nm, age:document.getElementById(`ag${i}`).value,
      avatar:document.getElementById(`avE${i}`).textContent, avatarImg:d._img||null});
  }
  updateHud(); await loadWorlds(); showScreen('worlds');
}

// ─── HUD ───
function updateHud() {
  document.getElementById('playerHud').innerHTML=G.players.map((p,i)=>`
    <div class="hud-card" id="hud${i}">
      <div class="hud-av">${p.avatarImg?`<img src="${p.avatarImg}">`:(p.avatar||'🦁')}</div>
      <div><div class="hud-name">${p.name}</div>
      <div class="hud-score">Score: <span>${G.scores[i]}</span></div></div>
    </div>`).join('');
}
function glowPlayer(idx) {
  document.querySelectorAll('.hud-card').forEach((el,i)=>el.classList.toggle('active-glow',i===idx));
}

// ─── Worlds Grid ───
async function loadWorlds() {
  document.getElementById('worldsGrid').innerHTML='<div class="loading-grid"><div class="spinner"></div>&nbsp;Loading worlds…</div>';
  const data = await api('/worlds');
  if(data && data.length) {
    WORLDS = data;
  } else {
    // Build from built-in fallback — creates worlds with string keys
    WORLDS = Object.entries(W_INFO).map(([k,w],i)=>({
      _key:k, id:k, name:w.name, emoji:w.emoji,
      color_from:w.color, color_to:'#6366F1',
      requires_premium:!FREE_WORLDS.has(k),
      locked:!FREE_WORLDS.has(k), is_active:true, sort_order:i+1
    }));
  }
  renderWorldsGrid();
}

function wKey(w) {
  if(w._key) return w._key;
  // Match by name to built-in key
  return Object.keys(W_INFO).find(k=>W_INFO[k].name===w.name)||'quiz';
}

function renderWorldsGrid() {
  const starsFor = k => {
    const lvls=Object.keys(G.completedLevels).filter(l=>l.startsWith(k+'-'));
    if(!lvls.length)return 0;
    return Math.round(lvls.reduce((s,l)=>s+(G.completedLevels[l]||0),0)/lvls.length);
  };

  let html = WORLDS.map(w=>{
    const k   = wKey(w);
    const def = W_INFO[k]||W_INFO.quiz;
    const locked = w.locked||w.requires_premium;
    const bg  = `background:linear-gradient(135deg,${w.color_from||def.color},${w.color_to||'#6366F1'})`;
    const stars = starsFor(k);
    return `
      <div class="world-tile ${def.cls}${locked?' world-locked':''}" style="${bg}"
        onclick="${locked?`lockScreen('${esc(w.name)}')`:`pickWorld(${w.id},'${k}')`}">
        ${locked?'<div class="lock-badge">🔒 Premium</div>':''}
        <span class="world-emoji">${w.emoji}</span>
        <span class="world-name">${w.name}</span>
        <div class="world-stars">${star(stars)}</div>
        ${locked?'<div style="font-size:11px;color:rgba(255,255,255,.6);margin-top:4px">Ask a grown-up!</div>':''}
      </div>`;
  }).join('');

  // Custom world tile (if questions exist)
  const cq=getCWQ();
  if(cq.length||ADMIN.active) {
    const cwName=localStorage.getItem('wwCWName')||'My Custom World';
    html+=`<div class="world-tile world-custom" style="background:linear-gradient(135deg,#EC4899,#F472B6)" onclick="pickWorld('custom','custom')">
      <span class="world-emoji">⭐</span>
      <span class="world-name">${cwName}</span>
      <div class="world-stars">${star(starsFor('custom'))}</div>
    </div>`;
  }

  // Admin: edit tile
  if(ADMIN.active) {
    html+=`<div class="world-tile world-edit-tile" onclick="openEditor()">
      <span class="world-emoji">✏️</span>
      <span class="world-name">Edit Custom World</span>
      <div style="font-size:11px;color:rgba(255,255,255,.45);margin-top:5px">👑 Admin only</div>
    </div>`;
  }
  document.getElementById('worldsGrid').innerHTML = html;
}

function lockScreen(name) {
  document.getElementById('lockTitle').textContent=`🔐 ${name} — Premium!`;
  showScreen('locked-world');
}

// ─── World & Level Selection ───
function pickWorld(worldId, worldKey) {
  if(worldKey==='custom') {
    const cq=getCWQ();
    if(!cq.length){
      if(ADMIN.active&&confirm('No custom questions yet. Go to editor?'))openEditor();
      else toast('No custom questions yet!');
      return;
    }
  }
  // Find the world object
  const w = WORLDS.find(x=>String(x.id)===String(worldId)||wKey(x)===worldKey) ||
            {id:worldId, _key:worldKey, name:W_INFO[worldKey]?.name||worldKey, emoji:W_INFO[worldKey]?.emoji||'⭐'};
  G.currentWorld    = w;
  G.currentWorldKey = worldKey;

  const levelTitle = document.getElementById('levelTitle');
  levelTitle.textContent = `${w.emoji} ${w.name} — Choose Level`;
  document.getElementById('levelsGrid').innerHTML = LEVELS.map(l=>{
    const k=`${worldKey}-${l.num}`;
    const s=G.completedLevels[k]||0;
    return `<div class="level-tile${s>0?' completed':''}" onclick="beginLevel(${l.num})">
      <span class="level-num">${l.num}</span>
      <span class="level-diff ${l.cls}">${l.label}</span>
      <div style="font-size:13px;margin-top:4px">${star(s)}</div>
      <div style="font-size:11px;color:rgba(255,255,255,.4);margin-top:3px">⏱ ${l.time}s</div>
    </div>`;
  }).join('');
  showScreen('levels');
}

// ─── Question fetch (API → fallback) ───
async function getQuestions(worldKey, worldId, diff, count) {
  // Try API — worldId can be a number OR numeric string from the API response
  if(API_ON && worldId !== null && worldId !== undefined) {
    const excl=[...G.usedQIds].join(',');
    const data = await api(`/questions/${worldId}/${diff}?count=${count}${excl?'&exclude='+excl:''}`);
    if(data && data.length) {
      data.forEach(q=>G.usedQIds.add(q.id));
      return data.map(q=>({
        q:q.question_text,
        opts:Array.isArray(q.options)?q.options:JSON.parse(q.options||'[]'),
        ans:q.correct_index, passage:q.passage||'', _id:q.id
      }));
    }
  }
  // Built-in fallback
  return pickBuiltin(worldKey, diff, count);
}

function pickBuiltin(wk, diff, count) {
  const pool = (wk==='custom' ? getCWQ().filter(q=>q.diff===diff) : QB[wk]?.[diff]) || [];
  if(!pool.length) return [];
  const key=`${wk}-${diff}`;
  if(!G.builtinUsed[key]) G.builtinUsed[key]=new Set();
  const used=G.builtinUsed[key];
  if(used.size>=pool.length) used.clear();
  const avail=pool.map((_,i)=>i).filter(i=>!used.has(i)).sort(()=>Math.random()-.5);
  const picked=avail.slice(0,count);
  picked.forEach(i=>used.add(i));
  return picked.map(i=>({...pool[i]}));
}

// ─── Start Level ───
async function beginLevel(num) {
  G.currentLevel = LEVELS[num-1];
  const diff=G.currentLevel.diff, wk=G.currentWorldKey;
  const wId = typeof G.currentWorld?.id==='number' ? G.currentWorld.id : null;
  const perPlayer=5;
  G.currentQ=0; G.turnScores=[0,0]; G.sessionAnswers=[]; G.builtinUsed={};

  showScreen('game');
  document.getElementById('answersGrid').innerHTML='<div style="text-align:center;padding:20px;color:rgba(255,255,255,.5)">Loading questions…</div>';

  if(G.numPlayers===2) {
    const [q1,q2] = await Promise.all([getQuestions(wk,wId,diff,perPlayer),getQuestions(wk,wId,diff,perPlayer)]);
    G.questions=[];
    for(let i=0;i<perPlayer;i++){
      if(q1[i]) G.questions.push({...q1[i],_player:0});
      if(q2[i]) G.questions.push({...q2[i],_player:1});
    }
  } else {
    G.questions = await getQuestions(wk,wId,diff,perPlayer);
  }

  G.totalQ = G.questions.length;
  if(!G.totalQ) { toast('No questions found for this level!',true); showScreen('levels'); return; }
  buildDots(); renderQ();
}

function buildDots() {
  document.getElementById('progressDots').innerHTML =
    Array(G.totalQ).fill(0).map((_,i)=>`<div class="dot" id="dt${i}"></div>`).join('');
}

// ─── Render Question ───
function renderQ() {
  clearInterval(G.timer);
  const q=G.questions[G.currentQ]; if(!q){endGame();return;}
  const def  = W_INFO[G.currentWorldKey]||W_INFO.quiz;
  const pIdx = G.numPlayers===2?(q._player??G.currentQ%2):0;
  const pl   = G.players[pIdx]||G.players[0];

  // Update dots
  for(let i=0;i<G.totalQ;i++){
    const d=document.getElementById('dt'+i); if(!d)continue;
    if(i<G.currentQ){ const sa=G.sessionAnswers[i]; d.className='dot '+(sa?.correct?'done-c':'done-w');}
    else d.className='dot'+(i===G.currentQ?' current':'');
  }

  // Turn indicator (2-player)
  const ti=document.getElementById('turnInd');
  if(G.numPlayers===2){
    ti.style.display='block';
    const av=pl.avatarImg?`<img src="${pl.avatarImg}" style="width:24px;height:24px;border-radius:50%;vertical-align:middle;margin-right:5px">`:pl.avatar+' ';
    ti.innerHTML=`${av}<strong>${pl.name}'s</strong> turn! 🎯`;
    ti.style.borderColor=pIdx===0?'#FF8E53':'#4ECDC4';
    glowPlayer(pIdx);
  } else { ti.style.display='none'; }

  // Badge
  const badge=document.getElementById('qBadge');
  badge.textContent=def.name; badge.style.cssText=`background:${def.color}28;color:${def.color};padding:4px 12px;border-radius:18px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px`;
  document.getElementById('qNum').textContent=`Q${G.currentQ+1}/${G.totalQ}`;
  updateScoreDisp();

  // Passage (reading world)
  document.getElementById('readingPassage').innerHTML = q.passage
    ?`<div class="reading-text">📖 ${q.passage}</div>`:'';

  document.getElementById('questionText').textContent=q.q;
  document.getElementById('feedbackArea').textContent='';

  const L=['A','B','C','D'];
  document.getElementById('answersGrid').innerHTML=q.opts.map((opt,i)=>
    `<button class="answer-btn" onclick="checkAns(${i})">${L[i]}. ${opt}</button>`
  ).join('');

  // Timer
  G.timeLeft=G.currentLevel.time;
  const fill=document.getElementById('timerFill');
  fill.style.width='100%'; fill.style.background='linear-gradient(90deg,#4ECDC4,#A855F7)';
  G.timer=setInterval(()=>{
    G.timeLeft--;
    fill.style.width=(G.timeLeft/G.currentLevel.time*100)+'%';
    if(G.timeLeft<=5) fill.style.background='linear-gradient(90deg,#EF4444,#FF6B6B)';
    if(G.timeLeft<=0){
      clearInterval(G.timer);
      document.querySelectorAll('.answer-btn').forEach(b=>b.disabled=true);
      document.querySelectorAll('.answer-btn')[q.ans]?.classList.add('correct');
      G.sessionAnswers.push({q,playerIdx:pIdx,chosen:-1,correct:false,timeTaken:G.currentLevel.time,pts:0});
      fb(false,'⏰ Time\'s up! Answer: '+q.opts[q.ans]);
      popup(false,0);
      setTimeout(nextQ,2000);
    }
  },1000);
}

function updateScoreDisp() {
  document.getElementById('scoreDisp').textContent = G.numPlayers===2
    ?`${G.players[0]?.avatar||''} ${G.turnScores[0]} | ${G.players[1]?.avatar||''} ${G.turnScores[1]}`
    :`Score: ${G.scores[0]}`;
}

function checkAns(idx) {
  clearInterval(G.timer);
  const q=G.questions[G.currentQ];
  const btns=document.querySelectorAll('.answer-btn');
  btns.forEach(b=>b.disabled=true);
  const ok=idx===q.ans;
  btns[idx].classList.add(ok?'correct':'wrong');
  if(!ok) btns[q.ans].classList.add('correct');
  const pts=ok?calcPts():0;
  const pIdx=G.numPlayers===2?(q._player??G.currentQ%2):0;
  if(ok){G.scores[pIdx]+=pts; G.turnScores[pIdx]+=pts;}
  const timeTaken=G.currentLevel.time-G.timeLeft;
  G.sessionAnswers.push({q,playerIdx:pIdx,chosen:idx,correct:ok,timeTaken,pts});
  fb(ok, ok?`✅ Correct! +${pts} pts`:`❌ Answer: ${q.opts[q.ans]}`);
  popup(ok,pts);
  setTimeout(nextQ,2000);
}

function calcPts() {
  const base={easy:50,medium:100,hard:150,expert:200}[G.currentLevel.diff]||50;
  return base+Math.floor(G.timeLeft/G.currentLevel.time*50);
}
function fb(ok,msg) {
  const el=document.getElementById('feedbackArea');
  el.textContent=msg; el.style.color=ok?'#6EE7B7':'#FCA5A5';
}
function popup(ok,pts) {
  document.getElementById('popupEmoji').textContent=ok?'🌟':'💪';
  document.getElementById('popupTitle').textContent=ok?'Correct!':'Keep Going!';
  document.getElementById('popupPoints').textContent=ok?`+${pts} points!`:'You\'ll get the next one!';
  const p=document.getElementById('scorePopup');
  p.classList.add('show'); setTimeout(()=>p.classList.remove('show'),1700);
}
function nextQ() { G.currentQ++; if(G.currentQ>=G.totalQ)endGame(); else renderQ(); }
function confirmExit() { if(confirm('Exit game? Progress will be lost.')){clearInterval(G.timer);showScreen('worlds');} }

// ─── End Game ───
async function endGame() {
  clearInterval(G.timer);
  const key=`${G.currentWorldKey}-${G.currentLevel.num}`;
  const maxPts=(G.totalQ/G.numPlayers)*250;
  const best=G.numPlayers===2?Math.max(...G.turnScores):(G.turnScores[0]||G.scores[0]);
  const pct=best/maxPts;
  const stars=pct>.75?3:pct>.4?2:1;
  if(!G.completedLevels[key]||G.completedLevels[key]<stars) G.completedLevels[key]=stars;
  updateWorldStars();
  saveToLb();  // local
  sendSession();  // API (non-blocking)
  launchConfetti();

  document.getElementById('resultsTrophy').textContent=stars===3?'🏆':stars===2?'🥈':'🥉';
  document.getElementById('resultsTitle').textContent=stars===3?'Outstanding! 🌟🌟🌟':stars===2?'Great Job! 🌟🌟':'Good Effort! 🌟';
  document.getElementById('resultsSub').textContent=`${G.currentWorld?.emoji||'🌍'} ${G.currentWorld?.name||''} — Level ${G.currentLevel.num}`;
  const winner=G.numPlayers===2?(G.turnScores[0]>G.turnScores[1]?0:G.turnScores[1]>G.turnScores[0]?1:-1):-1;
  document.getElementById('scoresRow').innerHTML=G.players.map((p,i)=>{
    const s=G.numPlayers===2?G.turnScores[i]:G.scores[i];
    const ms=G.numPlayers===1?stars:Math.min(3,Math.max(1,Math.round(s/maxPts*3)));
    const isW=G.numPlayers===2&&i===winner, isTie=G.numPlayers===2&&winner===-1;
    return `<div class="score-block">
      <div class="sb-av">${p.avatarImg?`<img src="${p.avatarImg}">`:p.avatar}</div>
      <div class="sb-name">${p.name}</div>
      <div class="sb-pts">${s}</div>
      <div class="sb-stars">${'⭐'.repeat(ms)}</div>
      ${isW?'<div class="winner-badge">🏆 Winner!</div>':''}
      ${isTie?'<div class="winner-badge">🤝 Tied!</div>':''}
    </div>`;
  }).join('');
  showScreen('results');
}

function updateWorldStars() {
  Object.keys(W_INFO).forEach(k=>{
    const lvls=Object.keys(G.completedLevels).filter(l=>l.startsWith(k+'-'));
    if(!lvls.length)return;
    const avg=lvls.reduce((s,l)=>s+(G.completedLevels[l]||0),0)/lvls.length;
    const el=document.getElementById('wstars-'+k); if(el)el.textContent=star(Math.round(avg));
  });
}

// Send session to API (non-blocking — game still works if it fails)
async function sendSession() {
  if(!API_ON)return;
  const wId=typeof G.currentWorld?.id==='number'?G.currentWorld.id:null;
  if(!wId)return;
  const correct=G.sessionAnswers.filter(s=>s.correct).length;
  const totalStars=Object.values(G.completedLevels).reduce((s,v)=>s+v,0);
  for(const p of G.players.map((p,i)=>({...p,idx:i}))) {
    const score=G.numPlayers===2?G.turnScores[p.idx]:G.scores[0];
    await api('/sessions/save',{method:'POST',body:JSON.stringify({
      playerName:p.name, worldId:wId, difficulty:G.currentLevel.diff,
      level:G.currentLevel.num, score, stars:G.completedLevels[`${G.currentWorldKey}-${G.currentLevel.num}`]||0,
      totalQuestions:G.totalQ/G.numPlayers, correctAnswers:Math.round(correct/G.numPlayers)
    })});
  }
}

function playAgain() { pickWorld(G.currentWorld?.id, G.currentWorldKey); }
function goHome()    { G.scores=[0,0]; updateHud(); renderWorldsGrid(); showScreen('worlds'); }

// ─── Review ───
function showReview() {
  const w=G.currentWorld;
  document.getElementById('reviewHdr').textContent=`📋 ${w?.emoji||'🌍'} ${w?.name||''} — Level ${G.currentLevel.num} Review`;
  const L=['A','B','C','D'];
  document.getElementById('reviewList').innerHTML=G.sessionAnswers.map((sa,qi)=>{
    const q=sa.q, pl=G.players[sa.playerIdx]||G.players[0];
    const av=pl.avatarImg?`<img src="${pl.avatarImg}" style="width:16px;height:16px;border-radius:50%;vertical-align:middle;margin-right:3px">`:pl.avatar;
    const timedOut=sa.chosen===-1;
    const opts=q.opts.map((o,i)=>{
      const cls=i===q.ans?'correct-ans':i===sa.chosen&&!sa.correct?'wrong-ans':'neutral';
      const mk=i===q.ans?'✅':i===sa.chosen&&!sa.correct?'❌':'';
      return `<div class="ri-opt ${cls}">${mk} ${L[i]}. ${o}</div>`;
    }).join('');
    return `<div class="review-item ${sa.correct?'ok':'bad'}">
      <div class="ri-q">Q${qi+1}: ${q.q}</div>
      ${q.passage?`<div class="ri-passage">📖 ${q.passage}</div>`:''}
      <div class="ri-opts">${opts}</div>
      <div class="ri-meta">
        <span class="ri-tag ${sa.correct?'ri-ok':'ri-bad'}">${av}${pl.name}: ${sa.correct?'Correct ✅':timedOut?'Timed out ⏰':'Wrong ❌'}</span>
        ${sa.correct?`<span class="ri-tag ri-time">⏱ ${sa.timeTaken}s | +${sa.pts} pts</span>`:''}
      </div>
    </div>`;
  }).join('');
  showScreen('review');
}

// ─── Leaderboard ───
function saveToLb() {
  try {
    const lb=JSON.parse(localStorage.getItem('wwLb')||'[]');
    G.players.forEach((p,i)=>{
      const score=G.numPlayers===2?G.turnScores[i]:G.scores[i];
      if(score<=0)return;
      lb.push({name:p.name, avatar:p.avatar, avatarImg:p.avatarImg,
        score, world:G.currentWorldKey, worldName:G.currentWorld?.name,
        stars:G.completedLevels[`${G.currentWorldKey}-${G.currentLevel.num}`]||0, date:Date.now()});
    });
    lb.sort((a,b)=>b.score-a.score);
    localStorage.setItem('wwLb',JSON.stringify(lb.slice(0,200)));
  } catch {}
}

async function openLeaderboard() {
  lbFilter='all'; await renderLb(); showScreen('leaderboard');
}

async function renderLb() {
  // Try API first for world tabs
  let worlds=[{key:'all',name:'All',emoji:'🌍'}];
  if(API_ON){
    const data=await api('/worlds');
    if(data) worlds=[...worlds,...data.map(w=>({key:wKey(w),name:w.name,emoji:w.emoji}))];
  } else {
    worlds=[...worlds,...Object.entries(W_INFO).map(([k,w])=>({key:k,name:w.name,emoji:w.emoji}))];
  }

  document.getElementById('lbTabs').innerHTML=worlds.slice(0,8).map(w=>
    `<button class="tab-btn${lbFilter===w.key?' active':''}" onclick="lbFilter='${w.key}';renderLb()">${w.emoji} ${w.name.split(' ')[0]}</button>`
  ).join('');

  // API leaderboard
  let rows=[];
  if(API_ON) {
    const worldObj=WORLDS.find(w=>wKey(w)===lbFilter);
    const path=lbFilter==='all'?'/leaderboard':`/leaderboard?worldId=${worldObj?.id||''}`;
    const data=await api(path);
    if(data) rows=data.map(r=>({name:r.player_name,avatar:r.avatar_url||'🏆',score:r.best_score,stars:r.total_stars}));
  }
  // Fallback: local storage
  if(!rows.length) {
    const lb=JSON.parse(localStorage.getItem('wwLb')||'[]');
    rows=(lbFilter==='all'?lb:lb.filter(r=>r.world===lbFilter)).slice(0,20)
         .map(r=>({name:r.name,avatar:r.avatar,avatarImg:r.avatarImg,score:r.score,stars:r.stars}));
  }

  const medals=['🥇','🥈','🥉'];
  document.getElementById('lbBody').innerHTML = rows.length
    ? rows.slice(0,20).map((r,i)=>{
        const cls=i===0?'lb-gold':i===1?'lb-silver':i===2?'lb-bronze':'';
        const av=r.avatarImg?`<img src="${r.avatarImg}">`:r.avatar||'🏆';
        return `<div class="lb-row">
          <div class="lb-rank ${cls}">${medals[i]||i+1}</div>
          <div class="lb-player"><div class="lb-av">${av}</div><div class="lb-pname">${r.name}</div></div>
          <div class="lb-val ${cls}">${r.score}</div>
          <div class="lb-val">${'⭐'.repeat(r.stars||0)}</div>
        </div>`;
      }).join('')
    : '<div class="lb-empty">No scores yet! Play a game first 🎮</div>';
}

function clearLb() {
  if(!confirm('Clear all leaderboard scores?'))return;
  localStorage.removeItem('wwLb'); renderLb(); toast('🗑 Leaderboard cleared');
}

// ─── Custom World Editor (Admin only) ───
function getCWQ() {
  try{return JSON.parse(localStorage.getItem('wwCW')||'{}').questions||[];}catch{return [];}
}
function openEditor() {
  if(!ADMIN.active){toast('🔒 Admin access required',true);return;}
  try{const d=JSON.parse(localStorage.getItem('wwCW')||'{}');cwDraft=(d.questions||[]).map(q=>({...q}));document.getElementById('cwName').value=d.name||'';}
  catch{cwDraft=[];}
  renderCW(); showScreen('custom-editor');
}
function renderCW() {
  const list=document.getElementById('customQList');
  if(!cwDraft.length){list.innerHTML='<p style="color:rgba(255,255,255,.35);text-align:center;padding:16px">No questions yet. Click + below to add one.</p>';return;}
  list.innerHTML=cwDraft.map((q,qi)=>`
    <div class="q-entry">
      <div class="q-entry-hdr">
        <span class="q-entry-num">Q${qi+1}</span>
        <div style="display:flex;gap:7px;align-items:center">
          <select class="diff-sel" onchange="cwDraft[${qi}].diff=this.value">
            ${['easy','medium','hard','expert'].map(d=>`<option value="${d}"${q.diff===d?' selected':''}>${d.charAt(0).toUpperCase()+d.slice(1)}</option>`).join('')}
          </select>
          <button class="btn-rmq" onclick="cwDraft.splice(${qi},1);renderCW()">✕ Remove</button>
        </div>
      </div>
      <label style="font-size:11px;color:rgba(255,255,255,.4)">QUESTION</label>
      <input type="text" class="cq-input" value="${esc(q.q)}" placeholder="Type your question…" onchange="cwDraft[${qi}].q=this.value">
      <label style="font-size:11px;color:rgba(255,255,255,.4);margin-top:8px;display:block">OPTIONS — click ✓ to mark the correct answer</label>
      <div class="opts-grid">
        ${q.opts.map((opt,oi)=>`
          <div class="opt-row">
            <span class="opt-lbl">${['A','B','C','D'][oi]}</span>
            <input type="radio" class="correct-radio" name="cr${qi}" value="${oi}" ${q.ans===oi?'checked':''} title="Correct answer" onchange="cwDraft[${qi}].ans=${oi}">
            <input type="text" value="${esc(opt)}" placeholder="Option ${['A','B','C','D'][oi]}…" onchange="cwDraft[${qi}].opts[${oi}]=this.value">
          </div>`).join('')}
      </div>
    </div>`).join('');
}
function addCQ() {
  cwDraft.push({q:'',opts:['','','',''],ans:0,diff:'easy'});
  renderCW();
  setTimeout(()=>{const items=document.querySelectorAll('.q-entry');items[items.length-1]?.scrollIntoView({behavior:'smooth'});},100);
}
function saveCW() {
  const valid=cwDraft.filter(q=>q.q.trim()&&q.opts.every(o=>o.trim()));
  if(!valid.length){alert('Add at least 1 complete question with all 4 options filled in.');return;}
  const name=document.getElementById('cwName').value.trim()||'My Custom World';
  try{
    localStorage.setItem('wwCW',JSON.stringify({name,questions:valid}));
    localStorage.setItem('wwCWName',name);
    toast(`✅ Saved! ${valid.length} questions in "${name}"`);
    showScreen('worlds'); renderWorldsGrid();
  }catch(e){alert('Could not save: '+e.message);}
}

// ─── Confetti ───
function launchConfetti() {
  const cols=['#FF6B6B','#4ECDC4','#FFD700','#A855F7','#3B82F6','#10B981','#FF8E53'];
  for(let i=0;i<80;i++){
    setTimeout(()=>{
      const c=document.createElement('div'); c.className='confetti-piece';
      const s=Math.random()*10+5;
      c.style.cssText=`left:${Math.random()*100}%;width:${s}px;height:${s}px;background:${cols[~~(Math.random()*cols.length)]};border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${Math.random()*2+2.5}s;animation-delay:${Math.random()*.4}s;transform:rotate(${Math.random()*360}deg)`;
      document.body.appendChild(c); setTimeout(()=>c.remove(),5000);
    },i*30);
  }
}

// ─── Init ───
createBubbles();
checkApi();
