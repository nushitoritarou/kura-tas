import { LogLevel } from '@/types';
import { storage } from '@/core/storage';

export interface Transport {
    log(level: LogLevel, message: string, ...args: any[]): void;
}

export class ConsoleTransport implements Transport {
    log(level: LogLevel, message: string, ...args: any[]): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] [${level}] ${message}`;
        
        switch (level) {
            case 'DEBUG':
                console.debug(formattedMessage, ...args);
                break;
            case 'INFO':
                console.info(formattedMessage, ...args);
                break;
            case 'WARN':
                console.warn(formattedMessage, ...args);
                break;
            case 'ERROR':
                console.error(formattedMessage, ...args);
                break;
        }
    }
}

export class FileTransport implements Transport {
    constructor(private logFilePath: string) {}

    log(level: LogLevel, message: string, ...args: any[]): void {
        const timestamp = new Date().toISOString();
        const argString = args.length > 0 ? ' ' + args.map(a => {
            if (a instanceof Error) {
                return a.stack || a.message;
            }
            if (typeof a === 'object' && a !== null) {
                try {
                    return JSON.stringify(a);
                } catch (e) {
                    return '[Unserializable Object]';
                }
            }
            return String(a);
        }).join(' ') : '';
        const formattedMessage = `[${timestamp}] [${level}] ${message}${argString}\n`;
        
        // TODO: ログ出力が多発してパフォーマンスに影響が出る場合は、
        // メモリバッファリングと定期的なフラッシュを検討すること。
        storage.appendText(this.logFilePath, formattedMessage).catch(err => {
            console.error('Failed to write log to file:', err);
        });
    }
}

export class Logger {
    private transports: Transport[] = [];
    private level: LogLevel = 'INFO';
    private levelPriority: Record<LogLevel, number> = {
        'DEBUG': 0,
        'INFO': 1,
        'WARN': 2,
        'ERROR': 3
    };

    constructor(options?: { level?: LogLevel, transports?: Transport[] }) {
        if (options?.level) this.level = options.level;
        if (options?.transports) this.transports = options.transports;
    }

    setLevel(level: LogLevel) {
        this.level = level;
    }

    addTransport(transport: Transport) {
        this.transports.push(transport);
    }

    clearTransports() {
        this.transports = [];
    }

    private shouldLog(level: LogLevel): boolean {
        return this.levelPriority[level] >= this.levelPriority[this.level];
    }

    debug(message: string, ...args: any[]) {
        if (this.shouldLog('DEBUG')) {
            this.transports.forEach(t => t.log('DEBUG', message, ...args));
        }
    }

    info(message: string, ...args: any[]) {
        if (this.shouldLog('INFO')) {
            this.transports.forEach(t => t.log('INFO', message, ...args));
        }
    }

    warn(message: string, ...args: any[]) {
        if (this.shouldLog('WARN')) {
            this.transports.forEach(t => t.log('WARN', message, ...args));
        }
    }

    error(message: string, ...args: any[]) {
        if (this.shouldLog('ERROR')) {
            this.transports.forEach(t => t.log('ERROR', message, ...args));
        }
    }
}
