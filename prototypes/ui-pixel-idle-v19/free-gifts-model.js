/* Review-only gift policy. Trusted time and receipt identity are explicit inputs.
   Product validation/reward persistence belong to the server. No ad or purchase prerequisite. */
(function(root){
    const dayMs=86400000,definition=Object.freeze({id:'daily-chest',name:'Daily chest',ore:30,pearls:12});
    const day=now=>Number.isFinite(now)&&now>=0?Math.floor(now/dayMs):null;
    const fresh=()=>({receipts:[],latestDay:null});
    function status(data,now){const current=day(now),valid=current!==null&&(data.latestDay===null||current>=data.latestDay),receipt=data.receipts.find(r=>r.day===current);return {available:valid&&!receipt,receipt:receipt||null,nextAt:current===null?null:(Math.max(current,data.latestDay??current)+1)*dayMs,valid};}
    function claim(player,{id,now}){const data=player.freeGifts;if(typeof id!=='string'||!/^[-a-z0-9]{1,96}$/i.test(id)||day(now)===null)return {ok:false,reason:'Invalid gift claim'};const old=data.receipts.find(r=>r.id===id);if(old)return {ok:true,duplicate:true,receipt:old};const s=status(data,now);if(!s.available)return {ok:false,reason:s.valid?'Already collected today':'Synchronize time first'};const receipt={id,day:day(now),gift:definition.id,ore:definition.ore,pearls:definition.pearls};player.ore+=receipt.ore;player.pearls+=receipt.pearls;data.latestDay=receipt.day;data.receipts.push(receipt);return {ok:true,duplicate:false,receipt};}
    root.MageFreeGifts=Object.freeze({definition,dayMs,day,fresh,status,claim});
})(globalThis);
