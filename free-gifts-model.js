/* Review-only gift policy. Trusted time, receipt identity and randomness are explicit inputs.
   Product validation/reward persistence belong to the server. No ad or purchase prerequisite. */
(function(root){
    const dayMs=86400000,definition=Object.freeze({id:'daily-chest',name:'Daily chest',ore:30,pearls:12});
    const odds=Object.freeze([6000,2500,1000,400,100]);
    const tiers=Object.freeze(root.MageRarity.tiers.map((name,i)=>Object.freeze({name,key:name.toLowerCase(),color:root.MageRarity.colors[i],odds:odds[i],ore:[30,45,60,90,150][i],pearls:[12,18,24,36,60][i],duration:[600,850,1100,1450,1800][i]})));
    const day=now=>Number.isFinite(now)&&now>=0?Math.floor(now/dayMs):null;
    const fresh=()=>({receipts:[],latestDay:null});
    function status(data,now){const current=day(now),valid=current!==null&&(data.latestDay===null||current>=data.latestDay),receipt=data.receipts.find(r=>r.day===current);return {available:valid&&!receipt,receipt:receipt||null,nextAt:current===null?null:(Math.max(current,data.latestDay??current)+1)*dayMs,valid};}
    function claim(player,{id,now,sample}){const data=player.freeGifts;if(typeof id!=='string'||!/^[-a-z0-9]{1,96}$/i.test(id)||day(now)===null)return {ok:false,reason:'Invalid gift claim'};const old=data.receipts.find(r=>r.id===id);if(old)return {ok:true,duplicate:true,receipt:old};const s=status(data,now);if(!s.available)return {ok:false,reason:s.valid?'Already collected today':'Synchronize time first'};const rarity=root.MageRarity.roll(odds,sample);if(rarity===null)return {ok:false,reason:'Invalid gift roll'};const tier=tiers[rarity],receipt=Object.freeze({id,day:day(now),gift:definition.id,rarity,ore:tier.ore,pearls:tier.pearls});player.ore+=receipt.ore;player.pearls+=receipt.pearls;data.latestDay=receipt.day;data.receipts.push(receipt);return {ok:true,duplicate:false,receipt};}
    root.MageFreeGifts=Object.freeze({definition,odds,tiers,dayMs,day,fresh,status,claim});
})(globalThis);
