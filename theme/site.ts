// Everything the two docs sites build the same way. Each site's quartz.ts only
// gives its own texts and links:
//
//   import { createSite } from "./theme/site"
//   const site = await createSite({ … })
//   export default site.config
//   export const layout = site.layout
//
// assemble.mjs copies theme/ next to that quartz.ts, so the paths below are the
// ones inside the Quartz folder.

import { loadQuartzConfig, loadQuartzLayout } from "../quartz/plugins/loader/config-loader"
import * as ExternalPlugin from "../.quartz/plugins"
import ChapterNav from "./components/ChapterNav"
import HomeHero from "./components/HomeHero"
import NotFound from "./components/NotFound"
import PageActions from "./components/PageActions"
import PageHeader from "./components/PageHeader"
import SiteFooter from "./components/SiteFooter"
import TableOfContents from "./components/TableOfContents"
import { ogImage } from "./components/ogImage"
import { ChapterCards } from "./chapterCards"
import { FontPreload } from "./fontPreload"
import { HeadingAnchors } from "./headingAnchors"
import { LazyImages } from "./lazyImages"

type Options<T extends (...args: never[]) => unknown> = NonNullable<Parameters<T>[0]>

export interface SiteOptions {
  /** owner/name of the repository the pages are written in. */
  repository: string
  /** Its default branch, for the "edit" and "history" links. */
  branch: string
  /** The share picture of the home page: see components/ogImage.tsx. */
  ogImage: { heading: string; text: string }
  /** Whether the home page's chapter lists become cards (chapterCards.ts). */
  chapterCards: boolean
  /** The page for an address that does not exist: see components/NotFound.tsx. */
  notFound: Omit<Options<typeof NotFound>, "repository">
  /** The site's own group of links in the right-hand column. */
  rail: NonNullable<Options<typeof PageActions>["extra"]>
  /** The top of the home page: see components/HomeHero.tsx. */
  hero: Options<typeof HomeHero>
  /** The footer, without the light and dark switch, which it gets here. */
  footer: Omit<Options<typeof SiteFooter>, "toggle">
}

export async function createSite(site: SiteOptions) {
  const { repository, branch } = site

  // The picture shown when a page is shared. Must be set before loadQuartzConfig().
  ExternalPlugin.CustomOgImages({ imageStructure: ogImage(site.ogImage) as never })

  const config = await loadQuartzConfig()
  config.plugins.transformers.push(
    ChapterCards({ cards: site.chapterCards }),
    HeadingAnchors(),
    LazyImages(),
    FontPreload(),
  )

  // The page for an address that does not exist (404.html) is the site's own,
  // in place of Quartz's bare heading.
  const notFound = config.plugins.pageTypes?.find((pageType) => pageType.name === "404")
  if (notFound) {
    notFound.body = () => NotFound({ ...site.notFound, repository })
  }

  // The layout quartz.config.yaml builds, with the site's components added.
  // The footer slot there holds only Quartz's light and dark switch, whose
  // script SiteFooter uses for the button it draws at the end of its row.
  const base = await loadQuartzLayout()
  const [toggle] = base.defaults.footer ?? []
  const layout = await loadQuartzLayout({
    defaults: {
      left: [...(base.defaults.left ?? []), ChapterNav()],
      // The table of contents, then the graph, then the page's links, in
      // groups. The table of contents is the site's own
      // (components/TableOfContents.tsx): Quartz's, which its plugin places by
      // itself, is left out.
      right: [
        TableOfContents(),
        ...(base.defaults.right ?? []).filter((component) => component.name !== "TableOfContents"),
        PageActions({ repository, branch, place: "rail", extra: site.rail }),
      ],
      beforeBody: [
        HomeHero(site.hero),
        PageHeader({ repository, branch }),
        ...(base.defaults.beforeBody ?? []),
      ],
      afterBody: [
        ...(base.defaults.afterBody ?? []),
        // The same links under the article, for widths with no right-hand column.
        PageActions({ repository, branch, place: "end" }),
      ],
      footer: [SiteFooter({ ...site.footer, toggle })],
    },
  })

  return { config, layout }
}
