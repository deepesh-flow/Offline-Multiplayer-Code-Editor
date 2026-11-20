/**
 * Client-side helper for Google Stitch integration.
 * Connects to both the backend Stitch proxy and supports local mock/offline previews.
 */

const BACKEND_URL = (import.meta.env.VITE_WS_URL || 'http://localhost:1234')
  .replace(/^ws:\/\//, 'http://')
  .replace(/^wss:\/\//, 'https://');

const STORAGE_KEYS = {
  API_KEY: 'multicode_stitch_api_key',
  ACCESS_TOKEN: 'multicode_stitch_access_token',
  PROJECT_ID: 'multicode_stitch_project_id',
};

export function getStitchAuth() {
  return {
    apiKey: localStorage.getItem(STORAGE_KEYS.API_KEY) || '',
    accessToken: localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN) || '',
    projectId: localStorage.getItem(STORAGE_KEYS.PROJECT_ID) || '',
  };
}

export function saveStitchAuth({ apiKey, accessToken, projectId }) {
  if (apiKey !== undefined) localStorage.setItem(STORAGE_KEYS.API_KEY, apiKey.trim());
  if (accessToken !== undefined) localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken.trim());
  if (projectId !== undefined) localStorage.setItem(STORAGE_KEYS.PROJECT_ID, projectId.trim());
}

/**
 * Check backend Stitch proxy health & capabilities
 */
export async function checkStitchBackendStatus() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/stitch/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      sdkLoaded: false,
      serverEnvConfigured: false,
      error: err.message,
    };
  }
}

/**
 * Call a Stitch Tool through the backend proxy
 */
export async function invokeStitchTool(toolName, args = {}) {
  const auth = getStitchAuth();
  const res = await fetch(`${BACKEND_URL}/api/stitch/call`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-stitch-api-key': auth.apiKey,
      'x-stitch-access-token': auth.accessToken,
    },
    body: JSON.stringify({
      toolName,
      args,
      config: {
        projectId: auth.projectId || undefined,
      },
    }),
  });

  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Stitch API request failed (${res.status})`);
  }
  return data.result;
}

/**
 * Curated high-fidelity UI templates for instant offline design generation
 */
export const OFFLINE_STITCH_TEMPLATES = {
  'mobile-auth': {
    title: 'Mobile Auth / Sign In Screen',
    device: 'MOBILE',
    filename: 'auth_screen.html',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login & Authentication</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center p-4">
  <div class="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl">
    <div class="text-center mb-8">
      <div class="inline-flex p-3 bg-blue-600/20 text-blue-400 rounded-xl mb-3 text-2xl">⚡</div>
      <h1 class="text-2xl font-bold text-white tracking-tight">Welcome Back</h1>
      <p class="text-sm text-slate-400 mt-1">Sign in to your collaborative workspace</p>
    </div>

    <form class="space-y-4" onsubmit="event.preventDefault(); alert('Signed in!');">
      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Email</label>
        <input type="email" required placeholder="developer@hostel.edu"
          class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white placeholder-slate-500 transition" />
      </div>

      <div>
        <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Password</label>
        <input type="password" required placeholder="••••••••••••"
          class="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white placeholder-slate-500 transition" />
      </div>

      <div class="flex items-center justify-between text-xs">
        <label class="flex items-center gap-2 cursor-pointer text-slate-300">
          <input type="checkbox" class="rounded bg-slate-900 border-slate-700 text-blue-500" />
          Remember me
        </label>
        <a href="#" class="text-blue-400 hover:underline">Forgot?</a>
      </div>

      <button type="submit"
        class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg text-sm shadow-lg shadow-blue-500/20 transition duration-150">
        Sign In
      </button>
    </form>
  </div>
</body>
</html>`,
  },

  'desktop-dashboard': {
    title: 'SaaS Analytics Dashboard',
    device: 'DESKTOP',
    filename: 'dashboard_screen.html',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cloud Metrics Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-neutral-950 text-neutral-100 min-h-screen">
  <div class="flex h-screen overflow-hidden">
    <!-- Sidebar -->
    <aside class="w-64 bg-neutral-900 border-r border-neutral-800 p-4 flex flex-col justify-between">
      <div>
        <div class="flex items-center gap-3 px-2 mb-8">
          <span class="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">StitchUI</span>
          <span class="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">Pro</span>
        </div>
        <nav class="space-y-1">
          <a href="#" class="flex items-center gap-3 px-3 py-2 rounded-lg bg-neutral-800 text-white font-medium text-sm">📊 Overview</a>
          <a href="#" class="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition text-sm">👥 Team</a>
          <a href="#" class="flex items-center gap-3 px-3 py-2 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition text-sm">⚙️ Settings</a>
        </nav>
      </div>
      <div class="p-3 bg-neutral-800/60 rounded-xl border border-neutral-700/50 text-xs text-neutral-400">
        <p class="font-medium text-white mb-1">Hostel Sync Engine</p>
        <p>CRDT Yjs state: Synced</p>
      </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 overflow-y-auto p-8">
      <header class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-2xl font-bold text-white">System Performance</h1>
          <p class="text-sm text-neutral-400">Real-time metrics from peer-to-peer collaboration mesh</p>
        </div>
        <button class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-lg shadow-blue-500/20">
          + New Deployment
        </button>
      </header>

      <!-- Stat Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
          <div class="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">Active Peers</div>
          <div class="text-3xl font-bold text-white">4 Peers</div>
          <div class="text-xs text-emerald-400 mt-2">↑ 100% convergence</div>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
          <div class="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">Merge Latency</div>
          <div class="text-3xl font-bold text-white">12 ms</div>
          <div class="text-xs text-emerald-400 mt-2">IndexedDB cached</div>
        </div>
        <div class="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
          <div class="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">Conflict Rate</div>
          <div class="text-3xl font-bold text-white">0.00%</div>
          <div class="text-xs text-blue-400 mt-2">Mathematical CRDT proof</div>
        </div>
      </div>
    </main>
  </div>
</body>
</html>`,
  },

  'component-chat': {
    title: 'Modern Multiplayer Chat Component',
    device: 'AGNOSTIC',
    filename: 'chat_component.html',
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Multiplayer Chat Component</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-zinc-950 text-zinc-100 p-6 flex justify-center items-center min-h-screen">
  <div class="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl flex flex-col h-[520px]">
    <div class="p-4 border-b border-zinc-800 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
        <div>
          <h2 class="font-semibold text-sm text-white">Project Room Chat</h2>
          <p class="text-xs text-zinc-400">Collaborative Awareness</p>
        </div>
      </div>
      <span class="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded">Y.Doc Synced</span>
    </div>

    <div class="flex-1 p-4 space-y-3 overflow-y-auto text-sm">
      <div class="flex flex-col items-start">
        <span class="text-[10px] text-blue-400 font-medium mb-1">Coder Panda</span>
        <div class="bg-zinc-800 border border-zinc-700/60 rounded-xl rounded-tl-none px-3.5 py-2 text-zinc-200">
          Hey team, pushed the new vector merge logic!
        </div>
      </div>

      <div class="flex flex-col items-end">
        <span class="text-[10px] text-purple-400 font-medium mb-1">You</span>
        <div class="bg-blue-600 rounded-xl rounded-tr-none px-3.5 py-2 text-white">
          Awesome! Offline testing in IndexedDB works flawlessly.
        </div>
      </div>
    </div>

    <div class="p-3 border-t border-zinc-800">
      <form class="flex gap-2" onsubmit="event.preventDefault();">
        <input type="text" placeholder="Type collaborative message..."
          class="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 text-white placeholder-zinc-500" />
        <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition">
          Send
        </button>
      </form>
    </div>
  </div>
</body>
</html>`,
  },
};
