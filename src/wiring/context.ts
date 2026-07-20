/**
 * Wiringモジュール共通のコンテキスト型定義
 */
import { StoreRegistry } from '@/core/store';

export interface WiringContext {
  store: StoreRegistry;
  dispatchAction: (
    action: () => Promise<void>,
    options?: { recordHistory?: boolean }
  ) => Promise<void>;
}
