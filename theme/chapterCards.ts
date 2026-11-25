// The home page's chapter tables become the groups of the chapter list, and
// (on the user guide's site) cards.
//
// In a docs folder's README (which GitHub shows too) each group is a heading
// followed by a table whose columns are "Chapter" (or "File") and "What it
// covers". The group's name is the heading's text, up to a " - ": "Subsystems
// - reference, as needed" is listed as "Subsystems". The groups, with the pages
// in them, are kept on the home page's data as `chapterGroups`, where
// theme/components/chapters.ts reads them. With `cards`, each table becomes a
// list of cards: number, title and summary.

import type { Element, ElementContent, Root, RootContent } from "hast"
import { toText } from "hast-util-to-text"
import { visit } from "unist-util-visit"
import type { VFile } from "vfile"
import type { QuartzTransformerPluginInstance } from "../quartz/plugins/types"

export interface ChapterGroupData {
  title: string
  pages: string[]
}

declare module "vfile" {
  interface DataMap {
    chapterGroups?: ChapterGroupData[]
  }
}

const element = (tagName: string, className: string, children: ElementContent[]): Element => ({
  type: "element",
  tagName,
  properties: { className: [className] },
  children,
})
const text = (value: string): ElementContent => ({ type: "text", value })
const cellsOf = (row: Element) =>
  row.children.filter((child): child is Element => child.type === "element" && /^t[hd]$/.test(child.tagName))
const rowsOf = (section: Element | undefined) =>
  (section?.children ?? []).filter((child): child is Element => child.type === "element" && child.tagName === "tr")
const child = (node: Element, tagName: string) =>
  node.children.find((c): c is Element => c.type === "element" && c.tagName === tagName)

function slugOf(link: Element): string {
  const dataSlug = link.properties?.dataSlug
  if (typeof dataSlug === "string" && dataSlug) return dataSlug
  const href = String(link.properties?.href ?? "")
  let path = href.split("#")[0].replace(/^\.\//, "").replace(/\.md$/, "")
  try {
    path = decodeURI(path)
  } catch {
    // Not percent-encoded: use it as written.
  }
  return path
}

/** The cards for one chapter table, or undefined when it is some other table. */
function cardsFor(table: Element): { list: Element; pages: string[] } | undefined {
  const head = rowsOf(child(table, "thead"))[0]
  const headers = head ? cellsOf(head).map((cell) => toText(cell).trim()) : []
  const chapterTable = ["Chapter", "File"].includes(headers[0]) && headers[1] === "What it covers"
  if (headers.length !== 2 || !chapterTable) return undefined

  const pages: string[] = []
  const items: ElementContent[] = []
  for (const row of rowsOf(child(table, "tbody"))) {
    const [chapterCell, summaryCell] = cellsOf(row)
    const link = chapterCell && child(chapterCell, "a")
    if (!link || !summaryCell) continue
    const label = toText(link).trim()
    const match = /^(\d+)\s*[-–—]\s*(.+)$/.exec(label)
    pages.push(slugOf(link))
    const parts: ElementContent[] = []
    if (match) parts.push(element("span", "cs-card-number", [text(match[1])]))
    parts.push(element("span", "cs-card-title", [text(match ? match[2] : label)]))
    parts.push(element("span", "cs-card-text", summaryCell.children))
    const classes = Array.isArray(link.properties?.className) ? link.properties.className : []
    items.push({
      type: "element",
      tagName: "li",
      properties: {},
      // No hover preview: the card already says what the chapter covers.
      children: [
        {
          ...link,
          properties: { ...link.properties, className: [...classes, "cs-card"], dataNoPopover: "true" },
          children: parts,
        },
      ],
    })
  }
  return { list: element("ul", "cs-cards", items), pages }
}

export const ChapterCards = (opts: { cards: boolean }): QuartzTransformerPluginInstance => ({
  name: "CalloutStudioChapterCards",
  htmlPlugins() {
    return [
      () => (tree: Root, file: VFile) => {
        if (file.data.slug !== "index") return
        const groups: ChapterGroupData[] = []
        let group = ""
        visit(tree, "element", (node: Element, index, parent) => {
          if (node.tagName === "h2" || node.tagName === "h3") group = toText(node).split(" - ")[0].trim()
          if (node.tagName !== "table" || !parent || index === undefined) return
          const cards = cardsFor(node)
          if (!cards) return
          if (group) groups.push({ title: group, pages: cards.pages })
          if (!opts.cards) return "skip"
          parent.children[index] = cards.list as RootContent & ElementContent
          return "skip"
        })
        // Quartz's scroll box is the table's parent: unwrap the cards from it.
        visit(tree, "element", (node: Element, index, parent) => {
          const classes = node.properties?.className
          const box = Array.isArray(classes) && classes.includes("table-container")
          const only = node.children.length === 1 && node.children[0]
          if (box && only && only.type === "element" && only.tagName === "ul" && parent && index !== undefined) {
            parent.children[index] = only
          }
        })
        if (groups.length > 0) file.data.chapterGroups = groups
      },
    ]
  },
})
