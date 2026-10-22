const {Plugin, Modal, setIcon} = require('obsidian');
const fs = require('fs');
const path = require('path');
const os = require('os');

function classify(record, now = Date.now() / 1000) {
  const unknown = {color:'#8b949e', label:'Status unavailable or stale'};
  if (!record || !Number.isFinite(record.localAt) || !Number.isFinite(record.peerAt) ||
      [record.localAt,record.peerAt].some(t => now-t > 240 || t > now+30)) return unknown;
  const kinds = {
    same: ['#5fc785','Portable content matches the other Mac'],
    outgoing: ['#e3b341','This Mac has changes the other Mac does not have'],
    incoming: ['#58a6ff','The other Mac has changes this Mac does not have'],
    peerOpen: ['#5fc785','Portable content matches the other Mac'],
    conflict: ['#f85149','Both Macs changed the same file differently'],
    bothChanged: ['#e3b341','Independent changes on both Macs; different files'],
    different: ['#bc8cff','Copies differ; direction is not established'],
    diverged: ['#bc8cff','Copies differ; direction is not established']
  };
  const pair=kinds[record.state];return pair ? {color:pair[0],label:pair[1]} : unknown;
}
function activity(record, now = Date.now()/1000) {
  if (!record || [record.localAt,record.peerAt].some(t=>!Number.isFinite(t)||t<=0||now-t>240||t>now+30) || typeof record.localOpen!=='boolean' || typeof record.peerOpen!=='boolean')
    return {icons:['help-circle'],label:'Open-vault activity unavailable or stale'};
  return {icons:[...(record.localOpen?['laptop']:[]),...(record.peerOpen?['monitor']:[])],
    label:record.localOpen ? (record.peerOpen?'Vault appears open on both Macs':'Vault appears open on this Mac') : (record.peerOpen?'Vault appears open on the other Mac':'Neither Mac reports this vault open')};
}
function contentViews(record,now=Date.now()/1000){
 const fallback=classify(record,now);if(fallback.color==='#8b949e')return [fallback];
 const counts=record.fileCounts;
 if(counts && ['conflict','unclassified','local','remote'].every(k=>Number.isInteger(counts[k])&&counts[k]>=0)){
  const defs=[['conflict','#f85149','Competing same-file edits'],['unclassified','#bc8cff','Baseline not established'],['local','#e3b341','Local changes'],['remote','#58a6ff','Remote changes']];
  const views=defs.filter(([k])=>counts[k]>0).map(([k,color,label])=>({color,label:`${label}: ${counts[k]}`}));
  if(views.length)return views;
 }
 return record.state==='bothChanged'?[fallback,{color:'#58a6ff',label:'Remote changes'}]:[fallback];
}
const when=t=>Number.isFinite(t) ? new Date(t*1000).toLocaleString() : 'Unavailable';
class StatusDetails extends Modal {
  constructor(app, getRecord) {super(app);this.getRecord=getRecord;}
  onOpen() {this.refresh();this.timer=setInterval(()=>this.refresh(),15000);}
  refresh() {
    this.contentEl.empty();const r=this.getRecord();this.contentEl.createEl('h3',{text:'Vault status'});
    this.contentEl.createEl('p',{text:classify(r).label});
    this.contentEl.createEl('p',{text:activity(r).label});
    if(r?.fileCounts)this.contentEl.createEl('p',{text:contentViews(r).map(v=>v.label).join('; ')});
    this.contentEl.createEl('p',{text:`Other Mac: ${r?.peerName || 'Not configured'}. Last checked: ${when(r?.peerAt)}.`});
    this.contentEl.createEl('p',{text:`This Mac checked: ${when(r?.localAt)}. Other Mac last received our status: ${when(r?.peerSawAt)}.`});
    if(r?.error)this.contentEl.createEl('p',{text:r.error});
    this.contentEl.createEl('p',{text:'Content dot: green = matching; amber = changes on this Mac; blue = changes on the other Mac; amber + blue = independent changes on both Macs; red = both Macs changed the same file differently; purple = baseline not established; gray = unknown or stale. Purple does not establish a conflict. Activity: laptop = this Mac; monitor = other Mac; both icons = both open; no icon = neither reports open; question mark = unavailable.'});
    this.contentEl.createEl('p',{text:'Updates normally arrive in 1–2 minutes plus scan time while both Macs are awake, logged in, and connected. This indicator does not copy files or lock editing. Gray is not permission to assume the other Mac has no changes.'});
    this.contentEl.createEl('p',{text:'Compares standard vault content and learning data. Credentials, Git internals, caches, workspace layouts, host-specific settings and protected nested vaults are excluded.'});
  }
  onClose(){clearInterval(this.timer);this.contentEl.empty();}
}
module.exports = class VaultManagerStatus extends Plugin {
  onload() {
    this.alive=true;this.pending=false;this.record=null;
    const base=this.app.vault.adapter.getBasePath?.();
    this.name=base && path.dirname(path.resolve(base))===path.join(os.homedir(),'ObsidianVaults') ? path.basename(base) : null;
    this.file=path.join(os.homedir(),'Library/Application Support/VaultManager/cross-status.json');
    this.item=this.addStatusBarItem();this.item.addClass('vault-manager-status');this.item.setAttribute('role','button');this.item.tabIndex=0;
    this.dot=this.item.createSpan({cls:'vault-manager-status-dot'});this.remoteDot=this.item.createSpan({cls:'vault-manager-status-dot'});this.dots=[this.dot,this.remoteDot,this.item.createSpan({cls:'vault-manager-status-dot'}),this.item.createSpan({cls:'vault-manager-status-dot'})];this.activityEl=this.item.createSpan({cls:'vault-manager-status-activity'});this.render();
    const open=()=>{this.modal?.close();this.modal=new StatusDetails(this.app,()=>this.record);this.modal.open();};
    this.registerDomEvent(this.item,'click',open);
    this.registerDomEvent(this.item,'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open();}});
    this.registerInterval(window.setInterval(()=>{
      if(this.pending && Date.now()-this.pendingSince>5000)this.record=null;
      this.render();void this.refresh();
    },15000));
    this.register(()=>{this.alive=false;this.controller?.abort();this.modal?.close();});
    void this.refresh();
  }
  render(){const views=contentViews(this.record),active=activity(this.record);
    this.dots.forEach((dot,i)=>{dot.style.display=i<views.length?'inline-block':'none';if(views[i])dot.style.backgroundColor=views[i].color;});
    const key=active.icons.join(',');if(this.activityKey!==key){this.activityKey=key;this.activityEl.empty();for(const icon of active.icons)setIcon(this.activityEl.createSpan(),icon);}
    const label=views.map(v=>v.label).join('; ')+'. '+active.label;
    this.item.setAttribute('aria-label','Vault status: '+label);this.item.setAttribute('title',label+' — click for details');}

  async refresh(){
    if(!this.alive||this.pending)return;
    this.pending=true;this.pendingSince=Date.now();const controller=new AbortController();this.controller=controller;
    const timer=setTimeout(()=>{controller.abort();if(this.alive){this.record=null;this.render();}},2500);
    let record=null;
    try {
      if(this.name){
        const stat=await fs.promises.stat(this.file);
        if(stat.size>2000000)throw new Error('Status file too large');
        const data=JSON.parse(await fs.promises.readFile(this.file,{encoding:'utf8',signal:controller.signal}));
        record=data?.vaults?.[this.name] || null;
      }
    }catch(_){/* Missing, failed or partial reads are unknown, never green. */}
    finally{clearTimeout(timer);this.pending=false;if(this.controller===controller)this.controller=null;}
    if(this.alive){this.record=record;this.render();}
  }
};
module.exports.classify=classify;
module.exports.activity=activity;

module.exports.contentViews=contentViews;
