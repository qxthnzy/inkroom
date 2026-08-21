#!/usr/bin/env bash
# Генерация адаптивных вариантов картинок: ширины 480/960/1400 + оригинал, JPG и WebP,
# плюс иконки PWA (включая отдельную maskable с safe zone).
#
# Движок выбирается по тому, что установлено:
#   ImageMagick (magick/convert) — работает везде, один вызов на вариант;
#   sips — фолбэк для macOS без ImageMagick.
# WebP жмёт cwebp, если он есть, иначе тот же ImageMagick.
#
# Запуск:  bash tools/build-images.sh
#          FORCE=1 bash tools/build-images.sh   — пересобрать всё
#          JOBS=4  bash tools/build-images.sh   — ограничить параллелизм
set -euo pipefail

# абсолютный путь к себе: основной проход делает cd, а дочерние процессы
# запускаются уже после него
SELF=$(cd "$(dirname "$0")" && pwd)/$(basename "$0")

SRC=images
WIDTHS="480 960 1400"
ICONS="32 180 192 512"
MASKABLE_BG='#0b0b0c'

# ---------- движок ----------
if command -v magick >/dev/null 2>&1; then
  IM="magick"; IDENTIFY="magick identify"
elif command -v convert >/dev/null 2>&1; then
  IM="convert"; IDENTIFY="identify"
elif command -v sips >/dev/null 2>&1; then
  IM="sips"; IDENTIFY="sips"
else
  echo "Нужен ImageMagick (brew install imagemagick / apt install imagemagick) или sips" >&2
  exit 1
fi
HAVE_CWEBP=0
command -v cwebp >/dev/null 2>&1 && HAVE_CWEBP=1

width_of() {
  if [ "$IM" = "sips" ]; then
    sips -g pixelWidth "$1" | awk '/pixelWidth/{print $2}'
  else
    $IDENTIFY -format '%w' "$1[0]"
  fi
}

# файл считается свежим, если он новее исходника (FORCE=1 отключает проверку)
fresh() { [ -z "${FORCE:-}" ] && [ -f "$2" ] && [ "$2" -nt "$1" ]; }

make_jpeg() { # src dst width
  fresh "$1" "$2" && return 0
  if [ "$IM" = "sips" ]; then
    # -Z и качество за один вызов: раньше было два прохода и двойное сжатие
    sips -Z "$3" -s format jpeg -s formatOptions 80 "$1" --out "$2" >/dev/null
  else
    $IM "$1" -auto-orient -resize "${3}x${3}>" -strip -quality 80 "$2"
  fi
}

make_webp() { # src dst
  fresh "$1" "$2" && return 0
  if [ "$HAVE_CWEBP" = 1 ]; then
    cwebp -quiet -q 78 -metadata none "$1" -o "$2"
  else
    $IM "$1" -strip -quality 78 -define webp:method=6 "$2"
  fi
}

make_icon() { # src dst size
  fresh "$1" "$2" && return 0
  if [ "$IM" = "sips" ]; then
    sips -Z "$3" "$1" --out "$2" >/dev/null
  else
    $IM "$1" -resize "${3}x${3}" -strip "$2"
  fi
}

make_maskable() { # src dst size
  fresh "$1" "$2" && return 0
  local inner=$(( $3 * 8 / 10 ))   # safe zone 10% с каждой стороны, иначе Android срежет углы
  if [ "$IM" = "sips" ]; then
    local dir; dir=$(mktemp -d)
    sips -Z "$inner" "$1" --out "$dir/icon.png" >/dev/null
    sips --padToHeightWidth "$3" "$3" --padColor "${MASKABLE_BG#\#}" "$dir/icon.png" --out "$2" >/dev/null 2>&1
    rm -rf "$dir"
  else
    $IM "$1" -resize "${inner}x${inner}" -background "$MASKABLE_BG" -gravity center \
       -extent "${3}x${3}" -alpha remove -strip "$2"
  fi
}

# ---------- обработка одной картинки (сюда же приходят дочерние процессы) ----------
if [ "${1:-}" = "--one" ]; then
  cd "$(dirname "$SELF")/.."
  f=$2; base=$3; ow=$4
  make_webp "$f" "$SRC/$base.webp"
  for w in $WIDTHS; do
    # пропускаем вариант, если он почти равен оригиналу
    [ "$w" -ge "$(( ow * 92 / 100 ))" ] && continue
    make_jpeg "$f" "$SRC/$base-$w.jpg" "$w"
    make_webp "$SRC/$base-$w.jpg" "$SRC/$base-$w.webp"
  done
  exit 0
fi

# ---------- основной проход ----------
cd "$(dirname "$SELF")/.."

cpu_count() {
  if command -v nproc >/dev/null 2>&1; then nproc
  elif command -v sysctl >/dev/null 2>&1; then sysctl -n hw.ncpu
  else echo 4
  fi
}
JOBS=${JOBS:-$(cpu_count)}
echo "Движок: $IM · cwebp: $HAVE_CWEBP · параллельно: $JOBS"

# Пачками по $JOBS фоновых процессов: без внешних зависимостей и одинаково
# ведёт себя с bash 3.2 (macOS) и bash 5.
running=0
for f in "$SRC"/*.jpg; do
  base=$(basename "$f" .jpg)
  case "$base" in *-480|*-960|*-1400) continue;; esac
  bash "$SELF" --one "$f" "$base" "$(width_of "$f")" &
  running=$(( running + 1 ))
  if [ "$running" -ge "$JOBS" ]; then wait; running=0; fi
done
wait

# ---------- иконки ----------
for s in $ICONS; do make_icon "$SRC/logo.png" "$SRC/icon-$s.png" "$s"; done
make_maskable "$SRC/logo.png" "$SRC/icon-maskable-512.png" 512

echo "Готово: $(ls "$SRC" | wc -l | tr -d ' ') файлов в $SRC"
