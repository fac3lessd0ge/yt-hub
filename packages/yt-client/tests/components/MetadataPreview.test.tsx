import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetadataPreview } from "@/components/download/MetadataPreview";

describe("MetadataPreview", () => {
  const baseProps = {
    title: "Test Video Title",
    author: "Test Channel",
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    hasCoverArt: true,
  };

  it("renders the title and author", () => {
    render(<MetadataPreview {...baseProps} />);

    expect(screen.getByText("Test Video Title")).toBeInTheDocument();
    expect(screen.getByText("Test Channel")).toBeInTheDocument();
  });

  it("renders Title and Artist labels", () => {
    render(<MetadataPreview {...baseProps} />);

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Artist")).toBeInTheDocument();
  });

  it("renders the thumbnail image with meaningful alt text when thumbnailUrl is provided", () => {
    render(<MetadataPreview {...baseProps} />);

    const img = screen.getByAltText("Thumbnail for Test Video Title");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute(
      "src",
      "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    );
  });

  it("does not render an img element when thumbnailUrl is null", () => {
    render(<MetadataPreview {...baseProps} thumbnailUrl={null} />);

    expect(
      screen.queryByAltText("Thumbnail for Test Video Title"),
    ).not.toBeInTheDocument();
  });

  it("does not show the mp4 caveat when hasCoverArt is true (mp3 format)", () => {
    render(<MetadataPreview {...baseProps} hasCoverArt={true} />);

    expect(
      screen.queryByText(/no cover art embedded/i),
    ).not.toBeInTheDocument();
  });

  it("shows the mp4 caveat when hasCoverArt is false (mp4 format)", () => {
    render(<MetadataPreview {...baseProps} hasCoverArt={false} />);

    expect(screen.getByText(/no cover art embedded/i)).toBeInTheDocument();
  });

  it("has an accessible label for the preview region", () => {
    render(<MetadataPreview {...baseProps} />);

    expect(
      screen.getByRole("region", { name: "File tags preview" }),
    ).toBeInTheDocument();
  });
});
