/** @param {NS} ns */
export async function main(ns) {
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
    return;
  }

  const starting_host = ns.getHostname();
  const log = NewLogger(ns, { host: starting_host });
  const params = {
    host: starting_host,
    visited: { home: true },
    script: args._[0],
    sargs: args._.slice(1),
  };

  log.log(`will deploy ${params.script} with ${JSON.stringify(params.sargs)}`);

  proccessConnections(ns, log, params);
}

const proccessConnections = (ns, l, params) => {
  const { host, visited, script, sargs } = params;
  const connections = ns.scan(host);
  for (const con of connections) {
    const log = l.with_fields({ host: host, con: con });
    if (visited[con]) {
      continue;
    }

    visited[con] = true;

    log.log(`processing connection`);

    log.log(`attempting to aquire root...`);
    const is_root = aquireRoot(ns, log, con);
    if (!is_root) {
      continue;
    }

    log.log(`attempting to deploy script...`);
    deployScript(ns, log, host, con, script, sargs);
    log.log(`done`);

    const nextParams = { ...params, host: con };
    proccessConnections(ns, l, nextParams);
  }
};

const deployScript = (ns, log, host, con, script, sargs) => {
  killExisting(ns, log, con, script);

  log.log(`copying script ${script} from ${host} to ${con}`);
  ns.scp(script, con, host);

  const req_ram = ns.getScriptRam(script, host);

  const max_ram = ns.getServerMaxRam(con);
  const used_ram = ns.getServerUsedRam(con);
  const avl_ram = max_ram - used_ram;
  log.log(`current memory availability: ${avl_ram}/${max_ram}`);
  if (req_ram > avl_ram) {
    log.log(`unable to run script: memory too low: ${avl_ram}/${req_ram}`);
    return false;
  }

  const dyn_args = sargs?.map((arg) => (arg === "<HOST>" ? con : arg)) ?? [];
  log.log(`launching '${script}' on server '${con}' with args: ${dyn_args}`);
  const pid = ns.exec(script, con, 1, ...dyn_args);
  if (pid == 0) {
    log.log(`failed to run script.`);
    return false;
  }

  log.log(`running with pid ${pid}`);

  return true;
};

/** @param {NS} ns */
const killExisting = (ns, log, host, script) => {
  const ps = ns.ps(host);
  for (let proc of ps) {
    if (proc.filename.includes(script)) {
      log.log(
        `script '${script}' already running pid: ${proc.pid}, killing...`
      );
      ns.kill(proc.pid, host);
      log.log(`done`);
    }
  }
};

const aquireRoot = (ns, log, con) => {
  if (ns.hasRootAccess(con)) {
    log.log(`already rooted`);
    return true;
  }

  const got_lvl = ns.getPlayer().skills.hacking;
  const req_lvl = ns.getServerRequiredHackingLevel(con);
  if (req_lvl > got_lvl) {
    log.log(`unable to hack: level too low ${got_lvl}/${req_lvl}`);
    return false;
  }

  const openers = getPortOpeners(ns);
  const req_ports = ns.getServerNumPortsRequired(con);
  if (req_ports > openers.length) {
    log.log(
      `unable to hack: can't open enough ports: ${openers.length}/${req_ports}`
    );
    return false;
  }

  log.log(`openning ports...`);
  openers.forEach((fn) => fn(con));
  log.log(`nuking...`);
  ns.nuke(con);
  log.log(`done`);

  return true;
};

const filesWithFns = (ns) => {
  return [
    { file: "BruteSSH.exe", fn: ns.brutessh },
    { file: "FTPCrack.exe", fn: ns.ftpcrack },
  ];
};

const getPortOpeners = (ns) => {
  const fns = [];
  for (const { file, fn } of filesWithFns(ns)) {
    if (ns.ls("home", file).length > 0) {
      fns.push(fn);
    }
  }

  return fns;
};

const NewLogger = (ns, fields) => {
  const logger = { ns, fields };
  logger.log = (msg) => {
    logger.ns.tprint(`${JSON.stringify(logger.fields)}: ${msg}`);
  };
  logger.with_fields = (fields) => {
    const mergedFields = { ...logger.fields, ...fields };
    return NewLogger(logger.ns, mergedFields);
  };

  return logger;
};
