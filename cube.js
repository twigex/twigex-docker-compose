// Cube.js configuration for the shared, multi-tenant Collimato analytics backend.
//
// A single Cube.js deployment serves every Collimato workspace. It holds no
// per-workspace files or database credentials of its own — instead it resolves
// everything at query time by calling back into twigex's internal Cube API,
// keyed on the workspaceId carried in the JWT that twigex signs and sends.
//
// Required environment variables:
//   CUBEJS_API_SECRET     shared secret that verifies the JWT from twigex.
//                         Must equal twigex TWIGEX_COLLIMATO_CUBE_API_SECRET.
//   TWIGEX_INTERNAL_URL  base URL of twigex's internal Cube API, e.g.
//                         http://twigex:3000/api/internal/cube (private network).
//   CUBE_CALLBACK_SECRET  shared secret sent back to twigex on every callback.
//                         Must equal twigex TWIGEX_COLLIMATO_CUBE_CALLBACK_SECRET.
//
// Optional:
//   CUBE_DEBUG            set to "false" to silence [cube:debug] lines.
//                         Defaults to on. Errors are always printed.
//   CUBE_DB_CONNECT_TIMEOUT_MS  how long to wait for a source database to accept
//                         a connection. Default 15000.

const TWIGEX_URL = process.env.TWIGEX_INTERNAL_URL;
const CALLBACK_SECRET = process.env.CUBE_CALLBACK_SECRET;
const CONNECT_TIMEOUT_MS = Number(process.env.CUBE_DB_CONNECT_TIMEOUT_MS) || 15000;

// Node tls options. pg hands these to tls.connect unchanged, so the identity
// check is replaced with a no-op for verify-ca. mysql2 does not: it reads only
// rejectUnauthorized and verifyIdentity off this object and overwrites
// checkServerIdentity itself, defaulting to no hostname check. verify-full has to
// ask for that check explicitly there, or it silently degrades to verify-ca.
const sslOption = (mode, ca, type) => {
  const trust = ca ? { ca } : {};

  switch (mode) {
    case 'require':
      return { rejectUnauthorized: false };
    case 'verify-ca':
      return { ...trust, rejectUnauthorized: true, checkServerIdentity: () => undefined };
    case 'verify-full':
      // The other modes are driver independent: an unmapped driver can only end
      // up stricter than asked, which fails visibly. This one can end up quieter
      // than asked, so a driver we have not checked is refused rather than
      // guessed at. Adding one means reading its source to find whether it hands
      // this object to tls.connect or reads its own keys off it.
      if (type === 'mysql') {
        return { ...trust, rejectUnauthorized: true, verifyIdentity: true };
      }
      if (type === 'postgres') {
        return { ...trust, rejectUnauthorized: true };
      }
      throw new Error(`sslOption: no verified TLS mapping for driver "${type}"`);
    default:
      return false;
  }
};

// Debug is on by default so you get visibility in dev; set CUBE_DEBUG=false to mute.
const DEBUG = process.env.CUBE_DEBUG !== 'false';

function debug(...args) {
  if (DEBUG) console.log('[cube:debug]', new Date().toISOString(), ...args);
}

// logError prints a scope, any structured context, and the full stack trace so
// you can see exactly where and why something failed.
function logError(scope, err, context) {
  console.error(`[cube:error] ${scope}`);
  if (context && Object.keys(context).length) {
    console.error('  context:', JSON.stringify(context));
  }
  console.error('  ', err && err.stack ? err.stack : String(err));
}

// Warn early if the env isn't wired up — a common source of confusing failures.
if (!TWIGEX_URL) console.warn('[cube:warn] TWIGEX_INTERNAL_URL is not set');
if (!CALLBACK_SECRET) console.warn('[cube:warn] CUBE_CALLBACK_SECRET is not set');

// callCospace performs an authenticated GET against a twigex internal endpoint.
async function callCospace(pathname, params) {
  const url = new URL(TWIGEX_URL + pathname);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  debug(`→ GET ${url.pathname}${url.search}`);
  const started = Date.now();

  let res;
  try {
    res = await fetch(url, {
      headers: { 'X-Cube-Callback-Secret': CALLBACK_SECRET },
    });
  } catch (err) {
    // Network-level failure (DNS, connection refused, TLS, etc.) — fetch throws
    // before any response exists.
    logError(`callCospace ${pathname} (network)`, err, { url: url.toString() });
    throw err;
  }

  const ms = Date.now() - started;

  if (!res.ok) {
    // Capture the response body — twigex's actual error message usually lives
    // here, and it's lost if you only look at the status code.
    let body = '';
    try {
      body = await res.text();
    } catch (_) {
      body = '<unreadable response body>';
    }
    const err = new Error(`cospace ${pathname} responded ${res.status}`);
    logError(`callCospace ${pathname}`, err, {
      status: res.status,
      ms,
      body: body.slice(0, 1000),
    });
    throw err;
  }

  let json;
  try {
    json = await res.json();
  } catch (err) {
    logError(`callCospace ${pathname} (invalid JSON)`, err, { status: res.status, ms });
    throw err;
  }

  debug(`← ${res.status} ${pathname} (${ms}ms)`);
  return json;
}

module.exports = {
  // Isolate each workspace's compiled data model and its orchestrator (query
  // cache + pre-aggregations), so tenants never share compiled schema or state.
  contextToAppId: ({ securityContext }) => {
    const id = `ws_${securityContext.workspaceId}`;
    debug('contextToAppId', { workspaceId: securityContext.workspaceId, appId: id });
    return id;
  },

  // connVersion busts the orchestrator (connection pool) when a connection is
  // edited, so driverFactory re-runs with the new credentials — no restart.
  contextToOrchestratorId: ({ securityContext }) => {
    const id = `ws_${securityContext.workspaceId}_c${securityContext.connVersion}`;
    debug('contextToOrchestratorId', {
      workspaceId: securityContext.workspaceId,
      connVersion: securityContext.connVersion,
      orchestratorId: id,
    });
    return id;
  },

  // Serve the workspace's cube/view definitions from twigex (backed by the DB).
  repositoryFactory: ({ securityContext }) => ({
    dataSchemaFiles: async () => {
      const workspaceId = securityContext.workspaceId;
      debug('dataSchemaFiles: fetching schema', { workspaceId });
      try {
        const files = await callCospace('/schema', { workspace: workspaceId });
        debug('dataSchemaFiles: received', {
          workspaceId,
          count: files.length,
          fileNames: files.map((f) => f.fileName),
        });
        return files.map((f) => ({ fileName: f.fileName, content: f.content }));
      } catch (err) {
        logError('dataSchemaFiles', err, { workspaceId });
        throw err;
      }
    },
  }),

  // Poll for changes: when a workspace edits a file in the twigex GUI this value
  // changes and Cube hot-reloads the model — no restart, no redeploy.
  schemaVersion: async ({ securityContext }) => {
    const workspaceId = securityContext.workspaceId;
    try {
      const { version } = await callCospace('/schema-version', { workspace: workspaceId });
      debug('schemaVersion', { workspaceId, version: String(version) });
      return String(version);
    } catch (err) {
      logError('schemaVersion', err, { workspaceId });
      throw err;
    }
  },

  // Resolve the database driver for a workspace + dataSource at query time. An
  // empty/"default" dataSource selects the workspace's default connection.
  // Returning a DriverConfig ({ type, ... }) replaces the removed `dbType`
  // option (Cube v1.7.0+).
  driverFactory: async ({ securityContext, dataSource }) => {
    const workspaceId = securityContext.workspaceId;
    debug('driverFactory: resolving connection', { workspaceId, dataSource });
    try {
      const conn = await callCospace('/connection', {
        workspace: workspaceId,
        dataSource,
      });

      // Log the resolved connection but NEVER the password.
      debug('driverFactory: resolved', {
        workspaceId,
        dataSource,
        type: conn.type,
        host: conn.host,
        port: conn.port,
        database: conn.database,
        user: conn.user,
        password: conn.password ? '<redacted>' : '<empty>',
      });

      return {
        type: conn.type,
        host: conn.host,
        port: Number(conn.port),
        database: conn.database,
        user: conn.user,
        password: conn.password,
        ssl: sslOption(conn.ssl_mode, conn.ssl_ca, conn.type),
        // Bounded so an unreachable DB surfaces as "connect ETIMEDOUT" instead of
        // hanging into a 504. Generous by default: a server doing a reverse DNS
        // lookup on the client IP can take seconds to answer a working connection,
        // and a timeout here is indistinguishable from unreachable.
        connectTimeout: CONNECT_TIMEOUT_MS,
      };
    } catch (err) {
      logError('driverFactory', err, { workspaceId, dataSource });
      throw err;
    }
  },
};
