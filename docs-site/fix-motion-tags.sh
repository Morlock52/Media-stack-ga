#!/bin/bash

# Fix Motion component closing tags
echo "🔧 Fixing Motion component tags..."

find src -type f \( -name "*.tsx" -o -name "*.ts" \) | while read file; do
  if ! grep -q "Motion" "$file"; then
    continue
  fi

  echo "📝 Fixing: $file"

  # Fix motion.div, motion.p, motion.h1, etc. to just Motion
  sed -i '' 's/<Motion\.div/<Motion/g' "$file"
  sed -i '' 's/<Motion\.span/<Motion/g' "$file"
  sed -i '' 's/<Motion\.p/<Motion/g' "$file"
  sed -i '' 's/<Motion\.h1/<Motion/g' "$file"
  sed -i '' 's/<Motion\.h2/<Motion/g' "$file"
  sed -i '' 's/<Motion\.h3/<Motion/g' "$file"
  sed -i '' 's/<Motion\.button/<Motion/g' "$file"
  sed -i '' 's/<Motion\.section/<Motion/g' "$file"
  sed -i '' 's/<Motion\.article/<Motion/g' "$file"
  sed -i '' 's/<Motion\.nav/<Motion/g' "$file"
  sed-i '' 's/<Motion\.ul/<Motion/g' "$file"
  sed -i '' 's/<Motion\.li/<Motion/g' "$file"
  sed -i '' 's/<Motion\.a/<Motion/g' "$file"

  # Fix all closing tags - they should be </Motion> not </Motion.XXX>
  sed -i '' 's/<\/Motion\.[a-z]*>/<\/Motion>/g' "$file"

done

echo "✅ Tags fixed!"
