/* Pending item drops. Resources are ordinary idle income; only items require pickup.
   This local review model does not replace server-owned drops, receipts or persistence. */
(function(root){
    const fresh=()=>({pending:[],drops:[],claims:[]});
    const safe=s=>typeof s==='string'&&/^[-a-z0-9]{1,96}$/i.test(s);
    function queue(data,{id,kind,key,realm,rarity=0,source='idle'}){
        if(!safe(id)||!['spell','spirit','familiar'].includes(kind)||typeof key!=='string'||!key||key.length>80||!Number.isInteger(realm)||realm<0||realm>3||!Number.isInteger(rarity)||rarity<0||rarity>4||!['idle','absence','review'].includes(source))return {ok:false};
        const signature=JSON.stringify([kind,key,realm,rarity,source]),old=data.drops.find(r=>r.id===id);if(old)return old.signature===signature?{ok:true,duplicate:true}:{ok:false};
        const slots=data.pending.filter(i=>i.realm===realm).map(i=>i.slot),slot=[0,1,2].find(n=>!slots.includes(n))??null;
        const item={id,kind,key,realm,rarity,source,slot};data.pending.push(item);data.drops.push({id,signature});return {ok:true,duplicate:false,item};
    }
    function collect(player,id){const data=player.groundLoot,old=data.claims.find(r=>r.id===id);if(old)return {ok:true,duplicate:true,receipt:old};const item=data.pending.find(i=>i.id===id);if(!item)return {ok:false};
        let changes={},converted=false;
        if(item.kind==='spell'){
            if(!Array.isArray(player.unlocked)||!player.spellRarities)return {ok:false};
            const owned=player.unlocked.includes(item.key),best=player.spellRarities[item.key]||0;converted=owned&&best>=item.rarity;
            changes={unlocked:owned?[...player.unlocked]:[...player.unlocked,item.key],spellRarities:{...player.spellRarities,[item.key]:Math.max(best,item.rarity)}};
            if(player.realmFinds)changes.realmFinds={...player.realmFinds,pending:(player.realmFinds.pending||[]).filter(n=>n!==item.key),unseen:[...new Set([...player.realmFinds.unseen,item.key])]};
        }else if(item.kind==='spirit'){
            if(!root.MageVentureSpirits?.find(item.key)||!player.ventureSpirits)return {ok:false};
            const spirits=structuredClone(player.ventureSpirits),out=root.MageVentureSpirits.drop(spirits,{receipt:'pickup-'+id,id:'loot-'+id,kind:item.key});if(!out.ok)return {ok:false};changes.ventureSpirits=spirits;
        }else{const familiarId=Number(item.key);if(!Number.isSafeInteger(familiarId)||familiarId<2)return {ok:false};const owned=player.lootFamiliars||[];converted=owned.includes(familiarId);changes.lootFamiliars=converted?[...owned]:[...owned,familiarId];}
        const receipt={id,item:{...item},converted,ore:converted?10:0};
        Object.assign(player,changes);if(converted)player.ore+=receipt.ore;data.pending=data.pending.filter(i=>i.id!==id);data.claims.push(receipt);
        const waiting=data.pending.find(i=>i.realm===item.realm&&i.slot===null);if(waiting&&item.slot!==null)waiting.slot=item.slot;
        return {ok:true,duplicate:false,receipt};
    }
    root.MageItemLoot=Object.freeze({fresh,queue,collect});
})(globalThis);
