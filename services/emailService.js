const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.APP_PASSWORD,
  },
});

async function sendOtpEmail(to, otp) {
  await transporter.sendMail({
    from: `"Lisa Kookt" <${process.env.EMAIL}>`,
    to,
    subject: 'Uw verificatiecode – Lisa Kookt',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;padding:32px;">
        <h2 style="color:#7C866E;margin:0 0 8px;">Verificatiecode</h2>
        <p style="color:#6b7280;margin:0 0 24px;">Gebruik de onderstaande code om uw e-mailadres te bevestigen. De code is 10 minuten geldig.</p>
        <div style="background:#F3F5F1;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
          <span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#1f2937;">${otp}</span>
        </div>
        <p style="color:#9ca3af;font-size:13px;margin:0;">Als u geen account heeft aangemaakt, kunt u deze e-mail negeren.</p>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail };
