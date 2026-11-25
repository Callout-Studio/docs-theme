// The top of every page but the home page: its title, how long it takes to read
// and when it last changed, and, where the right-hand column is hidden, a list
// of the page's sections. A page that has a picture of its own, theme/banners/
// <the page's name>.svg, draws the title and the two chips on a band with that
// picture at its right, as the home page's top does; the others have a plain
// heading. Adding a picture to a page is adding that file.
//
// It stands in for three of Quartz's components (the breadcrumbs, the article
// title and the content meta; quartz.config.yaml turns them off), for these
// reasons:
//   - the breadcrumbs ended in the page's own title, the line right under
//     them, and every chapter is at the same level, so "Home" was the only
//     thing they said; the site's name beside the logo already leads home;
//   - the page's date is when it last changed in the plugin's repository, so
//     it links to that file's history there;
//   - below the width where the table of contents has its column, there was
//     no way to see the page's sections: a folded list under the title shows
//     them.

import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../../quartz/components/types"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import type { FullSlug } from "../../quartz/util/path"
import { chapterGroups } from "./chapters"

// Where the pictures are, from the folder Quartz is built in (assemble.mjs
// copies theme/, and the site's own theme/banners/, to quartz/theme/).
const BANNERS = path.join("theme", "banners")
const pictures = new Map<string, string | undefined>()

/** The page's picture, as SVG markup, or undefined when it has none. */
function pictureOf(slug: string): string | undefined {
  if (!/^[\w-]+$/.test(slug)) return undefined
  if (!pictures.has(slug)) {
    const file = path.join(BANNERS, `${slug}.svg`)
    pictures.set(slug, existsSync(file) ? readFileSync(file, "utf8") : undefined)
  }
  return pictures.get(slug)
}

// Lucide icons (ISC License).
const ICON = {
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  history:
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
}

const Icon = ({ name }: { name: keyof typeof ICON }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON[name] }} />
)

interface TocEntry {
  depth: number
  text: string
  slug: string
}

interface Options {
  /** owner/name on GitHub */
  repository: string
  branch: string
}

/** Quartz's own reading speed: 200 words a minute, rounded up, at least a minute. */
function minutesToRead(text: string): number {
  const words = text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length
  return Math.max(1, Math.ceil(words / 200))
}

export default ((opts: Options) => {
  const PageHeader: QuartzComponent = ({ fileData, cfg, allFiles }: QuartzComponentProps) => {
    const slug = fileData.slug as FullSlug
    // The home page has its own heading (HomeHero.tsx); the "Not found" page
    // has none of its own.
    if (slug === "index" || slug === "404") return null

    const title = String(fileData.frontmatter?.title ?? "")
    const picture = pictureOf(slug)

    const text = fileData.text
    const date = fileData.dates?.modified
    const sourcePath = fileData.frontmatter?.sourcePath as string | undefined
    const history = sourcePath
      ? `https://github.com/${opts.repository}/commits/${opts.branch}/${encodeURI(sourcePath)}`
      : undefined
    const when = date?.toLocaleDateString(cfg.locale || "en-US", { year: "numeric", month: "short", day: "numeric" })
    const stamp = date && when && (
      <time datetime={date.toISOString()}>
        <Icon name="history" />
        Updated {when}
      </time>
    )

    const toc = ((fileData as { toc?: TocEntry[] }).toc ?? []).filter((entry) => entry.text)

    const heading = <h1 class="article-title inline-title">{title}</h1>
    const meta = (text || stamp) && (
      <p class="cs-page-meta">
        {text && (
          <span class="cs-chip">
            <Icon name="clock" />
            {minutesToRead(text)} min read
          </span>
        )}
        {stamp &&
          (history ? (
            <a class="cs-chip" href={history} title="See what changed in this page">
              {stamp}
            </a>
          ) : (
            <span class="cs-chip">{stamp}</span>
          ))}
      </p>
    )

    // On a band, the name of the page's group of chapters ("Styling") stands
    // above the title instead of the two chips.
    const group = chapterGroups(allFiles).find((g) => g.chapters.some((chapter) => chapter.slug === slug))?.title

    return (
      <div class="cs-page-head">
        {picture ? (
          <div class="cs-band">
            <div class="cs-band-text">
              {group && <p class="cs-band-eyebrow">{group}</p>}
              {heading}
            </div>
            <div class="cs-band-picture" dangerouslySetInnerHTML={{ __html: picture }} />
          </div>
        ) : (
          <>
            {heading}
            {meta}
          </>
        )}
        {toc.length > 1 && (
          <details class="cs-onpage">
            <summary>On this page</summary>
            <ul>
              {toc.map((entry) => (
                <li class={`depth-${entry.depth}`}>
                  <a href={`#${entry.slug}`}>{entry.text}</a>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    )
  }

  // Runs on every page view: Quartz fires "nav" after the first load and after
  // each in-site navigation, and window.addCleanup undoes the listeners first.
  // Choosing a section closes the list, so it does not stay open over the page
  // once the page has scrolled there.
  PageHeader.afterDOMLoaded = `
(() => {
  document.addEventListener("nav", () => {
    const list = document.querySelector(".cs-page-head .cs-onpage")
    if (!list) return
    const onClick = (event) => {
      if (event.target instanceof Element && event.target.closest("a")) list.open = false
    }
    list.addEventListener("click", onClick)
    if (window.addCleanup) window.addCleanup(() => list.removeEventListener("click", onClick))
  })
})()
`

  return PageHeader
}) satisfies QuartzComponentConstructor<Options>
