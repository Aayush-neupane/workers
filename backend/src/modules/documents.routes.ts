import { Router } from "express";
import { z } from "zod";
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { pool, query } from "../db/pool.js";
import { validate } from "../middleware/validate.js";
import { ah } from "../middleware/async.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

const UPLOAD_ROOT = path.resolve("uploads", "verification");
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(UPLOAD_ROOT, req.user!.id);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only JPG, PNG, WebP or PDF"));
    }
  },
});

const KINDS = ["citizenship", "experience-letter", "certificate", "photo", "other"] as const;

// Worker submits a verification document. First upload moves the
// profile from awaiting-documents to under-review automatically.
router.post(
  "/worker/documents",
  requireAuth,
  requireRole("WORKER"),
  (req, res, next) => {
    upload.single("document")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  validate(z.object({ kind: z.enum(KINDS) })),
  ah(async (req, res) => {
    const file = (req as Express.Request & { file?: Express.Multer.File }).file;
    if (!file) return res.status(400).json({ error: "No file received" });
    const { kind } = req.body as { kind: string };
    const uid = req.user!.id;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const d = await client.query(
        `INSERT INTO verification_documents(worker_user_id, kind, storage_path)
         VALUES ($1, $2, $3) RETURNING id, uploaded_at`,
        [uid, kind, path.relative(process.cwd(), file.path)],
      );
      const prof = await client.query(
        `SELECT verification_state FROM worker_profiles WHERE user_id = $1`,
        [uid],
      );
      if (prof.rows[0]?.verification_state === "awaiting-documents") {
        await client.query(
          `UPDATE worker_profiles SET verification_state = 'under-review', updated_at = now() WHERE user_id = $1`,
          [uid],
        );
        await client.query(
          `INSERT INTO verification_records(worker_user_id, state, notes) VALUES ($1, 'under-review', 'Documents submitted by worker.')`,
          [uid],
        );
        await client.query(
          `INSERT INTO notifications(user_id, title, body)
           SELECT u.id, 'Documents submitted', 'A worker submitted verification documents.'
           FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
           WHERE r.name = 'ADMIN'`,
        );
      }
      await client.query("COMMIT");
      return res.status(201).json({ ok: true, id: (d.rows[0] as { id: string }).id });
    } catch (e) {
      await client.query("ROLLBACK");
      fs.rm(file.path, { force: true }, () => undefined);
      throw e;
    } finally {
      client.release();
    }
  }),
);

router.get(
  "/worker/documents/mine",
  requireAuth,
  requireRole("WORKER"),
  ah(async (req, res) => {
    const r = await query(
      `SELECT id, kind, uploaded_at FROM verification_documents WHERE worker_user_id = $1 ORDER BY uploaded_at`,
      [req.user!.id],
    );
    return res.json({ documents: r.rows });
  }),
);

// Admin review: metadata only — file bytes via the download route.
router.get(
  "/admin/workers/:id/documents",
  requireAuth,
  requireRole("ADMIN"),
  ah(async (req, res) => {
    const r = await query(
      `SELECT d.id, d.kind, d.uploaded_at, u.name AS worker_name
       FROM verification_documents d JOIN users u ON u.id = d.worker_user_id
       WHERE d.worker_user_id = $1 ORDER BY d.uploaded_at`,
      [req.params.id],
    );
    return res.json({ documents: r.rows });
  }),
);

router.get(
  "/admin/documents/:docId/download",
  requireAuth,
  requireRole("ADMIN"),
  ah(async (req, res) => {
    const r = await query(`SELECT storage_path FROM verification_documents WHERE id = $1`, [
      req.params.docId,
    ]);
    if (r.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const abs = path.resolve((r.rows[0] as { storage_path: string }).storage_path);
    if (!abs.startsWith(UPLOAD_ROOT)) return res.status(403).json({ error: "Forbidden" });
    return res.download(abs);
  }),
);

export default router;
