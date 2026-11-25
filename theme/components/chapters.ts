// The docs' chapters, in reading order, and the groups the home page puts them in.
//
// The order is the order of the file names (01, 02, … 10, 11). The groups come
// from the guide's README: theme/chapterCards.ts reads its "### Group" headings
// and the chapter tables under them, and keeps them on the home page's data as
// `chapterGroups`. A site whose README has no groups gets one list.

import type { QuartzPluginData } from "../../quartz/plugins/vfile"
import type { ChapterGroupData } from "../chapterCards"

export interface Chapter {
  slug: string
  title: string
  /** "01" for 01-the-three-callout-types; undefined when the name has no number. */
  number?: string
}

export interface ChapterGroup {
  id: string
  /** Undefined for the single list of a site without groups. */
  title?: string
  chapters: Chapter[]
}

const isChapter = (file: QuartzPluginData) => {
  const slug = file.slug ?? ""
  // Not the home page, folder pages, tag pages or the "Not found" page.
  return (
    slug !== "" &&
    slug !== "index" &&
    slug !== "404" &&
    !slug.endsWith("/index") &&
    !slug.startsWith("tags/")
  )
}

export function chapterList(allFiles: QuartzPluginData[]): Chapter[] {
  return allFiles
    .filter(isChapter)
    .map((file) => {
      const slug = file.slug as string
      const name = slug.split("/").pop() ?? slug
      return {
        slug,
        title: String(file.frontmatter?.title ?? name),
        number: /^(\d+)-/.exec(name)?.[1],
      }
    })
    .sort((a, b) => a.slug.localeCompare(b.slug, undefined, { numeric: true, sensitivity: "base" }))
}

export function chapterGroups(allFiles: QuartzPluginData[]): ChapterGroup[] {
  const chapters = chapterList(allFiles)
  const bySlug = new Map(chapters.map((chapter) => [chapter.slug, chapter]))
  const index = allFiles.find((file) => file.slug === "index")
  const declared = (index as { chapterGroups?: ChapterGroupData[] } | undefined)?.chapterGroups
  if (!Array.isArray(declared) || declared.length === 0) {
    return [{ id: "all", chapters }]
  }

  const placed = new Set<string>()
  const groups: ChapterGroup[] = declared.map((group) => ({
    id: group.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    title: group.title,
    chapters: group.pages.flatMap((slug) => {
      const chapter = bySlug.get(slug)
      if (!chapter || placed.has(slug)) return []
      placed.add(slug)
      return [chapter]
    }),
  }))
  // A chapter the README forgot still gets listed, so it is never unreachable.
  const rest = chapters.filter((chapter) => !placed.has(chapter.slug))
  if (rest.length > 0) groups.push({ id: "more", title: "More", chapters: rest })
  return groups.filter((group) => group.chapters.length > 0)
}
