import { InboxItem, Task } from "@/types";
import * as factories from "@/core/engine/factories";

/** Task と InboxItem を相互に変換するユーティリティ関数群 */
export function convertInboxItemToTask(inboxItem: InboxItem, date: string): Task {
    return factories.createTask(inboxItem.text, date);
};

export function convertTaskToInboxItem(task: Task): InboxItem {
    return factories.createInboxItem(task.text);
};
