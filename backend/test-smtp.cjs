require('dotenv').config({ path: __dirname + '/.env' });
const nodemailer = require('nodemailer');

(async () => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,              // smtp.sendgrid.net
    port: Number(process.env.SMTP_PORT),      // 587
    secure: process.env.SMTP_SECURE === 'true', // false amb 587
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, // apikey / SG....
  });

  const fromEmail = process.env.FROM_EMAIL || 'botmailmonitorip@gmail.com';

  console.log('DEBUG SG KEY PREFIX =>', (process.env.SMTP_PASS || '').slice(0, 12));
  console.log('DEBUG FROM =>', fromEmail);
  console.log('DEBUG SMTP USER =>', process.env.SMTP_USER);

  const info = await transporter.sendMail({
    from: fromEmail,                                 // <-- sense nom
    to: 'mcarrere@bcn.cats',
    subject: 'Prova SMTP (mínim)',
    text: 'Funciona!',
    envelope: { from: fromEmail, to: 'EL_TEU_CORREU@exemple.com' }, // <-- forcem MAIL FROM
  });

  console.log('Enviat:', info.messageId);
})().catch(console.error);
