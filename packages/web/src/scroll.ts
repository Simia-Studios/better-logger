export const roundToDevicePixel = (value: number, ratio = globalThis.devicePixelRatio || 1) => {
  return Math.round(value * ratio) / ratio;
};
