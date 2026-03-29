import { status as GrpcStatus } from "@grpc/grpc-js";
import { describe, expect, it } from "vitest";
import { RequestValidator } from "~/handlers/requestValidator";

describe("RequestValidator", () => {
  const validator = new RequestValidator();

  describe("validateMetadataRequest", () => {
    it("throws with INVALID_ARGUMENT when link is empty string", () => {
      expect(() => validator.validateMetadataRequest({ link: "" })).toThrow(
        "link is required",
      );
      try {
        validator.validateMetadataRequest({ link: "" });
      } catch (err: any) {
        expect(err.code).toBe(GrpcStatus.INVALID_ARGUMENT);
      }
    });

    it("throws with INVALID_ARGUMENT when link is undefined", () => {
      expect(() => validator.validateMetadataRequest({})).toThrow(
        "link is required",
      );
    });

    it("throws with INVALID_ARGUMENT when link is whitespace only", () => {
      expect(() => validator.validateMetadataRequest({ link: "   " })).toThrow(
        "link is required",
      );
    });

    it("does not throw for a valid link", () => {
      expect(() =>
        validator.validateMetadataRequest({
          link: "https://www.youtube.com/watch?v=abc",
        }),
      ).not.toThrow();
    });
  });

  describe("validateDownloadRequest", () => {
    it("throws when link is missing", () => {
      expect(() =>
        validator.validateDownloadRequest({
          format: "mp3",
          name: "test",
        }),
      ).toThrow("link is required");
    });

    it("throws when format is missing", () => {
      expect(() =>
        validator.validateDownloadRequest({
          link: "https://www.youtube.com/watch?v=abc",
          name: "test",
        }),
      ).toThrow("format is required");
    });

    it("throws when name is missing", () => {
      expect(() =>
        validator.validateDownloadRequest({
          link: "https://www.youtube.com/watch?v=abc",
          format: "mp3",
        }),
      ).toThrow("name is required");
    });

    it("throws when all fields are empty strings", () => {
      expect(() =>
        validator.validateDownloadRequest({
          link: "",
          format: "",
          name: "",
        }),
      ).toThrow("link is required");
    });

    it("attaches INVALID_ARGUMENT gRPC status code to thrown errors", () => {
      try {
        validator.validateDownloadRequest({});
      } catch (err: any) {
        expect(err.code).toBe(GrpcStatus.INVALID_ARGUMENT);
      }
    });

    it("does not throw when all fields are provided", () => {
      expect(() =>
        validator.validateDownloadRequest({
          link: "https://www.youtube.com/watch?v=abc",
          format: "mp3",
          name: "test",
        }),
      ).not.toThrow();
    });
  });
});
