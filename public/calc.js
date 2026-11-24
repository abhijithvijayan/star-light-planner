// Star frame geometry and LED wrap calculator. Pure functions, no DOM.
// Units: cm. Axes: x right, y up, z toward the viewer. Tips at z = 0, faces at z = +/- depth/2.
function buildStar(p){
  const {upperEdge:Lu, bottomEdge:Lb, depth:D, sideEdge:a, bottomInner:b} = p;
  // Cyclic pentagon with 4 sides a and one side b (bottom, horizontal). Solve circumradius R.
  const f = R => 8*Math.asin(Math.min(1,a/(2*R))) + 2*Math.asin(Math.min(1,b/(2*R))) - 2*Math.PI;
  let lo = Math.max(a,b)/2 + 1e-9, hi = 1e4;
  for (let i=0;i<200;i++){ const m=(lo+hi)/2; if (f(m)>0) lo=m; else hi=m; }
  const R=(lo+hi)/2, ta=2*Math.asin(a/(2*R)), tb=2*Math.asin(b/(2*R));
  // CCW from bottom-right
  const ang=[-Math.PI/2+tb/2]; for(let i=1;i<5;i++) ang.push(ang[i-1]+ta);
  const P2=ang.map(t=>[R*Math.cos(t), R*Math.sin(t)]); // [BR, R, Top, L, BL]
  const names=['bottom-right','mid-right','top','mid-left','bottom-left'];
  const h=D/2;
  const inner=[]; P2.forEach((q,i)=>{inner.push({name:'F '+names[i],p:[q[0],q[1],h]});});
  P2.forEach((q,i)=>{inner.push({name:'B '+names[i],p:[q[0],q[1],-h]});});
  // edges i->(i+1): 0 BR-R (mid-right), 1 R-Top (top-right), 2 Top-L (top-left), 3 L-BL (mid-left), 4 BL-BR (bottom)
  const pointNames=['right point','upper-right point','upper-left point','left point','bottom point'];
  const tips=[], points=[];
  for(let i=0;i<5;i++){
    const A=P2[i], B=P2[(i+1)%5], e=Math.hypot(B[0]-A[0],B[1]-A[1]);
    const L = i===4 ? Lb : Lu;
    const hh2 = L*L - (e/2)**2 - h*h;
    if (hh2<=0) return {error:`Point edge ${L} cm is too short for inner edge ${e.toFixed(1)} cm and depth ${D} cm.`};
    const hh=Math.sqrt(hh2);
    const M=[(A[0]+B[0])/2,(A[1]+B[1])/2], n=Math.hypot(M[0],M[1]);
    const T=[M[0]+M[0]/n*hh, M[1]+M[1]/n*hh, 0];
    tips.push({name:pointNames[i],p:T});
    points.push({name:pointNames[i], tip:T, base:[[A[0],A[1],h],[B[0],B[1],h],[B[0],B[1],-h],[A[0],A[1],-h]], edge:L, innerEdge:e, height:hh, depth:D});
  }
  // bars
  const bars=[]; const fr=inner.slice(0,5).map(v=>v.p), bk=inner.slice(5).map(v=>v.p);
  for(let i=0;i<5;i++){ bars.push([fr[i],fr[(i+1)%5]]); bars.push([bk[i],bk[(i+1)%5]]); bars.push([fr[i],bk[i]]); }
  points.forEach(pt=>pt.base.forEach(bv=>bars.push([bv,pt.tip])));
  const len=s=>Math.hypot(s[1][0]-s[0][0],s[1][1]-s[0][1],s[1][2]-s[0][2]);
  const barTotal=bars.reduce((s,b)=>s+len(b),0);
  return {R, P2, inner, tips, points, bars, barTotal, depth:D,
    ymin:Math.min(...tips.map(t=>t.p[1])), ymax:Math.max(...tips.map(t=>t.p[1]))};
}
const lerp=(A,B,t)=>[A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t];
const dist=(A,B)=>Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2]);
function polyLen(pts){let s=0;for(let i=1;i<pts.length;i++)s+=dist(pts[i-1],pts[i]);return s;}
// Turn a list of closed loops (each an array of 3D points) into one helical polyline:
// each loop starts at its first point, and its vertical/axial travel is spread along the loop toward the next loop's start.
function helixFromLoops(loops){
  const out=[];
  for(let k=0;k<loops.length;k++){
    const L=loops[k], next=loops[k+1]; const ring=[...L, L[0]];
    const per=[0]; for(let i=1;i<ring.length;i++) per.push(per[i-1]+dist(ring[i-1],ring[i]));
    const tot=per[per.length-1]||1;
    for(let i=0;i<ring.length-(next?1:0);i++){
      const t=per[i]/tot;
      if(!next){ out.push(ring[i]); continue; }
      // blend toward the matching vertex position on the next loop (same vertex count) for a smooth spiral
      const j=Math.min(i, next.length-1);
      out.push(next.length===L.length ? lerp(ring[i], next[i%next.length], t) : ring[i]);
    }
  }
  return out;
}
// Method A: each point as a rectangular pyramid, loops spaced `pitch` along the slant edge.
function wrapPoint(pt,pitch){
  const n=Math.max(1,Math.floor(pt.edge/pitch));
  const loops=[];
  for(let k=0;k<=n;k++){ const t=Math.min(1,k*pitch/pt.edge); if(t>=0.999) break; loops.push(pt.base.map(bv=>lerp(bv,pt.tip,t))); }
  const path=helixFromLoops(loops); path.push(pt.tip);
  return {path, loops:loops.length, length:polyLen(path)};
}
// x-extent of the inner pentagon at height y
function pentWidth(P2,y){
  const xs=[];
  for(let i=0;i<5;i++){const A=P2[i],B=P2[(i+1)%5]; if((A[1]-y)*(B[1]-y)<=0 && A[1]!==B[1]){const t=(y-A[1])/(B[1]-A[1]); xs.push(A[0]+(B[0]-A[0])*t);} }
  if(xs.length<2) return null; return [Math.min(...xs),Math.max(...xs)];
}
function wrapCenter(S,pitch){
  const ys=S.P2.map(q=>q[1]), y0=Math.min(...ys), y1=Math.max(...ys), h=S.depth/2;
  const loops=[];
  for(let y=y0+pitch/2;y<y1;y+=pitch){ const w=pentWidth(S.P2,y); if(!w) continue;
    loops.push([[w[0],y,h],[w[1],y,h],[w[1],y,-h],[w[0],y,-h]]); }
  const path=helixFromLoops(loops);
  return {path, loops:loops.length, length:polyLen(path), height:y1-y0};
}
// Method B: horizontal slices of the whole body; taut loop = convex hull of the slice.
function hull2(pts){
  pts=pts.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]); if(pts.length<3) return pts;
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lo=[],up=[];
  for(const p of pts){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
  for(let i=pts.length-1;i>=0;i--){const p=pts[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}
  up.pop();lo.pop();return lo.concat(up);
}
function sliceBody(S,y){
  const pieces=S.points.map(pt=>[pt.tip,...pt.base]);
  pieces.push(S.inner.map(v=>v.p));
  const xz=[];
  for(const pc of pieces) for(let i=0;i<pc.length;i++) for(let j=i+1;j<pc.length;j++){
    const A=pc[i],B=pc[j]; if((A[1]-y)*(B[1]-y)>0||A[1]===B[1]) continue;
    const t=(y-A[1])/(B[1]-A[1]); xz.push([A[0]+(B[0]-A[0])*t, A[2]+(B[2]-A[2])*t]);
  }
  return hull2(xz);
}
function wrapBody(S,pitch,res=48){
  const loops=[];
  for(let y=S.ymin+pitch/2;y<S.ymax;y+=pitch){
    const H=sliceBody(S,y); if(H.length<2) continue;
    // resample hull to `res` points by angle from slice centroid so consecutive loops line up into a spiral
    const ring=[...H,H[0]], per=[0]; for(let i=1;i<ring.length;i++) per.push(per[i-1]+Math.hypot(ring[i][0]-ring[i-1][0],ring[i][1]-ring[i-1][1]));
    const tot=per[per.length-1];
    // start from leftmost point
    let s0=0; for(let i=1;i<H.length;i++) if(H[i][0]<H[s0][0]) s0=i;
    const off=per[s0]; const pts=[];
    for(let k=0;k<res;k++){ let d=(off+tot*k/res)%tot; let i=1; while(i<per.length-1&&per[i]<d) i++;
      const t=(d-per[i-1])/((per[i]-per[i-1])||1); const a=ring[i-1],b=ring[i];
      pts.push([a[0]+(b[0]-a[0])*t, y, a[1]+(b[1]-a[1])*t]); }
    loops.push({pts, perim:tot});
  }
  const path=helixFromLoops(loops.map(l=>l.pts));
  // exact length: hull perimeters with the pitch rise folded in
  const length=loops.reduce((s,l)=>s+Math.hypot(l.perim,pitch),0);
  return {path, loops:loops.length, length, height:S.ymax-S.ymin};
}
// Per-piece slices merged into separate components (pieces whose x-ranges overlap or touch).
function sliceComponents(S,y){
  const pieces=S.points.map(pt=>[pt.tip,...pt.base]); pieces.push(S.inner.map(v=>v.p));
  const parts=[];
  for(const pc of pieces){ const xz=[];
    for(let i=0;i<pc.length;i++) for(let j=i+1;j<pc.length;j++){
      const A=pc[i],B=pc[j]; if((A[1]-y)*(B[1]-y)>0||A[1]===B[1]) continue;
      const t=(y-A[1])/(B[1]-A[1]); xz.push([A[0]+(B[0]-A[0])*t, A[2]+(B[2]-A[2])*t]); }
    if(xz.length) parts.push({pts:xz, x0:Math.min(...xz.map(p=>p[0])), x1:Math.max(...xz.map(p=>p[0]))});
  }
  parts.sort((a,b)=>a.x0-b.x0);
  const comps=[];
  for(const p of parts){ const last=comps[comps.length-1];
    if(last && p.x0<=last.x1+1e-6){ last.pts.push(...p.pts); last.x1=Math.max(last.x1,p.x1); } else comps.push({...p, pts:[...p.pts]}); }
  return comps.map(c=>hull2(c.pts)).filter(h=>h.length>=2);
}
function ringFromHull(H,y,res){
  const ring=[...H,H[0]], per=[0]; for(let i=1;i<ring.length;i++) per.push(per[i-1]+Math.hypot(ring[i][0]-ring[i-1][0],ring[i][1]-ring[i-1][1]));
  const tot=per[per.length-1];
  let s0=0; for(let i=1;i<H.length;i++) if(H[i][0]<H[s0][0]) s0=i;
  const off=per[s0], pts=[];
  for(let k=0;k<res;k++){ const d=(off+tot*k/res)%tot; let i=1; while(i<per.length-1&&per[i]<d) i++;
    const t=(d-per[i-1])/((per[i]-per[i-1])||1), a=ring[i-1], b=ring[i];
    pts.push([a[0]+(b[0]-a[0])*t, y, a[1]+(b[1]-a[1])*t]); }
  return {pts, perim:tot};
}
// Method C: like B, but where the body splits into separate points at the same height (the top V),
// each point is spiralled on its own, with a return run of wire between them.
function wrapStarShape(S,pitch,res=48){
  const trunk=[], branches=[]; let splitY=null;
  for(let y=S.ymin+pitch/2;y<S.ymax;y+=pitch){
    const comps=sliceComponents(S,y); if(!comps.length) continue;
    if(comps.length===1 && splitY===null){ trunk.push(ringFromHull(comps[0],y,res)); continue; }
    if(splitY===null) splitY=y;
    comps.forEach((h,k)=>{ (branches[k]=branches[k]||[]).push(ringFromHull(h,y,res)); });
  }
  const segs=[trunk,...branches].filter(s=>s.length);
  const paths=segs.map(s=>helixFromLoops(s.map(l=>l.pts)));
  let length=0, loops=0;
  segs.forEach(s=>{ loops+=s.length; length+=s.reduce((a,l)=>a+Math.hypot(l.perim,pitch),0); });
  // joins: end of one segment to start of the next (the run back down between the top points)
  let joins=0; const path=[];
  paths.forEach((p,i)=>{ if(i){ joins+=dist(path[path.length-1],p[0]); } path.push(...p); });
  length+=joins;
  const names=['main body', ...branches.map((_,k)=>branches.length===2?(k?'right top point':'left top point'):'top point '+(k+1))];
  const segNames=[trunk,...branches].map((s,i)=>names[i]).filter((_,i)=>[trunk,...branches][i].length);
  const parts=paths.map((p,i)=>({name:segNames[i], path:p, loops:segs[i].length, ppr:res}));
  return {path, parts, loops, length, joins, splitY, branches:branches.length, height:S.ymax-S.ymin};
}
function computeAll(params){
  const S=buildStar(params); if(S.error) return S;
  const pitch=params.pitch;
  const A_points=S.points.map(pt=>({name:pt.name,...wrapPoint(pt,pitch)}));
  const A_center=wrapCenter(S,pitch);
  const A_total=A_points.reduce((s,x)=>s+x.length,0)+A_center.length;
  const B=wrapBody(S,pitch);
  const C=wrapStarShape(S,pitch);
  return {S,A_points,A_center,A_total,B,C};
}
