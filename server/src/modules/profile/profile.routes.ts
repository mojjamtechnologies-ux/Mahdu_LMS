import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { AppError } from '../../utils/AppError';
import { ok } from '../../utils/respond';
import * as s from './profile.service';

const h = (fn: (req: any) => Promise<unknown>, status = 200): RequestHandler => async (req, res) => { ok(res, await fn(req), status); };

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many uploads. Please wait a few minutes and try again.' } },
});
const mult = multer({ storage: multer.memoryStorage(), limits: { fileSize: s.AVATAR_MAX_BYTES, files: 1 } }).single('file');
// Runs multer, turning its errors into plain messages that mention the real 5 MB limit.
const upload: RequestHandler = (req, res, next) => {
  mult(req, res, (err: any) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'The picture is larger than 5 MB. Please choose a smaller one.', 'FILE_TOO_LARGE'));
    return next(new AppError(400, 'The upload could not be read. Send one picture in the "file" field.', 'BAD_UPLOAD'));
  });
};
const needFile = (req: any) => { if (!req.file) throw new AppError(400, 'Choose a picture to upload.', 'NO_FILE'); return req.file as { buffer: Buffer }; };
const idParam = z.object({ id: z.string().uuid() });

const r = Router();
r.use(authenticate);

r.get('/me', h((q) => s.getProfile(q.user.id)));
r.patch('/me', validate({ body: z.object({ phone: z.string().trim().max(30).nullable() }) }), h((q) => s.updateOwnPhone(q.user.id, q.validated.body.phone || null, q.ip)));

// Your own picture. Always the signed-in user: no id is accepted, so nobody can change someone else's through these.
r.post('/avatar', limiter, upload, h((q) => s.setAvatar(q.user.id, q.user, needFile(q), q.ip)));
r.delete('/avatar', h((q) => s.removeAvatar(q.user.id, q.user, q.ip)));

// Administrators can set or remove anyone's picture (for example a new student who has not signed in yet).
r.post('/users/:id/avatar', requireRole('admin'), limiter, validate({ params: idParam }), upload, h((q) => s.setAvatar(q.validated.params.id, q.user, needFile(q), q.ip)));
r.delete('/users/:id/avatar', requireRole('admin'), validate({ params: idParam }), h((q) => s.removeAvatar(q.validated.params.id, q.user, q.ip)));

// Reading a picture: fetched with the sign-in token and shown from memory by the Avatar component.
r.get('/users/:id/avatar', validate({ params: idParam }), async (req, res) => {
  const buf = await s.readAvatar(req.user!, req.validated.params.id);
  res.setHeader('Content-Type', 'image/jpeg');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.send(buf);
});

export default r;
