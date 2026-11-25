// Pictures in the pages load when they come near the screen, and keep their
// place while they load: each local SVG gets the width and height written in
// its own file, so the text below it does not jump.

import { readFileSync } from "node:fs"
import path from "node:path"
import type { Element, Root } from "hast"
import { visit } from "unist-util-visit"
import type { VFile } from "vfile"
import type { QuartzTransformerPluginInstance } from "../quartz/plugins/types"

function svgSize(file: string): { width: number; height: number } | undefined {
  try {
    const head = readFileSync(file, "utf8").slice(0, 2000)
    const tag = /<svg\b[^>]*>/.exec(head)?.[0] ?? ""
    const viewBox = /viewBox="\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(tag)
    if (viewBox) return { width: Math.round(Number(viewBox[1])), height: Math.round(Number(viewBox[2])) }
    const width = /\swidth="([\d.]+)"/.exec(tag)
    const height = /\sheight="([\d.]+)"/.exec(tag)
    if (width && height) return { width: Math.round(Number(width[1])), height: Math.round(Number(height[1])) }
  } catch {
    // Not readable here: the picture just loads without a reserved size.
  }
  return undefined
}

export const LazyImages = (): QuartzTransformerPluginInstance => ({
  name: "CalloutStudioLazyImages",
  htmlPlugins(ctx) {
    const contentDir = ctx.argv.directory
    return [
      () => (tree: Root, file: VFile) => {
        const slug = String(file.data.slug ?? "")
        visit(tree, "element", (node: Element) => {
          if (node.tagName !== "img") return
          const props = node.properties ?? {}
          props.loading ??= "lazy"
          props.decoding ??= "async"
          const src = typeof props.src === "string" ? props.src : ""
          if (src.endsWith(".svg") && !/^[a-z]+:/i.test(src) && props.width === undefined) {
            let decoded = src
            try {
              decoded = decodeURI(src)
            } catch {
              // Not percent-encoded: use it as written.
            }
            const size = svgSize(path.join(contentDir, path.dirname(slug), decoded))
            if (size) {
              props.width = size.width
              props.height = size.height
            }
          }
          node.properties = props
        })
      },
    ]
  },
})
