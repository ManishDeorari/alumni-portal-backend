const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER || process.env.GMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.GMAIL_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
});

const sendEmail = async (to, subject, html) => {
    if (process.env.DISABLE_EMAIL === "true") return;

    try {
        const fromEmail = process.env.SMTP_USER || process.env.GMAIL_USER || "manishdeorari377@gmail.com";
        console.log(`📧 Sending email to ${to}...`);

        const mailOptions = {
            from: fromEmail,
            to,
            subject,
            html,
        };
        await transporter.sendMail(mailOptions);
        console.log(`✅ Email sent to ${to}`);
    } catch (error) {
        console.error("❌ Email error:", error.message);
    }
};

const sendApprovalEmail = async (user) => {
    const subject = "Account Approved - Alumni Portal";
    const html = `
    <h3>Congratulations ${user.name}!</h3>
    <p>Your account has been approved by the admin.</p>
    <p>You can now login to the <a href="${process.env.CLIENT_URL || 'http://localhost:3000'}">Alumni Portal</a>.</p>
    <br>
    <p>Best Regards,<br>Alumni Portal Team</p>
  `;
    await sendEmail(user.email, subject, html);
};

const sendRejectionEmail = async (user) => {
    const subject = "Account Application Update - Alumni Portal";
    const html = `
    <h3>Hello ${user.name},</h3>
    <p>We regret to inform you that your account application for the Alumni Portal has been rejected.</p>
    <p>If you think this is a mistake, please contact the administration.</p>
    <br>
    <p>Best Regards,<br>Alumni Portal Team</p>
  `;
    await sendEmail(user.email, subject, html);
};

const sendOTPEmail = async (email, otp) => {
    const subject = "Password Reset OTP - Alumni Portal";
    const html = `
    <h3>Password Reset Request</h3>
    <p>Your OTP for password reset is: <strong>${otp}</strong></p>
    <p>This OTP is valid for 60 seconds.</p>
    <p>If you did not request this, please ignore this email.</p>
    <br>
    <p>Best Regards,<br>Alumni Portal Team</p>
  `;
    await sendEmail(email, subject, html);
};

module.exports = { sendApprovalEmail, sendRejectionEmail, sendOTPEmail };
