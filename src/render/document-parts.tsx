/** @jsx h */
/** @jsxFrag Fragment */
import { markdownHref, pageHref } from "../output/ai.ts";
import type { Config } from "../config/config.ts";
import { editorSourcePath } from "../editor/editor.ts";
import { editUrl, gitProviders } from "../config/repository.ts";
import { themeDeclarations } from "../theme/theme-declarations.ts";
import { normalizeIcon } from "../icons/icons.ts";
import type { Page, Site } from "../site/site.ts";
import { faviconUrl } from "./brand.tsx";
import type { RenderOptions } from "./document.ts";
import { Fragment, h, Icon, raw } from "./jsx.ts";

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" });

/**
 * Renders a `<time>` element with a medium English date, formatted in UTC so
 * the output does not depend on the build machine's time zone.
 */
export function time(date: Date) {
  return <time datetime={date.toISOString()}>{dateFormat.format(date)}</time>;
}

/**
 * Inline dev script that reloads on a message from the reload socket. When the
 * socket closes (server restart), it polls the page and reloads once the server
 * answers again, or reconnects.
 */
function liveReload(base: string) {
  const socket = JSON.stringify(base + "__reload");
  return (
    <script>
      {raw(
        `(()=>{const connect=()=>{const socket=new WebSocket(location.origin.replace(/^http/,"ws")+${socket});socket.onmessage=()=>location.reload();socket.onclose=()=>setTimeout(()=>fetch(location.href).then(()=>location.reload(),connect),400)};connect()})()`,
      )}
    </script>
  );
}

/**
 * Embeds the settings the in-browser editor reads for this page as JSON.
 * Server-only features (OAuth, server rendering) are null in a static export,
 * and `<` is escaped so the JSON cannot close the script tag.
 */
function editorSettings(site: Site, page: Page, options: RenderOptions) {
  const { config } = site;
  const settings = {
    source: page.source,
    title: page.title,
    payload: config.base + editorSourcePath(page).slice(1),
    editUrl: config.repository ? editUrl(config.repository, page.source) : null,
    provider: config.repository ? gitProviders[config.repository.provider] : null,
    oauth: options.server && config.editor.oauth !== undefined,
    render: options.server ? `${config.base}_editor/render` : null,
    base: config.base,
  };
  return (
    <script type="application/json" id="nodeps-editor">
      {raw(JSON.stringify(settings).replaceAll("<", "\\u003c"))}
    </script>
  );
}

/**
 * Renders the tags appended to `<head>`: meta description and Open Graph,
 * canonical and alternate links, the favicon, the theme's custom properties
 * on `:root` so pages paint in the right colors before any stylesheet loads,
 * the font preload and stylesheets, then the dev reload and editor scripts.
 */
export function headTags(
  site: Site,
  options: RenderOptions,
  parts: { fullTitle: string; description: string; page?: Page; home?: boolean },
) {
  const { config } = site;
  const { page } = parts;
  return (
    <>
      <meta name="description" content={parts.description} />
      <meta property="og:title" content={parts.fullTitle} />
      <meta property="og:description" content={parts.description} />
      {config.url && page && <link rel="canonical" href={config.url + pageHref(site, page)} />}
      {page && <link rel="alternate" type="text/markdown" href={markdownHref(site, page)} title="Markdown" />}
      {config.url && (
        <link rel="alternate" type="application/rss+xml" href={`${config.base}feed.xml`} title={config.title} />
      )}
      <link rel="icon" href={faviconUrl(site)} />
      <style>{raw(`:root{${themeDeclarations(config.theme)}}`)}</style>
      {site.fontPreload && (
        <link rel="preload" as="font" type={site.fontPreload.type} href={site.fontPreload.href} crossorigin />
      )}
      {site.stylesheets.map((href) => (
        <link rel="stylesheet" href={href} />
      ))}
      {options.dev && liveReload(config.base)}
      {page && !parts.home && config.editor.enabled && editorSettings(site, page, options)}
    </>
  );
}

/**
 * Renders the header links: the configured text links, then the repository
 * link with its provider's icon.
 */
export function headerLinks(config: Config) {
  const repository = config.repository;
  return (
    <>
      {config.links.map((link) => (
        <a href={link.url}>{link.label}</a>
      ))}
      {repository && (
        <a class="repository-link" href={repository.url} title={`Source on ${gitProviders[repository.provider]}`}>
          <Icon name={`simple-${repository.provider}`} />
          <span>{repository.label}</span>
        </a>
      )}
    </>
  );
}

/**
 * Renders the header theme menu entries, one per theme with a swatch. The
 * site default carries an empty `data-style` so choosing it clears the override.
 */
export function themePicker(site: Site) {
  return (
    <>
      {site.config.theme.choices.map((preset) => {
        const isSiteDefault = preset.name === site.config.theme.name;
        return (
          <button
            type="button"
            class="menu-item theme-option"
            data-preset={preset.name}
            data-style={isSiteDefault ? "" : themeDeclarations(preset)}
            role="menuitemradio"
          >
            <span class="swatch" style={themeDeclarations(preset)} data-theme-scope></span>
            <span>
              <strong>
                {preset.title}
                {isSiteDefault && (
                  <>
                    {" "}
                    <small>site default</small>
                  </>
                )}
              </strong>
              <small>{preset.description}</small>
            </span>
            <Icon name="check" />
          </button>
        );
      })}
    </>
  );
}

/**
 * Renders the page's tags as buttons that open the search filtered on them.
 */
export function tagList(tags: string[]) {
  return (
    <>
      {tags.map((tag) => (
        <li>
          <button type="button" class="tag" data-search={`#${tag}`}>
            #{tag}
          </button>
        </li>
      ))}
    </>
  );
}

/**
 * Renders the footer: an edit link (the built-in editor wins over the
 * repository's edit page), the footer text and the social links. Without a
 * page there is no edit link.
 */
export function footer(site: Site, page?: Page) {
  const { repository, editor, social } = site.config;
  const edit =
    page && editor.enabled ? (
      <a class="edit-link" href="?edit=true" data-edit-page>
        <Icon name="square-pen" />
        Edit this page
      </a>
    ) : page && repository?.edit ? (
      <a class="edit-link" href={editUrl(repository, page.source)}>
        <Icon name="square-pen" />
        Edit this page on {gitProviders[repository.provider]}
      </a>
    ) : undefined;
  return (
    <>
      {edit && <div class="page-meta">{edit}</div>}
      {site.config.footer && <p>{site.config.footer}</p>}
      {social.length > 0 && (
        <nav class="social-links" aria-label="Social links">
          {social.map((entry) => (
            <a href={entry.url} aria-label={entry.label} data-tooltip={entry.label}>
              <Icon name={normalizeIcon(entry.icon)} />
            </a>
          ))}
        </nav>
      )}
    </>
  );
}
