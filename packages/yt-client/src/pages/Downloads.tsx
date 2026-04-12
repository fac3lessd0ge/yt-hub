import { DownloadPage } from "@/components/download/DownloadPage";
import type { RedownloadRequest } from "@/App";

interface DownloadsProps {
  consumeRedownload?: () => RedownloadRequest | null;
}

export function Downloads({ consumeRedownload }: DownloadsProps) {
  return <DownloadPage consumeRedownload={consumeRedownload} />;
}
