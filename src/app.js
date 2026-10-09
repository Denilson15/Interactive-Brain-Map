(function(){
'use strict';
const ATLAS=window.ATLAS, H=window.HIER, PSYCH=window.PSYCH, DISEASES=window.DISEASES, GLOSSARY=window.GLOSSARY;
const EXT=Object.assign({},window.COND_EXT||{});
const V3=THREE.Vector3;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const firstSentence=s=>{const m=String(s).match(/^.*?[.!?](?=\s|$)/); return m?m[0]:s;};
const HOT='#FF5A47', WARM='#FFB23E';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };

/* ================= Structure tree ================= */
const S={}, TOPS=[];
ATLAS.tops.forEach(t=>{ Object.assign(t,{isTop:true,leaves:[],meshes:[],kids:[]}); TOPS.push(t); S[t.id]=t; });
ATLAS.subs.forEach(s=>{ Object.assign(s,{isTop:false,isLeaf:true,meshes:[],kids:[]}); S[s.id]=s; S[s.parent].leaves.push(s); });
const SUBCOLORS={callosum:['#F6E7C1','#E9C98F','#D3E0F2','#B8CBEA'],ventricles:['#5DA9E9','#8EC5F5','#3C86CF','#A9D4FF']};
TOPS.forEach(t=>{
  const base=new THREE.Color(t.color), hsl={}; base.getHSL(hsl); const n=t.leaves.length;
  t.leaves.forEach((c,i)=>{
    if(SUBCOLORS[t.id]){ c.color=SUBCOLORS[t.id][i%4]; return; }
    const off=n>1?(i/(n-1)-0.5):0;
    const h=(hsl.h+off*0.13+1)%1, l=Math.min(0.76,Math.max(0.4,hsl.l+((i%3)-1)*0.13));
    c.color='#'+new THREE.Color().setHSL(h,Math.min(0.85,hsl.s*0.85+0.05),l).getHexString();
  });
});
S.brain=Object.assign(H.root,{kids:[],meshes:[],isRoot:true});
H.hemis.forEach(h=>{ S[h.id]=Object.assign(h,{kids:[],meshes:[],isHemi:true,lat:true}); });
S.deep=Object.assign(H.deep,{kids:[],meshes:[],isGroupRoot:true});
const groupOf={};
H.groups.forEach(g=>{ S[g.id]=Object.assign(g,{meshes:[],isGroup:true,topId:g.parent}); g.kids=g.kids.map(id=>S[id]); g.kids.forEach(k=>{ groupOf[k.id]=g.id; k.tparent=g.id; }); g.color=g.kids[Math.floor(g.kids.length/2)].color; });
const CORTEX_TOPS=['frontal','parietal','temporal','occipital','insula','cingulate'];
const DEEP_TOPS=['basalganglia','thalamus','hypothalamus','hippocampus','amygdala','callosum','ventricles'];
TOPS.forEach(t=>{
  const added=new Set();
  t.leaves.forEach(l=>{ l.topId=t.id; const g=groupOf[l.id]; if(g){ if(!added.has(g)){ t.kids.push(S[g]); added.add(g); S[g].tparent=t.id; } } else { t.kids.push(l); l.tparent=t.id; } });
  t.topId=t.id;
});
S.brain.kids=[S.hemiL,S.hemiR,S.deep,S.cerebellum,S.brainstem];
S.hemiL.kids=CORTEX_TOPS.map(id=>S[id]); S.hemiR.kids=S.hemiL.kids;
S.deep.kids=DEEP_TOPS.map(id=>S[id]);
DEEP_TOPS.forEach(id=>S[id].tparent='deep');
['cerebellum','brainstem','deep','hemiL','hemiR'].forEach(id=>S[id].tparent='brain');
CORTEX_TOPS.forEach(id=>{ const mark=n=>{ n.lat=true; (n.kids||[]).forEach(mark); }; mark(S[id]); });
const parentOf=(id,side)=>CORTEX_TOPS.includes(id)?(side==='R'?'hemiR':'hemiL'):(S[id].tparent||null);
const keyOf=(id,side)=>S[id].lat&&!S[id].isHemi?id+'@'+side:id;
const parseKey=k=>{ const i=k.indexOf('@'); return i<0?{id:k,side:null}:{id:k.slice(0,i),side:k.slice(i+1)}; };
function pathKeys(id,side){ const out=[]; let c=id; while(c){ out.push(keyOf(c,side)); c=parentOf(c,side); } return out; }
const depthOf=(id,side)=>pathKeys(id,side).length-1;

/* ================= Conditions ================= */
const CONDS={};
const prep=(c,kind)=>{ c.kind=kind; c.key=kind+':'+c.id; const x=EXT[c.key]; if(x) Object.assign(c,x,{extended:true}); CONDS[c.key]=c; };
PSYCH.forEach(c=>prep(c,'psych')); DISEASES.forEach(c=>prep(c,'disease'));
Object.values(CONDS).forEach(c=>{ c.brain=c.brain.filter(b=>{ if(!S[b[0]]){ console.warn('Unknown structure',b[0],'in',c.id); return false; } return true; }); });
const LINKED={};
Object.values(CONDS).forEach(c=>c.brain.forEach(([id,lv])=>{ (LINKED[id]=LINKED[id]||[]).push({c,lv}); }));

/* ================= Dictionary index ================= */
const INDEX={}, TERMS={};
const addKey=(k,v)=>{ k=k.toLowerCase(); if(!INDEX[k]) INDEX[k]=v; };
Object.values(S).forEach(s=>{ if(s.isRoot||s.isHemi) return; addKey(s.name,{t:'s',id:s.id}); (s.aka||[]).forEach(a=>addKey(a,{t:'s',id:s.id})); });
Object.values(CONDS).forEach(c=>{ addKey(c.name,{t:'c',id:c.key}); (c.aka||[]).forEach(a=>addKey(a,{t:'c',id:c.key})); });
GLOSSARY.forEach(([t,d,aka])=>{ TERMS[t]={term:t,def:d,aka}; addKey(t,{t:'g',id:t}); aka.forEach(a=>addKey(a,{t:'g',id:t})); });
const escRe=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const TERM_RE=new RegExp('(?<![A-Za-z0-9])('+Object.keys(INDEX).sort((a,b)=>b.length-a.length).map(k=>escRe(esc(k))).join('|')+')(?![A-Za-z0-9])','gi');
function linkify(text,seen){
  return esc(text||'').replace(TERM_RE,m=>{
    const e=INDEX[m.toLowerCase().replace(/&amp;/g,'&')]; if(!e) return m;
    const key=e.t+':'+e.id; if(seen.has(key)) return m; seen.add(key);
    const cls=e.t==='s'?'term st':e.t==='c'?'term cd':'term';
    return `<button type="button" class="${cls}" data-t="${e.t}" data-id="${esc(e.id)}">${m}</button>`;
  });
}
function lookup(raw){
  let s=raw.toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z0-9'ε\/\- ]/g,' ').replace(/\s+/g,' ').trim().replace(/^'+|'+$/g,'');
  if(!s) return null;
  const tries=[s]; if(s.endsWith("'s")) tries.push(s.slice(0,-2)); if(s.endsWith('ies')) tries.push(s.slice(0,-3)+'y'); if(s.endsWith('es')) tries.push(s.slice(0,-2)); if(s.endsWith('s')) tries.push(s.slice(0,-1));
  for(const t of tries){ if(INDEX[t]) return {e:INDEX[t],q:s}; }
  return {q:s};
}

/* ================= Scene ================= */
const stage=document.getElementById('stage'), canvas=document.getElementById('brain');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(35,1,0.05,80);
const CENTER=new V3(0,-0.15,0);
const HOME=new V3(-3.7,1.5,2.9);
camera.position.copy(HOME);
const controls=new THREE.OrbitControls(camera,canvas);
controls.enableDamping=true; controls.enablePan=false; controls.minDistance=1.2; controls.maxDistance=16;
controls.target.copy(CENTER);
function addLights(sc){
  sc.add(new THREE.HemisphereLight(0xffffff,0x3a4556,0.8));
  const k=new THREE.DirectionalLight(0xffffff,0.85); k.position.set(-3,4,3); sc.add(k);
  const r=new THREE.DirectionalLight(0xbfd4ff,0.45); r.position.set(3,1,-3); sc.add(r);
  const f=new THREE.DirectionalLight(0xffffff,0.3); f.position.set(2,-2,4); sc.add(f);
  const b=new THREE.DirectionalLight(0xffffff,0.25); b.position.set(4,0.5,0); sc.add(b);
}
addLights(scene);
const LIGHTS=[]; scene.children.forEach(o=>{ if(o.isLight) LIGHTS.push([o,o.intensity]); });

/* ---------- geometry ---------- */
const G=(x,s)=>Math.exp(-(x/s)*(x/s));
function folds(x,y,z){
  const a=Math.sin(x*7.8+Math.sin(y*5.9+z*2.3)*2.3+Math.sin(z*4.1)*1.4);
  const b=Math.sin(y*7.0+Math.sin(z*6.7+x*2.9)*2.1);
  const c=Math.sin(z*6.2+Math.sin(x*6.4+y*3.6)*2.2);
  return Math.pow(Math.abs(Math.sin((a+b+c)*1.3)),0.55);
}
function classifyCortex(X,Y,ly,lz){
  const zc=0.28-0.25*ly, ys=-0.16-0.1*lz, zpo=-0.72+0.12*ly, medial=X<-0.2;
  if(X<-0.45){ const cc=0.34-0.5*lz*lz; if(lz>-0.62&&lz<0.62&&ly>cc-0.02&&ly<cc+0.2) return lz>0.02?'acc':'pcc'; }
  const lat=X<0?X*0.5:X;
  if(lz<zpo){
    if(medial){ const calc=-0.02+0.1*(lz+0.9); if(Math.abs(ly-calc)<0.09) return 'v1'; return ly>calc?'cuneus':'lingual'; }
    if(lz<-1.08) return 'v1';
    if(Y<-0.55&&X<0.6) return 'v4';
    if(X>0.45&&ly<-0.02&&ly>-0.4&&lz>-0.98) return 'v5';
    return 'v2v3';
  }
  if(ly<ys&&lz<0.6&&(lat>0.1||(lz<0.3&&ly<ys-0.08))){
    if(lz>0.42) return 'tpole';
    if(X<0) return lz>0.12?'entorhinal':'parahippocampal';
    if(X<0.5&&Y<-0.6) return 'fusiform';
    if(ly>ys-0.11){ if(lz<-0.22) return 'wernicke'; if(ly>ys-0.06&&lz<0.22) return 'a1'; return 'stg'; }
    if(ly>ys-0.22) return 'mtg';
    return 'itg';
  }
  if(lz>zc){
    if(lz<zc+0.12) return 'm1';
    if(lz<zc+0.3) return medial?'sma':'premotor';
    if(Y<-0.5) return 'ofc';
    if(lz>1.0) return 'fpole';
    if(medial) return Y<0.2?'vmpfc':'dmpfc';
    if(ly>ys-0.02&&ly<ys+0.2&&lz<zc+0.6) return 'broca';
    if(ly<ys+0.32) return 'vlpfc';
    return 'dlpfc';
  }
  if(lz>zc-0.14) return 's1';
  if(medial) return 'precuneus';
  if(ly>0.36) return 'spl';
  return lz>zc-0.42?'supramarginal':'angular';
}
function buildHemisphere(side){
  const g=new THREE.SphereGeometry(1,240,170);
  const p=g.attributes.position, n=p.count, info=new Float32Array(n*4);
  const A=0.64,B=0.8,C=1.18,OFF=0.37;
  for(let i=0;i<n;i++){
    const ux=p.getX(i),uy=p.getY(i),uz=p.getZ(i), X=ux*side;
    let lx=ux*A, ly=uy*B, lz=uz*C;
    const medial=X<0; if(medial) lx*=0.5; if(ly<0) ly*=0.88;
    const cly=ly, clz=lz;
    let nx=lx/(A*A),ny=ly/(B*B),nz=lz/(C*C); const nl=Math.hypot(nx,ny,nz)||1; nx/=nl; ny/=nl; nz/=nl;
    const lat=medial?X*0.5:X;
    const tf=smooth(0.35,1.18,lz), to=smooth(-0.55,-1.18,lz);
    let sx=1-0.13*tf*tf-0.16*to*to, sy=1-0.08*tf*tf-0.1*to;
    if(ly<0) sy*=1-0.28*tf;
    if(ly>0) sy*=0.97;
    const ys0=-0.16-0.1*lz;
    const tw=medial?0:smooth(ys0+0.02,ys0-0.14,ly)*smooth(0.62,0.38,lz)*smooth(-0.8,-0.55,lz)*clamp(lat*2.2,0,1);
    let px=lx*sx, py=ly*sy, pz=lz;
    py-=0.07*tw; px+=side*0.045*tw; pz+=0.02*tw;
    let d=0.05*(folds(lx+side*3,ly,lz)-0.6)*(medial?0.55:1);
    const zc=0.28-0.25*ly; if(ly>-0.2) d-=0.06*G(lz-zc,0.04);
    const ys=ys0; if(!medial&&lz>-0.65&&lz<0.62) d-=0.1*G(ly-ys,0.045)*Math.min(1,lat*3);
    if(!medial&&lz>0.3&&lz<0.62) d-=0.05*G(ly-(ys-0.03),0.06)*Math.min(1,lat*3);
    const zpo=-0.72+0.12*ly; d-=0.03*G(lz-zpo,0.04);
    if(lz>zc&&ly>-0.2) d-=0.022*G(lz-(zc+0.12),0.03);
    if(lz<zc&&lz>zpo&&ly>-0.1) d-=0.022*G(lz-(zc-0.14),0.03);
    if(!medial&&lz<zc-0.14&&lz>zpo) d-=0.022*G(ly-0.36,0.03)*Math.min(1,lat*2);
    if(!medial&&lz>zc+0.3&&ly>0.05) d-=0.02*G(ly-(0.42-0.1*lz),0.03)*Math.min(1,lat*2);
    if(!medial&&ly<ys&&lz<0.45&&lz>zpo){ d-=0.024*G(ly-(ys-0.11),0.025)*Math.min(1,lat*2); d-=0.02*G(ly-(ys-0.22),0.025)*Math.min(1,lat*2); }
    if(X<-0.2&&lz<zpo){ const calc=-0.02+0.1*(lz+0.9); d-=0.032*G(ly-calc,0.03); }
    if(X<-0.45&&Math.abs(lz)<0.62){ const cc=0.34-0.5*lz*lz; d-=0.028*G(ly-(cc+0.2),0.03); }
    p.setXYZ(i,px+side*OFF+nx*d,py+ny*d,pz+nz*d);
    info[i*4]=X; info[i*4+1]=uy; info[i*4+2]=cly; info[i*4+3]=clz;
  }
  g.computeVertexNormals();
  const idx=g.index.array, pos=p.array, nor=g.attributes.normal.array, out={}, med={};
  for(let t=0;t<idx.length;t+=3){
    const a=idx[t],b=idx[t+1],c=idx[t+2];
    const X=(info[a*4]+info[b*4]+info[c*4])/3;
    const key=classifyCortex(X,(info[a*4+1]+info[b*4+1]+info[c*4+1])/3,(info[a*4+2]+info[b*4+2]+info[c*4+2])/3,(info[a*4+3]+info[b*4+3]+info[c*4+3])/3);
    const o=out[key]||(out[key]={p:[],n:[],m:0,t:0}); o.t++; if(X<-0.2) o.m++;
    for(const v of [a,b,c]){ o.p.push(pos[v*3],pos[v*3+1],pos[v*3+2]); o.n.push(nor[v*3],nor[v*3+1],nor[v*3+2]); }
  }
  g.dispose();
  const geos={};
  for(const k in out){ const bg=new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.Float32BufferAttribute(out[k].p,3)); bg.setAttribute('normal',new THREE.Float32BufferAttribute(out[k].n,3)); geos[k]=bg; med[k]=out[k].m/out[k].t; }
  return {geos,med};
}
function ellipsoid(c,s,seg){
  seg=seg||36;
  const g=new THREE.SphereGeometry(1,seg,Math.round(seg*0.7));
  const aux=Float32Array.from(g.attributes.position.array);
  g.applyMatrix4(new THREE.Matrix4().compose(new V3(...c),new THREE.Quaternion(),new V3(...s)));
  return {g,aux,k:3};
}
function tube(points,r,seg,rad,scaleX){
  seg=seg||64; rad=rad||16;
  const curve=new THREE.CatmullRomCurve3(points.map(a=>new V3(...a)));
  const g=new THREE.TubeGeometry(curve,seg,r,rad,false);
  const P=g.attributes.position, n=P.count, aux=new Float32Array(n*4), v=new V3();
  for(let i=0;i<n;i++){ const u=Math.floor(i/(rad+1))/seg; const c=curve.getPointAt(Math.min(1,u)); v.fromBufferAttribute(P,i).sub(c).divideScalar(r); aux[i*4]=u; aux[i*4+1]=v.x; aux[i*4+2]=v.y; aux[i*4+3]=v.z; }
  if(scaleX&&scaleX!==1) g.applyMatrix4(new THREE.Matrix4().makeScale(scaleX,1,1));
  return {g,aux,k:4};
}
function split(obj,fn){
  const {g,aux,k}=obj, idx=g.index?g.index.array:null, pos=g.attributes.position.array, nor=g.attributes.normal.array;
  const triCount=idx?idx.length/3:pos.length/9, out={}, c=new Array(k);
  for(let t=0;t<triCount;t++){
    const a=idx?idx[t*3]:t*3, b=idx?idx[t*3+1]:t*3+1, d=idx?idx[t*3+2]:t*3+2;
    for(let j=0;j<k;j++) c[j]=(aux[a*k+j]+aux[b*k+j]+aux[d*k+j])/3;
    const key=fn(c); if(!key) continue;
    const o=out[key]||(out[key]={p:[],n:[]});
    for(const v of [a,b,d]){ o.p.push(pos[v*3],pos[v*3+1],pos[v*3+2]); o.n.push(nor[v*3],nor[v*3+1],nor[v*3+2]); }
  }
  const geos={};
  for(const key in out){ const bg=new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.Float32BufferAttribute(out[key].p,3)); bg.setAttribute('normal',new THREE.Float32BufferAttribute(out[key].n,3)); geos[key]=bg; }
  return geos;
}

/* ---------- materials ---------- */
const HOLO_VS='varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }';
const HOLO_FS='uniform vec3 uColor; uniform float uOpacity; uniform float uSolid; uniform float uBright; varying vec3 vN; varying vec3 vV; void main(){ vec3 n=normalize(vN); float ndv=abs(dot(n,normalize(vV))); float rim=pow(1.0-ndv,2.0); float l=0.5+0.5*max(dot(n,normalize(vec3(-0.4,0.7,0.6))),0.0); vec3 glow=uColor*(0.32+0.45*l)+uColor*rim*1.1+vec3(0.12*rim); vec3 lit=uColor*(0.38+0.62*l)+vec3(0.08*rim); vec3 c=mix(glow,lit,uSolid)*uBright; float a=mix(uOpacity*(0.4+1.5*rim),1.0,uSolid); gl_FragColor=vec4(c,clamp(a,0.0,1.0)); }';
function holoMat(){ return new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color()},uOpacity:{value:0.2},uSolid:{value:0},uBright:{value:1}},vertexShader:HOLO_VS,fragmentShader:HOLO_FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}); }

/* ---------- build meshes ---------- */
const MESHES=[];
function addMesh(leafId,geo,side,layer){
  const leaf=S[leafId]; if(!leaf||!geo){ console.warn('Missing leaf or geometry',leafId); return; }
  const solid=new THREE.MeshStandardMaterial({color:new THREE.Color(leaf.color),roughness:0.55,metalness:0.02});
  const m=new THREE.Mesh(geo,solid);
  m.userData={leaf:leafId,top:leaf.topId,layer,side,solid,holo:holoMat(),off:new V3()};
  scene.add(m); MESHES.push(m); leaf.meshes.push(m);
  if(!leaf.layer) leaf.layer=layer;
  return m;
}
const addSplit=(obj,fn,side,layer)=>{ const geos=split(obj,fn); for(const k in geos) addMesh(k,geos[k],side,layer); };
const sides=fn=>{ fn(-1,'L'); fn(1,'R'); };

sides((s,SD)=>{ const {geos,med}=buildHemisphere(s); for(const k in geos){ addMesh(k,geos[k],SD,'cortex'); if(s<0) S[k].medial=med[k]>0.6; } });
sides((s,SD)=>{
  addMesh('olfactory',tube([[s*0.17,-0.57,0.3],[s*0.17,-0.52,0.56],[s*0.17,-0.44,0.74]],0.016,24,10).g,SD,'shell');
  addMesh('olfactory',ellipsoid([s*0.17,-0.43,0.78],[0.032,0.024,0.055],20).g,SD,'shell');
});
sides((s,SD)=>addSplit(ellipsoid([s*0.74,-0.1,0.08],[0.045,0.17,0.27]),c=>c[2]>0?'antinsula':'postinsula',SD,'cortex'));
(function(){
  const g=new THREE.SphereGeometry(1,170,120), p=g.attributes.position, aux=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    let lx=x*0.86, ly=y*0.36, lz=z*0.52;
    ly*=1-0.25*G(lx,0.12)*(y>0?1:0.3);
    if(y>0) ly*=0.85+0.15*Math.abs(x);
    let d=0.022*(Math.pow(Math.abs(Math.sin(ly*60+lz*9+Math.sin(lx*6)*1.3)),0.5)-0.6);
    d-=0.05*G(lx,0.06)*(lz<0.1?1:0.3);
    const L=Math.hypot(x,y,z)||1;
    p.setXYZ(i,lx+x/L*d,ly+y/L*d-0.62,lz+z/L*d-0.84);
    aux[i*3]=lx; aux[i*3+1]=ly; aux[i*3+2]=lz;
  }
  g.computeVertexNormals();
  addSplit({g,aux,k:3},c=>Math.abs(c[0])<0.11?'vermis':(c[2]>0.2&&c[1]<-0.02&&Math.abs(c[0])>0.28?'flocculo':'cerebhemi'),'B','shell');
})();
sides((s,SD)=>addMesh('dentate',ellipsoid([s*0.24,-0.64,-0.76],[0.07,0.045,0.07],24).g,SD,'inner'));
(function(){
  const prof=[[0,0.13],[0.12,0.135],[0.2,0.15],[0.28,0.2],[0.4,0.215],[0.5,0.17],[0.6,0.135],[0.85,0.12],[1.05,0.1],[1.07,0.0]];
  const lg=new THREE.LatheGeometry(prof.map(([y,r])=>new THREE.Vector2(r,-y)),48);
  const aux=Float32Array.from(lg.attributes.position.array);
  const m=new THREE.Matrix4().makeRotationX(0.18); m.setPosition(new V3(0,-0.4,-0.24)); lg.applyMatrix4(m); lg.computeVertexNormals();
  addSplit({g:lg,aux,k:3},c=>{ const y=-c[1]; if(y<0.22) return 'midbrain'; if(y<0.56) return 'pons'; return 'medulla'; },'B','shell');
})();
addMesh('vta',ellipsoid([0,-0.52,-0.15],[0.035,0.022,0.03],20).g,'B','inner');
sides((s,SD)=>addMesh('lc',ellipsoid([s*0.045,-0.7,-0.32],[0.016,0.05,0.016],14).g,SD,'inner'));
addMesh('raphe',ellipsoid([0,-0.74,-0.27],[0.013,0.24,0.02],20).g,'B','inner');
sides((s,SD)=>{
  addMesh('caudate',tube([[0.15,0.04,0.38],[0.18,0.14,0.22],[0.2,0.18,0],[0.22,0.13,-0.22],[0.27,0,-0.38],[0.32,-0.15,-0.36],[0.34,-0.25,-0.2]].map(a=>[a[0]*s,a[1],a[2]]),0.032,60,12).g,SD,'inner');
  addMesh('caudate',ellipsoid([s*0.16,0.06,0.3],[0.06,0.08,0.1],28).g,SD,'inner');
  addMesh('putamen',ellipsoid([s*0.3,-0.05,0.06],[0.055,0.12,0.2],32).g,SD,'inner');
  addMesh('gp',ellipsoid([s*0.22,-0.07,0.02],[0.035,0.08,0.11],28).g,SD,'inner');
  addMesh('nacc',ellipsoid([s*0.12,-0.14,0.27],[0.045,0.04,0.055],22).g,SD,'inner');
  addMesh('stn',ellipsoid([s*0.1,-0.18,-0.1],[0.03,0.022,0.045],18).g,SD,'inner');
  addMesh('sn',ellipsoid([s*0.075,-0.49,-0.17],[0.05,0.02,0.04],20).g,SD,'inner');
});
sides((s,SD)=>{
  addSplit(ellipsoid([s*0.11,-0.03,-0.12],[0.1,0.09,0.17],40),c=>{ const X=c[0]*s; if(c[2]>0.6) return 'antthal'; if(c[2]<-0.5) return 'pulvinar'; if(X<-0.15&&c[1]>-0.3) return 'mdthal'; return 'ventthal'; },SD,'inner');
  addMesh('lgn',ellipsoid([s*0.19,-0.1,-0.24],[0.03,0.025,0.035],16).g,SD,'inner');
  addMesh('mgn',ellipsoid([s*0.12,-0.12,-0.29],[0.028,0.024,0.03],16).g,SD,'inner');
});
addMesh('pineal',ellipsoid([0,0,-0.34],[0.022,0.02,0.035],16).g,'B','inner');
addSplit(ellipsoid([0,-0.23,0.08],[0.075,0.06,0.09],32),c=>{ if(c[2]>0.5) return 'scn'; if(c[1]<-0.4) return 'arcuate'; if(Math.abs(c[0])>0.5) return 'lateralhyp'; return 'pvn'; },'B','inner');
sides((s,SD)=>addMesh('mammillary',ellipsoid([s*0.03,-0.27,-0.04],[0.024,0.024,0.024],16).g,SD,'inner'));
addMesh('pituitary',tube([[0,-0.27,0.1],[0,-0.32,0.11],[0,-0.37,0.12]],0.012,12,8).g,'B','inner');
addMesh('pituitary',ellipsoid([0,-0.4,0.12],[0.05,0.035,0.045],20).g,'B','inner');
sides((s,SD)=>{
  addSplit(tube([[0.37,-0.38,0.13],[0.39,-0.36,-0.12],[0.35,-0.26,-0.37],[0.24,-0.12,-0.5]].map(a=>[a[0]*s,a[1],a[2]]),0.055,64,18),c=>{ const medialness=-c[1]*s; if(c[2]<-0.55) return 'subiculum'; if(medialness>0.45) return 'dg'; return 'ca'; },SD,'inner');
  addMesh('fornix',tube([[0.24,-0.12,-0.5],[0.16,0.08,-0.42],[0.07,0.17,-0.25],[0.035,0.16,0],[0.035,0.05,0.12],[0.035,-0.15,0.03],[0.03,-0.25,-0.03]].map(a=>[a[0]*s,a[1],a[2]]),0.018,80,10).g,SD,'inner');
});
sides((s,SD)=>addSplit(ellipsoid([s*0.37,-0.38,0.22],[0.075,0.07,0.08],30),c=>{ const X=c[0]*s; if(X<-0.45) return 'medamyg'; if(c[1]>0.35) return 'cea'; return 'bla'; },SD,'inner'));
addSplit(tube([[0,-0.08,0.38],[0,0.04,0.54],[0,0.2,0.44],[0,0.29,0.12],[0,0.28,-0.2],[0,0.19,-0.44],[0,0.05,-0.52]],0.06,90,18,2.4),c=>c[0]<0.1?'rostrum':c[0]<0.27?'genu':c[0]<0.8?'ccbody':'splenium','B','inner');
sides((s,SD)=>{
  addMesh('latvent',tube([[0.07,0.1,0.36],[0.09,0.17,0.15],[0.1,0.17,-0.15],[0.15,0.1,-0.38],[0.18,0,-0.5],[0.24,-0.08,-0.42],[0.3,-0.2,-0.25],[0.32,-0.28,-0.02]].map(a=>[a[0]*s,a[1],a[2]]),0.03,70,12).g,SD,'inner');
  addMesh('latvent',tube([[0.18,0,-0.5],[0.18,-0.01,-0.58],[0.16,-0.03,-0.66]].map(a=>[a[0]*s,a[1],a[2]]),0.022,12,10).g,SD,'inner');
});
addMesh('thirdvent',ellipsoid([0,-0.08,-0.06],[0.012,0.1,0.15],24).g,'B','inner');
addMesh('aqueduct',tube([[0,-0.2,-0.22],[0,-0.42,-0.27],[0,-0.62,-0.32]],0.012,20,8).g,'B','inner');
addMesh('fourthvent',ellipsoid([0,-0.76,-0.4],[0.08,0.09,0.035],22).g,'B','inner');

MESHES.forEach(m=>{ const {leaf,side}=m.userData; pathKeys(leaf,side).forEach(k=>{ const {id}=parseKey(k); if(!S[id].meshes.includes(m)) S[id].meshes.push(m); }); });
['hemiL','hemiR'].forEach(h=>{ const sd=S[h].side; S[h].meshes=MESHES.filter(m=>CORTEX_TOPS.includes(m.userData.top)&&m.userData.side===sd); });
S.brain.meshes=MESHES.slice();
Object.values(S).forEach(s=>{ if(!s.layer){ const ls=new Set(s.meshes.map(m=>m.userData.layer)); s.layer=ls.has('cortex')?'cortex':(ls.size===1&&ls.has('inner'))?'inner':'shell'; } });
S.cingulate.medial=true;
Object.values(S).forEach(s=>{ if(!s.meshes.length) console.warn('No geometry for',s.id); });
MESHES.forEach(m=>{ m.userData.path=pathKeys(m.userData.leaf,m.userData.side); });

/* ---------- centers, anchors, spread offsets ---------- */
function meshesOf(id,side){
  const n=S[id]; if(n.lat&&!n.isHemi&&side) return n.meshes.filter(m=>m.userData.side===side);
  if(side==='L'||side==='R'){ const f=n.meshes.filter(m=>m.userData.side===side||m.userData.side==='B'); return f.length?f:n.meshes; }
  return n.meshes;
}
function bbox(meshes){ const b=new THREE.Box3(); meshes.forEach(m=>{ if(!m.geometry.boundingBox) m.geometry.computeBoundingBox(); b.union(m.geometry.boundingBox); }); return b; }
const CEN={};
function centerOf(id,side){ const k=id+'|'+(side||'B'); if(!CEN[k]) CEN[k]=id==='brain'?CENTER.clone():bbox(meshesOf(id,side)).getCenter(new V3()); return CEN[k]; }
function radiusOf(id,side){ return bbox(meshesOf(id,side)).getSize(new V3()).length()/2; }
const KDEPTH=[0,0.95,1.0,0.75,0.6];
function offsetFor(id,side){
  const o=new V3(); let c=id;
  while(c&&c!=='brain'){ const p=parentOf(c,side||'L'); const d=depthOf(c,side||'L'); let k=KDEPTH[Math.min(d,4)]; if(p==='deep') k=1.9; o.add(centerOf(c,side).clone().sub(centerOf(p,side)).multiplyScalar(k)); c=p; }
  return o;
}
const isBilateralInner=m=>m.userData.layer==='inner'&&m.userData.side!=='B'&&!CORTEX_TOPS.includes(m.userData.top);
MESHES.forEach(m=>{ const {leaf,side}=m.userData; const o=offsetFor(leaf,side==='B'?null:side); if(isBilateralInner(m)) o.x+=(side==='L'?-1:1)*0.18; m.userData.off.copy(o); });
const NODE_OFF={};
function nodeOffset(id,side){
  const k=id+'|'+side; if(NODE_OFF[k]) return NODE_OFF[k];
  const n=S[id]; const o=offsetFor(id,(n.lat||n.isHemi)?side:(n.meshes.every(m=>m.userData.side==='B')?null:side));
  if(!(n.lat||n.isHemi)&&n.meshes.some(isBilateralInner)&&n.meshes.every(m=>m.userData.layer==='inner')) o.x+=(side==='L'?-1:1)*0.18;
  return NODE_OFF[k]=o;
}
function centroidAnchor(meshes){
  const c=new V3(); let n=0; const v=new V3();
  meshes.forEach(m=>{ const P=m.geometry.attributes.position; for(let i=0;i<P.count;i+=3){ c.add(v.fromBufferAttribute(P,i)); n++; } });
  c.divideScalar(n||1);
  let best=Infinity; const bp=new V3(), bn=new V3();
  meshes.forEach(m=>{ const P=m.geometry.attributes.position, N=m.geometry.attributes.normal; for(let i=0;i<P.count;i+=3){ v.fromBufferAttribute(P,i); const d=v.distanceToSquared(c); if(d<best){ best=d; bp.copy(v); bn.fromBufferAttribute(N,i); } } });
  return {p:bp,n:bn.normalize()};
}
function pickDir(meshes,dir){
  let best=-Infinity; const bp=new V3(), bn=new V3(), v=new V3();
  meshes.forEach(m=>{ const P=m.geometry.attributes.position, N=m.geometry.attributes.normal; for(let i=0;i<P.count;i+=4){ v.fromBufferAttribute(P,i); const s=v.dot(dir); if(s>best){ best=s; bp.copy(v); bn.fromBufferAttribute(N,i); } } });
  return {p:bp,n:bn.normalize()};
}
const LOBE_DIR={frontal:[-0.45,0.45,0.75],parietal:[-0.45,0.85,-0.3],temporal:[-1,-0.35,0.15],occipital:[-0.35,0.15,-1],cerebellum:[-0.55,-0.35,-0.8],brainstem:[-0.85,-0.45,0.3],olfactory:[-0.35,-0.85,0.45],hemiL:[-1,0.75,0.15],hemiR:[-1,0.75,0.15],insula:[-1,0,0.1]};
const ANCHOR_CHILD={hippocampus:'ca',ventricles:'latvent',hypothalamus:'pvn',callosum:'ccbody',deep:'thalamus'};
const ANC={}, FDIR={};
function computeAnchor(id,side){
  const n=S[id], sx=side==='L'?1:-1, ms=meshesOf(id,(n.lat||n.isHemi)?side:side); if(!ms.length) return null;
  let ld=LOBE_DIR[id]; if(!ld&&n.layer==='shell'&&n.isLeaf) ld=LOBE_DIR[id==='olfactory'?'olfactory':n.topId];
  const ldir=ld?new V3(ld[0]*sx,ld[1],ld[2]).normalize():null;
  let a,f;
  if(id==='brain'){ a={p:CENTER.clone(),n:null}; f=HOME.clone().sub(CENTER).normalize(); }
  else if(ld&&!(n.isLeaf&&n.layer==='shell')){ a=pickDir(ms,ldir); f=ldir; }
  else if(n.layer==='cortex'||n.layer==='shell'){
    a=centroidAnchor(ms); const radial=a.p.clone().sub(CENTER).normalize();
    f=n.medial?new V3(sx,0.12,0.05).normalize():(ldir||a.n.clone().multiplyScalar(0.65).add(radial.multiplyScalar(0.35)).normalize());
  } else {
    const ac=ANCHOR_CHILD[id]; const ams=ac?meshesOf(ac,side):ms;
    a=n.isLeaf?{p:bbox(ms).getCenter(new V3()),n:null}:pickDir(ams,new V3(0,1,0.15).normalize());
    f=new V3(-0.8*sx,0.4,0.45).normalize();
  }
  return {a,f};
}
function anchorOf(id,side){ const k=id+'|'+side; if(!(k in ANC)){ const r=computeAnchor(id,side); ANC[k]=r?r.a:null; FDIR[k]=r?r.f:null; } return ANC[k]; }
function fdirOf(id,side){ anchorOf(id,side); return FDIR[id+'|'+side]; }

/* ================= State ================= */
let mode='structure', sel='brain', selSide='L', cond=null, condMap={}, condWhole={}, showLabels=true, hovered=null, activeTab='region', goal=null, spread=0, opac=0.2, bright=1;
const openCond={psych:null,disease:null};
const GHOST=new THREE.Color(0x8fa3bd), HOTC=new THREE.Color(HOT), WARMC=new THREE.Color(WARM);
const viewSide=()=>camera.position.x<=0?'L':'R';
const fit=()=>Math.max(1,1.15/(camera.aspect||1));
const selKey=()=>keyOf(sel,selSide);
const isLeafNode=id=>!S[id].kids||!S[id].kids.length;
function labelParent(){ return isLeafNode(sel)?(parentOf(sel,selSide)||'brain'):sel; }
const lpKey=()=>keyOf(labelParent(),selSide);
function childIn(m,parentKey){ const p=m.userData.path; const i=p.indexOf(parentKey); return i>0?p[i-1]:null; }
const colorOfKey=k=>S[parseKey(k).id].color;

function applyView(){
  const sk=selKey(), lk=lpKey();
  MESHES.forEach(m=>{
    const u=m.userData, path=u.path; let useSolid=false, col, op, em=0;
    if(mode==='condition'){
      const inv=condMap[u.leaf];
      if(inv){ useSolid=true; col=inv==='p'?HOTC:WARMC; op=u.layer==='cortex'?(condWhole[u.top]?0.3:(inv==='p'?0.72:0.4)):1; em=0.22; }
      else { col=GHOST; op=u.layer==='cortex'?0.1:u.layer==='shell'?0.14:0.12; }
    } else {
      const inSel=sel!=='brain'&&path.includes(sk);
      if(inSel){ useSolid=true; const ck=isLeafNode(sel)?sk:childIn(m,sk); col=new THREE.Color(colorOfKey(ck||sk)); op=1; em=isLeafNode(sel)?0.3:0.06; }
      else {
        const inLp=lk!=='brain'&&path.includes(lk); const ck=inLp?childIn(m,lk):null;
        col=new THREE.Color(ck?colorOfKey(ck):(u.top?S[u.top].color:'#9FB3D1'));
        op=u.layer==='cortex'?0.27:u.layer==='shell'?0.32:0.34;
        if(sel!=='brain'&&!inLp) op*=0.55;
        if(hovered&&path.includes(hovered)) op*=2.2;
      }
      if(useSolid&&hovered&&path.includes(hovered)) em=Math.max(em,0.22);
    }
    if(useSolid){
      const M=u.solid; M.color.copy(col); M.emissive.copy(col).multiplyScalar(em);
      const tr=op<0.999; if(M.transparent!==tr){ M.transparent=tr; M.needsUpdate=true; } M.opacity=op; M.depthWrite=op>=0.5;
      if(m.material!==M) m.material=M;
    } else {
      const M=u.holo, sld=mode==='condition'?0:clamp((opac-0.2)/0.8,0,1), add=sld<0.02;
      if(mode!=='condition'&&opac<0.2) op*=opac/0.2;
      M.uniforms.uColor.value.copy(col); M.uniforms.uOpacity.value=op; M.uniforms.uSolid.value=sld; M.uniforms.uBright.value=bright;
      const bl=add?THREE.AdditiveBlending:THREE.NormalBlending; if(M.blending!==bl){ M.blending=bl; M.needsUpdate=true; } M.depthWrite=sld>0.7; if(m.material!==M) m.material=M;
    }
  });
}
function applySpread(){ MESHES.forEach(m=>m.position.copy(m.userData.off).multiplyScalar(spread)); }

function focusNode(id,side){
  const n=S[id]; const sd=(n.lat||n.isHemi)?side:null;
  const c=centerOf(id,sd).clone().add(nodeOffset(id,side).clone().multiplyScalar(spread));
  const d=fdirOf(id,side)||new V3(-1,0.4,0.4).normalize(), r=radiusOf(id,sd);
  const k=id==='brain'?0:isLeafNode(id)?0.75:0.5;
  const tgt=CENTER.clone().lerp(c,k);
  let dist=id==='brain'?HOME.distanceTo(CENTER)/fit():n.isHemi?4.2:Math.min(4.3,Math.max(2.3,1.6+r*3.4));
  dist=dist*fit()*(1+spread*0.7);
  goal={pos:tgt.clone().addScaledVector(d,dist),tgt};
  if(reduceMotion){ camera.position.copy(goal.pos); controls.target.copy(goal.tgt); goal=null; }
}

/* ================= Selection ================= */
function selectNode(id,side,opts){
  opts=opts||{}; if(!S[id]) return;
  sel=id; if(side) selSide=side; mode='structure'; hidePop();
  applyView(); renderRegion(); buildMini(id,selSide); renderMap();
  if(opts.focus!==false) focusNode(id,selSide);
  if(opts.tab!==false) showTab('region');
  if(opts.scroll&&innerWidth<=900) document.querySelector('.panel').scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'});
}
function goUp(){ if(sel==='brain') return; const p=parentOf(sel,selSide)||'brain'; selectNode(p,S[p].isHemi?S[p].side:selSide); }
function setCondition(c){
  cond=c; mode='condition'; condMap={}; condWhole={};
  c.brain.forEach(([id])=>{ if(S[id].isTop&&S[id].layer==='cortex') condWhole[id]=true; });
  c.brain.forEach(([id,lv])=>{ S[id].meshes.forEach(m=>{ const l=m.userData.leaf; if(condMap[l]!=='p') condMap[l]=lv; }); });
}
function focusCondition(){
  const b=new THREE.Box3(); MESHES.forEach(m=>{ if(condMap[m.userData.leaf]){ m.updateMatrixWorld(); b.union(new THREE.Box3().setFromObject(m)); } });
  if(b.isEmpty()) return;
  const ctr=b.getCenter(new V3()), dir=camera.position.clone().sub(controls.target).normalize();
  const tgt=CENTER.clone().lerp(ctr,0.5);
  goal={pos:tgt.clone().addScaledVector(dir,4.4*fit()*(1+spread*0.7)),tgt};
  if(reduceMotion){ camera.position.copy(goal.pos); controls.target.copy(goal.tgt); goal=null; }
}
function openCondition(key){
  const c=CONDS[key]; if(!c) return; hidePop();
  openCond[c.kind]=c; renderCondDetail(c);
  showTab(c.kind); focusCondition();
}
function closeCondition(kind){ openCond[kind]=null; renderCondList(kind); showTab(kind); }

/* ================= Tabs ================= */
const VIEWS={region:'view-region',psych:'view-psych',disease:'view-disease',gloss:'view-gloss'};
function showTab(name){
  activeTab=name;
  for(const k in VIEWS){ document.getElementById('tab-'+k).setAttribute('aria-selected',String(k===name)); document.getElementById(VIEWS[k]).hidden=k!==name; }
  if(name==='psych'||name==='disease'){ const c=openCond[name]; if(c) setCondition(c); else if(mode==='condition') mode='structure'; }
  else if(name==='region'){ if(mode==='condition') mode='structure'; }
  applyView(); updateCondbar();
}
for(const k in VIEWS) document.getElementById('tab-'+k).addEventListener('click',()=>showTab(k));
const condbar=document.getElementById('condbar'), hint=document.getElementById('hint');
function updateCondbar(){
  const on=mode==='condition'&&cond;
  condbar.hidden=!on; hint.hidden=!!on;
  if(on) condbar.innerHTML=`<b>${esc(cond.short||cond.name)}</b><span class="k"><i style="background:${HOT}"></i>Primary</span><span class="k"><i style="background:${WARM}"></i>Also involved</span><button type="button" id="exitCond">Back to anatomy</button>`;
}
condbar.addEventListener('click',e=>{ if(e.target.id==='exitCond') showTab('region'); });

/* ================= Picking ================= */
const ray=new THREE.Raycaster();
function castAt(ev,list){
  const rc=canvas.getBoundingClientRect();
  ray.setFromCamera({x:((ev.clientX-rc.left)/rc.width)*2-1,y:-((ev.clientY-rc.top)/rc.height)*2+1},camera);
  return ray.intersectObjects(list,false);
}
function pickTarget(ev){
  if(mode==='condition'){
    const hits=castAt(ev,MESHES.filter(m=>condMap[m.userData.leaf])); if(!hits.length) return null;
    const u=hits[0].object.userData; return keyOf(u.leaf,u.side==='B'?selSide:u.side);
  }
  const lk=lpKey();
  const scope=lk==='brain'?MESHES:MESHES.filter(m=>m.userData.path.includes(lk));
  let hits=castAt(ev,scope);
  if(hits.length){
    const deepScope=lk!=='brain'&&!['hemiL','hemiR'].includes(lk);
    const inner=deepScope?hits.find(h=>h.object.userData.layer==='inner'):null;
    return childIn((inner||hits[0]).object,lk)||null;
  }
  hits=castAt(ev,MESHES); if(!hits.length) return null;
  const hp=hits[0].object.userData.path, sp=pathKeys(sel,selSide);
  const i=hp.findIndex(k=>sp.includes(k)); return i>0?hp[i-1]:null;
}
const nodeSide=(k)=>{ const {id,side}=parseKey(k); return side||(S[id].isHemi?S[id].side:selSide); };
let down=null; const tip=document.getElementById('tip');
canvas.addEventListener('pointerdown',e=>{ down={x:e.clientX,y:e.clientY,t:performance.now()}; });
canvas.addEventListener('pointerup',e=>{
  if(!down) return; const moved=Math.hypot(e.clientX-down.x,e.clientY-down.y), dt=performance.now()-down.t; down=null;
  if(moved<6&&dt<600){ const k=pickTarget(e); if(k) selectNode(parseKey(k).id,nodeSide(k),{scroll:true}); else if(mode==='structure') goUp(); }
});
let hoverQueued=null;
canvas.addEventListener('pointermove',e=>{ if(e.pointerType==='mouse') hoverQueued=e; });
canvas.addEventListener('pointerleave',()=>{ hovered=null; tip.hidden=true; canvas.style.cursor=''; applyView(); });
controls.addEventListener('start',()=>{ goal=null; });

/* ================= Labels ================= */
const labelsEl=document.getElementById('labels'), LBL={};
function labelEl(key){
  if(LBL[key]) return LBL[key];
  const {id}=parseKey(key), st=S[id];
  const b=document.createElement('button'); b.className='lbl'; b.type='button'; b.hidden=true;
  b.innerHTML=`<i></i><span>${esc(st.short||st.name)}</span>`;
  b.addEventListener('click',()=>{ if(mode==='condition'){ selectNode(id,viewSide(),{scroll:true}); return; } selectNode(id,nodeSide(key),{scroll:true}); });
  labelsEl.appendChild(b); LBL[key]=b; return b;
}
const tmp=new V3(), shown=new Set();
function updateLabels(){
  const w=stage.clientWidth,h=stage.clientHeight, vs=viewSide(), want=[];
  if(showLabels){
    if(mode==='condition'&&cond) cond.brain.forEach(([id,lv])=>want.push({key:'c|'+id,id,side:vs,c:lv==='p'?HOT:WARM}));
    else { const lp=labelParent();
      S[lp].kids.forEach(k=>{ const side=k.isHemi?k.side:(k.lat?selSide:vs); want.push({key:keyOf(k.id,side),id:k.id,side,c:k.color,sub:lp!=='brain'}); });
    }
  }
  const items=[];
  want.forEach(o=>{
    const a=anchorOf(o.id,o.side); if(!a) return;
    tmp.copy(a.p).addScaledVector(nodeOffset(o.id,o.side),spread).project(camera);
    if(tmp.z>1||Math.abs(tmp.x)>1.05||Math.abs(tmp.y)>1.05) return;
    items.push({o,x:(tmp.x*0.5+0.5)*w,y:(-tmp.y*0.5+0.5)*h});
  });
  items.sort((a,b)=>a.y-b.y);
  const placed=[], now=new Set(), sk=selKey();
  items.forEach(it=>{
    const el=it.o.key.startsWith('c|')?labelEl(it.o.id):labelEl(it.o.key);
    const lkey=it.o.key.startsWith('c|')?it.o.id:it.o.key;
    if(el.hidden) el.hidden=false;
    el.style.setProperty('--c',it.o.c);
    el.classList.toggle('sub',!!it.o.sub);
    el.classList.toggle('on',mode==='structure'&&lkey===sk);
    if(!el._w){ el._w=el.offsetWidth; el._h=el.offsetHeight; }
    const lw=el._w||110, lh=el._h||20;
    let flip=it.x<w*0.5; if(flip&&it.x-lw<4) flip=false; else if(!flip&&it.x+lw>w-4) flip=true;
    const x0=flip?it.x-lw+4.5:it.x-4.5; let y=it.y;
    for(let k=0;k<8;k++){ const hit=placed.find(r=>x0<r.x+r.w&&x0+lw>r.x&&y-lh/2<r.y+r.h/2+2&&y+lh/2>r.y-r.h/2-2); if(!hit) break; y=hit.y+lh+3; }
    placed.push({x:x0,y,w:lw,h:lh});
    el.classList.toggle('flip',flip);
    el.style.transform=`translate(${x0.toFixed(1)}px,${(y-lh/2).toFixed(1)}px)`;
    now.add(lkey);
  });
  shown.forEach(k=>{ if(!now.has(k)&&LBL[k]) LBL[k].hidden=true; });
  shown.clear(); now.forEach(k=>shown.add(k));
}

/* ================= Toolbar ================= */
const spreadIn=document.getElementById('spread');
spreadIn.addEventListener('input',()=>{ spread=spreadIn.value/100; applySpread(); });
const opacIn=document.getElementById('opac'), brightIn=document.getElementById('bright');
opacIn.addEventListener('input',()=>{ opac=opacIn.value/100; applyView(); });
brightIn.addEventListener('input',()=>{ bright=0.35+brightIn.value/100*1.3; LIGHTS.forEach(([L,b])=>L.intensity=b*bright); applyView(); });
document.getElementById('lblBtn').addEventListener('click',e=>{ showLabels=!showLabels; e.currentTarget.setAttribute('aria-pressed',String(showLabels)); });
document.getElementById('resetBtn').addEventListener('click',()=>{ spreadIn.value=0; spread=0; applySpread(); if(mode==='structure') selectNode('brain','L',{tab:false}); else goal={pos:HOME.clone(),tgt:CENTER.clone()}; });
document.getElementById('upBtn').addEventListener('click',()=>{ if(mode==='condition') showTab('region'); else goUp(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if(!pop.hidden){ hidePop(); return; } if(mode==='structure'&&!(e.target.closest&&e.target.closest('input'))) goUp(); } });

/* ================= Section map ================= */
const mapEl=document.getElementById('chips');
function chip(id,side,label,color,pressed,cls){ return `<button type="button" class="chip${cls?' '+cls:''}" data-node="${id}" data-side="${side||''}" style="--c:${color}" aria-pressed="${pressed}"><i></i>${esc(label)}</button>`; }
function renderMap(){
  const sp=pathKeys(sel,selSide), inPath=k=>sp.includes(k), sk=selKey();
  const sec=(title,headId,headSide,kids,kidSide,color)=>{
    const headKey=headId?keyOf(headId,headSide):null;
    const kk=k=>keyOf(k.id,k.lat?kidSide:'L');
    const active=(headKey&&inPath(headKey))||kids.some(k=>inPath(kk(k)));
    let h=`<div class="sec${active?' open':''}" style="--c:${color}"><div class="sec-h">${headId?`<button type="button" class="sec-t" data-node="${headId}" data-side="${headSide||''}" aria-pressed="${headKey===sk}">${esc(title)}</button>`:`<span class="sec-t">${esc(title)}</span>`}</div><div class="sec-row">`;
    h+=kids.map(k=>chip(k.id,k.lat?kidSide:null,k.name,k.color,inPath(kk(k)))).join('');
    h+='</div>';
    const open=kids.find(k=>inPath(kk(k)));
    if(open&&open.kids&&open.kids.length){
      h+=`<div class="sub-map" style="--c:${open.color}">`;
      const groups=open.kids.filter(k=>k.isGroup), singles=open.kids.filter(k=>!k.isGroup);
      groups.forEach(g=>{ h+=`<div class="grp"><button type="button" class="grp-t" data-node="${g.id}" data-side="${g.lat?kidSide:''}" aria-pressed="${keyOf(g.id,kidSide)===sk}">${esc(g.name)}</button><div class="grp-row">${g.kids.map(l=>chip(l.id,l.lat?kidSide:null,l.short||l.name,l.color,inPath(keyOf(l.id,kidSide)),'sm')).join('')}</div></div>`; });
      if(singles.length) h+=`<div class="grp">${groups.length?`<span class="grp-t plain">Other parts</span>`:`<span class="grp-t plain">Parts</span>`}<div class="grp-row">${singles.map(l=>chip(l.id,l.lat?kidSide:null,l.short||l.name,l.color,inPath(keyOf(l.id,kidSide)),'sm')).join('')}</div></div>`;
      h+='</div>';
    }
    return h+'</div>';
  };
  let h=sec('Left hemisphere','hemiL','L',S.hemiL.kids,'L',S.hemiL.color);
  h+=sec('Right hemisphere','hemiR','R',S.hemiR.kids,'R',S.hemiR.color);
  h+=sec('Deep structures','deep',null,S.deep.kids,null,S.deep.color);
  h+=sec('Hindbrain',null,null,[S.cerebellum,S.brainstem],null,'#B58BD6');
  mapEl.innerHTML=h;
}
mapEl.addEventListener('click',e=>{ const b=e.target.closest('[data-node]'); if(!b) return; const id=b.dataset.node; selectNode(id,b.dataset.side||(S[id].isHemi?S[id].side:selSide),{scroll:true}); });

/* ================= Close-up viewer ================= */
const mini=document.createElement('canvas'); mini.setAttribute('aria-label','Close-up of the selected structure');
const mR=new THREE.WebGLRenderer({canvas:mini,antialias:true,alpha:true}); mR.setPixelRatio(Math.min(devicePixelRatio,2));
const mS=new THREE.Scene(); addLights(mS);
const mC=new THREE.PerspectiveCamera(35,16/10,0.02,50);
const mCtl=new THREE.OrbitControls(mC,mini); mCtl.enablePan=false; mCtl.enableDamping=true; mCtl.autoRotate=!reduceMotion; mCtl.autoRotateSpeed=1.6; mCtl.minDistance=0.3; mCtl.maxDistance=8;
const ghostMat=new THREE.MeshStandardMaterial({color:0x9aa6b6,transparent:true,opacity:0.08,depthWrite:false,roughness:0.8});
MESHES.forEach(m=>{ if(m.userData.layer!=='inner') mS.add(new THREE.Mesh(m.geometry,ghostMat)); });
let miniGroup=new THREE.Group(); mS.add(miniGroup);
function buildMini(id,side){
  mS.remove(miniGroup); miniGroup=new THREE.Group();
  const n=S[id], key=keyOf(id,side), ms=(n.lat||n.isHemi)?meshesOf(id,side):n.meshes;
  ms.forEach(m=>{ const ck=isLeafNode(id)?key:childIn(m,key); const c=new THREE.Color(ck?colorOfKey(ck):S[m.userData.leaf].color); miniGroup.add(new THREE.Mesh(m.geometry,new THREE.MeshStandardMaterial({color:c,roughness:0.55,metalness:0.02,emissive:c.clone().multiplyScalar(0.12)}))); });
  mS.add(miniGroup);
  const b=bbox(ms), c=b.getCenter(new V3()), rad=b.getSize(new V3()).length()/2;
  const d=fdirOf(id,side)||new V3(-1,0.3,0.3), dist=Math.min(Math.max(rad*3.2,0.5),5);
  mCtl.target.copy(c); mC.position.copy(c).addScaledVector(d,dist); mCtl.update();
}
function sizeMini(){ const w=mini.clientWidth,h=mini.clientHeight; if(w&&h){ mR.setSize(w,h,false); mC.aspect=w/h; mC.updateProjectionMatrix(); } }
new ResizeObserver(sizeMini).observe(mini);

/* ================= Region panel ================= */
const regionView=document.getElementById('view-region');
function descendantIds(n,acc){ acc=acc||[]; acc.push(n.id); (n.kids||[]).forEach(k=>descendantIds(k,acc)); return acc; }
function linkedFor(id){
  const n=S[id]; if(n.isRoot||n.isHemi||n.isGroupRoot) return new Map();
  const ids=descendantIds(n); if(n.isLeaf||n.isGroup){ ids.push(n.topId); if(n.isLeaf&&groupOf[id]) ids.push(groupOf[id]); }
  const out=new Map();
  ids.forEach(i=>(LINKED[i]||[]).forEach(({c,lv})=>{ const prev=out.get(c.key); if(!prev||(lv==='p'&&prev!=='p')) out.set(c.key,lv); }));
  return out;
}
function condChips(map,kind){
  const arr=[...map.entries()].map(([k,lv])=>({c:CONDS[k],lv})).filter(x=>x.c.kind===kind).sort((a,b)=>(a.lv===b.lv?0:a.lv==='p'?-1:1)||a.c.name.localeCompare(b.c.name));
  return arr.map(({c,lv})=>`<button type="button" class="chip cond" data-cond="${c.key}" style="--c:${lv==='p'?'var(--hot)':'var(--warm)'}"><i></i>${esc(c.short||c.name)}</button>`).join('');
}
function subCard(c,side,current){
  return `<button type="button" class="subcard" data-node="${c.id}" data-side="${c.isHemi?c.side:(c.lat?side:'')}" style="--c:${c.color}"${current?' aria-current="true"':''}><span class="nm"><i></i>${esc(c.name)}${c.isGroup?`<small>${c.kids.length} parts</small>`:''}</span><span class="ds">${esc(firstSentence(c.summary||''))}</span></button>`;
}
function crumbs(){
  const p=pathKeys(sel,selSide).reverse();
  return `<div class="crumbs">${p.map((k,i)=>{ const {id,side}=parseKey(k); const nm=S[id].name; return i===p.length-1?`<span>${esc(nm)}</span>`:`<button type="button" data-node="${id}" data-side="${side||(S[id].isHemi?S[id].side:'')}">${esc(nm)}</button><span>›</span>`; }).join('')}</div>`;
}
function renderRegion(){
  const st=S[sel], seen=new Set(['s:'+st.id]);
  const sideName=(st.lat&&!st.isHemi)?(selSide==='L'?'Left':'Right'):'';
  let kind=st.kind||(st.isGroup?S[st.topId].name+' · Group':(st.isLeaf?(S[st.topId].name+(groupOf[st.id]?' · '+S[groupOf[st.id]].name:'')):''));
  if(sideName) kind=sideName+' · '+kind;
  let h=crumbs();
  h+=`<p class="eyebrow" style="--c:${st.color}"><i></i>${esc(kind)}</p><h2>${esc(st.name)}</h2>`;
  if(st.short&&st.short!==st.name) h+=`<p class="alias">Label on the model: ${esc(st.short)}</p>`;
  if(st.where) h+=`<p class="where"><b>Where</b>${linkify(st.where,seen)}</p>`;
  h+=`<div class="closer" id="closer"></div><p class="cap">${isLeafNode(sel)?'Close-up: this part in color inside a see-through brain. Drag to turn it.':'Close-up with each section in its own color. Drag to turn it.'}</p>`;
  if(sel==='brain') h+=`<p class="helpline">Click a section on the model, its label, or a button under the model to go one level deeper. Click empty space or press Esc to go back up. Use Spread to pull the parts apart. Dotted words open a definition; you can also highlight any word to look it up.</p>`;
  if(st.summary) h+=`<p class="summary">${linkify(st.summary,seen)}</p>`;
  if(st.does) h+=`<h3>What it does</h3><ul class="fx" style="--c:${st.color}">${st.does.map(d=>`<li>${linkify(d,seen)}</li>`).join('')}</ul>`;
  if(st.kids&&st.kids.length){
    const label=st.isRoot?'Main divisions':st.isHemi?'Lobes':st.isGroupRoot?'Structures':st.isGroup?'Parts':'Sections';
    h+=`<h3>${label} <span class="n">${st.kids.length}</span></h3><div class="subgrid">${st.kids.map(c=>subCard(c,selSide,false)).join('')}</div>`;
  }
  const dmg=st.damage||st.clinical;
  if(dmg) h+=`<h3>${st.clinical?'Clinical relevance':"When it's damaged"}</h3><p class="para">${linkify(dmg,seen)}</p>`;
  if(st.fact) h+=`<div class="fact"><b>Did you know</b>${linkify(st.fact,seen)}</div>`;
  const L=linkedFor(st.id);
  if(L.size){
    const p=condChips(L,'psych'), d=condChips(L,'disease');
    h+=`<h3>Linked conditions</h3>`;
    if(p) h+=`<p class="key" style="margin-top:8px">Psychology</p><div class="links">${p}</div>`;
    if(d) h+=`<p class="key" style="margin-top:10px">Diseases</p><div class="links">${d}</div>`;
  }
  if(isLeafNode(sel)){ const par=S[parentOf(sel,selSide)]; if(par&&par.kids) h+=`<h3>Also in the ${esc(par.name.toLowerCase())}</h3><div class="subgrid">${par.kids.map(c=>subCard(c,selSide,c.id===st.id)).join('')}</div>`; }
  regionView.innerHTML=h; regionView.scrollTop=0;
  document.getElementById('closer').appendChild(mini); sizeMini();
}
regionView.addEventListener('click',e=>{ const b=e.target.closest('[data-node]'); if(!b) return; const id=b.dataset.node; selectNode(id,b.dataset.side||(S[id].isHemi?S[id].side:selSide),{scroll:true}); });

/* ================= Condition panels ================= */
function renderCondList(kind){
  const view=document.getElementById(VIEWS[kind]), data=kind==='psych'?PSYCH:DISEASES, noun=kind==='psych'?'disorders':'diseases';
  view.innerHTML=`<label class="eyebrow" for="q-${kind}">Search ${noun}</label><input class="search" id="q-${kind}" type="search" placeholder="${kind==='psych'?'e.g. borderline, OCD, anxiety':"e.g. Alzheimer's, stroke, tremor"}" autocomplete="off"><p class="count"></p><div class="clist"></div><p class="note">${kind==='psych'?'Organized by DSM-5-TR category. Choose a disorder to see its full write-up and the brain areas research links to it.':'Choose a disease to see its full write-up and the brain areas it affects.'}</p>`;
  const input=view.querySelector('.search'), list=view.querySelector('.clist'), count=view.querySelector('.count');
  const draw=()=>{
    const q=input.value.trim().toLowerCase();
    const f=data.filter(c=>!q||c.name.toLowerCase().includes(q)||(c.aka||[]).some(a=>a.includes(q))||c.cat.toLowerCase().includes(q)||c.summary.toLowerCase().includes(q));
    count.textContent=`${f.length} of ${data.length} ${noun}`;
    const cats=[]; f.forEach(c=>{ if(!cats.includes(c.cat)) cats.push(c.cat); });
    list.innerHTML=f.length?cats.map(cat=>`<h4>${esc(cat)}</h4><ul>${f.filter(c=>c.cat===cat).map(c=>`<li><button type="button" class="citem" data-cond="${c.key}"><span class="t">${esc(c.name)}${c.short&&c.short!==c.name&&!c.name.includes(c.short)?`<small>${esc(c.short)}</small>`:''}</span><span class="d">${esc(firstSentence(c.summary))}</span></button></li>`).join('')}</ul>`).join(''):`<p class="empty">No ${noun} match “${esc(input.value)}”.</p>`;
  };
  input.addEventListener('input',draw); draw();
}
function section(title,body,open){ return `<details class="acc"${open?' open':''}><summary>${esc(title)}</summary><div class="acc-b">${body}</div></details>`; }
function renderCondDetail(c){
  const view=document.getElementById(VIEWS[c.kind]), seen=new Set(['c:'+c.key]);
  const areas=c.brain.slice().sort((a,b)=>a[1]===b[1]?0:a[1]==='p'?-1:1);
  const P=t=>`<p class="para">${linkify(t,seen)}</p>`;
  let h=`<button type="button" class="back" data-back="${c.kind}">← All ${c.kind==='psych'?'disorders':'diseases'}</button>`;
  h+=`<p class="eyebrow" style="--c:var(--hot)"><i></i>${esc(c.cat)}</p><h2>${esc(c.name)}</h2>`;
  if(c.short&&c.short!==c.name&&!c.name.includes(c.short)) h+=`<p class="alias">Also called ${esc(c.short)}</p>`;
  h+=`<div class="accs">`;
  h+=section('Overview',(c.overview||[c.summary]).map(P).join(''),true);
  let ab=`<div class="key"><span><i style="background:var(--hot)"></i>Primary</span><span><i style="background:var(--warm)"></i>Also involved</span></div><ul class="areas">`;
  areas.forEach(([id,lv,note])=>{ const st=S[id]; ab+=`<li><span class="sw" style="background:${lv==='p'?'var(--hot)':'var(--warm)'}"></span><button type="button" class="go" data-focus="${id}">${esc(st.name)}${st.isTop?'':`<small>${esc(S[st.topId].name)}</small>`}</button><p>${linkify(note,seen)}</p></li>`; });
  ab+=`</ul>`;
  h+=section('Brain areas highlighted on the model',ab,true);
  h+=section('Signs and symptoms',`<ul class="fx" style="--c:var(--hot)">${c.symptoms.map(s=>`<li>${linkify(s,seen)}</li>`).join('')}</ul>`,false);
  if(c.diagnosis) h+=section('How it is diagnosed',[].concat(c.diagnosis).map(P).join(''),false);
  if(c.types) h+=section(c.kind==='disease'?'Types and stages':'Types and presentations',[].concat(c.types).map(P).join(''),false);
  h+=section('Causes and risk factors',[].concat(c.causes).map(P).join(''),false);
  h+=section('Treatment',[].concat(c.treatment).map(P).join(''),false);
  if(c.course) h+=section('Course and outlook',[].concat(c.course).map(P).join(''),false);
  h+=section('How common',P(c.prevalence),false);
  h+=`</div>`;
  if(c.fact) h+=`<div class="fact"><b>${c.fact.startsWith('If you')?'Getting help':'Did you know'}</b>${linkify(c.fact,seen)}</div>`;
  h+=`<p class="note">Brain findings describe average differences found in research groups. They can't diagnose an individual, and brain changes may be a cause, a consequence or both. This is a study reference, not medical advice.</p>`;
  view.innerHTML=h; view.scrollTop=0;
}
renderCondList('psych'); renderCondList('disease');

/* ================= Dictionary ================= */
const DICT=[
  ...GLOSSARY.map(([t,d,aka])=>({k:'g:'+t,name:t,def:d,aka,type:'Term'})),
  ...Object.values(S).filter(s=>!s.isRoot).map(s=>({k:'s:'+s.id,name:s.name,def:firstSentence(s.summary||''),aka:s.aka||[],type:'Region',ref:s.id,sub:s.topId&&s.topId!==s.id?S[s.topId].name:''})),
  ...Object.values(CONDS).map(c=>({k:'c:'+c.key,name:c.name,def:firstSentence(c.summary),aka:c.aka||[],type:c.kind==='psych'?'Psychology':'Disease',ref:c.key}))
].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:'base'}));
const gq=document.getElementById('gq'), glist=document.getElementById('glist'), gcount=document.getElementById('gcount'), gfil=document.getElementById('gfilters');
const FILTERS=['All','Term','Region','Psychology','Disease']; let gFilter='All';
gfil.innerHTML=FILTERS.map(f=>`<button type="button" class="chip" data-f="${f}" aria-pressed="${f==='All'}">${f==='All'?'All':f==='Term'?'Terms':f==='Region'?'Regions':f}</button>`).join('');
gfil.addEventListener('click',e=>{ const b=e.target.closest('[data-f]'); if(!b) return; gFilter=b.dataset.f; gfil.querySelectorAll('[data-f]').forEach(x=>x.setAttribute('aria-pressed',String(x===b))); renderGloss(); });
const slug=k=>'g-'+k.replace(/[^a-z0-9]+/gi,'-');
function renderGloss(hl){
  const q=gq.value.trim().toLowerCase();
  const list=DICT.filter(e=>(gFilter==='All'||e.type===gFilter)&&(!q||e.name.toLowerCase().includes(q)||e.aka.some(a=>a.includes(q))||e.def.toLowerCase().includes(q)));
  gcount.textContent=`${list.length} of ${DICT.length} entries`;
  glist.innerHTML=list.length?list.map(e=>`<li id="${slug(e.k)}"${e.k===hl?' class="hl"':''}><span class="t">${esc(cap(e.name))}</span><span class="tag">${e.type}${e.sub?' · '+esc(e.sub):''}</span><p>${esc(e.def)}</p>${e.type==='Region'?`<button type="button" class="lnk" data-sub="${e.ref}">Show on the model →</button>`:e.type!=='Term'?`<button type="button" class="lnk" data-cond="${e.ref}">Open full entry →</button>`:''}</li>`).join(''):`<li class="empty">Nothing matches “${esc(gq.value)}”.</li>`;
}
gq.addEventListener('input',()=>renderGloss());
renderGloss();
const recent=[], recentEl=document.getElementById('recent');
function remember(term){ const i=recent.indexOf(term); if(i>=0) recent.splice(i,1); recent.unshift(term); recent.length=Math.min(recent.length,8);
  recentEl.innerHTML=recent.map(t=>`<button class="chip" type="button" data-dict="g:${esc(t)}">${esc(cap(t))}</button>`).join(''); }
function openInGlossary(k){
  hidePop(); gq.value=''; gFilter='All'; gfil.querySelectorAll('[data-f]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.f==='All')));
  showTab('gloss'); renderGloss(k);
  const el=document.getElementById(slug(k)); if(el) el.scrollIntoView({block:'center',behavior:reduceMotion?'auto':'smooth'});
}

/* ================= Popover ================= */
const pop=document.getElementById('pop'); let popAnchor=null;
function placePop(rect){
  pop.hidden=false;
  const pw=pop.offsetWidth, ph=pop.offsetHeight, m=16;
  const x=Math.min(Math.max(rect.left+rect.width/2-pw/2,m),innerWidth-pw-m);
  let y=rect.bottom+8; if(y+ph>innerHeight-m) y=Math.max(m,rect.top-ph-8);
  pop.style.left=x+'px'; pop.style.top=y+'px';
}
const closeBtn='<button class="x" type="button" data-close>Close ✕</button>';
function showDef(res,rect){
  if(!res) return; popAnchor=rect; const e=res.e;
  if(e&&e.t==='g'){ const t=TERMS[e.id]; remember(t.term);
    pop.innerHTML=`<div class="row"><span class="kind">Dictionary</span>${closeBtn}</div><h4>${esc(cap(t.term))}</h4><p>${esc(t.def)}</p><div class="row"><button class="lnk" type="button" data-dict="g:${esc(t.term)}">See in dictionary →</button></div>`;
  } else if(e&&e.t==='s'){ const st=S[e.id]; const s2=(st.summary||'').match(/^(.*?[.!?])(\s+.*?[.!?])?(?=\s|$)/);
    pop.innerHTML=`<div class="row"><span class="kind">Brain region${st.topId&&st.topId!==st.id?' · '+esc(S[st.topId].name):''}</span>${closeBtn}</div><h4>${esc(st.name)}</h4><p>${esc(s2?s2[0]:st.summary||'')}</p><div class="row"><button class="lnk" type="button" data-sub="${st.id}">Show on the model →</button></div>`;
  } else if(e&&e.t==='c'){ const c=CONDS[e.id];
    pop.innerHTML=`<div class="row"><span class="kind">${c.kind==='psych'?'Psychology':'Disease'} · ${esc(c.cat)}</span>${closeBtn}</div><h4>${esc(c.name)}</h4><p>${esc(firstSentence(c.summary))}</p><div class="row"><button class="lnk" type="button" data-cond="${c.key}">Open full entry and highlight →</button></div>`;
  } else {
    const q=res.q, words=q.split(' ').filter(w=>w.length>2);
    const sugg=DICT.filter(d=>words.some(w=>d.name.toLowerCase().includes(w)||d.aka.some(a=>a.includes(w)))).slice(0,4);
    pop.innerHTML=`<div class="row"><span class="kind">Dictionary</span>${closeBtn}</div><h4>“${esc(q)}”</h4><p>This isn't in the dictionary. It's likely an everyday word rather than a brain or medical term.</p>${sugg.length?`<div class="sugg">${sugg.map(d=>`<button class="chip" type="button" data-def="${esc(d.k)}">${esc(cap(d.name))}</button>`).join('')}</div>`:''}<div class="row"><button class="lnk" type="button" data-browse>Browse the dictionary →</button></div>`;
  }
  placePop(rect);
}
function hidePop(){ pop.hidden=true; popAnchor=null; }
function keyToRes(k){ const i=k.indexOf(':'); return {e:{t:k.slice(0,i),id:k.slice(i+1)}}; }

/* ================= Global clicks ================= */
document.addEventListener('click',e=>{
  const t=e.target.closest('button'); if(!t) return;
  if(t.classList.contains('term')&&t.dataset.t){ e.preventDefault(); showDef({e:{t:t.dataset.t,id:t.dataset.id}},t.getBoundingClientRect()); return; }
  if(t.hasAttribute('data-close')){ hidePop(); return; }
  if(t.dataset.sub){ const id=t.dataset.sub; selectNode(id,S[id].isHemi?S[id].side:selSide,{scroll:true}); return; }
  if(t.dataset.cond){ openCondition(t.dataset.cond); return; }
  if(t.dataset.focus){ focusNode(t.dataset.focus,viewSide()); return; }
  if(t.dataset.back){ closeCondition(t.dataset.back); return; }
  if(t.dataset.dict){ openInGlossary(t.dataset.dict); return; }
  if(t.dataset.def){ showDef(keyToRes(t.dataset.def),popAnchor||t.getBoundingClientRect()); return; }
  if(t.hasAttribute('data-browse')){ hidePop(); showTab('gloss'); gq.value=''; renderGloss(); gq.focus(); return; }
});
document.addEventListener('pointerdown',e=>{ if(!pop.hidden&&!pop.contains(e.target)&&!e.target.closest('.term')) hidePop(); });
window.addEventListener('resize',hidePop);
document.querySelectorAll('.view').forEach(v=>v.addEventListener('scroll',hidePop,{passive:true}));
let selTimer=null, lastSel='';
document.addEventListener('selectionchange',()=>{
  clearTimeout(selTimer);
  selTimer=setTimeout(()=>{
    const s=getSelection(); if(!s||s.isCollapsed||!s.rangeCount){ lastSel=''; return; }
    const text=s.toString().trim(); if(!text||text.length>48||text===lastSel) return;
    const node=s.anchorNode&&(s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode.parentElement);
    if(!node||!node.closest('.view')||node.closest('.pop')||node.closest('input')||node.closest('summary')) return;
    lastSel=text; showDef(lookup(text),s.getRangeAt(0).getBoundingClientRect());
  },380);
});

/* ================= Loop ================= */
let firstSize=true;
function resize(){
  const w=stage.clientWidth,h=stage.clientHeight; if(!w||!h) return;
  renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
  if(firstSize){ firstSize=false; HOME.sub(CENTER).multiplyScalar(fit()).add(CENTER); camera.position.copy(HOME); }
}
new ResizeObserver(resize).observe(stage); resize();
function tick(){
  if(goal){ camera.position.lerp(goal.pos,0.08); controls.target.lerp(goal.tgt,0.08); if(camera.position.distanceTo(goal.pos)<0.01) goal=null; }
  controls.update();
  if(hoverQueued){
    const e=hoverQueued; hoverQueued=null; const k=pickTarget(e);
    if(k!==hovered){ hovered=k; if(mode==='structure') applyView(); canvas.style.cursor=k?'pointer':''; }
    if(k){ const rc=stage.getBoundingClientRect(); const {id,side}=parseKey(k); const nm=S[id].name; tip.hidden=false; tip.textContent=side?(side==='L'?'Left ':'Right ')+nm.charAt(0).toLowerCase()+nm.slice(1):nm; tip.style.left=(e.clientX-rc.left)+'px'; tip.style.top=(e.clientY-rc.top)+'px'; } else tip.hidden=true;
  }
  renderer.render(scene,camera);
  updateLabels();
  if(activeTab==='region'&&mini.isConnected&&mini.clientWidth){ mCtl.update(); mR.render(mS,mC); }
  requestAnimationFrame(tick);
}
document.getElementById('stats').textContent=`${ATLAS.subs.length} brain parts · ${PSYCH.length} disorders · ${DISEASES.length} diseases · ${DICT.length} dictionary entries`;
selectNode('brain','L',{focus:false});
updateCondbar();
tick();
window.__atlas={S,CONDS,selectNode,openCondition,showTab,setSpread:v=>{spread=v;spreadIn.value=v*100;applySpread();}};
})();
