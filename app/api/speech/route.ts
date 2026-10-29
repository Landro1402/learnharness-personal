// LearnHarness Personal modifications maintained by Landro1402, 2026-10-29. See NOTICE.md and LICENSE (AGPL-3.0-only).
import { speechResponse, speechStatus } from "@/src/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = speechStatus;
export const POST = speechResponse;
