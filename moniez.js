/** @param {NS} ns */
export async function main(ns) {
  const args = parseArgs(ns);
  if (!args.valid) {
    return;
  }

  ns.print(`running ${ns.getScriptName()} with args:`);
  ns.print(args);

  await hackLoop(ns, args.host, getTargetMoney(ns, args.host), 10);
}

/** @param {NS} ns */
// returns 80% of max money, totally not optimal, but good enough
const getTargetMoney = (ns, host) => {
  const max = ns.getServerMaxMoney(host);
  return max * 0.8;
};

/** @param {NS} ns */
const parseArgs = (ns) => {
  const args = ns.flags([["help", false]]);
  if (args.help || args._.len < 3) {
    ns.tprint("This script runs grow/weaken/hack loop on a target server.");
    ns.tprint(`Usage: run ${ns.getScriptName()} [HOST]`);
    ns.tprint("Example:");
    ns.tprint(`> run ${ns.getScriptName()} n00dles`);
    return { valid: false };
  }

  return {
    valid: true,
    host: args._[0],
  };
};

/** @param {NS} ns */
const hackLoop = async (ns, host, desiredMoney, desiredSec) => {
  while (true) {
    // ensure there's money to be made
    await growMoney(ns, host, desiredMoney);

    // ensure security is reasonable
    await reduceSecurity(ns, host, desiredSec);

    // get money
    const moneyEarned = await ns.hack(host);
    ns.print(`earned ${moneyEarned} money from host ${host}`);
  }
};

/** @param {NS} ns */
const growMoney = async (ns, host, desiredMoney) => {
  ns.print(`growing host ${host}`);
  let availableMoney = ns.getServerMoneyAvailable(host);
  ns.print(
    `available money on host ${host}: ${availableMoney} target: ${desiredMoney}`
  );
  while (availableMoney < desiredMoney) {
    ns.print(
      `available money on host ${host}: ${availableMoney} target: ${desiredMoney}`
    );
    await ns.grow(host);
    availableMoney = ns.getServerMoneyAvailable(host);
  }
};

/** @param {NS} ns */
const reduceSecurity = async (ns, host, desiredSecurity) => {
  ns.print(`reducing security on host ${host}`);
  let securityLevel = ns.getServerSecurityLevel(host);
  ns.print(
    `security level on host ${host}: ${securityLevel} target: ${desiredSecurity}`
  );
  while (securityLevel > desiredSecurity) {
    ns.print(
      `security level on host ${host}: ${securityLevel} target: ${desiredSecurity}`
    );

    await ns.weaken(host);
    securityLevel = ns.getServerSecurityLevel(host);
  }
};
