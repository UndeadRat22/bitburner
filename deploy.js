/** @param {NS} ns */
export async function main(ns) {
  const args = ns.flags([["help", false]]);
  if (args.help || args._.length < 2) {
    ns.tprint("This script runs a copy of a given script on a target server.");
    ns.tprint(
      `Usage: run ${ns.getScriptName()} [HOST] [TGT_SCRIPT] <TGT_SCRIPT_ARGS...>`
    );
    ns.tprint("Example:");
    ns.tprint(
      `> run ${ns.getScriptName()} n00dles moniez.js n00dles 65000 1.01`
    );
  }

  const target_host = args._[0];
  const script_name = args._[1];
  const script_args = args._.slice(2);

  if (!ns.serverExists(target_host)) {
    ns.tprint(`Server '${target_host}' does not exist. Aborting.`);
    return;
  }

  const relevantFiles = ns
    .ls(ns.getHostname())
    .filter((f) => f.includes(script_name));
  if (relevantFiles.length == 0) {
    ns.tprint(`Script '${script_name}' does not exist. Aborting.`);
    return;
  }

  if (relevantFiles.length > 1) {
    ns.tprint(
      `Found multiple candidates for script ${script_name}: [${relevantFiles.join(
        ", "
      )}]`
    );
    return;
  }

  const script = relevantFiles[0];
  const threads = Math.floor(
    (ns.getServerMaxRam(target_host) - ns.getServerUsedRam(target_host)) /
      ns.getScriptRam(script)
  );
  const host = ns.getHostname();
  ns.tprint(`Copying script ${script} from ${host} to ${target_host}`);
  // wth is this api - to <- from :brainfreeze:
  await ns.scp(script, target_host, host);

  ns.tprint(
    `Running script '${script}' on server '${target_host}' with ${threads} threads and the following arguments: ${script_args}`
  );
  ns.exec(script, target_host, threads, ...script_args);
}
