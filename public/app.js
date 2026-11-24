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
// fade the far side of the star so back-face wire doesn't show through the front as blotchy patches
scene.fog = new THREE.Fog(0x0d0c1c, 1, 2);
function updateFog(){ const d=camera.position.distanceTo(controls.target); scene.fog.near=d-10; scene.fog.far=d+70; }

// soft round sprite for bulbs
const sprite = (()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.45,'rgba(255,255,255,1)');gr.addColorStop(.6,'rgba(255,255,255,.25)');gr.addColorStop(.75,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);const t=new THREE.CanvasTexture(c);return t;})();

const ringTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle='#ff5d8f';g.beginPath();g.arc(32,32,28,0,Math.PI*2);g.fill();g.fillStyle='#ffffff';g.beginPath();g.arc(32,32,12,0,Math.PI*2);g.fill();return new THREE.CanvasTexture(c);})();
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe(stage); resize();
let anim=null, lastT=performance.now();
renderer.setAnimationLoop((t)=>{const dt=Math.min(0.1,(t-lastT)/1000); lastT=t; tickAnim(dt); controls.update(); updateFog(); renderer.render(scene,camera);});

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
  const params={upperEdge:num('upperEdge',80),bottomEdge:num('bottomEdge',112),depth:num('depth',27),sideEdge:num('sideEdge',53),bottomInner:num('bottomInner',58),pitch,frontLR:$('dir').value==='lr',sideSeparate:$('sideSeparate').checked};
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
  let bulbs=0;
  const ends=renderGuide(r,S,pitch,stripCm,(view==='A'?bA:bC).n1,buf);
  if(view!=='F'){
    const runs = view==='A'
      ? [...r.A_points.map(p=>({name:p.name,path:p.path,starts:p.starts,loops:p.loops,linked:false})), {name:'centre',path:r.A_center.path,starts:r.A_center.starts,loops:r.A_center.loops,linked:false}]
      : r.C.parts;
    bulbs = buildAnim(buildSequence(runs, view==='A'?r.A_total:r.C.length), S, stripCm, ledColor, ends);
  } else { anim=null; }
  $('playbar').hidden = view==='F';
  const L=view==='A'?r.A_total:view==='C'?r.C.length:S.barTotal;
  $('legend').innerHTML = view==='F' ? `Frame bars ${nf(L/100,2)} m` : `${nf(L/100,1)} m wire${bulbs?` · ~${nf(bulbs,0)} bulbs`:''}${anim&&anim.ends.length?'<br><span style="color:#ff8fb1">● pink dots = where strips run out</span>':''}`;
}
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
// ---------- wrapping guide ----------
// Each run is one continuous piece of wire: {name, path, starts (path index where each turn begins), loops}.
// Joins: points where strip k ends, measured along the wire. Polyline lengths are scaled to the exact total.
// A sequence is the wire in wrapping order: pieces, plus the linking runs between pieces that share one wire.
// cum[] holds the length of wire used up to each vertex, scaled so the end equals the exact total.
function buildSequence(runs, exactTotal){
  const items=[]; let poly=0;
  runs.forEach((run,ri)=>{
    if(ri && run.linked){ const A=items.at(-1).path.at(-1), B=run.path[0];
      const d=Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2]);
      if(d>0.5){ items.push({name: /top point/.test(run.name)&&/top point/.test(items.at(-1).name)?'return run':'link', path:[A,B], starts:[0], loops:0, jump:true, cum:[poly,poly+d]}); poly+=d; } }
    const cum=[poly]; for(let i=1;i<run.path.length;i++){ const A=run.path[i-1],B=run.path[i]; poly+=Math.hypot(B[0]-A[0],B[1]-A[1],B[2]-A[2]); cum.push(poly); }
    items.push({...run, cum});
  });
  const k=poly/exactTotal; items.forEach(it=>{ it.cum=it.cum.map(c=>c/k); });
  let piece=0; items.forEach(it=>{ if(!it.jump) it.piece=++piece; });
  return {items, total:exactTotal};
}
function locate(seq, s){ // item, vertex index and position at wire length s
  for(const it of seq.items){ const c=it.cum; if(s>c.at(-1)+1e-9) continue;
    let lo=0, hi=c.length-1; while(hi-lo>1){ const m=(lo+hi)>>1; if(c[m]<=s) lo=m; else hi=m; }
    if(s<c[0]) return {it, i:1, t:0, pos:it.path[0], dir:sub(it.path[1],it.path[0])};
    const i=hi, A=it.path[i-1], B=it.path[i], t=(s-c[i-1])/((c[i]-c[i-1])||1);
    return {it, i, t, pos:[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t], dir:sub(B,A)};
  }
  const it=seq.items.at(-1), n=it.path.length-1; return {it, i:n, t:1, pos:it.path[n], dir:sub(it.path[n],it.path[n-1])};
}
const sub=(B,A)=>[B[0]-A[0],B[1]-A[1],B[2]-A[2]];
// 1-based turn number for the segment ending at path index i
function turnAt(it,i){ const st=it.starts; let lo=0,hi=st.length; while(lo<hi){const m=(lo+hi)>>1; if(st[m]<=i-1) lo=m+1; else hi=m;} return Math.max(1,Math.min(it.loops,lo)); }
function stripEndsFor(seq, stripCm){
  const out=[];
  for(let n=1; n*stripCm<seq.total-1e-6; n++){ const L=locate(seq,n*stripCm);
    out.push({n, s:n*stripCm, pos:L.pos, run:L.it, ring:L.it.jump?null:turnAt(L.it,L.i), of:L.it.loops}); }
  return out;
}
const cm = x=>`<span class="num">${nf(x,x<100?1:0)} cm</span>`;
function prepSteps(nBuy, buf, stripFt){ return [
  `<b>Get the wire ready.</b> Buy <span class="num">${nBuy}</span> strips of ${nf(stripFt,0)} ft (this includes the ${buf}% spare). Plug each one in before it goes on the frame and set aside any that don't fully light.`,
  `<b>Plan the power.</b> Check the box for how many sets can be linked end to end on one plug. If ${nBuy} is more than that, split the wrap into runs of that many strips, and give each run its own plug at the start. Start a new run at one of the strip ends listed in the table below.`,
];}
function dirWords(){ const lr=$('dir').value==='lr';
  return lr ? 'Facing the front, take the wire across the front from left to right, round the right side to the back, across the back from right to left, and round the left side to the front again'
            : 'Facing the front, take the wire across the front from right to left, round the left side to the back, across the back from left to right, and round the right side to the front again'; }
function guideSpiral(r,S,pitch,nBuy,buf,stripFt){
  const H=S.ymax-S.ymin, notch=r.C.splitY-S.ymin, side=S.inner.find(v=>v.name==='F bottom-right').p[1]-S.ymin;
  const P=n=>r.C.parts.find(p=>p.name===n), trunk=P('main body'), tops=r.C.parts.filter(p=>/top point/.test(p.name)), sides=r.C.parts.filter(p=>/^(left|right) point$/.test(p.name));
  const tieEvery=Math.max(1,Math.round(10/pitch)), sep=sides.length>0, pn=n=>r.C.parts.findIndex(p=>p.name===n)+1;
  const steps=[...prepSteps(nBuy,buf,stripFt)];
  steps.push(sep
    ? `<b>Mark the frame.</b> On the left and right points, mark every bar every ${cm(pitch)} from the centre out to the tip. For the rest, stand the star upright and mark the front bars every 10 cm up from the bottom tip to ${cm(H)}. Cut a strip of card ${cm(pitch)} wide to hold between turns as a spacer.`
    : `<b>Mark the heights.</b> Stand the star upright. With a tape measure from the bottom tip, mark the front bars every 10 cm up to ${cm(H)}. Each 10 cm is about ${nf(10/pitch,1)} turns. Cut a strip of card ${cm(pitch)} wide to hold between turns as a spacer.`);
  if(sep) sides.forEach(sd=>steps.push(
    `<b>Piece ${pn(sd.name)}: the ${sd.name}.</b> Start at the front corner where it joins the centre, at the number tag in 3D, and cable-tie the wire there. Wind round all four bars of the point, one turn per mark, working out to the tip: about ${sd.loops} turns. Keep turning the same way as the arrow in the animation. Tie off at the tip. Its flat underside gets a turn every ${cm(pitch)} this way.`));
  steps.push(
    `<b>Piece ${pn('main body')}: the spiral, from the bottom tip.</b> Cable-tie the wire to the bottom tip. ${dirWords()}. Each turn sits ${cm(pitch)} above the last. Pull it taut so it runs straight between bars.`,
    `<b>Tie as you go.</b> Put a cable tie on a bar about every ${tieEvery} turns (roughly every 10 cm of height) so the turns can't slide down.`,
    sep ? `<b>Past the side points.</b> From ${cm(side)} the turns go round the centre only, across the joints where the side points meet it. The side points are already done, so don't take these turns out to their tips.`
        : `<b>Past the side points.</b> At about ${cm(side)} the left and right points begin. Keep every turn going round the full width, out to both side points and back. These are the longest turns, up to ${cm(maxRing(r))} each. Their flat undersides only get a turn every 20 cm or so this way.`,
    `<b>Stop at the top notch.</b> At ${cm(notch)} you reach the top corner of the centre, where the two top points split apart. That is turn ${trunk?trunk.loops:'?'}. Finish the turn and cable-tie the wire to the corner.`,
    `<b>Piece ${pn(tops[0]?.name)}: the ${tops[0]?.name||'left top point'}.</b> Keep the same wire and wind round that point only, still ${cm(pitch)} per turn, up to its tip at ${cm(H)}: about ${tops[0]?.loops||0} turns. Tie it off at the tip.`,
    `<b>Come back down.</b> Run the wire straight back down the inside bar of that point to the notch, about ${cm(r.C.joins)}. Tie it to the bar every 10 cm so it lies flat.`,
    `<b>Piece ${pn(tops[1]?.name)}: the ${tops[1]?.name||'right top point'}.</b> Wind round it the same way up to its tip, about ${tops[1]?.loops||0} turns. Tie off and tuck the end.`,
    `<b>Changing strips.</b> When a strip runs out, plug in the next and keep winding. The table below shows roughly where each one ends. If a piece finishes partway through a strip, run the rest of that strip along a bar to the start of the next piece and tie it down. Tape over every connector and turn it to face the back.`,
    `<b>Light test.</b> Plug in and look for dark sections before tidying the ties. Do not cover the wire with anything that traps heat.`);
  return { title:'Wrapping guide · Full-body spiral',
    sub: sep ? `${r.C.parts.length} pieces in this order: ${r.C.parts.map((p,i)=>`${i+1} ${p.name}`).join(', ')}. Pieces ${pn('main body')} to ${r.C.parts.length} are one continuous wire. Heights are measured straight up from the bottom tip; the star is ${nf(H,0)} cm tall.`
             : `One wire, wound in level turns from the bottom tip up to the two top tips. Heights are measured straight up from the bottom tip; the star is ${nf(H,0)} cm tall.`,
    steps};
}
function maxRing(r){ // longest single turn of the spiral
  let m=0; for(const part of r.C.parts){ const P=part.path, st=part.starts; for(let k=0;k<st.length;k++){ const end=st[k+1]??P.length-1; let s=0; for(let j=st[k]+1;j<=end;j++) s+=Math.hypot(P[j][0]-P[j-1][0],P[j][1]-P[j-1][1],P[j][2]-P[j-1][2]); m=Math.max(m,s);} } return m; }
function guidePoints(r,S,pitch,nBuy,buf,stripFt){
  const up=r.A_points.find(p=>p.name!=='bottom point'), bot=r.A_points.find(p=>p.name==='bottom point');
  return { title:'Wrapping guide · Points + centre',
    sub:'Each of the five points is wound on its own, then the centre is wound as a box. The five points and the centre are separate pieces of wire.',
    steps:[...prepSteps(nBuy,buf,stripFt),
    `<b>Mark the bars.</b> On every bar of every point, put a mark every ${cm(pitch)} measured along the bar from the centre to the tip. Upper point bars are ${cm(S.points[0].edge)} and the bottom point bars ${cm(S.points[4].edge)}.`,
    `<b>Pieces 1 to 5: the points</b>, in the order right, upper-right, upper-left, left, bottom (numbered in 3D). Start where the point meets the centre. Cable-tie the wire to a corner, then wind round all four bars of that point (front two, back two), one turn per mark, until you reach the tip. Turn the same way as the arrow in the animation. Each upper point takes about ${up.loops} turns and ${nf(up.length/100,1)} m of wire. Tie off at the tip.`,
    `<b>The bottom point</b> (piece 5) is longer: about ${bot.loops} turns and ${nf(bot.length/100,1)} m.`,
    `<b>Piece 6: the centre.</b> Mark every ${cm(pitch)} up the centre from its bottom edge to its top corner (${cm(r.A_center.height)}). ${dirWords()}, ${cm(pitch)} higher each turn (the side is ${cm(S.depth)} deep): about ${r.A_center.loops} turns and ${nf(r.A_center.length/100,1)} m.`,
    `<b>Changing strips.</b> When a strip runs out, plug in the next and keep winding. Tape over every connector and turn it to face the back.`,
    `<b>Light test.</b> Plug in and look for dark sections before tidying the ties.`]};
}
function renderGuide(r,S,pitch,stripCm,nBuy,buf){
  const on=$('showGuide').checked; $('guide').hidden=!on || view==='F'; if(!on||view==='F') return [];
  const stripFt=stripCm/STRIP_CM_PER_FT;
  const g = view==='A' ? guidePoints(r,S,pitch,nBuy,buf,stripFt) : guideSpiral(r,S,pitch,nBuy,buf,stripFt);
  $('guideTitle').textContent=g.title; $('guideSub').textContent=g.sub;
  $('guideSteps').innerHTML=g.steps.map(s=>`<li>${s}</li>`).join('');
  const runs = view==='A' ? [...r.A_points.map(p=>({name:p.name,path:p.path,starts:p.starts,loops:p.loops,linked:false})), {name:'centre',path:r.A_center.path,starts:r.A_center.starts,loops:r.A_center.loops,linked:false}] : r.C.parts;
  const ends=stripEndsFor(buildSequence(runs, view==='A'?r.A_total:r.C.length), stripCm);
  const where=e=> e.ring==null ? (e.run.name==='return run'?'return run down to the notch':'link between pieces') : `${cap(e.run.name)} (piece ${e.run.piece}), turn ${e.ring} of ${e.of}`;
  const posCol = view==='A'
    ? ['Distance from the centre', e=> e.ring==null ? '' : e.run.name==='centre' ? `${nf(Math.min(e.ring*pitch,r.A_center.height),1)} cm up` : `${nf(Math.min(e.ring*pitch,S.points.find(p=>p.name===e.run.name).edge),1)} cm along the bar`]
    : ['Where', e=> /^(left|right) point$/.test(e.run.name) ? `${nf(Math.min(e.ring*pitch,S.points.find(p=>p.name===e.run.name).edge),1)} cm along the bar` : `${nf(e.pos[1]-S.ymin,1)} cm above bottom tip`];
  $('tblJoins').innerHTML = ends.length ? `<thead><tr><th>Strip</th><th>Runs out at</th><th>${posCol[0]}</th></tr></thead><tbody>${
    ends.map(e=>`<tr data-s="${e.s}" tabindex="0"><td>Strip ${e.n} → ${e.n+1}</td><td>${where(e)}</td><td>${posCol[1](e)}</td></tr>`).join('')}</tbody>` : '<tbody><tr><td>One strip covers the whole wrap.</td></tr></tbody>';
  return ends;
}


// ---------- wrapping animation ----------
const STRIP_TONES=[null, new THREE.Color('#5fd3ff')]; // even strips use the LED colour, odd strips this
function textSprite(text, bg, fg='#1b1400', h=11){
  const c=document.createElement('canvas'), g=c.getContext('2d'), fs=44;
  g.font=`600 ${fs}px IBM Plex Sans, system-ui, sans-serif`; const w=Math.ceil(g.measureText(text).width)+36;
  c.width=w; c.height=fs+24; g.font=`600 ${fs}px IBM Plex Sans, system-ui, sans-serif`;
  g.fillStyle=bg; g.beginPath(); g.roundRect(0,0,w,c.height,c.height/2); g.fill();
  g.fillStyle=fg; g.textBaseline='middle'; g.fillText(text,18,c.height/2+2);
  const m=new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,transparent:true,fog:false});
  const s=new THREE.Sprite(m); s.scale.set(h*w/c.height,h,1); s.renderOrder=10; return s;
}
function buildAnim(seq, S, stripCm, ledColor, ends){
  const prevFrac = anim ? anim.s/anim.seq.total : 1, wasPlaying = anim?.playing;
  const byStrip=$('stripColors').checked, wire=$('showWire').checked, base=ledColor.clone().multiplyScalar(.8);
  const lines=[], ghosts=[];
  for(const it of seq.items){
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(it.path.flat(),3));
    const col=[]; it.cum.forEach(c=>{ const odd=byStrip && Math.floor(c/stripCm)%2===1; const k=odd?STRIP_TONES[1].clone().multiplyScalar(.85):base; col.push(k.r,k.g,k.b); });
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    const L=new THREE.Line(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:it.jump?.95:.8}));
    L.visible=wire; group.add(L); lines.push(L);
    const G=new THREE.Line(g,new THREE.LineBasicMaterial({color:0x8c88b5,transparent:true,opacity:.12})); group.add(G); ghosts.push(G);
  }
  // bulbs in wrapping order, so a draw range can grow with the animation
  let bulbPts=null, bulbCum=[];
  if($('showBulbs').checked){
    const step=bulbCm(), pos=[];
    for(const it of seq.items){ if(it.jump) continue;
      let next=Math.ceil(it.cum[0]/step)*step;
      for(let i=1;i<it.path.length;i++){ const c0=it.cum[i-1], c1=it.cum[i];
        while(next<=c1){ const t=(next-c0)/((c1-c0)||1), A=it.path[i-1], B=it.path[i];
          pos.push(A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t); bulbCum.push(next); next+=step; } } }
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    bulbPts=new THREE.Points(g,new THREE.PointsMaterial({color:ledColor,size:Math.min(6,Math.max(2,step*0.4)),map:sprite,transparent:true,alphaTest:0.2,depthWrite:false}));
    group.add(bulbPts);
  }
  // strip ends
  let endPts=null;
  if(ends.length){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(ends.flatMap(e=>e.pos),3));
    endPts=new THREE.Points(g,new THREE.PointsMaterial({color:0xffffff,size:9,map:ringTex,transparent:true,alphaTest:0.3,depthWrite:false,depthTest:false,fog:false})); endPts.renderOrder=5; group.add(endPts); }
  // piece numbers at each start, plus FRONT / BACK labels on the ground
  seq.items.filter(it=>!it.jump).forEach(it=>{ const s=textSprite(String(it.piece),'#ffb53d','#1b1400',9); const p=it.path[0]; s.position.set(p[0],p[1]-7,p[2]+(p[2]>=0?6:-6)); group.add(s); });
  const fr=textSprite('FRONT','#e9e6f5','#141327',10); fr.position.set(0,S.ymin-12,S.depth/2+45); group.add(fr);
  // moving head: glow + arrow cone
  const head=new THREE.Group();
  // crisp marker for the end of the wire: white ball with a pink ring that always faces the camera
  const ball=new THREE.Mesh(new THREE.SphereGeometry(2.4,16,12),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,fog:false})); ball.renderOrder=12; head.add(ball);
  const ringC=document.createElement('canvas'); ringC.width=ringC.height=64; const rg=ringC.getContext('2d'); rg.strokeStyle='#ff5d8f'; rg.lineWidth=6; rg.beginPath(); rg.arc(32,32,26,0,Math.PI*2); rg.stroke();
  const ring=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(ringC),depthTest:false,transparent:true,fog:false})); ring.scale.set(11,11,1); ring.renderOrder=11; head.add(ring);
  const cone=new THREE.Mesh(new THREE.ConeGeometry(3.2,10,16),new THREE.MeshBasicMaterial({color:0xff5d8f,depthTest:false,fog:false})); cone.renderOrder=12; head.add(cone);
  group.add(head);
  anim={seq, lines, ghosts, bulbPts, bulbCum, endPts, ends, head, cone, stripCm, S, s:prevFrac*seq.total, playing:!!wasPlaying};
  applyProgress();
  return bulbCum.length || (seq.total/bulbCm());
}
const upper=(arr,x)=>{let lo=0,hi=arr.length;while(lo<hi){const m=(lo+hi)>>1;if(arr[m]<=x)lo=m+1;else hi=m;}return lo;};
function applyProgress(){
  if(!anim) return; const {seq,s}=anim, done=s>=seq.total-1e-6;
  seq.items.forEach((it,k)=>{ const n=upper(it.cum,s); anim.lines[k].geometry.setDrawRange(0,n); anim.ghosts[k].visible=!done; });
  if(anim.bulbPts) anim.bulbPts.geometry.setDrawRange(0,upper(anim.bulbCum,s));
  if(anim.endPts) anim.endPts.geometry.setDrawRange(0,done?anim.ends.length:upper(anim.ends.map(e=>e.s),s));
  const L=locate(seq,Math.min(s,seq.total)); anim.head.visible=!done && s>0;
  anim.head.position.set(...L.pos);
  const d=new THREE.Vector3(...L.dir); if(d.lengthSq()>0){ d.normalize(); anim.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d); anim.cone.position.copy(d).multiplyScalar(6); }
  $('scrub').value=String(Math.round(1000*Math.min(1,s/seq.total)));
  $('play').textContent = anim.playing ? '❚❚ Pause' : (done ? '▶ Play wrapping' : '▶ Resume');
  $('status').innerHTML = statusText(L, s, done);
}
function statusText(L, s, done){
  const {seq,stripCm,S}=anim, nStrips=Math.ceil(seq.total/stripCm-1e-9);
  if(done) return `Finished: <b>${nStrips}</b> strips laid in <b>${seq.items.filter(i=>!i.jump).length}</b> pieces. Press play to watch the order, or click a strip in the table below.`;
  const it=L.it, strip=Math.min(nStrips,Math.floor(s/stripCm)+1);
  if(it.jump) return `Strip <b>${strip}</b> of ${nStrips} · ${it.name==='return run'?'running the wire back down to the notch along the inside bar':'carrying the wire on to the next piece'}`;
  const turn=turnAt(it,L.i), [dx,dy,dz]=L.dir, z=L.pos[2];
  let how;
  const lr=dx>0?'left → right':'right → left';
  if(Math.abs(dz)<0.5*Math.hypot(dx,dy,dz)) how = z>=0 ? `crossing the <span class="dirn">front, ${lr}</span>` : `crossing the <span class="dirn">back, ${lr}</span>`;
  else { // which edge: the side of this turn the wire is on, from the turn's own x-range
    const t=turnAt(it,L.i)-1, ring=it.path.slice(it.starts[t], (it.starts[t+1]??it.path.length)+1), xs=ring.map(q=>q[0]), mid=(Math.min(...xs)+Math.max(...xs))/2;
    const edge = /^(left|right) point$|^(upper|bottom)|centre/.test(it.name) ? 'edge' : (L.pos[0]>mid?'right edge':'left edge');
    how = `going round the <span class="dirn">${edge} to the ${dz<0?'back':'front'}</span>`; }
  const where = /^(left|right) point$|^(upper|bottom)/.test(it.name) || view==='A' ? '' : ` · ${nf(L.pos[1]-S.ymin,0)} cm above bottom tip`;
  return `Strip <b>${strip}</b> of ${nStrips} · Piece <b>${it.piece}</b>: ${it.name}, turn <b>${turn}</b> of ${it.loops}${where} · ${how}`;
}
function tickAnim(dt){
  if(!anim||!anim.playing) return;
  const speed=parseFloat($('speed').value)||1;
  anim.s += dt*speed*anim.seq.total/90; // 1× lays the whole wrap in 90 s
  if(anim.s>=anim.seq.total){ anim.s=anim.seq.total; anim.playing=false; }
  applyProgress();
}
function seek(s){ if(!anim) return; anim.s=Math.max(0,Math.min(anim.seq.total,s)); applyProgress(); }
$('play').addEventListener('click',()=>{ if(!anim) return;
  if(anim.playing){ anim.playing=false; } else { if(anim.s>=anim.seq.total-1e-6) anim.s=0; anim.playing=true; controls.autoRotate=false; $('spin').checked=false; }
  applyProgress(); });
$('scrub').addEventListener('input',e=>{ if(!anim) return; anim.playing=false; seek(anim.seq.total*parseFloat(e.target.value)/1000); });
$('prevStrip').addEventListener('click',()=>{ if(!anim) return; anim.playing=false; const k=Math.ceil(anim.s/anim.stripCm-1e-6)-1; seek(Math.max(0,k*anim.stripCm)); });
$('nextStrip').addEventListener('click',()=>{ if(!anim) return; anim.playing=false; const k=Math.floor(anim.s/anim.stripCm+1e-6)+1; seek(k*anim.stripCm); });
$('faceFront').addEventListener('click',()=>{ controls.autoRotate=false; $('spin').checked=false; camera.position.set(0,-20,470); controls.target.set(0,-20,0); controls.update(); });
$('tblJoins').addEventListener('click',e=>{ const tr=e.target.closest('tr[data-s]'); if(!tr||!anim) return; anim.playing=false; seek(parseFloat(tr.dataset.s)); $('stage').scrollIntoView({behavior:'smooth',block:'center'}); });
$('tblJoins').addEventListener('keydown',e=>{ if(e.key==='Enter'){ const tr=e.target.closest('tr[data-s]'); if(tr&&anim){ anim.playing=false; seek(parseFloat(tr.dataset.s)); } } });

['vA','vC','vF'].forEach(id=>$(id).addEventListener('click',()=>{view=id.slice(1);['vA','vC','vF'].forEach(j=>$(j).setAttribute('aria-pressed',String(j===id)));schedule();}));
document.querySelectorAll('aside input, aside select').forEach(el=>el.addEventListener('input',schedule));
$('spin').addEventListener('change',()=>{controls.autoRotate=$('spin').checked;});
if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){controls.autoRotate=false;$('spin').checked=false;}
update();
