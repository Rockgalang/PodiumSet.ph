import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params;
  if (!/^[A-Za-z0-9_-]+$/.test(fileId))
    return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(
      fileId
    )}&export=download`,
    302
  );
}