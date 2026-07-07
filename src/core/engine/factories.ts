import { InboxItem, Task, CommonLink, Note } from "@/types";

// inboxItemを作成
export function createInboxItem(text: string): InboxItem {
    return {
        id: crypto.randomUUID(),
        text,
    };
};

// taskを作成
export function createTask(text: string, date: string): Task {
    return {
        id: crypto.randomUUID(),
        text: text,
        date: date,
        originalDate: date,
        done: false,
    };
}

// commonLinkを作成
export function createCommonLink(title: string, url: string): CommonLink {
    return {
        id: crypto.randomUUID(),
        title,
        url,
    };
}

/** Note の ID を生成する (Pure) */
export function getNoteId(type: 'task' | 'daily', key: string): string {
    const prefix = type === 'task' ? 'task' : 'daily';
    return `${prefix}-${key}`;
}

/** Note オブジェクトを生成する (ID発番ルールもここで隠蔽) */
export function createNote(params: {
    body: string;
    title: string;
    date: string;
    type: 'task' | 'daily';
    taskId?: string;
}): Note {
    const id = getNoteId(params.type, params.taskId || params.date);
    return {
        id,
        ...params
    };
}