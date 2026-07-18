from __future__ import annotations

import copy
import json
import re
from pathlib import Path
from xml.etree import ElementTree as ET

REPO_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = Path(__file__).with_name("build-config.json")


def make_parser() -> ET.XMLParser:
    return ET.XMLParser(target=ET.TreeBuilder(insert_comments=True))


def load_config() -> dict:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def repo_path(relative_path: str) -> Path:
    return REPO_ROOT / relative_path


def format_comment_text(text: str | None) -> str:
    stripped = (text or "").strip()
    return f" {stripped} " if stripped else " "


def normalize_comments(node: ET.Element) -> ET.Element:
    if node.tag is ET.Comment:
        node.text = format_comment_text(node.text)
        return node
    for child in list(node):
        normalize_comments(child)
    return node


def clone(node: ET.Element) -> ET.Element:
    return normalize_comments(copy.deepcopy(node))


def load_section(config: dict, section_config: dict) -> ET.Element:
    section_path = repo_path(f"{config['sourceDir']}/{section_config['file']}")
    root = ET.parse(section_path, parser=make_parser()).getroot()
    if root.tag != section_config["root"]:
        raise ValueError(
            f"Section {section_path} must use <{section_config['root']}> as root, got <{root.tag}>"
        )
    return normalize_comments(root)


def load_rule_fragments(config: dict) -> list[tuple[int, Path, ET.Element]]:
    source_dir = repo_path(config["sourceDir"])
    pattern = config["ruleGlob"]
    order_regex = re.compile(config["ruleOrderRegex"])
    require_numeric = config.get("requireNumericOrderPrefix", False)
    fragments: list[tuple[int, Path, ET.Element]] = []
    seen_orders: dict[int, Path] = {}

    for fragment_path in source_dir.glob(pattern):
        order = 0
        if require_numeric:
            match = order_regex.fullmatch(fragment_path.name)
            if not match:
                raise ValueError(
                    f"Rule fragment {fragment_path.name} must match {config['ruleOrderRegex']}"
                )
            order = int(match.group(1))
            if order in seen_orders:
                raise ValueError(
                    f"Duplicate rule order prefix {order} in {fragment_path.name} and {seen_orders[order].name}"
                )
            seen_orders[order] = fragment_path

        fragment_root = ET.parse(fragment_path, parser=make_parser()).getroot()
        if fragment_root.tag != config["ruleRoot"]:
            raise ValueError(
                f"Rule fragment {fragment_path} must use <{config['ruleRoot']}> as root, got <{fragment_root.tag}>"
            )
        fragments.append((order, fragment_path, normalize_comments(fragment_root)))

    if not fragments:
        raise ValueError(f"No rule fragments matched {pattern} in {source_dir}")

    fragments.sort(key=lambda item: (item[0], item[1].name))
    return fragments


def validate_profile(root: ET.Element, config: dict) -> None:
    expected_root = config["profileRoot"]["name"]
    if root.tag != expected_root:
        raise ValueError(f"Root element must be <{expected_root}>, got <{root.tag}>")

    children = list(root)
    if not children:
        raise ValueError("Generated profile is empty")

    generated_comment = (config.get("generatedComment") or "").strip()
    if generated_comment:
        first_child = children[0]
        if first_child.tag is not ET.Comment:
            raise ValueError("First child inside ProxifierProfile must be the generated comment")
        if (first_child.text or "").strip() != generated_comment:
            raise ValueError("Generated comment text does not match config")

    expected_sections = [section["root"] for section in config["sections"]] + [config["ruleRoot"]]
    for section_name in expected_sections:
        matches = [child for child in children if child.tag == section_name]
        if len(matches) != 1:
            raise ValueError(f"Expected exactly one <{section_name}> section, found {len(matches)}")

    proxy_ids: set[str] = set()
    proxy_list = root.find("ProxyList")
    if proxy_list is None:
        raise ValueError("Missing ProxyList")
    for index, proxy in enumerate(proxy_list.findall("Proxy"), start=100):
        proxy_id = proxy.attrib.get("id")
        if not proxy_id:
            raise ValueError("Proxy is missing required id attribute")
        if proxy_id in proxy_ids:
            raise ValueError(f"Duplicate proxy id {proxy_id}")
        if proxy_id != str(index):
            raise ValueError(f"Proxy ids must be sequential from 100, found {proxy_id} where {index} was expected")
        proxy_ids.add(proxy_id)

    chain_ids: set[str] = set()
    chain_list = root.find("ChainList")
    if chain_list is None:
        raise ValueError("Missing ChainList")
    for index, chain in enumerate(chain_list.findall("Chain"), start=200):
        chain_id = chain.attrib.get("id")
        if not chain_id:
            raise ValueError("Chain is missing required id attribute")
        if chain_id in chain_ids:
            raise ValueError(f"Duplicate chain id {chain_id}")
        if chain_id != str(index):
            raise ValueError(f"Chain ids must be sequential from 200, found {chain_id} where {index} was expected")
        chain_ids.add(chain_id)
        for proxy_ref in chain.findall("Proxy"):
            proxy_id = (proxy_ref.text or "").strip()
            if proxy_id and proxy_id not in proxy_ids:
                raise ValueError(f"Chain {chain_id} references missing proxy id {proxy_id}")

    rule_list = root.find(config["ruleRoot"])
    if rule_list is None:
        raise ValueError("Missing RuleList")

    rules = [child for child in list(rule_list) if child.tag == "Rule"]
    if not rules:
        raise ValueError("RuleList must contain at least one <Rule>")

    for child in list(rule_list):
        if child.tag is ET.Comment:
            if not ((child.text or "").startswith(" ") and (child.text or "").endswith(" ")):
                raise ValueError("All comments must include leading and trailing spaces")
            continue
        if child.tag != "Rule":
            raise ValueError(f"RuleList may only contain comments and Rule nodes, found <{child.tag}>")

    for rule in rules:
        action = rule.find("Action")
        if action is None:
            raise ValueError("Each Rule must contain an Action")
        if action.attrib.get("type") == "Chain":
            chain_id = (action.text or "").strip()
            if chain_id not in chain_ids:
                raise ValueError(f"Rule references missing chain id {chain_id}")

    default_rules = [rule for rule in rules if (rule.findtext("Name") or "").strip() == "Default"]
    if len(default_rules) != 1:
        raise ValueError(f"Expected exactly one Default rule, found {len(default_rules)}")
    if rules[-1] is not default_rules[0]:
        raise ValueError("Default rule must be the last Rule in RuleList")
    default_action = default_rules[0].find("Action")
    if default_action is None or default_action.attrib.get("type") != "Direct":
        raise ValueError("Default rule must use a Direct action")


def build_profile(config: dict) -> ET.Element:
    profile_root = ET.Element(config["profileRoot"]["name"], config["profileRoot"]["attributes"])
    generated_comment = (config.get("generatedComment") or "").strip()
    if generated_comment:
        profile_root.append(ET.Comment(format_comment_text(generated_comment)))

    for section_config in config["sections"]:
        profile_root.append(load_section(config, section_config))

    combined_rule_list = ET.Element(config["ruleRoot"])
    for _, fragment_path, fragment_root in load_rule_fragments(config):
        if fragment_root.text and fragment_root.text.strip():
            raise ValueError(f"Unexpected text directly inside {fragment_path.name}")
        for child in list(fragment_root):
            if child.tag is not ET.Comment and child.tag != "Rule":
                raise ValueError(
                    f"Rule fragment {fragment_path.name} may only contain comments and Rule nodes, found <{child.tag}>"
                )
            combined_rule_list.append(clone(child))

    profile_root.append(combined_rule_list)
    validate_profile(profile_root, config)
    return profile_root


def write_profile(root: ET.Element, config: dict) -> Path:
    ET.indent(root, space="\t")
    xml_body = ET.tostring(root, encoding="unicode", short_empty_elements=True)
    output_path = repo_path(config["outputFile"])
    output_path.write_text(f"{config['xmlDeclaration']}\n{xml_body}\n", encoding="utf-8", newline="\n")
    reparsed_root = ET.parse(output_path, parser=make_parser()).getroot()
    validate_profile(reparsed_root, config)
    return output_path


def main() -> None:
    config = load_config()
    profile_root = build_profile(config)
    output_path = write_profile(profile_root, config)
    print(f"Generated {output_path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
