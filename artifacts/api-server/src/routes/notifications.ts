import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";

const router: IRouter = Router();

router.get(
  "/notifications",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const rows = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, req.user!.id))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(30);

    res.json({ notifications: rows });
  },
);

router.put(
  "/notifications/read-all",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await db
      .update(notificationsTable)
      .set({ read: true })
      .where(
        and(
          eq(notificationsTable.userId, req.user!.id),
          eq(notificationsTable.read, false),
        ),
      );

    res.json({ ok: true });
  },
);

router.put(
  "/notifications/:id/read",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid notification ID" });
      return;
    }

    const [notif] = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(
        and(
          eq(notificationsTable.id, id),
          eq(notificationsTable.userId, req.user!.id),
        ),
      )
      .returning();

    if (!notif) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json({ ok: true });
  },
);

export default router;
