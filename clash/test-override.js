const fs = require("fs");
const path = require("path");
const vm = require("vm");

function printUsage() {
  console.log("Usage:");
  console.log("  node clash/test-override.js <input-config> [output-config]");
  console.log("");
  console.log("Examples:");
  console.log("  node clash/test-override.js clash/config.json");
  console.log("  node clash/test-override.js clash/config.json clash/output.json");
}

function resolvePath(inputPath) {
  return path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath);
}

function loadOverrideMain(overridePath) {
  const code = fs.readFileSync(overridePath, "utf8");
  const sandbox = {
    console,
    result: null,
  };

  vm.createContext(sandbox);
  vm.runInContext(`${code}\nresult = main;`, sandbox, { filename: overridePath });

  if (typeof sandbox.result !== "function") {
    throw new Error(`main function not found in ${overridePath}`);
  }

  return sandbox.result;
}

function main() {
  const [, , inputArg, outputArg] = process.argv;

  if (!inputArg) {
    printUsage();
    process.exit(1);
  }

  const scriptDir = __dirname;
  const overridePath = path.join(scriptDir, "override.js");
  const inputPath = resolvePath(inputArg);
  const outputPath = outputArg ? resolvePath(outputArg) : null;

  console.log(`[test-override] override: ${overridePath}`);
  console.log(`[test-override] input: ${inputPath}`);
  if (outputPath) {
    console.log(`[test-override] output: ${outputPath}`);
  } else {
    console.log("[test-override] output: stdout");
  }

  const config = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const overrideMain = loadOverrideMain(overridePath);
  const result = overrideMain(config);
  const json = JSON.stringify(result, null, 2);

  if (outputPath) {
    fs.writeFileSync(outputPath, json);
    console.log(`[test-override] written: ${outputPath}`);
    return;
  }

  console.log(json);
}

main();
