// Utilidades mínimas compartidas.
export const Dom = {
  escapeHtml(t){return String(t??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");},
  safeText(v){return v==null?"":String(v).trim();},
  fillSelect(sel, vals, fn){sel.innerHTML=""; for(const v of vals){const o=document.createElement("option"); o.value=v; o.textContent=fn?fn(v):v; sel.appendChild(o);} },
  fillSelectFromObjects(sel, items, ph){sel.innerHTML=""; const p=document.createElement("option"); p.value=""; p.textContent=ph; sel.appendChild(p); for(const it of items){const o=document.createElement("option"); o.value=String(it.value); o.textContent=String(it.label); sel.appendChild(o);} },
  setSelectValueIfExists(sel, v){const s=String(v??""); if(Array.from(sel.options).some(o=>o.value===s)) sel.value=s;},
  infoBox(m){return `<div class="alert alert-info mb-0" role="alert">${Dom.escapeHtml(m)}</div>`;},
  extractPlatformFromLabel(l){const m=String(l||"").match(/PLATF\.?\((\d+)\)/i); return m?m[1]:"";},
  extractLineFromLabel(l){const m=String(l||"").match(/^([A-Z]\d+[A-Z]?)-/i); return m?m[1].toUpperCase():"";},
  extractLineFromTripId(id){const m=String(id||"").match(/(C\d+[AB]?)/i); return m?m[1].toUpperCase():"";},
  uniqueSorted(vals){return Array.from(new Set(vals.filter(v=>v))).sort((a,b)=>a.localeCompare(b,"es"));}
};

export const Time = {
  pad2(v){return String(v).padStart(2,"0");},
  nowEpochSeconds(){return Math.floor(Date.now()/1000);},
  toLocalHHMM(e){if(!e) return ""; const d=new Date(Number(e)*1000); return `${Time.pad2(d.getHours())}:${Time.pad2(d.getMinutes())}`;},
  nowHHMMSS(){const d=new Date(); return `${Time.pad2(d.getHours())}:${Time.pad2(d.getMinutes())}:${Time.pad2(d.getSeconds())}`;}
};

export const Storage = {
  get(k){return localStorage.getItem(k);},
  set(k,v){localStorage.setItem(k,v);},
  safeJsonParse(r){try{return JSON.parse(r);}catch{return null;}}
};

export async function loadJson(url, timeoutMs=20000){
  const c=new AbortController(); const t=setTimeout(()=>c.abort(), timeoutMs);
  try{const r=await fetch(url,{cache:"no-store", signal:c.signal}); if(!r.ok) throw new Error(`HTTP ${r.status}`); return await r.json();}
  finally{clearTimeout(t);}
}

export async function loadScript(url){
  return await new Promise((res,rej)=>{const s=document.createElement("script"); s.defer=true; s.src=url; s.onload=()=>res(true); s.onerror=()=>rej(new Error(`No se pudo cargar: ${url}`)); document.head.appendChild(s);});
}

export const SplitFlap = {
  apply(el){
    if(!el) return;
    const txt=el.textContent||"";
    if(el.dataset.flapApplied==="1") return;
    el.dataset.flapApplied="1";
    const wrap=document.createElement("span"); wrap.className="splitflap";
    for(const ch of txt){
      const flap=document.createElement("span"); flap.className="flap";
      const inner=document.createElement("span"); inner.textContent=ch;
      flap.appendChild(inner); wrap.appendChild(flap);
      flap.animate([{transform:"rotateX(0deg)",opacity:0.2},{transform:"rotateX(60deg)",opacity:0.6},{transform:"rotateX(0deg)",opacity:1}],{duration:320+Math.floor(Math.random()*180),iterations:1,easing:"cubic-bezier(.2,.7,.1,1)"});
    }
    el.textContent=""; el.appendChild(wrap);
  }
};

export async function renderQrToCanvas(canvas, text){
  if(!canvas) throw new Error("Canvas QR no disponible.");
  if(!window.QRCode){await loadScript("https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js");}
  if(!window.QRCode?.toCanvas) throw new Error("Librería QR no disponible.");
  await window.QRCode.toCanvas(canvas, text, { width: 240, margin: 1 });
}

export async function readQrFromImageFile(file){
  if(!file) throw new Error("No se ha proporcionado imagen.");
  if(!("BarcodeDetector" in window)) throw new Error("Tu navegador no soporta lectura de QR (BarcodeDetector).");
  const detector=new window.BarcodeDetector({formats:["qr_code"]});
  const bitmap=await createImageBitmap(file);
  const codes=await detector.detect(bitmap);
  if(!codes?.length) throw new Error("No se detectó ningún QR en la imagen.");
  return String(codes[0].rawValue||"");
}
