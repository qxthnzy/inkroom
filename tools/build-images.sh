#!/usr/bin/env bash
# Генерация адаптивных вариантов картинок: ширины 480/960/1400 + оригинал, JPG и WebP.
# Требует sips (macOS) и cwebp (brew install webp). Запуск: bash tools/build-images.sh
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=images
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

for f in "$SRC"/*.jpg; do
  base=$(basename "$f" .jpg)
  case "$base" in *-480|*-960|*-1400) continue;; esac
  ow=$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}')

  # WebP оригинального размера
  cwebp -quiet -q 78 -metadata none "$f" -o "$SRC/$base.webp"

  for w in 480 960 1400; do
    # пропускаем вариант, если он почти равен оригиналу
    if [ "$w" -ge "$(( ow * 92 / 100 ))" ]; then continue; fi
    sips -Z "$w" "$f" --out "$TMP/$base-$w.jpg" >/dev/null
    sips -s formatOptions 80 "$TMP/$base-$w.jpg" --out "$SRC/$base-$w.jpg" >/dev/null
    cwebp -quiet -q 78 -metadata none "$SRC/$base-$w.jpg" -o "$SRC/$base-$w.webp"
  done
done

# Иконки из логотипа
for s in 32 180 192 512; do
  sips -Z "$s" "$SRC/logo.png" --out "$SRC/icon-$s.png" >/dev/null
done
echo "Готово: $(ls "$SRC" | wc -l | tr -d ' ') файлов в $SRC"
