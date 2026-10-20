import { Router, type IRouter, type Request, type Response } from "express";
import { NotificationModel } from "@workspace/db";

const router: IRouter = Router();

function parseId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = parseInt(raw ?? "", 10);
  return Number.isNaN(id) ? null : id;
}

router.get(
  "/notifications",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const rows = await NotificationModel.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    res.json({
      notifications: rows.map((n) => ({
        id: n.id,
        userId: n.userId,
        message: n.message,
        read: n.read,
        vacationId: n.vacationId,
        employeeId: n.employeeId,
        createdAt: n.createdAt,
      })),
    });
  },
);

router.put(
  "/notifications/read-all",
  async (req: Request, res: Response): Promise<void> => {
    if (!req.isAuthenticated()) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    await NotificationModel.updateMany(
      { userId: req.user!.id, read: false },
      { $set: { read: true } },
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

    const id = parseId(req.params.id);
    if (id === null) {
      res.status(400).json({ error: "Invalid notification ID" });
      return;
    }

    const notif = await NotificationModel.findOneAndUpdate(
      { id, userId: req.user!.id },
      { $set: { read: true } },
      { new: true },
    ).lean();

    if (!notif) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }

    res.json({ ok: true });
  },
);

export default router;
