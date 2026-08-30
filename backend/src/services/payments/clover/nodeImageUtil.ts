// remote-pay-cloud's IImageUtil interface isn't re-exported from its public
// entrypoint (only the concrete browser-oriented ImageUtil class is), so this
// mirrors its shape locally rather than reaching into internal type paths.
interface IImageUtil {
  getBase64Image(img: unknown, onEncode: (response: unknown) => void): void;
  loadImageFromURL(url: string, onLoad: (image: unknown) => void, onError: (errorMessage: string) => void): void;
}

/**
 * We never show receipt images/logos on the device from this backend, so
 * this just satisfies CloverDeviceConfiguration's required IImageUtil without
 * pulling in a DOM (Image/canvas) dependency that doesn't exist in Node.
 */
export class NodeImageUtil implements IImageUtil {
  getBase64Image(_img: unknown, onEncode: (response: unknown) => void): void {
    onEncode(null);
  }

  loadImageFromURL(_url: string, _onLoad: (image: unknown) => void, onError: (errorMessage: string) => void): void {
    onError("Image loading is not supported in the BlueBite backend Clover integration");
  }
}
