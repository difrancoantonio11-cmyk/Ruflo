/** SMTP transport. One place so credentials are read once and never logged. */

import nodemailer from 'nodemailer';
import type { Config } from '../config.js';

export async function sendMail(
  config: Config,
  message: { subject: string; html: string; text: string },
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });

  await transport.sendMail({
    from: config.mailFrom,
    to: config.mailTo,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
