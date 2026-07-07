import { JsonListStore } from '@/core/store/BaseStore';
import { CommonLink } from '@/types';

export class CommonLinkStore extends JsonListStore<CommonLink> {
    protected fileName = "links.json";
    constructor(initialState: CommonLink[] = []) {
        super(initialState);
    }
}
