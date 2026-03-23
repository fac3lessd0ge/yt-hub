import { type DependencyChecker, DependencyError } from "~/dependencies";
import type { IDownloadBackend } from "~/download";
import { DownloadError } from "~/download";
import type { IFileSystem, ILogger } from "~/infra";
import type { IInputReader } from "~/input";
import { type InputValidator, ValidationError } from "~/input";
import type { IMetadataFetcher } from "~/metadata";
import { MetadataError } from "~/metadata";
import type { OutputPathBuilder } from "~/output";

export class Application {
  constructor(
    private dependencyChecker: DependencyChecker,
    private inputReader: IInputReader,
    private validator: InputValidator,
    private metadataFetcher: IMetadataFetcher,
    private backend: IDownloadBackend,
    private outputPathBuilder: OutputPathBuilder,
    private fileSystem: IFileSystem,
    private logger: ILogger,
  ) {}

  async run(): Promise<void> {
    try {
      this.dependencyChecker.check(this.backend.requiredDependencies());

      const raw = this.inputReader.read();
      const input = this.validator.validate(raw);

      const metadata = await this.metadataFetcher.fetch(input.link);
      this.logger.info(`Found: "${metadata.title}" by ${metadata.authorName}`);

      const formatInfo = this.backend
        .supportedFormats()
        .find((f) => f.id === input.formatId)!;
      this.fileSystem.mkdirRecursive(input.destination);
      const outputPath = this.outputPathBuilder.build(
        input.name,
        input.formatId,
        input.destination,
      );

      this.logger.info(`Downloading as ${formatInfo.label}: ${input.link}`);
      this.logger.info(`Output: ${outputPath}\n`);

      await this.backend.download(input.link, outputPath, input.formatId);

      this.logger.info(`\nDone! Saved to: ${outputPath}`);
    } catch (error) {
      if (error instanceof DownloadError) {
        this.logger.error(`\n${error.message}`);
        process.exit(error.exitCode);
      }
      if (
        error instanceof ValidationError ||
        error instanceof DependencyError ||
        error instanceof MetadataError
      ) {
        this.logger.error(`Error: ${error.message}`);
        process.exit(1);
      }
      this.logger.error(`Unexpected error: ${error}`);
      process.exit(1);
    }
  }
}
