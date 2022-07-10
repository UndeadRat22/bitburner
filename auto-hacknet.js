const keepCashPercent = 20;

/** @param {NS} ns */
export async function main(ns) {
  ns.tprint("auto-hacknet activated.");
  while (true) {
    await ns.sleep(5000);
    checkLoop(ns);
  }
}

/** @param {NS} ns */
const checkLoop = (ns) => {
  const nodeCount = ns.hacknet.numNodes();
  const maxNodeCount = ns.hacknet.maxNumNodes();

  let minPricings =
    nodeCount < maxNodeCount
      ? [
          {
            name: "add node",
            value: ns.hacknet.getPurchaseNodeCost(),
            exec: () => ns.hacknet.purchaseNode(),
          },
        ]
      : [];

  for (let i = 0; i < nodeCount; i++) {
    minPricings = [...minPricings, ...nodeUpgradePricing(ns, i).values];
  }

  //buy untill cheapest available is too expensive
  const sorted = minPricings
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.value - b.value);

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    if (shouldBuy(ns, p)) {
      ns.print(`executing '${p.name}' buy action, cost: ${p.value}\$`);
      p.exec();
    } else {
      ns.print(
        `stopping at '${p.name}' op, at the cost of ${p.value}\$, total evaled pricings: ${minPricings.length}`
      );
      break;
    }
  }
};

/** @param {NS} ns */
const shouldBuy = (ns, min) => {
  const money = ns.getPlayer().money;
  // if player money is more than 120% of the upgrade cost, then upgrade
  return money > min.value + min.value * 0.2;
};

/** @param {NS} ns */
const nodeUpgradePricing = (ns, nodeIdx) => {
  const pricing = {
    nodeIdx: nodeIdx,
    values: [
      {
        name: "lvl",
        value: ns.hacknet.getLevelUpgradeCost(nodeIdx, 1),
        exec: () => ns.hacknet.upgradeLevel(nodeIdx, 1),
      },
      {
        name: "ram",
        value: ns.hacknet.getRamUpgradeCost(nodeIdx, 1),
        exec: () => ns.hacknet.upgradeRam(nodeIdx, 1),
      },
      {
        name: "cpu",
        value: ns.hacknet.getCoreUpgradeCost(nodeIdx, 1),
        exec: () => ns.hacknet.upgradeCore(nodeIdx, 1),
      },
    ],
  };

  return pricing;
};
