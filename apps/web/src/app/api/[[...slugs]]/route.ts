import { NextResponse } from "next/server";

const deprecated = () =>
  NextResponse.json(
    {
      error: "deprecated",
      message:
        "This API endpoint has been deprecated and is no longer operational. " +
        "The ActivityTrack API has moved to https://api.advantisgroup.de",
      movedTo: "https://api.advantisgroup.de",
    },
    {
      status: 410,
      headers: {
        "X-Deprecated": "true",
        "X-Moved-To": "https://api.advantisgroup.de",
      },
    },
  );

export const GET = deprecated;
export const POST = deprecated;
export const PUT = deprecated;
export const PATCH = deprecated;
export const DELETE = deprecated;

export const dynamic = "force-dynamic";
