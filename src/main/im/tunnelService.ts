/**
 * Tunnel Service - 内网穿透服务
 *
 * 提供通用的内网穿透能力，将本地端口映射到公网。
 * 目前支持 ngrok，后续可扩展 cloudflare tunnel、localtunnel 等。
 *
 * 使用方式：
 * 1. 配置 TunnelConfig（provider、authToken 等）
 * 2. 调用 start(targetPort) 启动隧道
 * 3. 获取 publicUrl 用于回调配置
 * 4. 调用 stop() 停止隧道
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import {
  TunnelConfig,
  TunnelStatus,
  TunnelProvider,
  DEFAULT_TUNNEL_CONFIG,
  DEFAULT_TUNNEL_STATUS,
} from './types';

export class TunnelService extends EventEmitter {
  private config: TunnelConfig;
  private status: TunnelStatus;
  private ngrokProcess: ChildProcess | null = null;
  private apiServer: http.Server | null = null;
  private log: (...args: unknown[]) => void = () => {};

  constructor(config?: Partial<TunnelConfig>) {
    super();
    this.config = { ...DEFAULT_TUNNEL_CONFIG, ...config };
    this.status = { ...DEFAULT_TUNNEL_STATUS };
  }

  /**
   * 设置日志函数
   */
  setLogger(logFn: (...args: unknown[]) => void): void {
    this.log = logFn;
  }

  /**
   * 获取当前状态
   */
  getStatus(): TunnelStatus {
    return { ...this.status };
  }

  /**
   * 获取配置
   */
  getConfig(): TunnelConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TunnelConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 启动隧道
   * @param targetPort 本地目标端口
   * @returns 公网 URL
   */
  async start(targetPort: number): Promise<string> {
    console.log('[Tunnel] start() called, targetPort:', targetPort);
    console.log('[Tunnel] current config:', JSON.stringify(this.config));
    console.log('[Tunnel] current status:', JSON.stringify(this.status));

    if (this.status.running) {
      this.log('[Tunnel] Tunnel already running');
      return this.status.publicUrl || '';
    }

    // provider 为 'none' 时不允许启动
    if (this.config.provider === 'none') {
      const error = 'Tunnel provider is set to "none". Please configure a valid provider.';
      console.error('[Tunnel]', error);
      throw new Error(error);
    }

    this.log(`[Tunnel] Starting ${this.config.provider} tunnel for port ${targetPort}`);
    console.log(`[Tunnel] Starting ${this.config.provider} tunnel for port ${targetPort}`);

    try {
      switch (this.config.provider) {
        case 'ngrok':
          return await this.startNgrok(targetPort);
        case 'cloudflare':
          return await this.startCloudflare(targetPort);
        case 'localtunnel':
          return await this.startLocaltunnel(targetPort);
        default:
          throw new Error(`Unsupported tunnel provider: ${this.config.provider}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.status.error = errorMessage;
      this.status.running = false;
      this.log('[Tunnel] Failed to start tunnel:', errorMessage);
      this.emit('error', errorMessage);
      throw error;
    }
  }

  /**
   * 停止隧道
   */
  async stop(): Promise<void> {
    if (!this.status.running) {
      return;
    }

    this.log('[Tunnel] Stopping tunnel...');

    // 停止 ngrok 进程
    if (this.ngrokProcess) {
      try {
        this.ngrokProcess.kill();
        this.ngrokProcess = null;
      } catch (error) {
        this.log('[Tunnel] Error killing ngrok process:', error);
      }
    }

    // 停止 API 服务器
    if (this.apiServer) {
      await new Promise<void>((resolve) => {
        this.apiServer?.close(() => resolve());
      });
      this.apiServer = null;
    }

    this.status.running = false;
    this.status.publicUrl = null;
    this.status.localUrl = null;
    this.status.startedAt = null;
    this.status.error = null;

    this.log('[Tunnel] Tunnel stopped');
    this.emit('stopped');
  }

  /**
   * 启动 ngrok 隧道
   */
  private async startNgrok(targetPort: number): Promise<string> {
    console.log('[Tunnel] startNgrok() called for port:', targetPort);

    return new Promise((resolve, reject) => {
      // 构建 ngrok 命令参数
      const args = ['http', targetPort.toString(), '--log=stdout'];

      // 添加 region
      if (this.config.region) {
        args.push(`--region=${this.config.region}`);
      }

      // 添加 auth token（如果配置了）
      if (this.config.ngrokAuthToken) {
        args.push(`--authtoken=${this.config.ngrokAuthToken}`);
      }

      // 确定 ngrok 可执行文件路径
      const ngrokPath = this.config.ngrokPath || 'ngrok';

      console.log(`[Tunnel] Running: ${ngrokPath} ${args.join(' ')}`);
      this.log(`[Tunnel] Running: ${ngrokPath} ${args.join(' ')}`);

      // 启动 ngrok 进程
      try {
        this.ngrokProcess = spawn(ngrokPath, args, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        console.log('[Tunnel] ngrok process spawned, PID:', this.ngrokProcess.pid);
      } catch (spawnError) {
        const errorMsg = spawnError instanceof Error ? spawnError.message : String(spawnError);
        console.error('[Tunnel] Failed to spawn ngrok:', errorMsg);
        reject(new Error(`Failed to spawn ngrok: ${errorMsg}`));
        return;
      }

      let resolved = false;
      let publicUrl = '';

      // 处理 stdout
      this.ngrokProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log('[ngrok stdout]', output.trim());
        this.log('[ngrok]', output.trim());

        // 解析公网 URL（ngrok 日志中会显示）
        const urlMatch = output.match(/url=(https:\/\/[^\s]+)/);
        if (urlMatch && !resolved) {
          publicUrl = urlMatch[1];
          console.log('[Tunnel] Found URL in stdout:', publicUrl);
        }
      });

      // 处理 stderr
      this.ngrokProcess.stderr?.on('data', (data: Buffer) => {
        console.error('[ngrok stderr]', data.toString().trim());
        this.log('[ngrok stderr]', data.toString().trim());
      });

      // 处理进程错误
      this.ngrokProcess.on('error', (error: Error) => {
        console.error('[Tunnel] ngrok process error:', error.message);
        this.log('[Tunnel] ngrok process error:', error.message);
        if (!resolved) {
          resolved = true;
          reject(new Error(`Failed to start ngrok: ${error.message}. Please ensure ngrok is installed and in PATH.`));
        }
      });

      // 处理进程退出
      this.ngrokProcess.on('close', (code: number) => {
        console.log(`[Tunnel] ngrok process exited with code ${code}`);
        this.log(`[Tunnel] ngrok process exited with code ${code}`);
        if (!resolved) {
          resolved = true;
          reject(new Error(`ngrok exited unexpectedly with code ${code}`));
        }
      });

      // 通过 ngrok API 获取隧道 URL
      // ngrok 启动后会在 4040 端口提供 API
      console.log('[Tunnel] Will fetch ngrok URL from API...');
      this.fetchNgrokUrl(targetPort)
        .then((url) => {
          console.log('[Tunnel] Got URL from API:', url);
          if (!resolved) {
            resolved = true;
            this.updateStatus(url, targetPort);
            resolve(url);
          }
        })
        .catch((error) => {
          console.error('[Tunnel] Failed to fetch URL from API:', error);
          if (!resolved) {
            resolved = true;
            reject(error);
          }
        });
    });
  }

  /**
   * 通过 ngrok API 获取隧道 URL
   */
  private async fetchNgrokUrl(targetPort: number, retries = 10, delay = 1000): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        const url = await new Promise<string>((resolve, reject) => {
          const req = http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                const tunnels = JSON.parse(data);
                // 找到对应端口的隧道
                const tunnel = tunnels.tunnels?.find(
                  (t: { config: { addr: string } }) =>
                    t.config.addr === `http://localhost:${targetPort}` ||
                    t.config.addr === `https://localhost:${targetPort}` ||
                    t.config.addr === `:${targetPort}`
                );
                if (tunnel?.public_url) {
                  resolve(tunnel.public_url);
                } else if (tunnels.tunnels?.[0]?.public_url) {
                  // 如果没找到精确匹配，使用第一个隧道
                  resolve(tunnels.tunnels[0].public_url);
                } else {
                  reject(new Error('No tunnel found'));
                }
              } catch {
                reject(new Error('Failed to parse ngrok API response'));
              }
            });
          });
          req.on('error', reject);
          req.setTimeout(5000, () => {
            req.destroy();
            reject(new Error('Timeout'));
          });
        });
        return url;
      } catch (error) {
        if (i === retries - 1) {
          throw new Error('Failed to get ngrok tunnel URL after retries. Please check if ngrok is running correctly.');
        }
        // 等待后重试
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw new Error('Failed to get ngrok tunnel URL');
  }

  /**
   * 启动 Cloudflare Tunnel（TODO: 待实现）
   */
  private async startCloudflare(_targetPort: number): Promise<string> {
    throw new Error('Cloudflare Tunnel is not yet implemented. Please use ngrok for now.');
  }

  /**
   * 启动 localtunnel（TODO: 待实现）
   */
  private async startLocaltunnel(_targetPort: number): Promise<string> {
    throw new Error('Localtunnel is not yet implemented. Please use ngrok for now.');
  }

  /**
   * 更新状态
   */
  private updateStatus(publicUrl: string, targetPort: number): void {
    this.status.running = true;
    this.status.publicUrl = publicUrl;
    this.status.localUrl = `http://localhost:${targetPort}`;
    this.status.provider = this.config.provider;
    this.status.startedAt = Date.now();
    this.status.error = null;

    this.log(`[Tunnel] Tunnel started successfully`);
    this.log(`[Tunnel] Public URL: ${publicUrl}`);
    this.log(`[Tunnel] Local URL: ${this.status.localUrl}`);

    this.emit('started', publicUrl);
  }
}

// 导出单例
let tunnelService: TunnelService | null = null;

export function getTunnelService(config?: Partial<TunnelConfig>): TunnelService {
  if (!tunnelService) {
    tunnelService = new TunnelService(config);
  }
  return tunnelService;
}
