"""Remove matching elements from JSON API responses.

Canvas builds dashboards, to-do lists, the planner, calendar and inbox from
JSON arrays. Dropping every array element whose serialized form matches a
pattern (a course id or code) erases that course from all of them without
knowing each endpoint's shape. Session-authenticated Canvas responses may
start with the `while(1);` anti-hijacking prefix, which is kept.
"""

import json
import re

PREFIX = "while(1);"


def _walk(node, pattern: re.Pattern, within: tuple = (), active: bool = True) -> tuple[object, int]:
    """Drop matching elements of lists. With `within`, only lists held under
    one of those keys drop elements (`active`); other lists are only searched."""
    if isinstance(node, list) and not active:
        out, dropped = [], 0
        for item in node:
            item, n = _walk(item, pattern, within, False)
            out.append(item)
            dropped += n
        return out, dropped
    if isinstance(node, list):
        kept, dropped = [], 0
        for item in node:
            if isinstance(item, (dict, list)) and pattern.search(json.dumps(item, ensure_ascii=False)):
                dropped += 1
                continue
            item, n = _walk(item, pattern, within, not within)
            kept.append(item)
            dropped += n
        return kept, dropped
    if isinstance(node, dict):
        dropped = 0
        for k, v in node.items():
            node[k], n = _walk(v, pattern, within, not within or k in within)
            dropped += n
        return node, dropped
    return node, 0


def drop(text: str, pattern: re.Pattern, within: tuple = ()) -> tuple[str, int]:
    """Return (new_text, number_of_elements_dropped)."""
    prefix = PREFIX if text.startswith(PREFIX) else ""
    try:
        data = json.loads(text[len(prefix):])
    except ValueError:
        return text, 0
    data, n = _walk(data, pattern, within, not within)
    if not n:
        return text, 0
    return prefix + json.dumps(data, ensure_ascii=False, separators=(",", ":")), n
