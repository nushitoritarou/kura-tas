
import { CommonLinkStore } from '@/core/store/CommonLinkStore';
import * as factories from "@/core/engine/factories";

interface LinksDeps {
    commonLinks: CommonLinkStore;
}

export async function addLink(title: string, url: string, deps: LinksDeps) {
    if (!title) throw new Error('タイトルを入力してください');
    if (!url) throw new Error('URLを入力してください');

    // URL形式の簡易バリデーション
    try {
        new URL(url);
    } catch (e) {
        throw new Error('不正なURL形式です');
    }

    await deps.commonLinks.add(factories.createCommonLink(title, url));
}

export async function deleteLink(id: string, deps: LinksDeps) {
    await deps.commonLinks.remove(id);
}
