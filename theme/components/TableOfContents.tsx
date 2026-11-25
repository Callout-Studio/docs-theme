// The table of contents, at the top of the right-hand column. It stands in for
// Quartz's own (the table-of-contents plugin still reads the headings; see
// quartz.config.yaml), for two reasons:
//   - Quartz's is a button that folds the list, and here it always stays open;
//   - Quartz's script marks every heading above the bottom of the screen, so
//     the first entry stays marked all the way down the page. This one marks
//     the section you are reading, and when the list is longer than its box it
//     scrolls to keep that entry in view.

import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../../quartz/components/types"

interface TocEntry {
  depth: number
  text: string
  slug: string
}

const TableOfContents: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
  const toc = (fileData as { toc?: TocEntry[] }).toc
  if (!toc) return null
  return (
    <nav class="toc" aria-labelledby="cs-toc-title">
      <h3 class="toc-header" id="cs-toc-title">
        Table of contents
      </h3>
      <ul class="toc-content">
        {toc.map((entry) => (
          <li class={`depth-${entry.depth}`}>
            <a href={`#${entry.slug}`} data-for={entry.slug}>
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// Runs on every page view: Quartz fires "nav" after the first load and after
// each in-site navigation, and window.addCleanup undoes the listeners first.
TableOfContents.afterDOMLoaded = `
(() => {
  function setup() {
    const list = document.querySelector(".toc .toc-content")
    if (!list) return
    const entries = [...list.querySelectorAll("a[data-for]")]
      .map((link) => ({ link, heading: document.getElementById(link.dataset.for) }))
      .filter((entry) => entry.heading)
    if (entries.length === 0) return

    let marked = -2
    let frame

    // Scrolls the list, never the page, so that the entry is in the middle.
    function reveal(link) {
      const box = list.getBoundingClientRect()
      const item = link.getBoundingClientRect()
      if (item.top >= box.top + 8 && item.bottom <= box.bottom - 8) return
      const top = list.scrollTop + item.top - box.top - (box.height - item.height) / 2
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      list.scrollTo({ top, behavior: calm ? "auto" : "smooth" })
    }

    function update() {
      frame = undefined
      // The section you are reading starts at the last heading that has
      // reached this line, a little way down the screen.
      const line = Math.min(window.innerHeight * 0.3, 240)
      let index = -1
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].heading.getBoundingClientRect().top <= line) index = i
        else break
      }
      // Before the first heading reaches the line, the first one is marked
      // only when it is already on screen.
      if (index === -1 && entries[0].heading.getBoundingClientRect().top < window.innerHeight) index = 0
      // At the very end the last section may be too short for its heading to
      // reach the line; it is the one being read.
      const atEnd = window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      if (atEnd) index = entries.length - 1

      if (index === marked) return
      marked = index
      entries.forEach((entry, i) => {
        entry.link.classList.toggle("current", i === index)
        if (i === index) entry.link.setAttribute("aria-current", "location")
        else entry.link.removeAttribute("aria-current")
      })
      if (index >= 0) reveal(entries[index].link)
    }

    const request = () => {
      if (frame === undefined) frame = requestAnimationFrame(update)
    }
    window.addEventListener("scroll", request, { passive: true })
    window.addEventListener("resize", request, { passive: true })
    if (window.addCleanup) {
      window.addCleanup(() => {
        window.removeEventListener("scroll", request)
        window.removeEventListener("resize", request)
        if (frame !== undefined) cancelAnimationFrame(frame)
      })
    }
    update()
  }

  document.addEventListener("nav", setup)
})()
`

export default (() => TableOfContents) satisfies QuartzComponentConstructor
