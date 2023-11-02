/** @param {NS} ns */
export async function main(ns) {
  ns.tprint("auto-hacknet activated.");
  while (true) {
    checkLoop(ns);
    await ns.sleep(100);
  }
}

/** @param {NS} ns */
const checkLoop = (ns) => {
  const pricings = [];
  for (let i = 0; i < ns.hacknet.numNodes(); i++) {
    const pricing = nodeUpgradePricing(ns, i);
    ns.tprint(`pricing: ${pricing}`);
    pricings.push(pricing);
  }

  let maxGainPricing = pricings[0];
  let maxGain = maxGainPricing.values[0];
  for (pricing of pricings) {
    for (value of pricing.values) {
      if (value.gainRatio > maxGain.gainRatio) {
        maxGain = value;
        maxGainPricing = pricing;
      }
    }
  }

  ns.tprint(`should buy node ${maxGainPricing.nodeIdx}, rsrc: ${maxGain.name}`);

  const buy = shouldBuy(ns, maxGain);
  if (buy) {
    ns.tprint(`buying...`);
    maxGain.exec();
  }
};

/** @param {NS} ns */
const shouldBuy = (ns, tgt) => {
  const money = ns.getPlayer().money;
  // if player money is more than 120% of the upgrade cost, then upgrade
  return money > tgt.cost * 1.2;
};

/** @param {NS} ns */
const nodeUpgradePricing = (ns, nodeIdx) => {
  const fms = ns.formulas.hacknetNodes;
  const cs = fms.constants();
  const stats = ns.hacknet.getNodeStats(nodeIdx);

  const currentGain = fms.moneyGainRate(stats.level, stats.ram, stats.cores);
  const nextLvlGain = fms.moneyGainRate(
    stats.level + 1,
    stats.ram,
    stats.cores
  );
  const nextRamGain = fms.moneyGainRate(
    stats.level,
    stats.ram + 1,
    stats.cores
  );
  const nextCpuGain = fms.moneyGainRate(
    stats.level,
    stats.ram,
    stats.cores + 1
  );

  const pricing = {
    nodeIdx: nodeIdx,
    values: [
      {
        name: "lvl",
        current: stats.level,
        max: cs.MaxLevel,
        cost: ns.hacknet.getLevelUpgradeCost(nodeIdx, 1),
        gain: nextLvlGain - currentGain,
        exec: () => ns.hacknet.upgradeLevel(nodeIdx, 1),
      },
      {
        name: "ram",
        current: stats.ram,
        max: cs.MaxRam,
        cost: ns.hacknet.getRamUpgradeCost(nodeIdx, 1),
        gain: nextRamGain - currentGain,
        exec: () => ns.hacknet.upgradeRam(nodeIdx, 1),
      },
      {
        name: "cpu",
        current: stats.cores,
        max: cs.MaxCores,
        cost: ns.hacknet.getCoreUpgradeCost(nodeIdx, 1),
        gain: nextCpuGain - currentGain,
        exec: () => ns.hacknet.upgradeCore(nodeIdx, 1),
      },
    ],
  };

  for (val of pricing.values) {
    val.gainRatio = val.gain / val.cost;
  }

  return pricing;
};
