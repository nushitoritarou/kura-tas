import { JsonListStore } from '@/core/store/BaseStore';
import { InboxItem } from '@/types';

export class InboxItemStore extends JsonListStore<InboxItem> {
    protected fileName = "inbox.json";
    constructor(initialState: InboxItem[] = []) {
        super(initialState);
    }
}