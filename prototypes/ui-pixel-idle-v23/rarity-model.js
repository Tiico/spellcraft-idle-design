/* Canonical review model. Illustrative odds/costs; explicit random input, no production authority.
   The game preview copy is generated with scripts/sync-rarity-model.mjs. */
(function(scope){
    const tiers=['Common','Uncommon','Rare','Epic','Legendary'];
    const colors=['#b4becb','#9ccda2','#87baf2','#c5a1ef','#f2cb76'];
    const rank=value=>Number.isInteger(value)&&value>=0&&value<tiers.length?value:0;
    const damageScale=[1,1.1,1.25,1.5,2];
    function quote(recipe,rarities={},id='preview'){
        const inputs=recipe.inputs.map(name=>({name,rarity:rank(rarities[name])}));
        const values=inputs.map(i=>i.rarity),low=Math.min(...values),high=Math.max(...values),center=Math.floor((low+high)/2),odds=tiers.map(()=>0);
        for(const [offset,weight] of [[0,6000],[1,3500],[2,500]])odds[Math.min(4,center+offset)]+=weight;
        return {id,policy:'rarity-study-1',recipeId:recipe.id,result:recipe.result,level:recipe.level,inputs,odds,cost:{fire:10+high*10,ore:high*5}};
    }
    const fingerprint=q=>JSON.stringify([q.policy,q.recipeId,q.result,q.level,q.inputs,q.odds,q.cost]);
    function roll(odds,sample){
        if(!Number.isFinite(sample)||sample<0||sample>=1||odds.length!==5||odds.some(n=>!Number.isInteger(n)||n<0)||odds.reduce((a,b)=>a+b,0)!==10000)return null;
        const ticket=Math.floor(sample*10000);let total=0;
        for(let i=0;i<odds.length;i++){total+=odds[i];if(ticket<total)return i;}return null;
    }
    function attempt(player,recipe,shown,{requestId,sample}){
        const previous=(player.fusionReceipts||[]).find(r=>r.requestId===requestId||r.quoteId===shown?.id);
        if(previous)return {ok:true,duplicate:true,receipt:previous};
        if(!requestId||!shown?.id||!recipe||recipe.inputs.length!==2||recipe.inputs[0]===recipe.inputs[1]||!recipe.inputs.every(n=>player.unlocked.includes(n)))return {ok:false,reason:'Unlock both ingredients first'};
        const expected=quote(recipe,player.spellRarities||{},shown.id);
        if(fingerprint(expected)!==fingerprint(shown))return {ok:false,reason:'Review the updated odds'};
        if(player.forgeLevel<recipe.level)return {ok:false,reason:'Requires forge '+recipe.level};
        const rarity=roll(shown.odds,sample);if(rarity===null)return {ok:false,reason:'Invalid attempt'};
        if(player.shards[0]<shown.cost.fire||player.ore<shown.cost.ore)return {ok:false,reason:'Not enough resources'};
        const owned=player.unlocked.includes(recipe.result),before=owned?rank(player.spellRarities?.[recipe.result]):-1;
        const keptBest=before>=rarity,receipt={requestId,quoteId:shown.id,result:recipe.result,rarity,best:Math.max(before,rarity),keptBest,cost:{...shown.cost}};
        player.shards[0]-=shown.cost.fire;player.ore-=shown.cost.ore;
        if(!owned)player.unlocked.push(recipe.result);
        player.spellRarities={...player.spellRarities,[recipe.result]:receipt.best};
        player.fusionReceipts=[...(player.fusionReceipts||[]),receipt];
        return {ok:true,duplicate:false,receipt};
    }
    scope.MageRarity=Object.freeze({tiers,colors,damageScale,rank,quote,fingerprint,roll,attempt});
})(globalThis);
