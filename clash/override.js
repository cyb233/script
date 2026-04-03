function main(config) {
  const LOG_LEVEL = "debug";

  function shouldLog(level) {
    const order = { debug: 10, info: 20, warn: 30, error: 40 };
    return order[level] >= order[LOG_LEVEL];
  }

  function log(level, message) {
    if (!shouldLog(level)) return;
    console.log(`[clash-override][${level}] ${message}`);
  }

  const rules = Array.isArray(config.rules) ? config.rules : [];
  const names = new Set();

  if (Array.isArray(config.proxies)) {
    for (const p of config.proxies) {
      if (p?.name) names.add(p.name);
    }
  }

  if (Array.isArray(config["proxy-groups"])) {
    for (const g of config["proxy-groups"]) {
      if (g?.name) names.add(g.name);
    }
  }

  const allNames = [...names];
  const builtinTargets = new Set(["DIRECT", "REJECT"]);

  log("debug", `start: rules=${rules.length}, candidates=${allNames.length}`);

  function findBestMatch(keywords) {
    const ks = keywords
      .map(x => String(x).trim().toLowerCase())
      .filter(Boolean);

    let bestName = null;
    let bestScore = -1;

    for (const name of allNames) {
      const raw = name.toLowerCase();
      const normalized = raw.replace(/\s+/g, "");

      let score = 0;
      let hitCount = 0;

      for (const k of ks) {
        const nk = k.replace(/\s+/g, "");
        let matched = false;

        if (raw === k || normalized === nk) {
          score += 100;
          matched = true;
        } else if (raw.includes(k)) {
          score += 10 + k.length;
          matched = true;
        } else if (normalized.includes(nk)) {
          score += 8 + nk.length;
          matched = true;
        }

        if (matched) hitCount++;
      }

      // 命中的关键词越多越优先
      score += hitCount * 20;

      if (score > bestScore) {
        bestScore = score;
        bestName = name;
      } else if (score === bestScore && bestName) {
        // 分数相同则优先更短的名字，通常更像主策略组
        if (name.length < bestName.length) {
          bestName = name;
        }
      }
    }

    return bestScore > 0 ? bestName : null;
  }

  function resolveTarget(target) {
    target = String(target).trim();

    if (builtinTargets.has(target)) {
      return target;
    }

    if (names.has(target)) {
      return target;
    }

    const fallbackMap = {
      Proxies: ["proxies", "proxy", "选择", "节点", "手动", "select", "auto"],
      TW: ["tw", "taiwan", "台湾", "台","台北", "Taibei"],
      JP: ["jp", "japan", "日本", "日", "东京", "Tokyo"],
      HK: ["hk", "hongkong", "hong kong", "香港"],
      SG: ["sg", "singapore", "新加坡"],
      US: ["us", "usa", "united states", "美国"],
    };

    if (fallbackMap[target]) {
      const matched = findBestMatch(fallbackMap[target]);
      if (matched) return matched;
    }

    return findBestMatch([target]);
  }

  let kept = 0;
  let removed = 0;
  let replaced = 0;

  config.rules = rules.map((rule, index) => {
    if (typeof rule !== "string") {
      removed++;
      log("warn", `rule[${index}] removed: not a string`);
      return null;
    }

    const parts = rule.split(",");
    if (parts.length < 3) {
      kept++;
      log("debug", `rule[${index}] kept: parts.length < 3`);
      return rule;
    }

    const originalTarget = String(parts[2]).trim();
    const resolved = resolveTarget(originalTarget);

    if (!resolved) {
      removed++;
      log("warn", `rule[${index}] removed: target "${originalTarget}" not found`);
      return null;
    }

    parts[2] = resolved;
    const newRule = parts.join(",");

    if (resolved !== originalTarget) {
      replaced++;
      log("info", `rule[${index}] replaced: "${originalTarget}" -> "${resolved}" | ${newRule}`);
    } else {
      kept++;
      log("debug", `rule[${index}] kept: "${originalTarget}"`);
    }

    return newRule;
  }).filter(Boolean);

  log("debug", `done: kept=${kept}, replaced=${replaced}, removed=${removed}, finalRules=${config.rules.length}`);

  return config;
}
