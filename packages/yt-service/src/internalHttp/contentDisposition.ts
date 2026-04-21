import contentDisposition from "content-disposition";

export function attachmentFor(filename: string): string {
  return contentDisposition(filename, { type: "attachment" });
}
