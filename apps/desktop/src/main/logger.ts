import { parentPort } from 'node:worker_threads';

export interface LogItem {
	level: string;
	context: string;
	message: string;
	args: any[];
}

type LogListener = (level: string, context: string, message: string, ...args: any[]) => void;

let listener: LogListener | null = null;

export class Logger {
	constructor(private context: string) { }

	static setListener(l: LogListener) {
		listener = l;
	}

	private log(level: string, message: string, ...args: any[]) {
		const timestamp = new Date().toISOString();
		const formattedMessage = `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`;

		// Local console log
		if (level === 'error') console.error(formattedMessage, ...args);
		else if (level === 'warn') console.warn(formattedMessage, ...args);
		else if (level === 'debug') console.debug(formattedMessage, ...args);
		else console.log(formattedMessage, ...args);

		// If we're in a worker, send to parent
		if (parentPort) {
			parentPort.postMessage({
				type: 'worker:log',
				payload: { level, context: this.context, message, args }
			});
		}

		// Notify local listener (usually in main process)
		listener?.(level, this.context, message, ...args);
	}

	info(message: string, ...args: any[]) {
		this.log('info', message, ...args);
	}

	error(message: string, ...args: any[]) {
		this.log('error', message, ...args);
	}

	warn(message: string, ...args: any[]) {
		this.log('warn', message, ...args);
	}

	debug(message: string, ...args: any[]) {
		this.log('debug', message, ...args);
	}
}

export const logger = new Logger('App');
