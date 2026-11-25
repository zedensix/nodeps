import type { Config } from "../config/config.ts";
import type { Page, Site } from "../site/site.ts";

interface Session {
  token: string;
  login: string;
  avatar: string;
  expires: number;
}

const sessionCookie = "nodeps_session";
const stateCookie = "nodeps_oauth_state";
const sessionLifetime = 8 * 60 * 60 * 1000;
const maximumContentLength = 1_000_000;

/**
 * The `owner/name` of the configured GitHub repository.
 */
function repositoryName(config: Config) {
  return config.repository!.label;
}

/**
 * Calls the GitHub REST API as the signed-in user. Throws with the status and the
 * start of the response body on any non-2xx, and returns undefined for a 204.
 */
async function github<Result>(token: string, method: string, path: string, body?: unknown): Promise<Result> {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "nodeps",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub ${method} ${path} failed (${response.status}): ${detail.slice(0, 300)}`);
  }
  return (response.status === 204 ? undefined : await response.json()) as Result;
}

/**
 * Polls a freshly created fork until its base branch exists, since GitHub creates
 * forks asynchronously. Gives up after 15 attempts, 1.5 seconds apart.
 */
async function waitForBranch(token: string, repository: string, branch: string) {
  for (let attempt = 0; attempt < 15; attempt++) {
    try {
      return await github<{ object: { sha: string } }>(token, "GET", `/repos/${repository}/git/ref/heads/${branch}`);
    } catch {
      await Bun.sleep(1500);
    }
  }
  throw new Error(`The fork ${repository} was not ready in time, try publishing again in a minute.`);
}

/**
 * Commits the edited page to a new branch and opens a pull request against the
 * configured branch. Users without push access get the branch on their fork,
 * created on first use.
 */
async function openPullRequest(config: Config, session: Session, page: Page, content: string) {
  const upstream = repositoryName(config);
  const { branch: baseBranch, path } = config.repository!;
  const filePath = [path, page.source].filter(Boolean).join("/");
  const repository = await github<{ permissions?: { push?: boolean } }>(session.token, "GET", `/repos/${upstream}`);
  const base = await github<{ object: { sha: string } }>(
    session.token,
    "GET",
    `/repos/${upstream}/git/ref/heads/${baseBranch}`,
  );

  let target = upstream;
  if (!repository.permissions?.push) {
    const fork = await github<{ full_name: string }>(session.token, "POST", `/repos/${upstream}/forks`, {
      default_branch_only: true,
    });
    target = fork.full_name;
    await waitForBranch(session.token, target, baseBranch);
  }

  const slug = page.source
    .replace(/\.md$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
  const branch = `nodeps/${slug}-${Date.now().toString(36)}`;
  await github(session.token, "POST", `/repos/${target}/git/refs`, {
    ref: `refs/heads/${branch}`,
    sha: base.object.sha,
  });
  const existing = await github<{ sha: string }>(
    session.token,
    "GET",
    `/repos/${target}/contents/${filePath}?ref=${branch}`,
  );
  await github(session.token, "PUT", `/repos/${target}/contents/${filePath}`, {
    message: `docs: update ${page.title}`,
    content: Buffer.from(content).toString("base64"),
    sha: existing.sha,
    branch,
  });
  const head = target === upstream ? branch : `${target.split("/")[0]}:${branch}`;
  return github<{ number: number; html_url: string }>(session.token, "POST", `/repos/${upstream}/pulls`, {
    title: `docs: update ${page.title}`,
    head,
    base: baseBranch,
    body: `Edited with the nodeps editor by @${session.login}.`,
  });
}

/**
 * Returns the request handler for the editor's `/_auth/*` (GitHub OAuth sign-in)
 * and `/_editor/*` (publish, pull request status) routes. Sessions live in memory,
 * so a restart signs everyone out; the handler returns undefined for any other path
 * or when the editor is disabled.
 */
export function createEditorRoutes(getSite: () => Site) {
  const sessions = new Map<string, Session>();

  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

  const cookieOptions = (config: Config, maxAge: number) => ({
    httpOnly: true,
    secure: config.url?.startsWith("https://") ?? false,
    sameSite: "lax" as const,
    path: config.base,
    maxAge,
  });

  const sessionOf = (request: Request) => {
    const id = new Bun.CookieMap(request.headers.get("cookie") ?? "").get(sessionCookie);
    const session = id ? sessions.get(id) : undefined;
    if (!session || session.expires < Date.now()) {
      return undefined;
    }
    return session;
  };

  const sameOrigin = (request: Request, config: Config) => {
    const origin = request.headers.get("origin");
    return origin !== null && origin === new URL(config.url!).origin;
  };

  return async (request: Request, path: string): Promise<Response | undefined> => {
    const site = getSite();
    const { config } = site;
    const oauth = config.editor.oauth;
    if (!config.editor.enabled || !oauth || (!path.startsWith("/_auth/") && !path.startsWith("/_editor/"))) {
      return undefined;
    }
    const url = new URL(request.url);
    const callback = `${config.url}${config.base}_auth/callback`;

    if (path === "/_auth/login") {
      const returnTo = url.searchParams.get("return") ?? config.base;
      const safeReturn = returnTo.startsWith(config.base) && !returnTo.startsWith("//") ? returnTo : config.base;
      const state = crypto.randomUUID();
      const authorize = new URL("https://github.com/login/oauth/authorize");
      authorize.searchParams.set("client_id", oauth.clientId);
      authorize.searchParams.set("redirect_uri", callback);
      authorize.searchParams.set("scope", oauth.scope);
      authorize.searchParams.set("state", state);
      const cookie = new Bun.Cookie(stateCookie, `${state}|${safeReturn}`, cookieOptions(config, 600));
      return new Response(null, {
        status: 302,
        headers: { location: authorize.href, "set-cookie": cookie.toString() },
      });
    }

    if (path === "/_auth/callback") {
      const [expectedState, returnTo = config.base] = (
        new Bun.CookieMap(request.headers.get("cookie") ?? "").get(stateCookie) ?? ""
      ).split("|");
      const code = url.searchParams.get("code");
      if (!code || !expectedState || url.searchParams.get("state") !== expectedState) {
        return new Response("Sign-in expired or was tampered with. Close this tab and try again.", { status: 400 });
      }
      const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({
          client_id: oauth.clientId,
          client_secret: oauth.clientSecret,
          code,
          redirect_uri: callback,
        }),
      });
      const token = ((await tokenResponse.json()) as { access_token?: string }).access_token;
      if (!token) {
        return new Response("GitHub refused the sign-in.", { status: 502 });
      }
      const user = await github<{ login: string; avatar_url: string }>(token, "GET", "/user");
      const id = crypto.randomUUID();
      sessions.set(id, { token, login: user.login, avatar: user.avatar_url, expires: Date.now() + sessionLifetime });
      const headers = new Headers({ location: `${returnTo}?edit=true` });
      headers.append(
        "set-cookie",
        new Bun.Cookie(sessionCookie, id, cookieOptions(config, sessionLifetime / 1000)).toString(),
      );
      headers.append("set-cookie", new Bun.Cookie(stateCookie, "", cookieOptions(config, 0)).toString());
      return new Response(null, { status: 302, headers });
    }

    if (path === "/_auth/me") {
      const session = sessionOf(request);
      return session ? json({ login: session.login, avatar: session.avatar }) : json({ error: "Not signed in" }, 401);
    }

    if (path === "/_auth/logout" && request.method === "POST") {
      const id = new Bun.CookieMap(request.headers.get("cookie") ?? "").get(sessionCookie);
      if (id) {
        sessions.delete(id);
      }
      return json({}, 200, { "set-cookie": new Bun.Cookie(sessionCookie, "", cookieOptions(config, 0)).toString() });
    }

    if (path === "/_editor/publish" && request.method === "POST") {
      if (!sameOrigin(request, config)) {
        return json({ error: "Forbidden origin" }, 403);
      }
      const session = sessionOf(request);
      if (!session) {
        return json({ error: "Sign in first" }, 401);
      }
      let input: { source?: unknown; content?: unknown };
      try {
        input = await request.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
      const page = site.pages.find((candidate) => candidate.source === input.source);
      if (!page || typeof input.content !== "string" || input.content.length > maximumContentLength) {
        return json({ error: "Unknown page or invalid content" }, 400);
      }
      try {
        const pull = await openPullRequest(config, session, page, input.content);
        return json({ number: pull.number, url: pull.html_url });
      } catch (error) {
        return json({ error: (error as Error).message }, 502);
      }
    }

    if (path === "/_editor/status") {
      const session = sessionOf(request);
      const number = Number(url.searchParams.get("number"));
      if (!session || !Number.isInteger(number) || number <= 0) {
        return json({ error: "Sign in first" }, 401);
      }
      try {
        const pull = await github<{ state: string; merged: boolean; html_url: string }>(
          session.token,
          "GET",
          `/repos/${repositoryName(config)}/pulls/${number}`,
        );
        return json({ state: pull.merged ? "merged" : pull.state, url: pull.html_url });
      } catch (error) {
        return json({ error: (error as Error).message }, 502);
      }
    }

    return undefined;
  };
}
