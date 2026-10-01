"""Build regional SVGs from the bundled Geolonia map, preserving its coastlines.

Run from any directory with Python 3. No network or third-party packages needed.
Remote islands are simplified; Okinawa uses a labelled inset with its own scale.
"""
from copy import deepcopy
from pathlib import Path
import math
import re
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
REGIONS = [
    ("hokkaido-tohoku", "北海道・東北", range(1, 8)),
    ("kanto", "関東", range(8, 15)),
    ("chubu", "中部", range(15, 24)),
    ("kinki", "近畿", range(24, 31)),
    ("chugoku", "中国", range(31, 36)),
    ("shikoku", "四国", range(36, 40)),
    ("kyushu-okinawa", "九州・沖縄", range(40, 48)),
]


def points(value):
    numbers = [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", value)]
    assert len(numbers) % 2 == 0
    return list(zip(numbers[::2], numbers[1::2]))


def bounds(vertices):
    return (min(x for x, _ in vertices), min(y for _, y in vertices),
            max(x for x, _ in vertices), max(y for _, y in vertices))


def signed_area(vertices):
    return sum(x*y2-x2*y for (x, y), (x2, y2) in
               zip(vertices, vertices[1:]+vertices[:1]))/2


def inside(x, y, vertices):
    result = False
    for (x1, y1), (x2, y2) in zip(vertices, vertices[1:]+vertices[:1]):
        if (y1 > y) != (y2 > y) and x < (x2-x1)*(y-y1)/(y2-y1)+x1:
            result = not result
    return result


def prepare(original):
    group = deepcopy(original)
    offset = points(group.get("transform"))[0]
    fragments = []
    for child in group:
        tag = child.tag.rsplit("}", 1)[-1]
        if tag == "polygon":
            fragments.append((child, child.get("points"), points(child.get("points"))))
        elif tag == "path":
            data = child.get("d")
            # The source consists entirely of absolute straight-line contours.
            assert set(re.findall(r"[A-Za-z]", data)) <= {"M", "L", "Z"}
            fragments.extend((child, data, points(data)) for data in re.findall(r"M[^M]+", data))
    main = max(fragments, key=lambda f: abs(signed_area(f[2])))
    b = bounds(main[2])
    kept = []
    for f in fragments:
        box = bounds(f[2])
        distance = math.hypot(max(b[0]-box[2], box[0]-b[2], 0),
                              max(b[1]-box[3], box[1]-b[3], 0))
        if distance <= 65:
            kept.append(f)
    # Keep subpaths in the same path so lakes retain their original winding.
    for child in list(group):
        if child.tag.rsplit("}", 1)[-1] not in {"polygon", "path"}:
            continue
        parts = [f for f in kept if f[0] is child]
        if not parts:
            group.remove(child)
        elif child.tag.endswith("path"):
            child.set("d", " ".join(f[1] for f in parts))
        child.set("vector-effect", "non-scaling-stroke")
    holes = [f[2] for f in kept if f is not main and
             signed_area(f[2])*signed_area(main[2]) < 0 and
             inside(sum(x for x, _ in f[2])/len(f[2]),
                    sum(y for _, y in f[2])/len(f[2]), main[2])]
    center = ((b[0]+b[2])/2, (b[1]+b[3])/2)
    candidates = [center] + [(b[0]+(b[2]-b[0])*x/40, b[1]+(b[3]-b[1])*y/40)
                              for x in range(1, 40) for y in range(1, 40)]
    candidates = [p for p in candidates if inside(*p, main[2]) and
                  not any(inside(*p, hole) for hole in holes)]
    assert candidates, f"No mainland landing point for {group.get('data-code')}"
    anchor = min(candidates, key=lambda p: (p[0]-center[0])**2+(p[1]-center[1])**2)
    vertices = [(x+offset[0], y+offset[1]) for _, _, polygon in kept for x, y in polygon]
    return group, vertices, (anchor[0]+offset[0], anchor[1]+offset[1])


def fit(prepared, rectangle):
    vertices = [p for _, polygon, _ in prepared for p in polygon]
    x1, y1, x2, y2 = bounds(vertices)
    left, top, width, height = rectangle
    scale = min(width/(x2-x1), height/(y2-y1))
    tx = left+(width-(x2-x1)*scale)/2-x1*scale
    ty = top+(height-(y2-y1)*scale)/2-y1*scale
    wrapper = ET.Element(f"{{{NS}}}g", {"transform": f"matrix({scale:.8f} 0 0 {scale:.8f} {tx:.8f} {ty:.8f})"})
    for group, polygon, anchor in prepared:
        x, y = anchor[0]*scale+tx, anchor[1]*scale+ty
        assert 0 < x < 1000 and 0 < y < 1000
        assert all(-.01 <= px*scale+tx <= 1000.01 and
                   -.01 <= py*scale+ty <= 1000.01 for px, py in polygon)
        group.set("data-anchor-x", f"{x:.3f}")
        group.set("data-anchor-y", f"{y:.3f}")
        wrapper.append(group)
    return wrapper


def main():
    source = ET.parse(ROOT/"public/assets/japan.svg").getroot()
    groups = {int(g.get("data-code")): g for g in source.iter(f"{{{NS}}}g") if g.get("data-code")}
    assert set(groups) == set(range(1, 48))
    output = ROOT/"public/assets/regions"
    output.mkdir(parents=True, exist_ok=True)
    for slug, name, codes in REGIONS:
        svg = ET.Element(f"{{{NS}}}svg", {"class": "regional-svg-map", "viewBox": "0 0 1000 1000"})
        ET.SubElement(svg, f"{{{NS}}}title").text = f"{name}の地域地図"
        ET.SubElement(svg, f"{{{NS}}}desc").text = "Adapted from Geolonia / Wikipedia. GFDL. Some remote islands omitted."
        prepared = [prepare(groups[code]) for code in codes]
        if slug == "kyushu-okinawa":
            svg.append(fit(prepared[:-1], (65, 85, 560, 800)))
            ET.SubElement(svg, f"{{{NS}}}rect", {"x": "645", "y": "570", "width": "300", "height": "290", "rx": "24", "fill": "#f8fbff", "stroke": "#cad9ed", "stroke-width": "2", "stroke-dasharray": "7 7"})
            ET.SubElement(svg, f"{{{NS}}}text", {"x": "670", "y": "612", "font-size": "30", "fill": "#6981a4"}).text = "沖縄（別枠）"
            svg.append(fit(prepared[-1:], (670, 660, 250, 165)))
        else:
            svg.append(fit(prepared, (95, 100, 810, 785)))
        expected = set(codes)
        assert {int(g.get("data-code")) for g in svg.iter(f"{{{NS}}}g") if g.get("data-code")} == expected
        ET.indent(svg, space=" ")
        ET.ElementTree(svg).write(output/f"{slug}.svg", encoding="utf-8", xml_declaration=True)
        print(f"{name}: {len(expected)} prefectures")


if __name__ == "__main__":
    main()
