export const dynamic = "force-dynamic";
import { z } from "zod";
import { requireAdmin } from "../../../../lib/auth";
import { handleApiError, failure, success } from "../../../../lib/api-response";
import { prisma } from "../../../../lib/prisma";

const announcementSchema = z
  .object({
    message: z.string().max(280).optional(),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.isActive && !data.message?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Announcement message is required when active",
        path: ["message"],
      });
    }
  });

export async function GET(request) {
  try {
    await requireAdmin(request, ["ADMIN"]);
    const announcement = await prisma.announcement.findFirst({
      orderBy: { updatedAt: "desc" },
    });
    return success({ announcement });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request) {
  try {
    await requireAdmin(request, ["ADMIN"]);
    const body = await request.json();
    const parsed = announcementSchema.safeParse(body);

    if (!parsed.success) {
      return failure("Invalid announcement payload", 400, { details: parsed.error.flatten() });
    }

    const message = parsed.data.message?.trim() || "";
    const isActive = parsed.data.isActive;
    const existing = await prisma.announcement.findFirst({
      orderBy: { updatedAt: "desc" },
    });

    const announcement = existing
      ? await prisma.announcement.update({
          where: { id: existing.id },
          data: { message, isActive },
        })
      : await prisma.announcement.create({
          data: { message, isActive },
        });

    if (isActive) {
      await prisma.announcement.updateMany({
        where: { id: { not: announcement.id }, isActive: true },
        data: { isActive: false },
      });
    }

    return success({ announcement });
  } catch (error) {
    return handleApiError(error);
  }
}