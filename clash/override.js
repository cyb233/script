const FALLBACK_MAP = {
  Proxies: ["proxies", "proxy", "选择", "节点", "手动", "select", "auto"],
  TW: ["tw", "taiwan", "台湾", "台", "台北", "taipei", "taibei"],
  JP: ["jp", "japan", "日本", "日", "东京", "tokyo"],
  HK: ["hk", "hongkong", "hong kong", "香港"],
  KR: ["kr", "korea", "korean", "south korea", "韩国", "韩", "首尔", "汉城", "seoul"],
  SG: ["sg", "singapore", "新加坡"],
  US: ["us", "usa", "united states", "america", "美国", "美"],
  OTHER: ["other", "others", "其他"],
};

const REGION_KEYS = ["TW", "JP", "HK", "KR", "SG", "US"];
const REGION_GROUP_NAME_MAP = {
  TW: "TW",
  JP: "JP",
  HK: "HK",
  KR: "KR",
  SG: "SG",
  US: "US",
  OTHER: "其他",
};

function main(config) {
  const LOG_LEVEL = "debug";
  const builtinTargets = new Set(["DIRECT", "REJECT"]);

  function shouldLog(level) {
    const order = { debug: 10, info: 20, warn: 30, error: 40 };
    return order[level] >= order[LOG_LEVEL];
  }

  function log(level, message) {
    if (!shouldLog(level)) return;
    console.log(`[clash-override][${level}] ${message}`);
  }

  const proxies = Array.isArray(config.proxies) ? config.proxies : [];
  const proxyGroups = Array.isArray(config["proxy-groups"]) ? config["proxy-groups"] : [];
  const rules = Array.isArray(config.rules) ? config.rules : [];

  const proxyNameSet = new Set();
  const proxyGroupNameSet = new Set();
  const names = new Set();

  for (const proxy of proxies) {
    if (!proxy?.name) continue;
    proxyNameSet.add(proxy.name);
    names.add(proxy.name);
  }

  for (const group of proxyGroups) {
    if (!group?.name) continue;
    proxyGroupNameSet.add(group.name);
    names.add(group.name);
  }

  log(
    "debug",
    `start: proxies=${proxies.length}, groups=${proxyGroups.length}, rules=${rules.length}, candidates=${names.size}`
  );

  function normalize(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
  }

  function findBestMatch(keywords, candidateNames) {
    const ks = keywords.map(normalize).filter(Boolean);
    const candidates = Array.isArray(candidateNames) ? candidateNames : [...names];

    let bestName = null;
    let bestScore = -1;

    for (const name of candidates) {
      const raw = String(name || "").trim().toLowerCase();
      const normalized = raw.replace(/\s+/g, "");

      let score = 0;
      let hitCount = 0;

      for (const keyword of ks) {
        let matched = false;

        if (raw === keyword || normalized === keyword) {
          score += 100;
          matched = true;
        } else if (raw.includes(keyword)) {
          score += 10 + keyword.length;
          matched = true;
        } else if (normalized.includes(keyword)) {
          score += 8 + keyword.length;
          matched = true;
        }

        if (matched) hitCount++;
      }

      // 命中的关键词越多越优先。
      score += hitCount * 20;

      if (score > bestScore) {
        bestScore = score;
        bestName = name;
      } else if (score === bestScore && bestName && name.length < bestName.length) {
        // 分数一致时优先更短的名称，通常更接近主策略组。
        bestName = name;
      }
    }

    return bestScore > 0 ? bestName : null;
  }

  function detectRegionKey(name) {
    for (const regionKey of REGION_KEYS) {
      const keywords = FALLBACK_MAP[regionKey] || [];
      const matched = findBestMatch(keywords, [name]);
      if (matched) return regionKey;
    }

    return null;
  }

  const regionGroupNameMap = {};
  let existingOtherGroup = null;

  for (const group of proxyGroups) {
    if (!group?.name) continue;

    const regionKey = detectRegionKey(group.name);
    if (!regionKey || regionGroupNameMap[regionKey]) continue;

    regionGroupNameMap[regionKey] = group.name;
    log("info", `detected existing region group: ${regionKey} -> "${group.name}"`);
  }

  for (const group of proxyGroups) {
    if (!group?.name) continue;

    const matchedOtherGroup = findBestMatch(FALLBACK_MAP.OTHER, [group.name]);
    if (!matchedOtherGroup) continue;

    existingOtherGroup = group;
    log("info", `detected existing fallback region group -> "${group.name}"`);
    break;
  }

  const regionProxyMap = {};
  const unmatchedProxyNames = [];

  for (const proxy of proxies) {
    if (!proxy?.name) continue;

    const regionKey = detectRegionKey(proxy.name);
    if (!regionKey) {
      unmatchedProxyNames.push(proxy.name);
      log("warn", `proxy "${proxy.name}" did not match any region, queued for "其他"`);
      continue;
    }

    if (!regionProxyMap[regionKey]) regionProxyMap[regionKey] = [];
    regionProxyMap[regionKey].push(proxy.name);
    log("debug", `proxy "${proxy.name}" matched region ${regionKey}`);
  }

  const generatedRegionGroupNames = [];

  for (const regionKey of REGION_KEYS) {
    const matchedProxyNames = regionProxyMap[regionKey] || [];
    if (matchedProxyNames.length === 0) continue;

    if (regionGroupNameMap[regionKey]) {
      log(
        "debug",
        `skip generating region group for ${regionKey}: existing group "${regionGroupNameMap[regionKey]}"`
      );
      continue;
    }

    const groupName = REGION_GROUP_NAME_MAP[regionKey] || regionKey;
    const uniqueProxyNames = [...new Set(matchedProxyNames)];

    proxyGroups.push({
      name: groupName,
      type: "select",
      proxies: uniqueProxyNames,
    });

    regionGroupNameMap[regionKey] = groupName;
    generatedRegionGroupNames.push(groupName);
    proxyGroupNameSet.add(groupName);
    names.add(groupName);

    log(
      "info",
      `generated region group "${groupName}" for ${regionKey}, proxies=${uniqueProxyNames.length}`
    );
  }

  if (unmatchedProxyNames.length > 0 && !existingOtherGroup) {
    const otherGroupName = REGION_GROUP_NAME_MAP.OTHER;
    const uniqueProxyNames = [...new Set(unmatchedProxyNames)];

    proxyGroups.push({
      name: otherGroupName,
      type: "select",
      proxies: uniqueProxyNames,
    });

    generatedRegionGroupNames.push(otherGroupName);
    proxyGroupNameSet.add(otherGroupName);
    names.add(otherGroupName);

    log(
      "info",
      `generated fallback region group "${otherGroupName}", proxies=${uniqueProxyNames.length}`
    );
  } else if (unmatchedProxyNames.length > 0 && existingOtherGroup) {
    const existingEntries = Array.isArray(existingOtherGroup.proxies) ? existingOtherGroup.proxies : [];
    existingOtherGroup.proxies = [...new Set([...existingEntries, ...unmatchedProxyNames])];

    log(
      "info",
      `appended unmatched proxies into existing fallback group "${existingOtherGroup.name}", total=${existingOtherGroup.proxies.length}`
    );
  }

  const generatedGroupNameSet = new Set(generatedRegionGroupNames);

  for (const group of proxyGroups) {
    if (!group?.name || group.type !== "select" || !Array.isArray(group.proxies)) continue;

    const isRegionLikeGroup = Boolean(detectRegionKey(group.name)) || findBestMatch(FALLBACK_MAP.OTHER, [group.name]);
    if (isRegionLikeGroup) {
      log("debug", `skip injecting generated region groups into region group "${group.name}"`);
      continue;
    }

    const existingEntries = [...group.proxies];
    const groupEntries = [];
    const builtinEntries = [];
    const nodeEntries = [];
    const seen = new Set();

    for (const entry of existingEntries) {
      if (seen.has(entry)) continue;
      seen.add(entry);

      if (proxyGroupNameSet.has(entry) && !generatedGroupNameSet.has(entry)) {
        groupEntries.push(entry);
        continue;
      }

      if (builtinTargets.has(entry)) {
        builtinEntries.push(entry);
        continue;
      }

      nodeEntries.push(entry);
    }

    const insertedGeneratedEntries = generatedRegionGroupNames.filter(name => !seen.has(name));
    group.proxies = [...groupEntries, ...insertedGeneratedEntries, ...builtinEntries, ...nodeEntries];

    if (insertedGeneratedEntries.length > 0) {
      log(
        "info",
        `injected generated region groups into "${group.name}": ${insertedGeneratedEntries.join(", ")}`
      );
    } else {
      log("debug", `no generated region groups inserted into "${group.name}"`);
    }
  }

  const allNames = [...names];
  const allGroupNames = [...proxyGroupNameSet];
  const allProxyNames = [...proxyNameSet];

  function resolveTarget(target) {
    const originalTarget = String(target || "").trim();

    if (builtinTargets.has(originalTarget)) {
      return originalTarget;
    }

    if (proxyGroupNameSet.has(originalTarget)) {
      return originalTarget;
    }

    if (proxyNameSet.has(originalTarget)) {
      return originalTarget;
    }

    if (FALLBACK_MAP[originalTarget]) {
      const matchedGroup = findBestMatch(FALLBACK_MAP[originalTarget], allGroupNames);
      if (matchedGroup) {
        log("debug", `target "${originalTarget}" matched group by fallback map -> "${matchedGroup}"`);
        return matchedGroup;
      }

      const matchedProxy = findBestMatch(FALLBACK_MAP[originalTarget], allProxyNames);
      if (matchedProxy) {
        log("debug", `target "${originalTarget}" matched proxy by fallback map -> "${matchedProxy}"`);
        return matchedProxy;
      }
    }

    const matchedGroup = findBestMatch([originalTarget], allGroupNames);
    if (matchedGroup) {
      log("debug", `target "${originalTarget}" matched group by name -> "${matchedGroup}"`);
      return matchedGroup;
    }

    const matchedProxy = findBestMatch([originalTarget], allProxyNames);
    if (matchedProxy) {
      log("debug", `target "${originalTarget}" matched proxy by name -> "${matchedProxy}"`);
      return matchedProxy;
    }

    const matchedAny = findBestMatch([originalTarget], allNames);
    if (matchedAny) {
      log("debug", `target "${originalTarget}" matched fallback candidate -> "${matchedAny}"`);
    }

    return matchedAny;
  }

  let kept = 0;
  let removed = 0;
  let replaced = 0;

  config.rules = rules
    .map((rule, index) => {
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

      const target = String(parts[2]).trim();
      const resolved = resolveTarget(target);

      if (!resolved) {
        removed++;
        log("warn", `rule[${index}] removed: target "${target}" not found`);
        return null;
      }

      parts[2] = resolved;
      const nextRule = parts.join(",");

      if (resolved !== target) {
        replaced++;
        log("info", `rule[${index}] replaced: "${target}" -> "${resolved}" | ${nextRule}`);
      } else {
        kept++;
        log("debug", `rule[${index}] kept: "${target}"`);
      }

      return nextRule;
    })
    .filter(Boolean);

  config["proxy-groups"] = proxyGroups;

  log(
    "debug",
    `done: generatedGroups=${generatedRegionGroupNames.length}, kept=${kept}, replaced=${replaced}, removed=${removed}, finalRules=${config.rules.length}`
  );

  return config;
}
