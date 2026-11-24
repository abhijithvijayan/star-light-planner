import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const STRIP_CM_PER_FT = 30.48;
let view = 'C';

// ---------- three.js scene ----------
const stage = $('stage');
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
stage.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0c1c);
const camera = new THREE.PerspectiveCamera(40, 1, 1, 5000);
camera.position.set(170, 60, 420);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.target.set(0,-20,0);
controls.autoRotate = true; controls.autoRotateSpeed = 0.8;
const group = new THREE.Group(); scene.add(group);

// soft round sprite for bulbs
const sprite = (()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.85)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);return t;})();

function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage); resize();
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});

function clearGroup(){while(group.children.length){const o=group.children.pop();o.geometry?.dispose();o.material?.dispose();}}
function samplePath(path, step){
  const out=[]; let carry=0;
  for(let i=1;i<path.length;i++){const A=path[i-1],B=path[i];const d=Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2]);
    let s=carry; while(s<d){const t=s/d;out.push(A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t);s+=step;} carry=s-d;}
  return out;
}

// ---------- formatting ----------
const nf = (x,d=1)=>x.toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
const inr = x=>'₹'+Math.round(x).toLocaleString('en-IN');

function buyBlock(lenCm, stripCm, buf, price){
  const exact=lenCm/stripCm, withBuf=exact*(1+buf/100);
  const n0=Math.ceil(exact-1e-9), n1=Math.ceil(withBuf-1e-9);
  return {exact, withBuf, n0, n1, cost0:n0*price, cost1:n1*price};
}
function renderCard(key, lenCm, loops, extra, b, buf){
  $('len'+key).innerHTML = `${nf(lenCm/100,2)}<small>m</small>`;
  $('kv'+key).innerHTML = `
    <dt>Total length</dt><dd class="strong">${nf(lenCm,0)} cm · ${nf(lenCm/STRIP_CM_PER_FT,1)} ft</dd>
    <dt>Rings / loops</dt><dd>${loops}</dd>
    ${extra}
    <dt>Strips, exact</dt><dd>${nf(b.exact,2)}</dd>
    <dt>Strips with ${buf}% buffer</dt><dd>${nf(b.withBuf,2)}</dd>
    <dt>Bulbs at ${$('bulb').value} in spacing</dt><dd>${nf(lenCm/bulbCm(),0)} (${Math.floor(stripCmG/bulbCm())} per strip)</dd>`;
  $('buy'+key).innerHTML = `
    <div><span>No buffer</span><b>${b.n0}</b></div>
    <div class="hl"><span>Buy (+${buf}%)</span><b>${b.n1}</b></div>
    <div><span>Cost</span><b>${inr(b.cost1)}</b></div>`;
}

// ---------- main update ----------
let pending=false, stripCmG=426.72;
function schedule(){ if(!pending){pending=true;requestAnimationFrame(update);} }
function bulbCm(){return parseFloat($('bulb').value)*2.54;}
function num(id,fallback){const v=parseFloat($(id).value);return Number.isFinite(v)?v:fallback;}

function update(){
  pending=false;
  const pitch=num('pitch',1.5);
  $('pitchOut').textContent = pitch.toFixed(1)+' cm';
  const params={upperEdge:num('upperEdge',80),bottomEdge:num('bottomEdge',112),depth:num('depth',27),sideEdge:num('sideEdge',53),bottomInner:num('bottomInner',58),pitch};
  stripCmG=num('stripFt',14)*STRIP_CM_PER_FT; const stripCm=num('stripFt',14)*STRIP_CM_PER_FT, buf=num('buffer',10), price=num('price',0);
  const r=computeAll(params);
  if(r.error){$('err').hidden=false;$('err').textContent=r.error;return;}
  $('err').hidden=true;
  const S=r.S;

  const bA=buyBlock(r.A_total,stripCm,buf,price), bC=buyBlock(r.C.length,stripCm,buf,price);
  const loopsA=r.A_points.reduce((s,p)=>s+p.loops,0)+r.A_center.loops;
  renderCard('A', r.A_total, loopsA, `<dt>Pieces</dt><dd>5 points + centre box</dd>`, bA, buf);
  renderCard('C', r.C.length, r.C.loops, `<dt>Spiral height</dt><dd>${nf(r.C.height,1)} cm</dd><dt>Return run between top points</dt><dd>${nf(r.C.joins,0)} cm</dd>`, bC, buf);
  const lens={A:r.A_total,C:r.C.length}, min=Math.min(...Object.values(lens));
  for(const k of 'AC'){ const best=lens[k]<=min+1e-6; $('tag'+k).textContent = best?'least wire':`+${nf((lens[k]/min-1)*100,0)}% wire`; $('tag'+k).className='tag'+(best?' best':''); $('card'+k).classList.toggle('active',view===k); }

  // Method A table
  const rowsA=r.A_points.map((p,i)=>{const pt=S.points[i];return `<tr><td>${cap(p.name)}</td><td>${nf(pt.innerEdge,1)} × ${nf(pt.depth,1)}</td><td>${nf(pt.edge,1)}</td><td>${p.loops}</td><td>${nf(p.length,0)}</td></tr>`;}).join('');
  $('tblA').innerHTML = `<thead><tr><th>Piece</th><th>Base</th><th>Bar</th><th>Rings</th><th>Wire cm</th></tr></thead>
   <tbody>${rowsA}<tr><td>Centre box (front + back)</td><td>pentagon × ${nf(S.depth,1)}</td><td>${nf(r.A_center.height,1)} tall</td><td>${r.A_center.loops}</td><td>${nf(r.A_center.length,0)}</td></tr></tbody>
   <tfoot><tr><td>Total</td><td></td><td></td><td>${loopsA}</td><td>${nf(r.A_total,0)}</td></tr></tfoot>`;
  // vertex table
  const vrow=(n,p)=>`<tr><td>${n}</td><td>${nf(p[0],2)}</td><td>${nf(p[1],2)}</td><td>${nf(p[2],2)}</td></tr>`;
  $('tblV').innerHTML = `<thead><tr><th>Vertex</th><th>x</th><th>y</th><th>z</th></tr></thead><tbody>
   ${S.tips.map(t=>vrow('Tip, '+t.name+' (front = back)',t.p)).join('')}
   ${S.inner.map(v=>vrow(v.name.replace(/^F /,'Front inner, ').replace(/^B /,'Back inner, '),v.p)).join('')}
   <tr><td>Star height × width</td><td colspan="3">${nf(S.ymax-S.ymin,1)} × ${nf(Math.max(...S.tips.map(t=>t.p[0]))*2,1)}</td></tr>
   <tr><td>Total steel in frame</td><td colspan="3">${nf(S.barTotal,0)} cm</td></tr></tbody>`;

  // ---------- draw ----------
  clearGroup();
  const ledColor=new THREE.Color($('color').value);
  if($('showFrame').checked){
    const pos=[]; S.bars.forEach(([a,b])=>pos.push(...a,...b));
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    group.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0x8c88b5,transparent:true,opacity:view==='F'?1:.55})));
  }
  let paths=[];
  if(view==='A') paths=[...r.A_points.map(p=>p.path), r.A_center.path];
  else if(view==='C') paths=[r.C.path];
  if($('showWire').checked) paths.forEach(path=>{
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(path.flat(),3));
    group.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:ledColor.clone().multiplyScalar(.45),transparent:true,opacity:.7})));
  });
  let bulbs=0;
  if($('showBulbs').checked && paths.length){
    const step=bulbCm(); const pts=[];
    paths.forEach(p=>pts.push(...samplePath(p,step)));
    bulbs=pts.length/3;
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
    group.add(new THREE.Points(g,new THREE.PointsMaterial({color:ledColor,size:Math.min(9,Math.max(2.5,step*0.55)),map:sprite,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending})));
  }
  const ends=renderGuide(r,S,pitch,stripCm,(view==='A'?bA:bC).n1,buf);
  if(ends.length){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(ends.flatMap(e=>e.pos),3));
    group.add(new THREE.Points(g,new THREE.PointsMaterial({color:0xff5d8f,size:12,map:sprite,transparent:true,depthWrite:false,depthTest:false}))); }
  const L=view==='A'?r.A_total:view==='C'?r.C.length:S.barTotal;
  $('legend').innerHTML = view==='F' ? `Frame bars ${nf(L/100,2)} m` : `${nf(L/100,1)} m wire${bulbs?` · ~${nf(bulbs,0)} bulbs`:''}`;
}
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
// ---------- wrapping guide ----------
// Each run is one continuous piece of wire: {name, path, ppr (path points per ring)}.
// Joins: points where strip k ends, measured along the wire. Polyline lengths are scaled to the exact total.
function stripEnds(runs, exactTotal, stripCm, linkRuns){
  const segs=[]; let poly=0;
  runs.forEach((run,ri)=>{
    if(ri && linkRuns){ const A=runs[ri-1].path.at(-1), B=run.path[0]; const d=Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2]);
      segs.push({run:{name:'return run'},i:-1,A,B,s0:poly,d}); poly+=d; }
    for(let i=1;i<run.path.length;i++){ const A=run.path[i-1],B=run.path[i],d=Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2]); segs.push({run,i,A,B,s0:poly,d}); poly+=d; }
  });
  const k=poly/exactTotal, out=[]; let si=0;
  for(let n=1; n*stripCm<exactTotal-1e-6; n++){
    const s=n*stripCm*k; while(si<segs.length-1 && segs[si].s0+segs[si].d<s) si++;
    const g=segs[si], t=Math.min(1,(s-g.s0)/(g.d||1));
    const pos=[g.A[0]+(g.B[0]-g.A[0])*t, g.A[1]+(g.B[1]-g.A[1])*t, g.A[2]+(g.B[2]-g.A[2])*t];
    out.push({n, pos, run:g.run, ring:g.i<0?null:Math.floor((g.i-1)/g.run.ppr)+1, of:g.run.loops});
  }
  return out;
}
const cm = x=>`<span class="num">${nf(x,x<100?1:0)} cm</span>`;
function prepSteps(nBuy, buf, stripFt){ return [
  `<b>Get the wire ready.</b> Buy <span class="num">${nBuy}</span> strips of ${nf(stripFt,0)} ft (this includes the ${buf}% spare). Plug each one in before it goes on the frame and set aside any that don't fully light.`,
  `<b>Plan the power.</b> Check the box for how many sets can be linked end to end on one plug. If ${nBuy} is more than that, split the wrap into runs of that many strips, and give each run its own plug at the start. Start a new run at one of the strip ends listed in the table below.`,
];}
function guideSpiral(r,S,pitch,nBuy,buf,stripFt){
  const H=S.ymax-S.ymin, notch=r.C.splitY-S.ymin, side=S.inner.find(v=>v.name==='F bottom-right').p[1]-S.ymin;
  const trunk=r.C.parts.find(p=>p.name==='main body'), tops=r.C.parts.filter(p=>p.name!=='main body');
  const tieEvery=Math.max(1,Math.round(10/pitch));
  return { title:'Wrapping guide · Full-body spiral',
    sub:`One wire, wound in level turns from the bottom tip up to the two top tips. All heights are measured straight up from the bottom tip. The star is ${nf(H,0)} cm tall.`,
    steps:[...prepSteps(nBuy,buf,stripFt),
    `<b>Mark the heights.</b> Stand the star upright. With a tape measure from the bottom tip, mark the front bars every 10 cm up to ${cm(H)}. Each 10 cm is about ${nf(10/pitch,1)} turns, so you can check you are on track. Cut a strip of card ${cm(pitch)} wide and hold it between turns as a spacer.`,
    `<b>Start at the bottom tip.</b> Cable-tie the plug end of strip 1 to the bottom tip, leaving the plug hanging free. Wind the wire round the frame in level turns: across the front, round the side, across the back, round the other side. Each turn sits ${cm(pitch)} above the last. Pull it taut so it runs straight between the bars.`,
    `<b>Tie as you go.</b> Put a cable tie on a bar about every ${tieEvery} turns (roughly every 10 cm of height) so the turns can't slide down.`,
    `<b>Past the side points.</b> At about ${cm(side)} the left and right points begin. Keep every turn going round the full width, out to both side points and back. These are the longest turns, up to ${cm(maxRing(r))} of wire each.`,
    `<b>Stop at the top notch.</b> At ${cm(notch)} you reach the top corner of the centre, where the two top points split apart. That is turn ${trunk?trunk.loops:'?'}. Finish the turn there and cable-tie the wire to the corner.`,
    `<b>Wrap the ${tops[0]?.name||'left top point'}.</b> Carry on winding round that point only, still ${cm(pitch)} per turn, up to its tip at ${cm(H)}. That is about ${tops[0]?.loops||0} turns. Tie it off at the tip.`,
    `<b>Come back down.</b> Run the wire straight back down the inside bar of that point to the notch, about ${cm(r.C.joins)}. Tie it to the bar every 10 cm so it lies flat.`,
    `<b>Wrap the ${tops[1]?.name||'right top point'}.</b> Wind round it the same way up to its tip, about ${tops[1]?.loops||0} turns. Tie off and tuck the end.`,
    `<b>Changing strips.</b> When a strip runs out, plug in the next and keep winding. The table below shows roughly where each one ends. Tape over every connector and turn it to face the back.`,
    `<b>Light test.</b> Plug in and look for dark sections before tidying the ties. Do not cover the wire with anything that traps heat.`]};
}
function maxRing(r){ // longest single turn of the spiral, from consecutive ring lengths
  let m=0; for(const part of r.C.parts){ const pp=part.ppr, P=part.path; for(let i=0;i+pp<P.length;i+=pp){ let s=0; for(let j=i+1;j<=i+pp;j++) s+=Math.hypot(P[j][0]-P[j-1][0],P[j][1]-P[j-1][1],P[j][2]-P[j-1][2]); m=Math.max(m,s);} } return m; }
function guidePoints(r,S,pitch,nBuy,buf,stripFt){
  const up=r.A_points.find(p=>p.name!=='bottom point'), bot=r.A_points.find(p=>p.name==='bottom point');
  return { title:'Wrapping guide · Points + centre',
    sub:'Each of the five points is wound on its own, then the centre is wound as a box. The five points and the centre are separate pieces of wire.',
    steps:[...prepSteps(nBuy,buf,stripFt),
    `<b>Mark the bars.</b> On every bar of every point, put a mark every ${cm(pitch)} measured along the bar from the centre to the tip. Upper point bars are ${cm(S.points[0].edge)} and the bottom point bars ${cm(S.points[4].edge)}.`,
    `<b>Wrap each upper point.</b> Start where the point meets the centre. Cable-tie the wire to a corner, then wind round all four bars of that point (front two, back two), one turn per mark, until you reach the tip. Each upper point takes about ${up.loops} turns and ${nf(up.length/100,1)} m of wire. Tie off at the tip.`,
    `<b>Wrap the bottom point</b> the same way: about ${bot.loops} turns and ${nf(bot.length/100,1)} m.`,
    `<b>Wrap the centre.</b> Mark every ${cm(pitch)} up the centre from its bottom edge to its top corner (${cm(r.A_center.height)}). Wind level turns across the front pentagon, round the ${cm(S.depth)} side, across the back and round the other side: about ${r.A_center.loops} turns and ${nf(r.A_center.length/100,1)} m.`,
    `<b>Changing strips.</b> When a strip runs out, plug in the next and keep winding. Tape over every connector and turn it to face the back.`,
    `<b>Light test.</b> Plug in and look for dark sections before tidying the ties.`]};
}
function renderGuide(r,S,pitch,stripCm,nBuy,buf){
  const on=$('showGuide').checked; $('guide').hidden=!on || view==='F'; if(!on||view==='F') return [];
  const stripFt=stripCm/STRIP_CM_PER_FT;
  const g = view==='A' ? guidePoints(r,S,pitch,nBuy,buf,stripFt) : guideSpiral(r,S,pitch,nBuy,buf,stripFt);
  $('guideTitle').textContent=g.title; $('guideSub').textContent=g.sub;
  $('guideSteps').innerHTML=g.steps.map(s=>`<li>${s}</li>`).join('');
  const runs = view==='A' ? [...r.A_points.map(p=>({name:p.name,path:p.path,ppr:4,loops:p.loops})), {name:'centre',path:r.A_center.path,ppr:4,loops:r.A_center.loops}] : r.C.parts;
  const ends=stripEnds(runs, view==='A'?r.A_total:r.C.length, stripCm, view!=='A');
  const where=e=> e.ring==null ? 'return run down to the notch' : `${cap(e.run.name)}, turn ${e.ring} of ${e.of}`;
  const posCol = view==='A'
    ? ['Distance from the centre', e=> e.run.name==='centre' ? `${nf(Math.min(e.ring*pitch,r.A_center.height),1)} cm up` : `${nf(Math.min(e.ring*pitch,S.points.find(p=>p.name===e.run.name).edge),1)} cm along the bar`]
    : ['Height above bottom tip', e=>`${nf(e.pos[1]-S.ymin,1)} cm`];
  $('tblJoins').innerHTML = ends.length ? `<thead><tr><th>Strip</th><th>Runs out at</th><th>${posCol[0]}</th></tr></thead><tbody>${
    ends.map(e=>`<tr><td>Strip ${e.n} → ${e.n+1}</td><td>${where(e)}</td><td>${posCol[1](e)}</td></tr>`).join('')}</tbody>` : '<tbody><tr><td>One strip covers the whole wrap.</td></tr></tbody>';
  return ends;
}


['vA','vC','vF'].forEach(id=>$(id).addEventListener('click',()=>{view=id.slice(1);['vA','vC','vF'].forEach(j=>$(j).setAttribute('aria-pressed',String(j===id)));schedule();}));
document.querySelectorAll('input,select').forEach(el=>el.addEventListener('input',schedule));
$('spin').addEventListener('change',()=>{controls.autoRotate=$('spin').checked;});
if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){controls.autoRotate=false;$('spin').checked=false;}
update();
