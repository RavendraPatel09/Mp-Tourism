import { NextResponse } from "next/server";

/** Response helpers shared by the mock handlers, matching PRD §8 conventions. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function notFound(message = "Resource not found") {
  return NextResponse.json(
    { error: { code: "NOT_FOUND", message } },
    { status: 404 },
  );
}

export function badRequest(message: string) {
  return NextResponse.json(
    { error: { code: "BAD_REQUEST", message } },
    { status: 400 },
  );
}
