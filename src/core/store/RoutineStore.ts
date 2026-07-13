import { JsonListStore } from '@/core/store/BaseStore';
import { RoutineTask } from '@/types';

export class RoutineStore extends JsonListStore<RoutineTask> {
    protected fileName = "routine.json";
    constructor(initialState: RoutineTask[] = []) {
        super(initialState);
    }
}
