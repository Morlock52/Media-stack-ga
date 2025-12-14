#!/bin/bash

# Migration script to replace framer-motion with motion/react
# This script updates all component files

echo "🔄 Starting migration from framer-motion to motion/react..."

# Find all TypeScript/TSX files in src directory
find src -type f \( -name "*.tsx" -o -name "*.ts" \) | while read file; do
  # Skip if file doesn't contain framer-motion
  if ! grep -q "framer-motion" "$file"; then
    continue
  fi

  echo "📝 Updating: $file"

  # Replace imports
  sed -i '' "s/import { motion } from 'framer-motion'/import { Motion } from 'motion\/react'/g" "$file"
  sed -i '' "s/import { motion, AnimatePresence } from 'framer-motion'/import { Motion, AnimatePresence } from 'motion\/react'/g" "$file"
  sed -i '' "s/import { AnimatePresence, motion } from 'framer-motion'/import { AnimatePresence, Motion } from 'motion\/react'/g" "$file"

  # Replace motion components with Motion
  sed -i '' 's/<motion\./<Motion /g' "$file"
  sed -i '' 's/<\/motion\./<\/Motion/g' "$file"

  # Replace y: values with transform: translateY
  sed -i '' "s/initial={{ opacity: 0, y: \([0-9-]*\) }}/initial={{ opacity: 0, transform: 'translateY(\1px)' }}/g" "$file"
  sed -i '' "s/animate={{ opacity: 1, y: \([0-9-]*\) }}/animate={{ opacity: 1, transform: 'translateY(\1px)' }}/g" "$file"

  # Replace x: values with transform: translateX
  sed -i '' "s/initial={{ opacity: 0, x: \([0-9-]*\) }}/initial={{ opacity: 0, transform: 'translateX(\1px)' }}/g" "$file"
  sed -i '' "s/animate={{ opacity: 1, x: \([0-9-]*\) }}/animate={{ opacity: 1, transform: 'translateX(\1px)' }}/g" "$file"

  # Replace scale: values with transform: scale
  sed -i '' "s/initial={{ opacity: 0, scale: \([0-9.]*\) }}/initial={{ opacity: 0, transform: 'scale(\1)' }}/g" "$file"
  sed -i '' "s/animate={{ opacity: 1, scale: \([0-9.]*\) }}/animate={{ opacity: 1, transform: 'scale(\1)' }}/g" "$file"

done

echo "✅ Migration complete!"
echo "⚠️  Please review the changes and test thoroughly"
echo "📝 Some complex animations may need manual adjustment"
