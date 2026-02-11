const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    family: 4, // Force IPv4
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS, // App Password
    },
    connectionTimeout: 10000, // 10 seconds timeout
    greetingTimeout: 5000,    // 5 seconds greeting timeout
    socketTimeout: 10000,     // 10 seconds socket timeout
});

const sendEmail = async (to, subject, html) => {
    try {
        const mailOptions = {
            from: process.env.GMAIL_USER || "your-email@gmail.com",
            to,
            subject,
            html,
        };
        const info = await transporter.sendMail(mailOptions);
        console.log("Email sent: " + info.response);
    } catch (error) {
        console.error("Error sending email:", error);
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
