import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readModel } from "../read-model.js";
import {
  clearCockpitRuntime,
  ensureProjectInitialized,
  findLiveCockpit,
  readCockpitRuntime,
  stopProjectCockpit,
  writeCockpitRuntime,
  type CockpitStartOptions,
} from "./lifecycle.js";

interface StaticAsset {
  bytes: Buffer;
  contentType: string;
}

export interface RunningCockpit {
  url: string;
  close: () => Promise<void>;
}

const packageRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

const staticAssetFiles = new Map<string, {
  path: string;
  contentType: string;
}>([
  ["/", {
    path: resolve(packageRoot, "assets", "cockpit", "index.html"),
    contentType: "text/html; charset=utf-8",
  }],
  ["/assets/cockpit.css", {
    path: resolve(packageRoot, "assets", "cockpit", "cockpit.css"),
    contentType: "text/css; charset=utf-8",
  }],
  ["/assets/cockpit.js", {
    path: resolve(packageRoot, "assets", "cockpit", "cockpit.js"),
    contentType: "text/javascript; charset=utf-8",
  }],
  ["/assets/fonts/IBMPlexSans-Regular.woff2", {
    path: resolve(
      packageRoot,
      "assets",
      "cockpit",
      "fonts",
      "IBMPlexSans-Regular.woff2",
    ),
    contentType: "font/woff2",
  }],
  ["/assets/fonts/IBMPlexSans-SemiBold.woff2", {
    path: resolve(
      packageRoot,
      "assets",
      "cockpit",
      "fonts",
      "IBMPlexSans-SemiBold.woff2",
    ),
    contentType: "font/woff2",
  }],
  ["/assets/fonts/IBMPlexSansCondensed-SemiBold.woff2", {
    path: resolve(
      packageRoot,
      "assets",
      "cockpit",
      "fonts",
      "IBMPlexSansCondensed-SemiBold.woff2",
    ),
    contentType: "font/woff2",
  }],
  ["/assets/fonts/IBMPlexSansCondensed-Bold.woff2", {
    path: resolve(
      packageRoot,
      "assets",
      "cockpit",
      "fonts",
      "IBMPlexSansCondensed-Bold.woff2",
    ),
    contentType: "font/woff2",
  }],
  ["/assets/fonts/IBMPlexMono-Regular.woff2", {
    path: resolve(
      packageRoot,
      "assets",
      "cockpit",
      "fonts",
      "IBMPlexMono-Regular.woff2",
    ),
    contentType: "font/woff2",
  }],
  ["/assets/fonts/IBMPlexMono-SemiBold.woff2", {
    path: resolve(
      packageRoot,
      "assets",
      "cockpit",
      "fonts",
      "IBMPlexMono-SemiBold.woff2",
    ),
    contentType: "font/woff2",
  }],
  ["/assets/fonts/OFL.txt", {
    path: resolve(packageRoot, "assets", "cockpit", "fonts", "OFL.txt"),
    contentType: "text/plain; charset=utf-8",
  }],
  ["/brand/oh-no-codex-plush-hero.png", {
    path: resolve(
      packageRoot,
      "assets",
      "brand",
      "oh-no-codex-plush-hero.png",
    ),
    contentType: "image/png",
  }],
]);

async function loadStaticAssets(): Promise<Map<string, StaticAsset>> {
  const assets = new Map<string, StaticAsset>();
  await Promise.all(
    [...staticAssetFiles].map(async ([route, asset]) => {
      assets.set(route, {
        bytes: await readFile(asset.path),
        contentType: asset.contentType,
      });
    }),
  );
  return assets;
}

function securityHeaders(response: ServerResponse): void {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self'; style-src 'self'; "
      + "script-src 'self'; font-src 'self'; connect-src 'self'; "
      + "object-src 'none'; base-uri 'none'; form-action 'none'",
  );
}

function sendBytes(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  bytes: Buffer,
  cacheControl: string,
): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", contentType);
  response.setHeader("Content-Length", String(bytes.length));
  response.setHeader("Cache-Control", cacheControl);
  securityHeaders(response);
  if (request.method === "HEAD") {
    response.end();
  } else {
    response.end(bytes);
  }
}

function sendText(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  message: string,
): void {
  sendBytes(
    request,
    response,
    statusCode,
    "text/plain; charset=utf-8",
    Buffer.from(`${message}\n`, "utf8"),
    "no-store",
  );
}

async function handleRequest(
  projectPath: string,
  assets: ReadonlyMap<string, StaticAsset>,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const method = request.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendText(request, response, 405, "Method Not Allowed");
    return;
  }

  const requestUrl = new URL(
    request.url ?? "/",
    "http://127.0.0.1",
  );
  if (requestUrl.pathname === "/api/state") {
    const model = await readModel(projectPath);
    const bytes = Buffer.from(`${JSON.stringify(model)}\n`, "utf8");
    sendBytes(
      request,
      response,
      model.availability === "AVAILABLE" ? 200 : 503,
      "application/json; charset=utf-8",
      bytes,
      "no-store",
    );
    return;
  }

  const asset = assets.get(requestUrl.pathname);
  if (asset === undefined) {
    sendText(request, response, 404, "Not Found");
    return;
  }
  sendBytes(
    request,
    response,
    200,
    asset.contentType,
    asset.bytes,
    requestUrl.pathname === "/" ? "no-store" : "public, max-age=3600",
  );
}

async function listen(server: Server, port: number): Promise<number> {
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const onError = (error: Error) => {
      server.off("listening", onListening);
      rejectPromise(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolvePromise();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen({
      host: "127.0.0.1",
      port,
    });
  });
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Cockpit did not bind a loopback TCP address");
  }
  return (address as AddressInfo).port;
}

export async function startCockpitServer(
  projectPath: string,
  options: { port?: number } = {},
): Promise<RunningCockpit> {
  const assets = await loadStaticAssets();
  const server = createServer((request, response) => {
    void handleRequest(projectPath, assets, request, response).catch(() => {
      if (!response.headersSent) {
        sendText(request, response, 500, "Internal Server Error");
      } else {
        response.destroy();
      }
    });
  });
  server.on("clientError", (_error, socket) => {
    socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
  });

  const requestedPort = options.port ?? 0;
  let port: number;
  try {
    port = await listen(server, requestedPort);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (requestedPort > 0) {
      throw new Error(
        `port ${requestedPort} is unavailable (${message}). `
          + "Try another --port, or: ohno cockpit stop / ohno cockpit --replace",
      );
    }
    throw error;
  }
  const url = `http://127.0.0.1:${port}/`;
  const record = {
    pid: process.pid,
    port,
    url,
    cwd: resolve(projectPath),
    started_at: new Date().toISOString(),
  };
  await writeCockpitRuntime(projectPath, record);

  let closed = false;
  return {
    url,
    close: async () => {
      if (closed) {
        return;
      }
      closed = true;
      server.closeIdleConnections();
      await new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) => {
          if (error === undefined) {
            resolvePromise();
          } else {
            rejectPromise(error);
          }
        });
      });
      const current = await readCockpitRuntime(projectPath);
      if (current?.pid === process.pid) {
        await clearCockpitRuntime(projectPath);
      }
    },
  };
}

export async function runCockpit(
  projectPath: string,
  options: CockpitStartOptions = {},
): Promise<void> {
  await ensureProjectInitialized(projectPath);

  if (!options.replace) {
    const live = await findLiveCockpit(projectPath);
    if (live !== null) {
      process.stdout.write(
        `Cockpit already running: ${live.url}\n`
          + `pid=${live.pid} port=${live.port}\n`
          + "Reuse this URL, or run: ohno cockpit --replace"
          + (options.port !== undefined ? ` --port ${options.port}` : "")
          + "\n"
          + "To free the port: ohno cockpit stop\n",
      );
      return;
    }
  } else {
    const stopped = await stopProjectCockpit(projectPath);
    if (stopped.stopped && stopped.record !== null) {
      process.stdout.write(
        `Replaced previous cockpit pid=${stopped.record.pid} `
          + `port=${stopped.record.port}\n`,
      );
    }
  }

  const listenOptions: { port?: number } = {};
  if (options.port !== undefined) {
    listenOptions.port = options.port;
  }
  const cockpit = await startCockpitServer(projectPath, listenOptions);
  process.stdout.write(`Cockpit: ${cockpit.url}\n`);
  process.stdout.write(
    "Stop: Ctrl+C in this terminal, or from another shell: ohno cockpit stop\n",
  );

  await new Promise<void>((resolvePromise, rejectPromise) => {
    let closing = false;
    const cleanup = () => {
      process.off("SIGINT", stop);
      process.off("SIGTERM", stop);
    };
    const stop = () => {
      if (closing) {
        return;
      }
      closing = true;
      cleanup();
      void cockpit.close().then(resolvePromise, rejectPromise);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}

export async function runCockpitStop(projectPath: string): Promise<void> {
  await ensureProjectInitialized(projectPath);
  const result = await stopProjectCockpit(projectPath);
  if (result.record === null) {
    process.stdout.write(
      "No cockpit runtime recorded for this project "
        + "(.ohno/cockpit.runtime.json missing or stale).\n",
    );
    return;
  }
  if (result.stopped) {
    process.stdout.write(
      `Stopped cockpit pid=${result.record.pid} port=${result.record.port}\n`
        + `Was: ${result.record.url}\n`,
    );
    return;
  }
  process.stdout.write(
    `Cleared stale cockpit record for port=${result.record.port} `
      + `(process already gone).\n`,
  );
}
