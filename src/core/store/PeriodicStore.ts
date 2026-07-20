import { JsonListStore } from '@/core/store/BaseStore';
import { PeriodicTask } from '@/types';

export class PeriodicStore extends JsonListStore<PeriodicTask> {
    protected fileName = "periodic.json";
    constructor(initialState: PeriodicTask[] = []) {
        super(initialState);
    }
}
