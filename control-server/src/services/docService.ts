import fs from 'node:fs'
import path from 'node:path'
import { PROJECT_ROOT } from '../utils/env.js'

const docsDirPath = () => path.join(PROJECT_ROOT, 'docs-site', 'src', 'components', 'docs')

export const listDocs = (): string[] => {
  const dir = docsDirPath()
  if (!fs.existsSync(dir)) return []

  const files = fs.readdirSync(dir)
  return files
    .filter((file) => file.endsWith('.tsx'))
    .map((file) => file.replace(/\.tsx$/, ''))
}

export const createDoc = (name: string, content: string): void => {
  const dir = docsDirPath()
  if (!fs.existsSync(dir)) {
    throw new Error(`Docs directory does not exist: ${dir}`)
  }

  const filePath = path.join(dir, `${name}.tsx`)
  fs.writeFileSync(filePath, content)
}

