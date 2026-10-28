import isEmpty from 'lodash/isEmpty';
import { Observable } from 'rxjs';

import ToolPathGeometryConverter from './GcodeToBufferGeometry/ToolPathGeometryConverter';

type ToolpathRendererData = {
    data: object;
    filenames: string[];
    taskId: string;
    headType: string;
};

const toolpathRenderer = (taskResult: ToolpathRendererData) => {
    return new Observable((observer) => {
        if (isEmpty(taskResult.data)) {
            observer.next({
                status: 'err',
                value: 'Data is empty'
            });
            observer.complete();
            return;
        }

        const { headType } = taskResult;

        const renderAll = async () => {
            const taskTotal = taskResult.data.length;
            const filenames = Array.isArray(taskResult.filenames) ? taskResult.filenames : [];

            for (let i = 0; i < taskTotal; i++) {
                const filename = filenames[i];
                if (!filename) {
                    throw new Error(`Missing toolpath file for index ${i}`);
                }

                console.log(`Generate geometry from tool path, ${filename}`);
                const converter = new ToolPathGeometryConverter();
                const renderResult = await converter.parseAsync(
                    filename,
                    (progress: number) => {
                        observer.next({
                            status: 'progress',
                            headType: headType,
                            value: {
                                progress: (i + progress) / taskTotal,
                            }
                        });
                    },
                );

                observer.next({
                    status: 'data',
                    headType: headType,
                    value: {
                        taskResult: taskResult,
                        index: i,
                        renderResult: renderResult,
                    }
                });
            }

            observer.next({
                status: 'succeed',
                headType: headType,
                value: {
                    taskResult: taskResult,
                }
            });
            observer.complete();
        };

        renderAll().catch((err) => {
            observer.next({
                status: 'err',
                headType: headType,
                value: err,
            });
            observer.complete();
        });
    });
};

export default toolpathRenderer;
