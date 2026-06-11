import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBrowserBarcodeDetector,
  isBrowserCameraPreviewSupported,
  isBrowserCameraScanSupported,
} from "./browserBarcodeScanner";

describe("browserBarcodeScanner", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports support when media devices and BarcodeDetector exist", () => {
    class FakeBarcodeDetector {
      detect() {
        return Promise.resolve([]);
      }
    }

    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(),
      },
    });
    vi.stubGlobal("BarcodeDetector", FakeBarcodeDetector);

    expect(isBrowserCameraScanSupported()).toBe(true);
    expect(isBrowserCameraPreviewSupported()).toBe(true);
    expect(createBrowserBarcodeDetector()).toBeInstanceOf(FakeBarcodeDetector);
  });

  it("still reports camera preview support when BarcodeDetector is missing", () => {
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(),
      },
    });
    vi.stubGlobal("BarcodeDetector", undefined);

    expect(isBrowserCameraScanSupported()).toBe(false);
    expect(isBrowserCameraPreviewSupported()).toBe(true);
    expect(createBrowserBarcodeDetector()).toBeNull();
  });

  it("reports preview unsupported when getUserMedia is missing", () => {
    vi.stubGlobal("navigator", {});

    expect(isBrowserCameraPreviewSupported()).toBe(false);
    expect(isBrowserCameraScanSupported()).toBe(false);
  });
});
