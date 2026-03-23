import { parseArgs } from "util";
import { Application } from "~/Application";
import { DependencyChecker, NodeBinaryResolver } from "~/dependencies";
import { InputValidator, CliInputReader, ConsolePrompter } from "~/input";
import { OutputPathBuilder } from "~/output";
import { BackendRegistry, YtDlpBackend } from "~/download";
import { NodeProcessSpawner } from "~/process";
import { HttpMetadataFetcher } from "~/metadata";
import { NodeFileSystem, ConsoleLogger } from "~/infra";

const logger = new ConsoleLogger();

// Register backends
const backends = new BackendRegistry();
backends.register(new YtDlpBackend(new NodeProcessSpawner()));

// Resolve --backend flag (defaults to yt-dlp)
const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { backend: { type: "string" } },
  strict: false,
});
const backendName = typeof values.backend === "string" ? values.backend : "yt-dlp";
const backend = backends.get(backendName);

if (!backend) {
  logger.error(
    `Error: Unknown backend "${backendName}". Available: ${backends.names().join(", ")}`
  );
  process.exit(1);
}

const app = new Application(
  new DependencyChecker(new NodeBinaryResolver()),
  new CliInputReader(backend, new ConsolePrompter()),
  new InputValidator(backend),
  new HttpMetadataFetcher(),
  backend,
  new OutputPathBuilder(),
  new NodeFileSystem(),
  logger
);

app.run();
