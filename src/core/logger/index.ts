import { Logger, ConsoleTransport, FileTransport } from './Logger';
import { Config } from '@/types';

// シングルトンインスタンスの作成
export const logger = new Logger({
    level: 'INFO',
    transports: [new ConsoleTransport()]
});

/**
 * 設定に基づいてロガーを再構成する
 */
export function configureLogger(config: Config) {
    logger.setLevel(config.logLevel || 'INFO');
    logger.clearTransports();
    
    // 常にコンソール出力は有効（ログレベルによるフィルタリングは効く）
    logger.addTransport(new ConsoleTransport());
    
    if (config.enableFileLog && config.logFilePath) {
        logger.addTransport(new FileTransport(config.logFilePath));
    }
}
