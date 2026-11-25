// Quartz puts a "#" link inside every heading with role="anchor", which is not
// an ARIA role, and an empty aria-hidden, which assistive technology reads as
// "false". The link is only a mouse convenience (it is out of the tab order),
// so it is hidden from assistive technology properly instead.
//
// Quartz shows a page preview when the pointer rests on any "internal" link.
// For this link that preview would be the page the reader is already on, so the
// class is dropped and no preview opens.

import type { Element, Root } from "hast"
import { visit } from "unist-util-visit"
import type { QuartzTransformerPluginInstance } from "../quartz/plugins/types"

export const HeadingAnchors = (): QuartzTransformerPluginInstance => ({
  name: "CalloutStudioHeadingAnchors",
  htmlPlugins() {
    return [
      () => (tree: Root) => {
        visit(tree, "element", (node: Element) => {
          if (node.tagName !== "a" || node.properties?.role !== "anchor") return
          delete node.properties.role
          node.properties.ariaHidden = "true"
          const classes = node.properties.className
          if (Array.isArray(classes)) node.properties.className = classes.filter((c) => c !== "internal")
        })
      },
    ]
  },
})
