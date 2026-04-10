/**
 * Clash/Mihomo override script.
 *
 * 功能概览：
 * 1. 在处理规则前，先根据节点名称与已有策略组自动识别地区。
 * 2. 若缺少对应地区策略组，则自动生成地区组，并将未识别节点归入“其他”。
 * 3. 将新生成的地区组插入到非地区类 select 策略组中的“已有组”和“节点”之间。
 * 4. 处理 rules 时优先匹配策略组，其次匹配单个节点，并保留 DIRECT / REJECT 等内置目标。
 * 5. 对 select 策略组做基础安全整理，例如避免组内包含自身名称。
 *
 * GitHub:
 * https://github.com/cyb233/script/blob/main/clash/override.js
 */
const FALLBACK_MAP = {
  Proxies: ["proxies", "proxy", "选择", "节点", "手动", "select", "auto"],
  // 排序约定：
  // [emoji, 国家2字母缩写, 中文国家全称, 英文国家全称, 自身语言国家全称(如有), 地区1中文, 地区1英文, 地区1自身语言(如有), 地区1缩写(如有), ...]
  // 额外别名会尽量贴近对应国家或地区项放置，方便后续维护与扩展。
  CN: [
    "🇨🇳", "cn",
    "中国", "china", "zhongguo",
    "北京", "beijing",
    "上海", "shanghai",
    "广州", "guangzhou",
    "深圳", "shenzhen",
    "大陆", "prc",
  ],
  TW: [
    "🇹🇼", "tw",
    "台湾", "taiwan", "taiwanese",
    "台北", "taipei", "taibei",
    "台",
  ],
  JP: [
    "🇯🇵", "jp",
    "日本", "japan", "にほん", "にっぽん", "nihon", "nippon",
    "东京", "tokyo",
    "日",
  ],
  HK: [
    "🇭🇰", "hk",
    "香港", "hong kong", "hongkong", "heungkong", "xianggang",
  ],
  KR: [
    "🇰🇷", "kr",
    "韩国", "south korea", "대한민국", "한국", "korea", "korean", "hanguk",
    "首尔", "seoul",
    "汉城",
    "韩",
  ],
  SG: [
    "🇸🇬", "sg",
    "新加坡", "singapore", "singapura",
  ],
  US: [
    "🇺🇸", "us",
    "美国", "united states", "united states of america", "america", "usa",
    "美",
  ],
  UK: [
    "🇬🇧", "uk",
    "英国", "united kingdom", "great britain", "britain", "england", "british",
    "伦敦", "london",
    "英",
  ],
  DE: [
    "🇩🇪", "de",
    "德国", "germany", "deutschland", "deutsch",
    "法兰克福", "frankfurt",
    "柏林", "berlin",
    "德",
  ],
  FR: [
    "🇫🇷", "fr",
    "法国", "france", "francais", "français",
    "巴黎", "paris",
    "法",
  ],
  CA: [
    "🇨🇦", "ca",
    "加拿大", "canada", "canadian",
    "多伦多", "toronto",
    "温哥华", "vancouver",
    "加",
  ],
  AU: [
    "🇦🇺", "au",
    "澳大利亚", "australia", "australian", "aussie",
    "悉尼", "sydney",
    "墨尔本", "melbourne",
    "澳洲",
    "澳",
  ],
  NL: [
    "🇳🇱", "nl",
    "荷兰", "netherlands", "nederland", "nederlands", "holland",
    "阿姆斯特丹", "amsterdam",
  ],
  IN: [
    "🇮🇳", "in",
    "印度", "india", "bharat",
    "孟买", "mumbai",
    "新德里", "new delhi",
  ],
  TR: [
    "🇹🇷", "tr",
    "土耳其", "turkey", "turkiye", "türkiye",
    "伊斯坦布尔", "istanbul",
  ],
  RU: [
    "🇷🇺", "ru",
    "俄罗斯", "russia", "россия",
    "莫斯科", "moscow",
  ],
  OTHER: ["other", "others", "其他"],
};

const REGION_KEYS = ["CN", "TW", "JP", "HK", "KR", "SG", "US", "UK", "DE", "FR", "CA", "AU", "NL", "IN", "TR", "RU"];
const REGION_GROUP_NAME_MAP = {
  CN: "CN",
  TW: "TW",
  JP: "JP",
  HK: "HK",
  KR: "KR",
  SG: "SG",
  US: "US",
  UK: "UK",
  DE: "DE",
  FR: "FR",
  CA: "CA",
  AU: "AU",
  NL: "NL",
  IN: "IN",
  TR: "TR",
  RU: "RU",
  OTHER: "其他",
};

function isRegionalIndicatorSymbolPair(value) {
  return /^(?:\uD83C[\uDDE6-\uDDFF]){2}$/u.test(String(value || "").trim());
}

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
  const originalGroupFirstEntryMap = {};

  const proxyNameSet = new Set();
  const proxyGroupNameSet = new Set();
  const names = new Set();

  // 收集所有节点名和策略组名，后续规则修复与模糊匹配都会复用这份索引。
  for (const proxy of proxies) {
    if (!proxy?.name) continue;
    proxyNameSet.add(proxy.name);
    names.add(proxy.name);
  }

  for (const group of proxyGroups) {
    if (!group?.name) continue;
    proxyGroupNameSet.add(group.name);
    names.add(group.name);
    if (Array.isArray(group.proxies) && group.proxies.length > 0) {
      originalGroupFirstEntryMap[group.name] = group.proxies[0];
    }
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
        const regionalIndicatorBonus = isRegionalIndicatorSymbolPair(keyword) ? 60 : 0;

        // 国旗 Regional Indicator Symbol 命中时额外加权，
        // 使其在同类国家词条中拥有更高优先级。
        if (raw === keyword || normalized === keyword) {
          score += 100 + regionalIndicatorBonus;
          matched = true;
        } else if (raw.includes(keyword)) {
          score += 10 + keyword.length + regionalIndicatorBonus;
          matched = true;
        } else if (normalized.includes(keyword)) {
          score += 8 + keyword.length + regionalIndicatorBonus;
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
    // 使用统一的地区关键词表识别节点或策略组归属地区。
    for (const regionKey of REGION_KEYS) {
      const keywords = FALLBACK_MAP[regionKey] || [];
      const matched = findBestMatch(keywords, [name]);
      if (matched) return regionKey;
    }

    return null;
  }

  const regionGroupNameMap = {};
  let existingOtherGroup = null;

  // 先识别配置里已经存在的地区策略组，避免重复创建。
  for (const group of proxyGroups) {
    if (!group?.name) continue;

    const regionKey = detectRegionKey(group.name);
    if (!regionKey || regionGroupNameMap[regionKey]) continue;

    regionGroupNameMap[regionKey] = group.name;
    log("info", `detected existing region group: ${regionKey} -> "${group.name}"`);
  }

  // 单独识别“其他”兜底组，便于把未识别节点统一归档进去。
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

  // 根据节点名称自动识别地区，并暂存到各地区分组候选列表中。
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

  // 仅为“已有节点、但缺少地区组”的地区自动创建 select 组。
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

  // 将新生成的地区组插入到非地区类 select 组中，
  // 排序保持为：已有组 -> 新地区组 -> 内置目标/节点。
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

    const insertedGeneratedEntries = generatedRegionGroupNames.filter(
      name => !seen.has(name) && name !== group.name
    );
    group.proxies = [...groupEntries, ...insertedGeneratedEntries, ...builtinEntries, ...nodeEntries];

    if (group.proxies.includes(group.name)) {
      group.proxies = group.proxies.filter(entry => entry !== group.name);
      log("warn", `removed self reference from group "${group.name}"`);
    }

    if (insertedGeneratedEntries.length > 0) {
      log(
        "info",
        `injected generated region groups into "${group.name}": ${insertedGeneratedEntries.join(", ")}`
      );
    } else {
      log("debug", `no generated region groups inserted into "${group.name}"`);
    }
  }

  for (const group of proxyGroups) {
    if (!group?.name || group.type !== "select" || !Array.isArray(group.proxies)) continue;

    let expectedDefaultPolicy = null;
    const originalFirstEntry = originalGroupFirstEntryMap[group.name];

    // 默认策略只以原始首项是否为内置目标为准，不再依赖组名猜测。
    if (builtinTargets.has(originalFirstEntry)) {
      expectedDefaultPolicy = originalFirstEntry;
      log(
        "debug",
        `group "${group.name}" uses original first builtin target "${expectedDefaultPolicy}" as default policy`
      );
    }

    if (!expectedDefaultPolicy) continue;

    const existingEntries = [...new Set(group.proxies)];
    const reorderedEntries = existingEntries.filter(entry => entry !== expectedDefaultPolicy);

    if (!builtinTargets.has(expectedDefaultPolicy)) {
      log("warn", `skip default policy reorder for "${group.name}": "${expectedDefaultPolicy}" is not builtin`);
      continue;
    }

    group.proxies = [expectedDefaultPolicy, ...reorderedEntries];

    if (group.proxies.includes(group.name)) {
      group.proxies = group.proxies.filter(entry => entry !== group.name);
      log("warn", `removed self reference from group "${group.name}" after default policy reorder`);
    }

    log("info", `ensured default policy "${expectedDefaultPolicy}" is first in group "${group.name}"`);
  }

  const allNames = [...names];
  const allGroupNames = [...proxyGroupNameSet];
  const allProxyNames = [...proxyNameSet];

  function resolveTarget(target) {
    const originalTarget = String(target || "").trim();

    // 规则目标解析顺序：
    // 1. 内置目标
    // 2. 已存在的策略组
    // 3. 已存在的单节点
    // 4. fallbackMap 模糊匹配，且优先命中策略组
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

  // 逐条修正规则中的目标对象，无法解析的规则直接移除并记录日志。
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
