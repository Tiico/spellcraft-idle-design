/* Canonical progression-frontier input for reward scaling (#19 free chest, reused by #36 dungeons).
   Callers pass the server-trusted frontier explicitly: {tier>=1, realm 0..3 = Fire/Ice/Earth/Wind}.
   step equals MageRealms.journey.pairIndex and journey.unlocked. The 1.5x-per-tier growth is a proposal. */
(function(root){
    const realmCount=4,maxTier=10000,perTier=1.5;
    function frontier(input){const tier=input?.tier,realm=input?.realm;if(!Number.isSafeInteger(tier)||tier<1||tier>maxTier||!Number.isInteger(realm)||realm<0||realm>=realmCount)return null;return Object.freeze({tier,realm,step:(tier-1)*realmCount+realm});}
    const fromStep=step=>Number.isSafeInteger(step)&&step>=0?frontier({tier:Math.floor(step/realmCount)+1,realm:step%realmCount}):null;
    function scale(input,growth=perTier){const f=frontier(input);return f&&Number.isFinite(growth)&&growth>=1?growth**(f.step/realmCount):null;}
    root.MageFrontier=Object.freeze({realmCount,maxTier,perTier,frontier,fromStep,scale});
})(globalThis);
