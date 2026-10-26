import log from './log';
import UniApi from './uni-api';

const EDITOR_READY_EVENT = 'appbar-menu:editor-ready';
const EDITOR_READY_TIMEOUT_MS = 20000;

/**
 * The editor page emits this after its one-time init finishes.
 * Project open waits for that signal so recovery does not land in an
 * unmounted canvas, or get cleared by init afterwards.
 */
export function notifyEditorReady(headType: string, token?: string): void {
    if (!token) {
        return;
    }
    UniApi.Event.emit(EDITOR_READY_EVENT, headType, token);
}

export async function waitForEditorReady(headType: string, token: string): Promise<void> {
    await new Promise<void>((resolve) => {
        let settled = false;
        let timer: ReturnType<typeof setTimeout>;
        let onReady: (readyHeadType: string, readyToken: string) => void = () => undefined;

        const finish = (timedOut: boolean) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            UniApi.Event.off(EDITOR_READY_EVENT, onReady);
            if (timedOut) {
                log.warn(`Editor was not ready for ${headType} project open before timeout`);
            }
            resolve();
        };

        onReady = (readyHeadType: string, readyToken: string) => {
            if (readyHeadType === headType && readyToken === token) {
                finish(false);
            }
        };

        timer = setTimeout(() => {
            finish(true);
        }, EDITOR_READY_TIMEOUT_MS);
        UniApi.Event.on(EDITOR_READY_EVENT, onReady);
    });
}
