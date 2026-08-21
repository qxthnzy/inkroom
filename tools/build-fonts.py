#!/usr/bin/env python3
"""
Собирает локальную копию Google Fonts: fonts/*.woff2 + fonts/fonts.css.

Зачем: Playfair Display 900 — это LCP-текст в hero. С внешним CSS путь до файла
шрифта складывается из трёх сетевых прыжков (googleapis → gstatic → woff2) и
двух чужих доменов в критическом пути. Локальные файлы позволяют сделать
<link rel="preload" as="font"> на конкретный woff2 и убрать эти прыжки.

Запуск: python3 tools/build-fonts.py
"""
import os
import re
import subprocess
import sys

CSS_URL = (
    "https://fonts.googleapis.com/css2"
    "?family=Inter:wght@300;400;500"
    "&family=JetBrains+Mono"
    "&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400"
    "&display=swap"
)
# На странице только кириллица и латиница — greek/vietnamese/*-ext не качаем.
KEEP_SUBSETS = ("latin", "cyrillic")
UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "fonts")


def fetch(url, binary=False):
    """curl вместо urllib: есть и в macOS, и в linux-раннерах, и не зависит от
    того, установлены ли корневые сертификаты для конкретного Python."""
    res = subprocess.run(["curl", "-sSfL", "--max-time", "30", "-A", UA, url],
                         capture_output=True)
    if res.returncode:
        sys.exit("Не скачалось: %s\n%s" % (url, res.stderr.decode("utf-8", "replace")))
    return res.stdout if binary else res.stdout.decode("utf-8")


def parse(css):
    faces = []
    for subset, block in re.findall(r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*\{.*?\})", css, re.S):
        if subset not in KEEP_SUBSETS:
            continue
        faces.append({
            "subset": subset,
            "family": re.search(r"font-family:\s*'([^']+)'", block).group(1),
            "weight": re.search(r"font-weight:\s*(\d+)", block).group(1),
            "style": re.search(r"font-style:\s*(\w+)", block).group(1),
            "url": re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1),
            "range": re.search(r"unicode-range:\s*([^;]+);", block).group(1).strip(),
        })
    return faces


def name_files(faces):
    """Inter и Playfair отдаются вариативными файлами: 300/400/500 — это один и
    тот же woff2. Раскладываем по имени файла так, чтобы такие начертания
    делили один файл, а не лежали тремя копиями."""
    groups = {}
    for f in faces:
        base = "%s%s-%s" % (f["family"].lower().replace(" ", "-"),
                            "-italic" if f["style"] == "italic" else "",
                            f["subset"])
        groups.setdefault(base, {}).setdefault(f["url"], []).append(f)

    names = {}
    for base, by_url in groups.items():
        shared = len(by_url) == 1
        for url, group in by_url.items():
            names[url] = "%s.woff2" % base if shared else "%s-%s.woff2" % (base, group[0]["weight"])
    return names


def main():
    faces = parse(fetch(CSS_URL))
    if not faces:
        sys.exit("Не удалось разобрать CSS Google Fonts — проверьте CSS_URL")
    names = name_files(faces)

    os.makedirs(OUT_DIR, exist_ok=True)
    for url, fname in names.items():
        path = os.path.join(OUT_DIR, fname)
        if not os.path.exists(path):
            with open(path, "wb") as f:
                f.write(fetch(url, binary=True))

    rules = ["/* %s %s %s · %s */\n@font-face{\n"
             "  font-family:'%s';\n  font-style:%s;\n  font-weight:%s;\n"
             "  font-display:swap;\n  src:url('%s') format('woff2');\n"
             "  unicode-range:%s;\n}\n" % (
                 f["family"], f["weight"], f["style"], f["subset"],
                 f["family"], f["style"], f["weight"], names[f["url"]], f["range"])
             for f in faces]

    with open(os.path.join(OUT_DIR, "fonts.css"), "w", encoding="utf-8") as out:
        out.write("/* Сгенерировано tools/build-fonts.py — вручную не править.\n"
                  "   Подмножества: %s. */\n\n" % ", ".join(KEEP_SUBSETS))
        out.write("\n".join(rules))

    total = sum(os.path.getsize(os.path.join(OUT_DIR, n)) for n in set(names.values()))
    print("Готово: %d файлов, %.0f КБ, %d @font-face в fonts/fonts.css"
          % (len(set(names.values())), total / 1024, len(faces)))


if __name__ == "__main__":
    main()
