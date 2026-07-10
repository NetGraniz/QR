export type LoadedImage = {
  image: HTMLImageElement;
  imageData: ImageData;
  objectUrl: string;
};

const SUPPORTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];

export function validateScanImageFile(file: File): string | null {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type) && !/\.(png|jpe?g|svg|webp)$/i.test(file.name)) {
    return "Поддерживаются изображения PNG, JPG, JPEG, SVG и WebP.";
  }

  if (file.size > 8 * 1024 * 1024) {
    return "Файл слишком большой. Выберите изображение до 8 МБ.";
  }

  return null;
}

export async function loadImageFile(file: File): Promise<LoadedImage> {
  const error = validateScanImageFile(file);
  if (error) {
    throw new Error(error);
  }

  const objectUrl = URL.createObjectURL(file);
  const image = await loadImage(objectUrl);
  const imageData = imageToImageData(image);
  return { image, imageData, objectUrl };
}

export function imageToImageData(image: CanvasImageSource): ImageData {
  const { width, height } = getSourceSize(image);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("Canvas недоступен для чтения изображения.");
  }
  context.drawImage(image, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

function getSourceSize(image: CanvasImageSource): { width: number; height: number } {
  if (image instanceof HTMLImageElement) {
    return { width: Math.max(1, image.naturalWidth), height: Math.max(1, image.naturalHeight) };
  }
  if (image instanceof HTMLVideoElement) {
    return { width: Math.max(1, image.videoWidth), height: Math.max(1, image.videoHeight) };
  }
  if (image instanceof SVGImageElement) {
    return { width: Math.max(1, Math.round(image.width.baseVal.value)), height: Math.max(1, Math.round(image.height.baseVal.value)) };
  }

  const sized = image as HTMLCanvasElement | ImageBitmap | OffscreenCanvas;
  return { width: Math.max(1, Math.round(sized.width)), height: Math.max(1, Math.round(sized.height)) };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error("Не удалось загрузить изображение.")));
    image.src = src;
  });
}
