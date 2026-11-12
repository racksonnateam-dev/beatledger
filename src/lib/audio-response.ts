export function audioResponse(bytes: Buffer, mimeType: string, filename: string, request: Request) {
  const safeName = filename.replace(/[^\w.\- ]+/g, "") || "audio";
  const payload = new Uint8Array(bytes);
  const size = payload.byteLength;
  const headers = {
    "Content-Type": mimeType || "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Disposition": `inline; filename="${safeName}"`,
    "X-Content-Type-Options": "nosniff",
  };
  const range = request.headers.get("range");
  if (!range) {
    return new Response(payload, { status: 200, headers: { ...headers, "Content-Length": String(size) } });
  }
  const match = /^bytes=(\d+)-(\d*)$/.exec(range);
  if (!match) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= size || end < start || end >= size) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
  }
  const slice = payload.subarray(start, end + 1);
  return new Response(slice, {
    status: 206,
    headers: {
      ...headers,
      "Content-Length": String(slice.byteLength),
      "Content-Range": `bytes ${start}-${end}/${size}`,
    },
  });
}
