import { ChildProcess, fork } from 'child_process';
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { join } from 'path';

export interface BackgroundRemovalResult {
  backgroundRemoved: boolean;
  processedBuffer?: Buffer;
  warning?: string;
}

interface RemovalRequest {
  resolve: (value: BackgroundRemovalResult) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
}

interface WorkerSuccessMessage {
  type: 'success';
  requestId: string;
  processedBase64: string;
}

interface WorkerErrorMessage {
  type: 'error';
  requestId: string;
  warning: string;
}

type WorkerMessage = WorkerSuccessMessage | WorkerErrorMessage;

@Injectable()
export class BackgroundRemovalService implements OnModuleDestroy {
  private readonly logger = new Logger(BackgroundRemovalService.name);
  private readonly modelId: string;
  private readonly timeoutMs: number;
  private readonly workerScriptPath: string;
  private worker: ChildProcess | null = null;
  private readonly pendingRequests = new Map<string, RemovalRequest>();

  constructor(private readonly configService: ConfigService) {
    this.modelId = this.configService.get<string>(
      'HF_BACKGROUND_REMOVAL_MODEL',
      'Xenova/modnet',
    );
    this.timeoutMs = Number(
      this.configService.get<string>('HF_BACKGROUND_REMOVAL_TIMEOUT_MS', '20000'),
    );
    this.workerScriptPath = join(process.cwd(), 'scripts', 'background-removal-worker.cjs');
  }

  async removeBackground(imagePath: string): Promise<BackgroundRemovalResult> {
    try {
      const worker = this.ensureWorker();
      const requestId = randomUUID();

      return await new Promise<BackgroundRemovalResult>((resolve) => {
        const timeoutHandle = setTimeout(() => {
          this.pendingRequests.delete(requestId);
          this.logger.warn('Remocion de fondo omitida: la operacion tardo demasiado.');
          resolve({
            backgroundRemoved: false,
            warning: 'La remocion de fondo tardo demasiado; se usara la imagen original.',
          });
          this.restartWorker();
        }, this.timeoutMs);

        this.pendingRequests.set(requestId, { resolve, timeoutHandle });
        worker.send({
          type: 'remove',
          requestId,
          imagePath,
          modelId: this.modelId,
        });
      });
    } catch (error) {
      const warning = this.readErrorMessage(error);
      this.logger.warn(`Remocion de fondo omitida: ${warning}`);
      return {
        backgroundRemoved: false,
        warning,
      };
    }
  }

  onModuleDestroy(): void {
    this.disposeWorker();
  }

  private ensureWorker(): ChildProcess {
    if (this.worker && this.worker.connected) {
      return this.worker;
    }

    const worker = fork(this.workerScriptPath, [], {
      cwd: process.cwd(),
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: process.env,
    });

    worker.on('message', (message: WorkerMessage) => this.handleWorkerMessage(message));
    worker.on('error', (error) => {
      this.logger.warn(`Worker de remocion de fondo fallo: ${this.readErrorMessage(error)}`);
      this.failAllPending(
        'No fue posible preparar la transparencia; se usara la imagen original.',
      );
      this.worker = null;
    });
    worker.on('exit', () => {
      this.failAllPending(
        'La remocion de fondo no pudo completarse; se usara la imagen original.',
      );
      this.worker = null;
    });

    this.worker = worker;
    return worker;
  }

  private handleWorkerMessage(message: WorkerMessage): void {
    const pending = this.pendingRequests.get(message.requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeoutHandle);
    this.pendingRequests.delete(message.requestId);

    if (message.type === 'success') {
      pending.resolve({
        backgroundRemoved: true,
        processedBuffer: Buffer.from(message.processedBase64, 'base64'),
      });
      return;
    }

    this.logger.warn(`Remocion de fondo omitida: ${message.warning}`);
    pending.resolve({
      backgroundRemoved: false,
      warning: message.warning,
    });
  }

  private failAllPending(warning: string): void {
    for (const [requestId, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeoutHandle);
      pending.resolve({
        backgroundRemoved: false,
        warning,
      });
      this.pendingRequests.delete(requestId);
    }
  }

  private restartWorker(): void {
    this.disposeWorker();
    this.worker = null;
  }

  private disposeWorker(): void {
    if (this.worker && !this.worker.killed) {
      this.worker.kill();
    }
  }

  private readErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message.trim();
    }

    return 'No fue posible preparar la transparencia; se usara la imagen original.';
  }
}
