import defu from 'defu'
import { importModule } from './module'
import { readFile, writeFile, exists, join, writeJson, ensureDir } from './fs'

function removePrivateKeys (source, target = null) {
  if (target === null) {
    target = {}
  }
  for (const prop in source) {
    if (prop === '__proto__' || prop === 'constructor') {
      continue
    }
    const value = source[prop]
    if ((!prop.startsWith('$')) && prop !== 'source') {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        target[prop] = {}
        removePrivateKeys(value, target[prop])
        continue
      }
      target[prop] = value
    }
  }
  return target
}

export async function loadConfig (rootId, config = {}) {
  // Detect standalone mode
  if (typeof config === 'string') {
    config = { $standalone: config }
  }

  const jsConfigPath = join(this.options.rootDir, `nuxt.${rootId}.js`)
  // JavaScript config has precedence over JSON config
  if (exists(jsConfigPath)) {
    config = defu(await importModule(jsConfigPath), config)
  } else if (exists(`${jsConfigPath}on`)) {
    config = defu(await importModule(`${jsConfigPath}on`), config)
  }
  this.options[rootId] = defu(config, this.options[rootId] || {})
  this[`$${rootId}`] = this.options[rootId]
  this[`$${rootId}`].$buildDir = this.options.buildDir
  return this[`$${rootId}`]
}

export async function updateConfig (rootId, obj) {
  // Copy object and remove props that start with $
  // (These can be used for internal template pre-processing)
  obj = removePrivateKeys(obj)

  // If .js config found, do nothing
  // we only update JSON files, not JavaScript
  if (exists(join(this.options.rootDir, `nuxt.${rootId}.js`))) {
    const config = await importModule(join(this.options.rootDir, `nuxt.${rootId}.js`))
    await ensureDir(join(this.options.buildDir, 'press'))
    await writeFile(join(this.options.buildDir, 'press', 'config.json'), JSON.stringify(config, null, 2))
    return
  }

  const path = join(this.options.rootDir, `nuxt.${rootId}.json`)
  if (!exists(path)) {
    await writeJson(path, obj, { spaces: 2 })
    return
  }
  const jsonFile = await readFile(path)
  let json = {}
  try {
    json = JSON.parse(jsonFile)
  } catch (_) {}
  const updated = defu(json, obj)
  await writeFile(path, JSON.stringify(updated, null, 2))
  await ensureDir(join(this.options.buildDir, 'press'))
  await writeFile(
    join(this.options.buildDir, 'press', 'config.json'),
    JSON.stringify(updated, null, 2)
  )
}
