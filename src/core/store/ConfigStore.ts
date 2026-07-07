import { JsonObjectStore } from '@/core/store/BaseStore';
import { Config } from '@/types';

export class ConfigStore extends JsonObjectStore<Config> {
    protected fileName = "config.json";
    constructor(initialState: Config = {}) {
        super(initialState);
    }
}