/* Local mock entitlements. No payment, currency or combat input; the first version has no ads (PRD 1.23 §11.2). */
(function(root){
    const products=Object.freeze([
        {id:'starfall',name:'Starfall aura',type:'Cosmetic',price:'€2.99',description:'A constellation circles your mage.',art:'crowned'},
        {id:'embers',name:'Ember trail',type:'Cosmetic',price:'€1.99',description:'Leave a trail of dancing embers.',art:'fire'}
    ].map(Object.freeze));
    const fresh=()=>({owned:[],equipped:null,receipts:[]});
    function purchase(data,id,receipt){if(!products.some(p=>p.id===id)||typeof receipt!=='string'||!receipt)return false;const old=data.receipts.find(r=>r.receipt===receipt);if(old&&old.id!==id)return false;if(!data.owned.includes(id))data.owned.push(id);if(!old)data.receipts.push({receipt,id});return true;}
    function equip(data,id){if(id!==null&&(!['starfall','embers'].includes(id)||!data.owned.includes(id)))return false;data.equipped=id;return true;}
    function restore(data,receipts){if(!Array.isArray(receipts)||receipts.some(r=>!products.some(p=>p.id===r.id)||typeof r.receipt!=='string'||!r.receipt))return false;const copy=structuredClone(data);for(const r of receipts)if(!purchase(copy,r.id,r.receipt))return false;Object.assign(data,copy);return true;}
    root.MageShop=Object.freeze({products,fresh,purchase,equip,restore});
})(globalThis);
