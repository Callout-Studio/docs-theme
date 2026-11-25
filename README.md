# Callout Studio Docs Theme

The look, the components and the build shared by the two websites of [Callout Studio](https://github.com/Callout-Studio/obsidian)'s docs, both built with [Quartz](https://quartz.jzhao.xyz) 5:

| Site | Repository | Pages from |
| --- | --- | --- |
| [Callout Studio Docs](https://callout-studio.github.io/docs/) | [`Callout-Studio/docs`](https://github.com/Callout-Studio/docs) | `docs/user-guide/` |
| [Callout Studio Internal Docs](https://callout-studio.github.io/internal-docs/) | [`Callout-Studio/internal-docs`](https://github.com/Callout-Studio/internal-docs) | `docs/internals-docs/` |

Each site repository keeps only what is its own: its texts and links (`quartz.ts`), its name, address and which pages it publishes (`site.json`), and the pictures only it shows (its `theme/` folder). Everything else is here, once.

## How a change reaches the sites

1. A push to `main` here runs [Rebuild the sites](.github/workflows/rebuild-sites.yml) (unless it changes only this README or `dev.sh`).
2. That workflow writes the new commit into `theme-commit.txt` in both site repositories. It pushes with a deploy key of each, which never expires; the private halves are this repository's `DOCS_SITE_DEPLOY_KEY` and `INTERNAL_DOCS_SITE_DEPLOY_KEY` secrets.
3. That push runs the site's **Build and deploy** workflow, which is [`build-site.yml`](.github/workflows/build-site.yml) from here. It builds the pages of the plugin commit in the site's `source-commit.txt` with the theme of the commit in its `theme-commit.txt`, and publishes the site on GitHub Pages.

The plugin's repository does the same with `source-commit.txt` when its docs change. Each build is therefore pinned to one commit of each: an older build can be run again exactly.

To rebuild a site by hand, open **Actions → Build and deploy → Run workflow** in its repository. Leave both fields empty to build what its two files name, or write `master` (the docs) or `main` (the theme) for the newest.

## What is here

| File | What it does |
| --- | --- |
| [`theme/`](theme) | The stylesheet, the components (home-page top, page header, chapter list, table of contents, page links, footer, 404 page, share picture), the Markdown transforms, the logo and the fonts. |
| [`theme/site.ts`](theme/site.ts) | Places the components in Quartz's layout. A site's `quartz.ts` calls it with its own texts and links. |
| [`quartz.config.yaml`](quartz.config.yaml) | Quartz's settings shared by both sites: colors, fonts, plugins and layout. |
| [`assemble.mjs`](assemble.mjs) | Puts one site together inside a Quartz folder: this theme, the site's own files over it, and the site's `quartz.config.yaml` (this one plus the `quartz` part of its `site.json`). |
| [`prepare-content.mjs`](prepare-content.mjs) | Turns a docs folder into Quartz pages: titles, links and alerts, live results under examples marked `preview`, and redirects for renamed pages. The text itself is not changed. |
| [`prepare-graph.mjs`](prepare-graph.mjs) | Serves the graph's two libraries from the site instead of a CDN. |
| [`quartz-version.txt`](quartz-version.txt) | The Quartz version the theme is built for. |
| [`dev.sh`](dev.sh) | The local preview. |

## Preview on your computer

Put the three repositories side by side, with the plugin's repository (a clone, or a link to yours) as `source` in each site:

```bash
git clone https://github.com/Callout-Studio/docs-theme.git
git clone https://github.com/Callout-Studio/docs.git
git clone https://github.com/Callout-Studio/internal-docs.git
ln -s /path/to/your/obsidian-clone docs/source
ln -s /path/to/your/obsidian-clone internal-docs/source
cd docs-theme
./dev.sh             # the user guide:    http://localhost:8080/docs
./dev.sh internal    # the internal docs: http://localhost:8081/internal-docs
```

The first run installs Quartz into each site's `quartz/` folder. `quartz/` and `source/` are ignored by Git. After changing anything but a page, stop the preview and run it again.

## Upgrading Quartz

Change [`quartz-version.txt`](quartz-version.txt), delete each site's `quartz/` folder, preview both sites with `./dev.sh`, and push.
