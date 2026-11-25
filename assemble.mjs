// Puts one docs site together inside a Quartz folder: the shared theme from
// this repository, the site's own files over it, and the site's
// quartz.config.yaml. The deploy workflow (.github/workflows/build-site.yml)
// and the local preview (dev.sh) both run it, so they build the same thing.
//
// Usage: node assemble.mjs <the site's folder> <the Quartz folder>
//
// What it does, in order:
//   1. copies the site's quartz.ts into the Quartz folder;
//   2. copies theme/ from here to <Quartz>/theme, then the site's own theme/
//      (if it has one) over it: pictures that only that site shows, such as
//      the user guide's page banners or a home-page picture;
//   3. copies the result's custom.scss over Quartz's quartz/styles/custom.scss,
//      and its static/ into Quartz's quartz/static/;
//   4. writes <Quartz>/quartz.config.yaml: quartz.config.yaml from here, with
//      the `quartz` part of the site's site.json merged in. Its `configuration`
//      (the site's name and address) goes into the configuration, and
//      `plugins` maps a plugin's `source` to what changes in that plugin's
//      entry (its options, for example).
//
// Step 4 reads YAML with Quartz's own `yaml` package, so it runs after
// `npm ci` in the Quartz folder.

import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const [siteArg, quartzArg] = process.argv.slice(2)
if (!siteArg || !quartzArg) {
  console.error("Usage: node assemble.mjs <the site's folder> <the Quartz folder>")
  process.exit(2)
}
const here = dirname(fileURLToPath(import.meta.url))
const site = resolve(siteArg)
const quartz = resolve(quartzArg)

// 1. The site's texts and links.
cpSync(join(site, "quartz.ts"), join(quartz, "quartz.ts"))

// 2. The theme, then the site's own files over it.
const theme = join(quartz, "theme")
rmSync(theme, { recursive: true, force: true })
cpSync(join(here, "theme"), theme, { recursive: true })
if (existsSync(join(site, "theme"))) cpSync(join(site, "theme"), theme, { recursive: true })

// 3. The stylesheet and the static files, where Quartz looks for them.
cpSync(join(theme, "custom.scss"), join(quartz, "quartz", "styles", "custom.scss"))
cpSync(join(theme, "static"), join(quartz, "quartz", "static"), { recursive: true })

// 4. quartz.config.yaml.
const YAML = createRequire(join(quartz, "package.json"))("yaml")
const config = YAML.parse(readFileSync(join(here, "quartz.config.yaml"), "utf8"))
const own = JSON.parse(readFileSync(join(site, "site.json"), "utf8")).quartz ?? {}

const isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value)
const merge = (target, changes) => {
  for (const [key, value] of Object.entries(changes)) {
    if (isObject(value) && isObject(target[key])) merge(target[key], value)
    else target[key] = value
  }
  return target
}

merge(config.configuration, own.configuration ?? {})
for (const [source, changes] of Object.entries(own.plugins ?? {})) {
  const entry = config.plugins.find((plugin) => plugin.source === source)
  if (!entry) {
    console.error(`site.json names a plugin that quartz.config.yaml does not have: ${source}`)
    process.exit(1)
  }
  merge(entry, changes)
}

const missing = ["pageTitle", "pageTitleSuffix", "baseUrl"].filter((key) => config.configuration[key] == null)
if (missing.length > 0) {
  console.error(`site.json → quartz.configuration must set ${missing.join(", ")}.`)
  process.exit(1)
}

writeFileSync(
  join(quartz, "quartz.config.yaml"),
  "# yaml-language-server: $schema=./quartz/plugins/quartz-plugins.schema.json\n" +
    "# Written by assemble.mjs (Callout-Studio/docs-theme) from its quartz.config.yaml\n" +
    "# and the site's site.json. Change those, not this file.\n" +
    YAML.stringify(config),
)
console.log(`Assembled ${config.configuration.pageTitle} in ${quartz}.`)
