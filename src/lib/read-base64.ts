/** A picked file as base64, for an upload inside a JSON body. */
export async function readBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let text = '';
  // In slices, so a large photo doesn't overflow the call stack.
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
