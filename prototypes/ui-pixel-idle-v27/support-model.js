/* Support-spell study. Values are proposals; explicit time/attack IDs, no persistent stat changes. */
(function(scope){
    const definitions={
        'Frost Ward':{kind:'shield',duration:6000,capacity:60},
        'Fire Shield':{kind:'shield',duration:6000,capacity:60,multiplier:1.25,bolts:3,boltDamage:8,procInterval:800}
    };
    const create=()=>({shield:{name:null,hp:0,until:0},reactAt:-Infinity,attacks:[]});
    const active=(effects,now)=>!!effects&&effects.shield.until>now&&effects.shield.hp>0;
    const multiplier=(effects,now)=>active(effects,now)?definitions[effects.shield.name]?.multiplier||1:1;
    function status(effects,now){
        if(!effects)return {buff:0,shield:0,shieldName:null,shieldSeconds:0};
        return {buff:multiplier(effects,now)>1?Math.max(0,Math.ceil((effects.shield.until-now)/1000)):0,shield:effects.shield.until>now?effects.shield.hp:0,shieldName:effects.shield.until>now&&effects.shield.hp>0?effects.shield.name:null,shieldSeconds:effects.shield.until>now&&effects.shield.hp>0?Math.ceil((effects.shield.until-now)/1000):0};
    }
    function cast(effects,name,now){
        const d=definitions[name];if(!d)return false;
        const isActive=active(effects,now);
        const retainFire=isActive&&effects.shield.name==='Fire Shield'&&name==='Frost Ward';
        effects.shield={name:retainFire?'Fire Shield':name,hp:Math.max(isActive?effects.shield.hp:0,d.capacity),until:Math.max(isActive?effects.shield.until:0,now+d.duration)};
        return true;
    }
    function receive(effects,{id,attackerId,damage,health,now,landed=true,source='attack',attackerAlive=true}){
        const none={duplicate:false,absorbed:0,hpDamage:0,health,bolts:[]};
        if(effects.attacks.includes(id))return {...none,duplicate:true};
        if(!Number.isFinite(damage)||damage<=0||health<=0)return none;
        effects.attacks.push(id);if(!landed)return none;
        const active=effects.shield.until>now&&effects.shield.hp>0;
        const name=effects.shield.name,absorbed=active?Math.min(damage,effects.shield.hp):0;
        effects.shield.hp=Math.max(0,effects.shield.hp-absorbed);
        const hpDamage=damage-absorbed,remaining=Math.max(0,health-hpDamage),d=definitions[name];
        let bolts=[];
        if(active&&name==='Fire Shield'&&source==='attack'&&attackerAlive&&attackerId&&remaining>0&&now>=effects.reactAt){
            effects.reactAt=now+d.procInterval;
            bolts=Array.from({length:d.bolts},(_,i)=>({id:String(id)+'-response-'+i,targetId:attackerId,damage:d.boltDamage,source:'retaliation'}));
        }
        return {duplicate:false,absorbed,hpDamage,health:remaining,bolts};
    }
    scope.MageEffects=Object.freeze({definitions,create,multiplier,status,cast,receive});
})(globalThis);
