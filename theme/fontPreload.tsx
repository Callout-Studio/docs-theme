// The browser finds the site's fonts only after it has read the stylesheet
// that declares them; a preload in the page's <head> starts the Latin files at
// once, so the first text appears in its own font sooner.

import type { QuartzTransformerPluginInstance } from "../quartz/plugins/types"
import type { QuartzPluginData } from "../quartz/plugins/vfile"
import { pathToRoot, type FullSlug } from "../quartz/util/path"

const FILES = ["static/fonts/inter-latin.woff2"]

export const FontPreload = (): QuartzTransformerPluginInstance => ({
  name: "CalloutStudioFontPreload",
  externalResources() {
    return {
      // Not on the "Not found" page: it is served at whatever address was
      // missing, so a relative link from it would point nowhere.
      additionalHead: FILES.map(
        (file) => (page: QuartzPluginData) =>
          page.slug === "404" ? <></> : (
          <link
            rel="preload"
            href={`${pathToRoot((page.slug ?? "index") as FullSlug)}/${file}`}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          ),
      ),
    }
  },
})
