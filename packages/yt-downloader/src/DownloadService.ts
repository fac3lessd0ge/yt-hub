import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import type { YtDlpConfig } from "~/config";
import type { IBinaryResolver } from "~/dependencies";
import { DependencyChecker, NodeBinaryResolver } from "~/dependencies";
import type {
  FormatInfo,
  IDownloadBackend,
  ProgressCallback,
} from "~/download";
import { BackendRegistry, YtDlpBackend } from "~/download";
import { ConsoleLogger } from "~/infra/implementations/ConsoleLogger";
import type { ILogger } from "~/infra/types/ILogger";
import { ValidationError } from "~/input";
import type { IMetadataFetcher, VideoMetadata } from "~/metadata";
import { HttpMetadataFetcher } from "~/metadata";
import { OutputPathBuilder, buildStorageStem } from "~/output";
import { NodeProcessSpawner } from "~/process";

export interface DownloadParams {
  link: string;
  format: string;
  name: string;
  destination?: string;
  backend?: string;
}

export interface DownloadResult {
  outputPath: string;
  metadata: VideoMetadata;
  format: FormatInfo;
}

const DEFAULT_DESTINATION = resolve(homedir(), "Downloads", "yt-downloader");

export class DownloadService {
  private backends: BackendRegistry;
  private activeBackend: IDownloadBackend;
  private metadataFetcher: IMetadataFetcher;
  private dependencyChecker: DependencyChecker;
  private outputPathBuilder: OutputPathBuilder;
  private logger: ILogger;

  constructor(
    options: {
      backend?: string;
      binaryResolver?: IBinaryResolver;
      metadataFetcher?: IMetadataFetcher;
      backends?: BackendRegistry;
      ytDlpConfig?: YtDlpConfig;
      logger?: ILogger;
    } = {},
  ) {
    this.backends =
      options.backends ?? DownloadService.defaultBackends(options.ytDlpConfig);
    this.metadataFetcher = options.metadataFetcher ?? new HttpMetadataFetcher();
    this.dependencyChecker = new DependencyChecker(
      options.binaryResolver ?? new NodeBinaryResolver(),
    );
    this.outputPathBuilder = new OutputPathBuilder();
    this.logger = options.logger ?? new ConsoleLogger();

    const backendName = options.backend ?? "yt-dlp";
    const backend = this.backends.get(backendName);
    if (!backend) {
      throw new Error(
        `Unknown backend "${backendName}". Available: ${this.backends.names().join(", ")}`,
      );
    }
    this.activeBackend = backend;
  }

  async download(
    params: DownloadParams,
    onProgress?: ProgressCallback,
    signal?: AbortSignal,
  ): Promise<DownloadResult> {
    this.validateParams(params);

    this.dependencyChecker.check(this.activeBackend.requiredDependencies());

    const metadata = await this.metadataFetcher.fetch(params.link, signal);

    const format = this.activeBackend
      .supportedFormats()
      .find((f) => f.id === params.format.toLowerCase());
    if (!format) throw new ValidationError(`Unknown format: ${params.format}`);

    const destination = resolve(params.destination ?? DEFAULT_DESTINATION);
    mkdirSync(destination, { recursive: true });

    const stem = buildStorageStem(
      params.link,
      params.format.toLowerCase(),
      params.name,
    );
    const outputPath = this.outputPathBuilder.buildStorage(
      stem,
      params.format.toLowerCase(),
      destination,
      existsSync,
    );

    await this.activeBackend.download(
      params.link,
      outputPath,
      params.format.toLowerCase(),
      onProgress,
      signal,
    );

    return { outputPath, metadata, format };
  }

  async getMetadata(link: string): Promise<VideoMetadata> {
    return this.metadataFetcher.fetch(link);
  }

  listFormats(): FormatInfo[] {
    return this.activeBackend.supportedFormats();
  }

  listBackends(): string[] {
    return this.backends.names();
  }

  // URL validation is handled at the API gateway (yt-api/src/validation.rs).
  // CLI path validates via InputValidator. DownloadService only checks
  // required fields and format support.
  private validateParams(params: DownloadParams): void {
    if (!params.link || !params.name) {
      throw new ValidationError("link and name are required.");
    }

    if (!params.format) {
      throw new ValidationError("format is required.");
    }

    const formatId = params.format.toLowerCase();
    const supportedIds = this.activeBackend.supportedFormats().map((f) => f.id);
    if (!supportedIds.includes(formatId)) {
      throw new ValidationError(
        `Unsupported format "${params.format}". Use ${supportedIds.join(" or ")}.`,
      );
    }
  }

  private static defaultBackends(ytDlpConfig?: YtDlpConfig): BackendRegistry {
    const registry = new BackendRegistry();
    registry.register(new YtDlpBackend(new NodeProcessSpawner(), ytDlpConfig));
    return registry;
  }
}
