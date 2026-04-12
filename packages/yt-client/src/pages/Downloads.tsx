import type { RedownloadRequest } from "@/App";
import { DownloadPage } from "@/components/download/DownloadPage";

interface DownloadsProps {
  consumeRedownload?: () => RedownloadRequest | null;
}

export function Downloads({ consumeRedownload }: DownloadsProps) {
  return <DownloadPage consumeRedownload={consumeRedownload} />;
}
