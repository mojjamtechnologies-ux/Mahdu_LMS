import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AppError } from '../../utils/AppError';
import { ok } from '../../utils/respond';
import * as s from './idcards.service';
import * as tpl from './idcards.template';
import { prepareCardsPdf } from './idcards.pdf';

const h = (fn: (req: any) => Promise<unknown>, status = 200): RequestHandler => async (req, res) => { ok(res, await fn(req), status); };
const uuid = z.string().uuid();
const idParam = z.object({ id: uuid });
const role = z.enum(['admin', 'teacher', 'student', 'parent']);
const page = { page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25) };

const usersQuery = z.object({
  role: role.optional(), classId: uuid.optional(), sessionId: uuid.optional(), q: z.string().trim().max(80).optional(),
  card: z.enum(['any', 'has', 'missing', 'expired', 'revoked', 'suspended']).optional(), ...page,
});
const generateBody = z.object({
  userIds: z.array(uuid).max(1000).optional(),
  filter: z.object({ role: role.optional(), classId: uuid.optional(), sessionId: uuid.optional(), q: z.string().trim().max(80).optional(), card: z.enum(['any', 'has', 'missing', 'expired', 'revoked', 'suspended']).optional() }).optional(),
  mode: z.enum(['missing', 'replace']).default('missing'),
}).refine((b) => (b.userIds && b.userIds.length) || b.filter, { message: 'Choose who to generate cards for.' });
const pdfBody = z.object({ cardIds: z.array(uuid).min(1).max(200), layout: z.enum(['cards', 'sheet']).default('sheet') });
const scanBody = z.object({ code: z.string().trim().min(1).max(300), method: z.enum(['qr', 'manual']).default('qr') });

const logoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('file');
const upload: RequestHandler = (req, res, next) => logoUpload(req, res, (err: any) => {
  if (!err) return next();
  next(new AppError(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400, err.code === 'LIMIT_FILE_SIZE' ? 'The logo is larger than 5 MB.' : 'Send one picture in the "file" field.', 'BAD_UPLOAD'));
});

// A person can scan many cards in a row at a school gate, but a script guessing codes is stopped.
const scanLimiter = rateLimit({
  windowMs: 60 * 1000, limit: 90, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many scans. Please wait a minute and try again.' } },
});

// Lookups run first so any failure is normal JSON; only then is the PDF streamed.
const sendPdf = async (res: any, faces: s.CardFace[], layout: 'cards' | 'sheet') => {
  const pdf = await prepareCardsPdf(faces, layout);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  pdf.render(res);
};

const r = Router();
r.use(authenticate, requireRole('admin'));

r.get('/users', validate({ query: usersQuery }), h((q) => s.listUsers(q.validated.query)));
r.post('/generate', validate({ body: generateBody }), h((q) => s.generate(q.validated.body, q.user.id, q.ip), 201));
r.get('/history', validate({ query: z.object({ userId: uuid.optional(), status: z.enum(['active', 'suspended', 'revoked', 'replaced', 'expired']).optional(), ...page }) }), h((q) => s.history(q.validated.query)));

r.get('/template', h(() => tpl.getTemplate()));
r.put('/template', validate({ body: tpl.templateSchema }), h((q) => tpl.updateTemplate(q.validated.body, q.user.id, q.ip)));
r.post('/template/logo', upload, h((q) => { if (!q.file) throw new AppError(400, 'Choose a logo to upload.', 'NO_FILE'); return tpl.setLogo(q.file.buffer, q.user.id, q.ip); }));
r.delete('/template/logo', h((q) => tpl.removeLogo(q.user.id, q.ip)));
r.get('/template/logo', async (_req, res) => {
  const b = await tpl.readLogo();
  if (!b) throw new AppError(404, 'No logo', 'NOT_FOUND');
  res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'private, no-store'); res.send(b);
});

r.post('/preview', validate({ body: z.object({ userId: uuid }) }), h(async (q) => s.faceWithQr(await s.previewForUser(q.validated.body.userId))));
r.post('/pdf', validate({ body: pdfBody }), async (req, res) => { await sendPdf(res, await s.facesByCardIds(req.validated.body.cardIds), req.validated.body.layout); });

r.post('/scan', scanLimiter, validate({ body: scanBody }), h((q) => s.scan(q.validated.body.code, q.validated.body.method, q.user.id, q.ip)));
r.get('/scans', h(() => s.recentScans(25)));

r.get('/:id/preview', validate({ params: idParam }), h(async (q) => s.faceWithQr((await s.facesByCardIds([q.validated.params.id]))[0]!)));
r.get('/:id/pdf', validate({ params: idParam }), async (req, res) => { await sendPdf(res, await s.facesByCardIds([req.validated.params.id]), 'cards'); });
r.post('/:id/revoke', validate({ params: idParam, body: z.object({ reason: z.string().trim().max(200).optional() }) }), h((q) => s.revoke(q.validated.params.id, q.validated.body.reason, q.user.id, q.ip)));
r.post('/:id/suspend', validate({ params: idParam }), h((q) => s.setSuspended(q.validated.params.id, true, q.user.id, q.ip)));
r.post('/:id/reactivate', validate({ params: idParam }), h((q) => s.setSuspended(q.validated.params.id, false, q.user.id, q.ip)));

export default r;
