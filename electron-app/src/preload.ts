import { contextBridge, ipcRenderer } from 'electron';

type OrchestratorResult = { success: boolean; output: string; error?: string };

const ENABLE_ORCHESTRATOR = process.env.REMI_ENABLE_ORCHESTRATOR === '1';

async function runOrchestrator(): Promise<OrchestratorResult> {
	if (!ENABLE_ORCHESTRATOR) {
		return { success: false, output: '', error: 'orchestrator disabled (set REMI_ENABLE_ORCHESTRATOR=1 to enable)' };
	}
	try {
		const output = await ipcRenderer.invoke('run-orchestrator');
		return { success: true, output };
	} catch (e: any) {
		return { success: false, output: '', error: e?.message || String(e) };
	}
}

// Expose a minimal, safe API to the renderer
contextBridge.exposeInMainWorld('api', {
	platform: process.platform,
	ping: () => ipcRenderer.invoke('ping') as Promise<string>,
	orchestrate: () => runOrchestrator(),
});
