// the goal of this script is to recursively infect all of the available servers with a given script
/** @param {NS} ns */

var g_ns;
var script_name;
var script_args;

export async function main(ns) {
  processed = {};
  g_ns = ns;

  const args = ns.flags([["help", false]]);
  if (args.help || args._.length == 0) {
    ns.tprint(
      "This script runs a given script throught the whole network, rooting hosts in the process."
    );
    ns.tprint(
      "If the first argument is given as <HOST> then this script will inject host param as first arg"
    );
    ns.tprint(
      `Usage: run ${ns.getScriptName()} [TGT_SCRIPT] <TGT_SCRIPT_ARGS...>`
    );
    ns.tprint("Example:");
    ns.tprint(`> run ${ns.getScriptName()} moniez.js "(con) => {con}"`);
  }

  script_name = args._[0];
  script_args = args._.slice(1);

  const host = ns.getHostname();
  await processConRec(ns, host);
}

const r_print = (msg, dpth) => g_ns.tprint(`> ${"\t".repeat(dpth)} ${msg}`);
const processed = {};

/** @param {NS} ns */
const processConRec = async (ns, host, depth = 0) => {
  //ensure we don't process the same node twice, as the node graph has loops.
  if (processed[host]) {
    r_print(`already processed ${host}, returning`, depth);
    return;
  }
  processed[host] = true;

  const connections = ns
    .scan(host)
    .filter((con) => con !== "home")
    .map((con) => Connection(ns, con));
  // map[host] = connections

  r_print(`found ${connections.length} connections for host '${host}'`, depth);

  for (const con of connections) {
    r_print(`processing connection '${con.name}'`, depth);
    const canGainRoot = con.canGainRootAccess();
    r_print(`can gain root on '${con.name}?: ${canGainRoot}'`, depth);
    if (canGainRoot) {
      r_print(`attempting to gain access on '${con.name}'`, depth);
      con.root();
    }

    const hasRoot = con.hasRoot();
    r_print(`has root on '${con.name}'?: ${hasRoot}`, depth);
    if (hasRoot) {
      r_print(`attempting to infect ${con.name}`, depth);
      await con.infect(script_name, script_args, depth);
    }

    await ns.sleep(2000);

    r_print(`recursively processing '${con.name}' connections...`, depth);
    await processConRec(ns, con.name, depth + 1);

    r_print(`process connection '${con.name}' finished`, depth);
  }
};

/** @param {NS} ns */
const getPortOpenFns = (ns) => [ns.brutessh];

const allCons = {};
/** @param {NS} ns */
const Connection = (ns, con) => {
  // caching mechanism, we want to update the connection from any connection
  if (allCons[con]) {
    return allCons[con];
  }

  const hc = {
    name: con,
    lvl: ns.getServerRequiredHackingLevel(con),
    ports: ns.getServerNumPortsRequired(con),
    __portOpenFns: getPortOpenFns(ns),
    hasRoot: () => ns.hasRootAccess(con),
    canGainRootAccess: () =>
      hc.lvl <= ns.getHackingLevel() && hc.ports <= hc.__portOpenFns.length,
    root: () => {
      if (!hc.canGainRootAccess()) {
        return;
      }

      //open all possible ports
      hc.__portOpenFns.forEach((f) => f(con));
      ns.nuke(con);
      // ns.connect(con);
      // ns.installBackdoor();
    },
    infect: async (script, args, depth) => {
      await deploy(ns, con, script, args, depth);
    },
    getAvailableMoney: () => ns.getServerMoneyAvailable(con),
  };

  // store in cache
  allCons[con] = hc;

  return hc;
};

/** @param {NS} ns */
const deploy = async (ns, host, script_name, script_args, depth) => {
  const relevantFiles = ns
    .ls(ns.getHostname())
    .filter((f) => f.includes(script_name));
  if (relevantFiles.length == 0) {
    return;
  }

  if (relevantFiles.length > 1) {
    return;
  }

  const script = relevantFiles[0];

  killExisting(ns, host, script_name, depth);

  const r_args =
    script_args?.map((arg) => (arg === "<HOST>" ? host : arg)) ?? [];
  r_print(
    `Launching script '${script}' on server '${host}' and the following arguments: ${r_args}`,
    depth
  );
  await ns.scp(script, ns.getHostname(), host);
  const pid = ns.exec(script, host, 1, ...r_args);
  r_print(
    pid === 0
      ? `Failed to spawn '${script}' on ${host}`
      : `Spawned '${script}' on ${host}`,
    depth
  );
};

/** @param {NS} ns */
const killExisting = (ns, host, script_name, depth) => {
  const ps = ns.ps(host);
  for (let proc of ps) {
    if (proc.filename.includes(script_name)) {
      r_print(
        `Cleaning up existing script on host '${host}', pid: ${proc.pid}`,
        depth
      );
      ns.kill(proc.pid, host);
    }
  }
};
