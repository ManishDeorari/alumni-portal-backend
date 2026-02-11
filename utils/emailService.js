const nodemailer = require("nodemailer");

console.log("🚀 Initializing Email Service...");
console.log("   - SMTP_HOST:", process.env.SMTP_HOST || "smtp-relay.brevo.com");
console.log("   - SMTP_PORT:", process.env.SMTP_PORT || "587");
console.log("   - SMTP_USER:", process.env.SMTP_USER ? `${process.env.SMTP_USER.substring(0, 3)}***` : "MISSING");
console.log("   - SMTP_PASS:", process.env.SMTP_PASS ? "PRESENT (Length: " + process.env.SMTP_PASS.length + ")" : "MISSING");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: {
        rejectUnauthorized: false // Helps in some restricted environments
    }
});

// Verify connection configuration
transporter.verify(function (error, success) {
    if (error) {
        console.log("❌ SMTP Verification Failed!");
        console.log("   - Error Message:", error.message);
        console.log("   - Error Code:", error.code);
        console.log("   - Response:", error.response);
    } else {
        console.log("✅ SMTP Server Connection Verified - Ready to send emails");
    }
});

const sendEmail = async (to, subject, html) => {
    if (process.env.DISABLE_EMAIL === "true") return;

    try {
        // Use a verified sender email. Brevo login (SMTP_USER) is often different from the sender email.
        const fromEmail = process.env.EMAIL_FROM || "manishdeorari377@gmail.com";
        console.log(`📧 Sending email to ${to} from ${fromEmail}...`);

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
