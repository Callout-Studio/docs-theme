// Makes the graph in the right-hand column load from the site itself.
//
// Quartz's graph plugin loads d3 and pixi.js from cdn.jsdelivr.net every time a
// page opens, so each visitor would contact a third party (and receive code of
// a version nobody pinned). This site promises the opposite: its fonts are its
// own, there is no analytics. So, at build time, this script
//
//   1. downloads the two libraries from the npm registry, at the exact
//      versions below, the way the build already downloads Quartz and its
//      plugins,
//   2. puts the files into Quartz's static folder (served as static/vendor/),
//      with their licenses,
//   3. points the plugin at them, and stops the build if the plugin still
//      mentions the CDN afterwards (an update of the plugin that changes its
//      code must not quietly bring the CDN back).
//
// Usage: node prepare-graph.mjs <the Quartz folder>

import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const LIBRARIES = [
  { pkg: "d3", version: "7.9.2", file: "dist/d3.min.js", as: "d3.min.js", cdn: "https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js" },
  { pkg: "pixi.js", version: "8.23.0", file: "dist/pixi.min.js", as: "pixi.min.js", cdn: "https://cdn.jsdelivr.net/npm/pixi.js@8/dist/pixi.js" },
]

const quartz = resolve(process.argv[2] ?? "")
if (!process.argv[2]) {
  console.error("Usage: node prepare-graph.mjs <the Quartz folder>")
  process.exit(1)
}

const vendor = join(quartz, "quartz", "static", "vendor")
mkdirSync(vendor, { recursive: true })

// A copy already there at the right version is kept (a local preview restarts
// often; a fresh build, as in the deploy workflow, always downloads).
const stamp = (lib) => join(vendor, `${lib.as}.version`)
const present = (lib) => existsSync(join(vendor, lib.as)) && existsSync(stamp(lib)) && readFileSync(stamp(lib), "utf8") === lib.version

const work = mkdtempSync(join(tmpdir(), "graph-libraries-"))
try {
  for (const lib of LIBRARIES.filter((lib) => !present(lib))) {
    const folder = join(work, lib.pkg)
    mkdirSync(folder)
    const tarball = execFileSync("npm", ["pack", `${lib.pkg}@${lib.version}`, "--silent"], { cwd: folder, encoding: "utf8" }).trim().split("\n").pop()
    execFileSync("tar", ["-xzf", join(folder, tarball), "-C", folder])
    copyFileSync(join(folder, "package", lib.file), join(vendor, lib.as))
    copyFileSync(join(folder, "package", "LICENSE"), join(vendor, `${lib.as.replace(/\.min\.js$/, "")}.LICENSE`))
    writeFileSync(stamp(lib), lib.version)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}

// The plugin builds its script from these files; Quartz gives the script the
// address of its static folder as window.quartzStaticUrl (with a trailing
// slash), which is right under any base path.
const plugin = join(quartz, "node_modules", "@quartz-community", "graph", "dist")
const files = []
const walk = (folder) => {
  for (const name of readdirSync(folder)) {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) walk(path)
    else if (name.endsWith(".js")) files.push(path)
  }
}
walk(plugin)

let patched = 0
for (const path of files) {
  let text = readFileSync(path, "utf8")
  let changed = false
  for (const lib of LIBRARIES) {
    const quoted = `"${lib.cdn}"`
    if (text.includes(quoted)) {
      text = text.split(quoted).join(`window.quartzStaticUrl+"vendor/${lib.as}"`)
      changed = true
    }
  }
  if (changed) {
    writeFileSync(path, text)
    patched += 1
  }
}

const leftovers = files.filter((path) => readFileSync(path, "utf8").includes("cdn.jsdelivr.net"))
if (leftovers.length > 0) {
  console.error(`The graph plugin still loads from a CDN (${leftovers.join(", ")}); update prepare-graph.mjs.`)
  process.exit(1)
}
console.log(`Graph libraries are served from static/vendor/ (${patched} plugin file${patched === 1 ? "" : "s"} patched).`)
