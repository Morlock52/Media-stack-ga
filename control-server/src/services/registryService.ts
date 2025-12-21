import fs from 'node:fs'
import path from 'node:path'
import { PROJECT_ROOT } from '../utils/env.js'

export interface RegistryApp {
  id: string
  name: string
  description?: string
}

const registryFilePath = () => path.join(PROJECT_ROOT, 'apps', 'registry.json')

export const loadRegistry = (): RegistryApp[] => {
  const filePath = registryFilePath()
  if (!fs.existsSync(filePath)) return []
  const raw = fs.readFileSync(filePath, 'utf-8')
  if (!raw.trim()) return []
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? (parsed as RegistryApp[]) : []
}

export const addApp = (app: RegistryApp): RegistryApp[] => {
  const registry = loadRegistry()
  if (registry.some((existing) => existing?.id === app.id)) {
    throw new Error(`App with ID ${app.id} already exists`)
  }

  const nextRegistry = [...registry, app]
  fs.writeFileSync(registryFilePath(), JSON.stringify(nextRegistry, null, 2))
  return nextRegistry
}

