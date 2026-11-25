// The page shown for an address that does not exist (404.html): the number with
// the plugin's brush where the zero goes, sad, a line saying what happened, and
// the way back. It replaces Quartz's own, a bare heading and a link, and keeps
// its one working part: an address that is only wrong in its letter case
// redirects to the page that exists.
//
// GitHub Pages serves 404.html for an address at any depth, so nothing here is
// relative: the home link and the page's own files start from the site's base
// path (Quartz does the same for the files).

import type { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "../../quartz/components/types"

// Lucide icons (ISC License).
const ICON = {
  github:
    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
}

// The mascot at rest is the plugin's icon exactly; sad, the stripe across the
// bristles becomes a frown and two dot eyes sit above it. The face is drawn
// around its own axis (the eyes level, the frown centred under them) and the
// group is tilted 15 degrees, the stripe's slant, so it stays centred whatever
// the numbers; it is also small enough to clear the brush's outline, which a
// thicker face would smear into. Drawn in Lucide's 24-unit box.
const SAD_BRUSH =
  '<path d="M18.376 2.622a1 1 0 1 1 3.002 3.002L17.36 9.643a.5.5 0 0 0 0 .707l.944.944a2.41 2.41 0 0 1 0 3.408l-.944.944a.5.5 0 0 1-.707 0L8.354 7.348a.5.5 0 0 1 0-.707l.944-.944a2.41 2.41 0 0 1 3.408 0l.944.944a.5.5 0 0 0 .707 0z"/>' +
  '<path d="M9 8c-1.804 2.71-3.97 3.46-6.583 3.948a.507.507 0 0 0-.302.819l7.32 8.883a1 1 0 0 0 1.185.204C12.735 20.405 16 16.792 16 15"/>' +
  '<g transform="translate(10.35 13.9) rotate(15)">' +
  '<circle class="cs-404-eye" cx="-1.5" cy="0" r="0.95"/><circle class="cs-404-eye" cx="1.5" cy="0" r="0.95"/>' +
  '<path d="M-1.3 3.2Q0 2 1.3 3.2"/>' +
  "</g>"

// Quartz's own redirect: /Docs/Page → /docs/page when only the letter case
// differs and the lower-case page exists.
const CASE_REDIRECT = `
  if (typeof fetchData !== "undefined") {
    fetchData.then(function(index) {
      var basePath = document.body.dataset.basepath || "";
      if (basePath.length > 1 && basePath.endsWith("/")) {
        basePath = basePath.slice(0, -1);
      }
      var pathname = window.location.pathname;
      var hasBasePrefix = basePath.length > 1 && pathname.startsWith(basePath);
      if (hasBasePrefix) {
        pathname = pathname.slice(basePath.length);
      }
      if (pathname.startsWith("/")) {
        pathname = pathname.slice(1);
      }
      if (pathname.endsWith("/")) {
        pathname = pathname.slice(0, -1);
      }
      if (pathname.endsWith(".html")) {
        pathname = pathname.slice(0, -5);
      }
      if (pathname.endsWith("/index")) {
        pathname = pathname.slice(0, -6);
      }
      var lowered = pathname.toLowerCase();
      if (lowered !== pathname && index[lowered] != null) {
        var prefix = hasBasePrefix ? basePath : "";
        var target = prefix + (prefix.endsWith("/") ? "" : "/") + lowered;
        window.location.replace(target);
      }
    });
  }
`

// "Report a broken link" names the address that was asked for, so the report
// says which link it was. Set when the page loads: the page itself is the same
// file for every address.
const REPORT_TITLE = `
  var report = document.getElementById("cs-404-report");
  if (report) {
    report.href += "&title=" + encodeURIComponent("Broken link: " + window.location.pathname);
  }
`

interface Options {
  /** What the way back is called: "the user guide", "the internal docs". */
  siteName: string
  /** "Callout-Studio/obsidian": where the broken link is reported. */
  repository: string
  /** The surprise's address, shown as a small link under the buttons. */
  surprise: string
}

export default ((opts: Options) => {
  const NotFound: QuartzComponent = ({ cfg }: QuartzComponentProps) => {
    const base = new URL(`https://${cfg.baseUrl ?? "example.com"}`).pathname
    const home = base.endsWith("/") ? base : `${base}/`
    return (
      <article class="cs-404">
        <h1 class="cs-404-number" aria-label="404">
          <span aria-hidden="true">4</span>
          <svg class="cs-404-brush" viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: SAD_BRUSH }} />
          <span aria-hidden="true">4</span>
        </h1>
        <p class="cs-404-title">This page isn't here</p>
        <p class="cs-404-lead">
          The address may be mistyped, or the page may have been moved or renamed. It might also be private.
        </p>
        <div class="cs-404-actions">
          <a class="cs-button cs-button-primary" href={home}>
            Go to {opts.siteName}
          </a>
          <a
            class="cs-button"
            id="cs-404-report"
            href={`https://github.com/${opts.repository}/issues/new?template=bug_report.yml`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON.github }} />
            Report a broken link
          </a>
        </div>
        <p class="cs-404-surprise">
          <a href={opts.surprise} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICON.gift }} />
            A little surprise
          </a>
        </p>
        <script dangerouslySetInnerHTML={{ __html: CASE_REDIRECT + REPORT_TITLE }} />
      </article>
    )
  }
  return NotFound
}) satisfies QuartzComponentConstructor<Options>
