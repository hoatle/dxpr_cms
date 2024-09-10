import { PhpCgiWorker } from "./PhpCgiWorker.mjs";
import {getBroadcastChannel} from "./utils.mjs";
import CookieMap from "./cookie-map.mjs";

// Fibers are not yet supported in the Wasm runtime.
// Instead of uninstalling BigPipe, set the `big_pipe_nojs` cookie which disables its functionality.
// This will make it easier to export the trial experience in the future.
const cookies = new CookieMap([
  ['big_pipe_nojs', '1']
]);

const onRequest = (request, response) => {
    const url = new URL(request.url);
    const logLine =
        `[${new Date().toISOString()}]` +
        ` 127.0.0.1 - "${request.method}` +
        ` ${url.pathname}" - HTTP/1.1 ${response.status}`;
    console.log(logLine);
};
const notFound = (request) => {
    console.log(request)
    return new Response(`<body><h1>404</h1>${request.url} not found</body>`, {
        status: 404,
        headers: {"Content-Type": "text/html"},
    });
};

const sharedLibs = [
    `php\${PHP_VERSION}-zlib.so`,
    `php\${PHP_VERSION}-zip.so`,
    `php\${PHP_VERSION}-iconv.so`,
    `php\${PHP_VERSION}-gd.so`,
    `php\${PHP_VERSION}-dom.so`,
    `php\${PHP_VERSION}-mbstring.so`,
    `php\${PHP_VERSION}-sqlite.so`,
    `php\${PHP_VERSION}-pdo-sqlite.so`,
    `php\${PHP_VERSION}-xml.so`,
    `php\${PHP_VERSION}-simplexml.so`,
];

export class DrupalCgiWorker extends PhpCgiWorker {
    // @todo `docroot` doesn't really work, requires vHosts.
    constructor({docroot, prefix, types = {}, ...args}) {
        super({
            onRequest,
            notFound,
            sharedLibs,
            docroot,
            prefix,
            types: {
                jpeg: "image/jpeg",
                jpg: "image/jpeg",
                gif: "image/gif",
                png: "image/png",
                svg: "image/svg+xml",
                ...types
            },
            cookies,
            ...args,
        });
    }
}

export function setUpWorker(worker, prefix, docroot) {
    const php = new DrupalCgiWorker({
        prefix,
        docroot,
        env: {
            HTTP_USER_AGENT: worker.navigator.userAgent,
            DXPR_CMS_TRIAL: '1'
        },
        ini: `
        date.timezone=${Intl.DateTimeFormat().resolvedOptions().timeZone}
        `
    })

    const channel = getBroadcastChannel()
    channel.addEventListener('message', async ({ data }) => {
        const { action, params } = data;
        if (action === 'refresh') {
            await navigator.locks.request('cgi-worker-action', async () => {
                console.log('Refreshing CGI')
                php.refresh();
            });
        }
        if (action === 'set_vhost') {
            await navigator.locks.request('cgi-worker-action', async () => {
                const vHost = {
                    pathPrefix: `/cgi/${params.flavor}`,
                    directory: `/persist/${params.flavor}/web`,
                    entrypoint: 'index.php',
                };
                const settings = await php.getSettings();
                const vHostExists = settings.vHosts.find(existing => existing.pathPrefix === vHost.pathPrefix);

                if (!vHostExists) {
                    settings.vHosts.push(vHost)
                    await php.setSettings(settings)
                    await php.storeInit()
                }
            });
        }
        else if (action === 'set_cookie') {
            await navigator.locks.request('cgi-worker-action', async () => {
                cookies.set(params.name, params.id)
            });
        }
    })

    worker.addEventListener('install',  event => php.handleInstallEvent(event));
    worker.addEventListener('activate', event => php.handleActivateEvent(event));
    worker.addEventListener('activate', () => {
        channel.postMessage({
            action: 'service_worker_activated'
        })
    });
    worker.addEventListener('fetch',    event => php.handleFetchEvent(event));
    worker.addEventListener('message',  event => php.handleMessageEvent(event));

    return php
}
