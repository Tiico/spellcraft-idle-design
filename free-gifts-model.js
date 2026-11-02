/* Review-only gift policy. Trusted time, receipt identity, randomness, frontier and charge cap are explicit inputs.
   Product validation/reward persistence belong to the server. No ad or purchase prerequisite.
   PO 2026-11-02: one charge per whole UTC hour, base cap 3 (ventures may raise it later), odds/durations/multipliers locked.
   Base amounts and the frontier growth (MageFrontier.scale) are proposals. */
(function(root){
    const hourMs=3600000,baseCap=3,maxCap=100,definition=Object.freeze({id:'free-chest',name:'Free chest'}),base=Object.freeze({ore:10,pearls:4});
    const odds=Object.freeze([6000,2500,1000,400,100]);
    const tiers=Object.freeze(root.MageRarity.tiers.map((name,i)=>Object.freeze({name,key:name.toLowerCase(),color:root.MageRarity.colors[i],odds:odds[i],multiplier:[1,1.5,2,3,5][i],duration:[600,850,1100,1450,1800][i]})));
    const hour=now=>Number.isFinite(now)&&now>=0?Math.floor(now/hourMs):null;
    const validCap=cap=>Number.isInteger(cap)&&cap>=1&&cap<=maxCap;
    const fresh=()=>({receipts:[],charges:null,hour:null});
    function reward(rarity,frontier){const t=tiers[rarity],scale=root.MageFrontier.scale(frontier);return Number.isInteger(rarity)&&t&&scale!==null?Object.freeze({ore:Math.round(base.ore*t.multiplier*scale),pearls:Math.round(base.pearls*t.multiplier*scale)}):null;}
    const preview=frontier=>tiers.map((t,rarity)=>({rarity,...reward(rarity,frontier)}));
    // A new account starts full; afterwards each whole UTC hour adds one charge until the cap. Time before the last settled hour is invalid.
    function settle(data,current,cap){if(current===null||!validCap(cap))return null;if(data.hour===null)return {charges:cap,hour:current};if(current<data.hour)return null;return {charges:Math.min(cap,data.charges+current-data.hour),hour:current};}
    function status(data,now,{cap=baseCap}={}){const current=hour(now),s=settle(data,current,cap),charges=s?s.charges:0;return {valid:!!s,charges,cap:validCap(cap)?cap:null,available:!!s&&charges>0,nextAt:s&&charges<cap?(current+1)*hourMs:null,receipt:data.receipts.at(-1)||null};}
    function claim(player,{id,now,sample,frontier,cap=baseCap}){const data=player.freeGifts,target=root.MageFrontier.frontier(frontier);if(typeof id!=='string'||!/^[-a-z0-9]{1,96}$/i.test(id)||hour(now)===null||!target||!validCap(cap))return {ok:false,reason:'Invalid gift claim'};const old=data.receipts.find(r=>r.id===id);if(old)return {ok:true,duplicate:true,receipt:old};const s=settle(data,hour(now),cap);if(!s)return {ok:false,reason:'Synchronize time first'};if(s.charges<1)return {ok:false,reason:'No free chest charge yet'};const rarity=root.MageRarity.roll(odds,sample);if(rarity===null)return {ok:false,reason:'Invalid gift roll'};const amount=reward(rarity,target),receipt=Object.freeze({id,hour:s.hour,gift:definition.id,rarity,frontier:target,ore:amount.ore,pearls:amount.pearls});player.ore+=receipt.ore;player.pearls+=receipt.pearls;data.charges=s.charges-1;data.hour=s.hour;data.receipts.push(receipt);return {ok:true,duplicate:false,receipt};}
    root.MageFreeGifts=Object.freeze({definition,base,odds,tiers,hourMs,baseCap,maxCap,hour,fresh,reward,preview,status,claim});
})(globalThis);
