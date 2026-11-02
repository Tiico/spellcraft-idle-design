/* Pending item drops. Resources are ordinary idle income; only items require pickup.
   This local review model does not replace server-owned drops, receipts or persistence. */
(function(root){
    const fresh=()=>({pending:[],drops:[],claims:[],batches:[]});
    const safe=s=>typeof s==='string'&&/^[-a-z0-9]{1,96}$/i.test(s);
    function queue(data,{id,kind,key,realm,rarity=0,source='idle',count=1}){
        if(!safe(id)||!['spell','spirit','familiar','relic','consumable'].includes(kind)||typeof key!=='string'||!key||key.length>80||!Number.isInteger(realm)||realm<0||realm>3||!Number.isInteger(rarity)||rarity<0||rarity>4||!['idle','absence','review','active','boss'].includes(source))return {ok:false};
        if(!Number.isSafeInteger(count)||count<1||count>1000000||!['relic','consumable'].includes(kind)&&count!==1)return {ok:false};
        if(['relic','consumable'].includes(kind)){const d=root.MageRelics?.find(key);if(!d||(kind==='relic')!==(d.kind==='chest'))return {ok:false};}
        const signature=JSON.stringify([kind,key,realm,rarity,source,count]),old=data.drops.find(r=>r.id===id);if(old)return old.signature===signature?{ok:true,duplicate:true}:{ok:false};
        const slots=data.pending.filter(i=>i.realm===realm).map(i=>i.slot),slot=[0,1,2].find(n=>!slots.includes(n))??null;
        const item={id,kind,key,realm,rarity,source,slot,count};data.pending.push(item);data.drops.push({id,signature});return {ok:true,duplicate:false,item};
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
        }else if(item.kind==='relic'||item.kind==='consumable'){
            if(!player.inventory)return {ok:false};const inventory=structuredClone(player.inventory),out=root.MageRelics.grant(inventory,{id:'pickup-'+id,key:item.key,count:item.count});if(!out.ok)return {ok:false};changes.inventory=inventory;
        }else{const familiarId=Number(item.key);if(!Number.isSafeInteger(familiarId)||familiarId<2)return {ok:false};const owned=player.lootFamiliars||[];converted=owned.includes(familiarId);changes.lootFamiliars=converted?[...owned]:[...owned,familiarId];}
        const receipt={id,item:{...item},converted,ore:converted?10:0};
        Object.assign(player,changes);if(converted)player.ore+=receipt.ore;data.pending=data.pending.filter(i=>i.id!==id);data.claims.push(receipt);
        const waiting=data.pending.find(i=>i.realm===item.realm&&i.slot===null);if(waiting&&item.slot!==null)waiting.slot=item.slot;
        return {ok:true,duplicate:false,receipt};
    }
    function collectMany(player,{id,ids}){const data=player.groundLoot;if(!safe(id)||!Array.isArray(ids)||!ids.length||ids.length>100000||new Set(ids).size!==ids.length||!ids.every(safe))return {ok:false};const signature=JSON.stringify(ids),old=(data.batches||[]).find(r=>r.id===id);if(old)return old.signature===signature?{ok:true,duplicate:true,receipt:old}:{ok:false};if(!ids.every(id=>data.pending.some(i=>i.id===id)))return {ok:false};const trial=structuredClone(player),receipts=[];for(const id of ids){const out=collect(trial,id);if(!out.ok||out.duplicate)return {ok:false};receipts.push(out.receipt);}const receipt={id,signature,count:ids.length,items:receipts.map(r=>r.item),converted:receipts.filter(r=>r.converted).length,ore:receipts.reduce((a,r)=>a+r.ore,0)};trial.groundLoot.batches??=[];trial.groundLoot.batches.push(receipt);Object.assign(player,trial);return {ok:true,duplicate:false,receipt};}
    root.MageItemLoot=Object.freeze({fresh,queue,collect,collectMany});
})(globalThis);
