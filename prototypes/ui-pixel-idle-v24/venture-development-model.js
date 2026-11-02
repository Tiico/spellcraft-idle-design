/* Venture review: explicit production inputs and atomic, replay-safe development commands. */
(function(root){
    const resources=Object.freeze([
        ['tin','Tin','mine',1,'#b5c8d6'],['copper','Copper','mine',2,'#d58b58'],['gold','Gold','mine',3,'#efca66'],['platinum','Platinum','mine',4,'#d8c7f6'],
        ['reedfin','Reedfin','pond',1,'#8abd83'],['mooncarp','Mooncarp','pond',2,'#83c5d5'],['glassEel','Glass eel','pond',3,'#b1a2e2'],['starKoi','Star koi','pond',4,'#edb374']
    ].map(([id,name,venture,level,color])=>Object.freeze({id,name,venture,level,color})));
    const recipes=Object.freeze([
        {id:'bronze',name:'Bronze focus',level:2,cost:{tin:6,copper:4},power:5},
        {id:'solar',name:'Solar focus',level:3,cost:{copper:6,gold:4},power:10},
        {id:'astral',name:'Astral focus',level:4,cost:{gold:6,platinum:4},power:20}
    ]);
    const find=id=>resources.find(r=>r.id===id);
    const fresh=()=>({mine:{level:1,selected:'tin'},pond:{level:1,selected:'reedfin'},stock:Object.fromEntries(resources.map(r=>[r.id,r.id==='tin'?24:r.id==='reedfin'?16:0])),refined:{bronze:0,solar:0,astral:0},sanctuary:[],receipts:[]});
    function bonuses(data){const count=data?.sanctuary.length||0;return {mine:1+count*.05,pond:count===4?1.25:1};}
    function production(data,rates){return Object.fromEntries(['mine','pond'].map(id=>[data[id].selected,(id==='mine'?rates.ore:rates.pearls)/2]));}
    function preview(data,rates,seconds){if(!Number.isFinite(seconds)||seconds<0)return null;return Object.fromEntries(Object.entries(production(data,rates)).map(([id,rate])=>[id,rate*Math.min(43200,seconds)/60]));}
    function credit(data,materials){if(!materials||Object.entries(materials).some(([id,n])=>!find(id)||!Number.isFinite(n)||n<0||!Number.isFinite(data.stock[id])||data.stock[id]<0||!Number.isFinite(data.stock[id]+n)))return false;for(const [id,n]of Object.entries(materials))data.stock[id]+=n;return true;}
    function quote(player,action,target){const d=player.ventureDevelopment;let cost={},power=0,reason=null,next=null;
        if(!d)return {ok:false,reason:'Venture unavailable'};
        if(action==='select'){const r=find(target);if(!r||r.level>d[r.venture].level)reason='Expand to unlock this resource';}
        else if(action==='upgrade'){
            const v=d[target];if(!['mine','pond'].includes(target)||!v||!Number.isInteger(v.level)||v.level<1||v.level>=4)reason='Fully expanded';
            else{const resource=resources.find(r=>r.venture===target&&r.level===v.level);next=resources.find(r=>r.venture===target&&r.level===v.level+1);cost={[target==='mine'?'ore':'pearls']:(target==='mine'?50:30)*v.level,[resource.id]:8*v.level};}
        }else if(action==='refine'){
            const r=recipes.find(r=>r.id===target);if(!r||d.mine.level<r.level)reason='Expand the mine first';
            else if(!Number.isSafeInteger(d.refined[target])||d.refined[target]<0)reason='Invalid refinement progress';
            else{cost=Object.fromEntries(Object.entries(r.cost).map(([id,n])=>[id,n*(d.refined[target]+1)]));power=r.power;}
        }else if(action==='stock'){
            const r=find(target);if(!r||r.venture!=='pond'||r.level>d.pond.level)reason='Expand the pond first';
            else if(d.sanctuary.includes(target))reason='Already sheltered';else cost={[target]:5};
        }else reason='Unknown action';
        if(!reason&&Object.values(cost).some(n=>!Number.isSafeInteger(n)||n<=0))reason='Invalid material cost';
        if(!reason&&Object.entries(cost).some(([id,n])=>{const balance=['ore','pearls'].includes(id)?player[id]:d.stock[id];return !Number.isFinite(balance)||balance<n;}))reason='Gather the required resources';
        const token=JSON.stringify([action,target,cost,power,next?.id||null]);return {ok:!reason,reason,action,target,cost,power,next:next?.id||null,token};
    }
    function commit(player,{id,action,target,token}){
        const d=player.ventureDevelopment;if(!d||typeof id!=='string'||!id||id.length>100)return {ok:false};
        const signature=JSON.stringify([action,target,token]),old=d.receipts.find(r=>r.id===id);
        if(old)return old.signature===signature?{ok:true,duplicate:true,receipt:old}:{ok:false};
        const q=quote(player,action,target);if(!q.ok||token!==q.token)return {ok:false,reason:q.reason||'Review the updated cost'};
        if(action==='refine'&&(!Number.isSafeInteger(player.damageBonus)||player.damageBonus<0||!Number.isSafeInteger(player.damageBonus+q.power)))return {ok:false};
        if(action==='upgrade'&&(!Number.isSafeInteger(player[target==='mine'?'mining':'fishing'])||player[target==='mine'?'mining':'fishing']<1||!Number.isSafeInteger(player[target==='mine'?'mining':'fishing']+1)))return {ok:false};
        for(const [key,n]of Object.entries(q.cost)){if(['ore','pearls'].includes(key))player[key]-=n;else d.stock[key]-=n;}
        if(action==='select')d[find(target).venture].selected=target;
        if(action==='upgrade'){d[target].level++;d[target].selected=q.next;player[target==='mine'?'mining':'fishing']++;}
        if(action==='refine'){d.refined[target]++;player.damageBonus+=q.power;}
        if(action==='stock')d.sanctuary.push(target);
        const receipt={id,signature,action,target,cost:q.cost,power:q.power,next:q.next};d.receipts.push(receipt);return {ok:true,duplicate:false,receipt};
    }
    root.MageVentureDevelopment=Object.freeze({resources,recipes,find,fresh,bonuses,production,preview,credit,quote,commit});
})(globalThis);
