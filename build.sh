#!/usr/bin/env bash
# Сборка для публикации: сжимает JS и CSS в папку dist/ (исходные файлы не меняются).
# Нужен Node.js; esbuild скачается сам через npx. Запуск: ./build.sh
# Публиковать (на GitHub Pages и т. п.) нужно СОДЕРЖИМОЕ папки dist/, а работать и править — исходные файлы рядом.
set -euo pipefail
cd "$(dirname "$0")"
OUT=dist
rm -rf "$OUT" && mkdir -p "$OUT"
ES="npx --yes esbuild@0.25.0"
# --charset=utf8: иначе кириллица превращается в \uXXXX и файл растёт; top-level имена в режиме скрипта не переименовываются,
# поэтому data.js → recipe-bot.js → app.js по-прежнему видят общие переменные (DB, INFO и др.)
for f in data.js recipe-bot.js app.js profile-config.js profile-cloud.js profile-auth.js study-stats.js profile.js diag.js; do $ES "$f" --minify --charset=utf8 --legal-comments=none --log-level=warning --outfile="$OUT/$f"; done
for f in style.css theme-dark.css; do $ES "$f" --minify --charset=utf8 --log-level=warning --outfile="$OUT/$f"; done
cp index.html sw.js manifest.webmanifest .nojekyll "$OUT"/
cp -r icons fonts vendor "$OUT"/
echo "Готово: $OUT/"; du -sh "$OUT"
