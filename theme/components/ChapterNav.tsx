// The chapter list: every chapter, in order, in the groups of the home page,
// with the page you are on marked. Each group folds (sliding shut, see
// custom.scss), and stays folded on the next page. It is rendered into the page itself (Quartz's Explorer is drawn by
// a script), so it is there before any script runs and for every reader.
//
// On a phone the list is in a drawer that a menu button opens: a modal
// <dialog> holding a sideways scroller with two snap points, so the drawer
// follows a swipe and settles open or closed.

import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../../quartz/components/types"
import { resolveRelative, type FullSlug } from "../../quartz/util/path"
import { chapterGroups, type ChapterGroup } from "./chapters"

function ChapterLinks({ groups, slug, prefix }: { groups: ChapterGroup[]; slug: FullSlug; prefix: string }) {
  const links = (group: ChapterGroup) => (
    <ul>
      {group.chapters.map((chapter) => (
        <li>
          <a
            href={resolveRelative(slug, chapter.slug as FullSlug)}
            aria-current={chapter.slug === slug ? "page" : undefined}
            data-no-popover
          >
            {chapter.number && <span class="cs-nav-number">{chapter.number}</span>}
            <span class="cs-nav-title">{chapter.title}</span>
          </a>
        </li>
      ))}
    </ul>
  )
  return (
    <>
      {groups.map((group) =>
        group.title ? (
          <details class="cs-nav-group" data-group={group.id} open>
            <summary id={`${prefix}-${group.id}`}>{group.title}</summary>
            {links(group)}
          </details>
        ) : (
          links(group)
        ),
      )}
    </>
  )
}

const ChapterNav: QuartzComponent = ({ fileData, allFiles }: QuartzComponentProps) => {
  const slug = fileData.slug as FullSlug
  const groups = chapterGroups(allFiles)
  return (
    <div class="cs-chapters">
      <button
        type="button"
        class="cs-menu-button"
        aria-label="Chapters"
        aria-expanded="false"
        aria-controls="cs-drawer"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <nav class="cs-nav cs-nav-sidebar" aria-label="Chapters">
        <ChapterLinks groups={groups} slug={slug} prefix="cs-nav" />
      </nav>
      <dialog class="cs-drawer" id="cs-drawer" aria-labelledby="cs-drawer-title">
        <div class="cs-drawer-scroller">
          <div class="cs-drawer-sheet">
            <div class="cs-drawer-head">
              <span id="cs-drawer-title">Chapters</span>
              <button type="button" class="cs-drawer-close" aria-label="Close the chapter list" autofocus>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav class="cs-nav" aria-labelledby="cs-drawer-title">
              <ChapterLinks groups={groups} slug={slug} prefix="cs-drawer" />
            </nav>
          </div>
        </div>
      </dialog>
    </div>
  )
}

// Runs on every page view: Quartz fires "nav" after the first load and after
// each in-site navigation, and window.addCleanup undoes the listeners first.
ChapterNav.afterDOMLoaded = `
(() => {
  const FOLDED = "cs-nav-folded"
  const readFolded = () => {
    try { return new Set(JSON.parse(localStorage.getItem(FOLDED) || "[]")) } catch { return new Set() }
  }
  const writeFolded = (set) => {
    try { localStorage.setItem(FOLDED, JSON.stringify([...set])) } catch {}
  }
  const cleanup = (fn) => window.addCleanup ? window.addCleanup(fn) : undefined

  function setupGroups() {
    // The page arrives with every group open and the groups you had folded are
    // closed here, so for two frames the lists must not animate (custom.scss).
    const navs = document.querySelectorAll(".cs-nav")
    for (const nav of navs) nav.setAttribute("data-settling", "")
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        for (const nav of navs) nav.removeAttribute("data-settling")
      }),
    )
    const folded = readFolded()
    for (const group of document.querySelectorAll("details.cs-nav-group")) {
      const id = group.dataset.group
      // The group holding the page you are on always shows it.
      if (folded.has(id) && !group.querySelector('[aria-current="page"]')) group.open = false
      const onToggle = () => {
        const now = readFolded()
        group.open ? now.delete(id) : now.add(id)
        writeFolded(now)
      }
      group.addEventListener("toggle", onToggle)
      cleanup(() => group.removeEventListener("toggle", onToggle))
    }
  }

  function setupDrawer() {
    const drawer = document.getElementById("cs-drawer")
    const openButton = document.querySelector(".cs-menu-button")
    if (!drawer || !openButton) return
    const scroller = drawer.querySelector(".cs-drawer-scroller")
    const sheet = drawer.querySelector(".cs-drawer-sheet")
    const closeButton = drawer.querySelector(".cs-drawer-close")

    async function openDrawer() {
      drawer.showModal()
      if (!CSS.supports("scroll-initial-target", "nearest")) {
        // Start from the closed snap point, so the sheet slides in.
        scroller.scrollTo({ left: scroller.scrollWidth, behavior: "instant" })
        await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
      }
      scroller.scrollTo({ left: 0, behavior: "auto" })
    }
    // Slide out; the observer closes the dialog once the sheet has left.
    const closeDrawer = () => scroller.scrollTo({ left: scroller.scrollWidth, behavior: "auto" })

    const visible = 1 / window.innerWidth
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1]
        if (!drawer.open) return
        if (entry.intersectionRatio < visible) {
          drawer.close()
          openButton.setAttribute("aria-expanded", "false")
        } else if (entry.intersectionRatio === 1) {
          openButton.setAttribute("aria-expanded", "true")
        }
      },
      { root: drawer, threshold: [visible, 1] },
    )
    observer.observe(sheet)

    const onDrawerClick = (event) => {
      // A chapter link: close at once, before the next page replaces this one.
      if (event.target.closest("a")) {
        drawer.close()
        openButton.setAttribute("aria-expanded", "false")
      } else if (!sheet.contains(event.target)) {
        closeDrawer()
      }
    }
    const onCancel = (event) => {
      if (event.cancelable) {
        event.preventDefault()
        closeDrawer()
      }
    }
    const onScroll = () => {
      const ratio = 1 - scroller.scrollLeft / sheet.offsetWidth
      drawer.style.setProperty("--cs-drawer-backdrop", String(Math.max(0, Math.min(1, ratio))))
    }
    const scrollTimeline = CSS.supports("animation-timeline: scroll()")

    openButton.addEventListener("click", openDrawer)
    closeButton.addEventListener("click", closeDrawer)
    drawer.addEventListener("click", onDrawerClick)
    drawer.addEventListener("cancel", onCancel)
    if (!scrollTimeline) scroller.addEventListener("scroll", onScroll)
    cleanup(() => {
      observer.disconnect()
      openButton.removeEventListener("click", openDrawer)
      closeButton.removeEventListener("click", closeDrawer)
      drawer.removeEventListener("click", onDrawerClick)
      drawer.removeEventListener("cancel", onCancel)
      scroller.removeEventListener("scroll", onScroll)
      if (drawer.open) drawer.close()
    })
  }

  // A wide table scrolls inside its own box; let the keyboard reach it.
  function labelWideTables() {
    for (const box of document.querySelectorAll("article .table-container")) {
      if (box.scrollWidth > box.clientWidth + 1) {
        box.tabIndex = 0
        box.setAttribute("role", "region")
        box.setAttribute("aria-label", "Table, scrolls sideways")
      }
    }
  }

  // The search box shows its shortcut the way this computer writes it.
  const apple = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
  document.documentElement.dataset.csPlatform = apple ? "apple" : "other"

  document.addEventListener("nav", () => {
    setupGroups()
    setupDrawer()
    labelWideTables()
  })
})()
`

export default (() => ChapterNav) satisfies QuartzComponentConstructor
